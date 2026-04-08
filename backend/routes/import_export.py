import csv
import io
from datetime import datetime

from flask import Blueprint, jsonify, request, send_file
from flask_login import current_user, login_required

from ..extensions import db
from ..models import Category, Department, Expense, Income, OperationDimension, Project, TransactionMeta
from ..scope import get_scope_user_id
from ..utils import log_action

try:
    import openpyxl
except Exception:
    openpyxl = None


import_export_bp = Blueprint("import_export_bp", __name__, url_prefix="/api")


def _ensure_default_category(kind, scope_user_id):
    category_type = "income" if kind == "income" else "expense"
    default_name = "Прочие доходы" if kind == "income" else "Прочие затраты"
    category = Category.query.filter_by(user_id=scope_user_id, type=category_type, name=default_name).first()
    if category:
        return category
    category = Category(user_id=scope_user_id, type=category_type, name=default_name)
    db.session.add(category)
    db.session.flush()
    return category


def _ensure_default_department(scope_user_id):
    default_name = "Не указано"
    department = Department.query.filter_by(user_id=scope_user_id, name=default_name).first()
    if department:
        return department
    department = Department(user_id=scope_user_id, name=default_name)
    db.session.add(department)
    db.session.flush()
    return department


def _serialize_rows(rows):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "amount", "date", "category_id"])
    for row in rows:
        writer.writerow([row.id, row.amount, row.date.isoformat(), row.category_id])
    output.seek(0)
    return output


def _serialize_xlsx(rows):
    if not openpyxl:
        return None
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["id", "amount", "date", "category_id"])
    for row in rows:
        ws.append([row.id, row.amount, row.date.isoformat(), row.category_id])
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


@import_export_bp.route("/export/<string:kind>", methods=["GET"])
@login_required
def export_data(kind):
    scope_user_id = get_scope_user_id(current_user.id)
    if kind not in ("income", "expense"):
        return jsonify({"message": "Invalid export type"}), 400

    fmt = request.args.get("format", "csv")
    model = Income if kind == "income" else Expense
    rows = model.query.filter_by(user_id=scope_user_id).order_by(model.date.desc()).all()

    if fmt == "xlsx":
        xlsx = _serialize_xlsx(rows)
        if xlsx is None:
            return jsonify({"message": "openpyxl not installed"}), 500
        log_action("export", kind, None, {"format": "xlsx"})
        db.session.commit()
        return send_file(
            xlsx,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name=f"{kind}.xlsx",
        )

    csv_file = _serialize_rows(rows)
    log_action("export", kind, None, {"format": "csv"})
    db.session.commit()
    return send_file(
        io.BytesIO(csv_file.getvalue().encode("utf-8")),
        mimetype="text/csv",
        as_attachment=True,
        download_name=f"{kind}.csv",
    )


def _parse_csv(file_storage):
    content = file_storage.stream.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    return list(reader)


def _parse_xlsx(file_storage):
    if not openpyxl:
        return None
    wb = openpyxl.load_workbook(file_storage)
    ws = wb.active
    headers = [cell.value for cell in next(ws.iter_rows(min_row=1, max_row=1))]
    rows = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        rows.append(dict(zip(headers, row)))
    return rows


def _resolve_department(row, default_department, scope_user_id):
    department_id = row.get("department_id")
    department_name = (row.get("department_name") or "").strip()
    department = None

    if department_id:
        department = Department.query.filter_by(id=int(department_id), user_id=scope_user_id).first()
    elif department_name:
        department = Department.query.filter_by(user_id=scope_user_id, name=department_name).first()
        if not department:
            department = Department(user_id=scope_user_id, name=department_name)
            db.session.add(department)
            db.session.flush()

    return department or default_department


def _resolve_project(row, scope_user_id):
    project_id = row.get("project_id")
    project_name = (row.get("project_name") or "").strip()
    project = None

    if project_id:
        project = Project.query.filter_by(id=int(project_id), user_id=scope_user_id).first()
    elif project_name:
        project = Project.query.filter_by(user_id=scope_user_id, name=project_name).first()
        if not project:
            project = Project(user_id=scope_user_id, name=project_name)
            db.session.add(project)
            db.session.flush()

    return project


@import_export_bp.route("/import/<string:kind>", methods=["POST"])
@login_required
def import_data(kind):
    scope_user_id = get_scope_user_id(current_user.id)
    if kind not in ("income", "expense"):
        return jsonify({"message": "Invalid import type"}), 400
    if "file" not in request.files:
        return jsonify({"message": "file is required"}), 400

    file_storage = request.files["file"]
    filename = file_storage.filename or ""
    fmt = "xlsx" if filename.endswith(".xlsx") else "csv"

    if fmt == "xlsx":
        rows = _parse_xlsx(file_storage)
        if rows is None:
            return jsonify({"message": "openpyxl not installed"}), 500
    else:
        rows = _parse_csv(file_storage)

    model = Income if kind == "income" else Expense
    expected_type = "income" if kind == "income" else "expense"
    created = 0
    default_department = _ensure_default_department(scope_user_id)

    for row in rows:
        try:
            amount_raw = row.get("amount")
            date_value = row.get("date")
            category_id = row.get("category_id")
            if amount_raw is None or amount_raw == "":
                continue

            amount = float(amount_raw)
            if amount <= 0:
                continue
            if not date_value:
                continue
            date_obj = datetime.strptime(str(date_value), "%Y-%m-%d").date()

            category_id = int(category_id) if category_id else None
            if category_id:
                exists = Category.query.filter_by(id=category_id, user_id=scope_user_id, type=expected_type).first()
                if not exists:
                    category_id = None
            if not category_id:
                category_id = _ensure_default_category(kind, scope_user_id).id

            department = _resolve_department(row, default_department, scope_user_id)
            project = _resolve_project(row, scope_user_id)

            record = model(amount=amount, date=date_obj, user_id=scope_user_id, category_id=category_id)
            db.session.add(record)
            db.session.flush()

            db.session.add(
                OperationDimension(
                    user_id=scope_user_id,
                    transaction_type=expected_type,
                    transaction_id=record.id,
                    department_id=department.id,
                    project_id=project.id if project else None,
                )
            )

            note = row.get("note")
            if note:
                db.session.add(TransactionMeta(transaction_type=expected_type, transaction_id=record.id, note=note))

            created += 1
        except Exception:
            continue

    log_action("import", kind, None, {"count": created})
    db.session.commit()
    return jsonify({"message": "Import completed", "count": created})
