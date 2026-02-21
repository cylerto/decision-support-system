import csv
import io
from datetime import datetime

from flask import Blueprint, request, jsonify, send_file
from flask_login import login_required, current_user

from ..extensions import db
from ..models import Income, Expense, Category
from ..utils import log_action

try:
    import openpyxl
except Exception:
    openpyxl = None


import_export_bp = Blueprint("import_export_bp", __name__, url_prefix="/api")


def _serialize_rows(rows, kind):
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
    if kind not in ("income", "expense"):
        return jsonify({"message": "Invalid export type"}), 400

    fmt = request.args.get("format", "csv")
    Model = Income if kind == "income" else Expense
    rows = Model.query.filter_by(user_id=current_user.id).order_by(Model.date.desc()).all()

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
            download_name=f"{kind}.xlsx"
        )

    csv_file = _serialize_rows(rows, kind)
    log_action("export", kind, None, {"format": "csv"})
    db.session.commit()
    return send_file(
        io.BytesIO(csv_file.getvalue().encode("utf-8")),
        mimetype="text/csv",
        as_attachment=True,
        download_name=f"{kind}.csv"
    )


def _parse_csv(file_storage):
    content = file_storage.stream.read().decode("utf-8")
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


@import_export_bp.route("/import/<string:kind>", methods=["POST"])
@login_required
def import_data(kind):
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

    Model = Income if kind == "income" else Expense
    created = 0
    for row in rows:
        try:
            amount = float(row.get("amount") or 0)
            date_value = row.get("date")
            category_id = row.get("category_id")
            if not amount:
                continue
            date_obj = datetime.strptime(str(date_value), "%Y-%m-%d").date() if date_value else datetime.utcnow().date()
            category_id = int(category_id) if category_id else None
            if category_id:
                exists = Category.query.filter_by(id=category_id, user_id=current_user.id).first()
                if not exists:
                    category_id = None
            record = Model(
                amount=amount,
                date=date_obj,
                user_id=current_user.id,
                category_id=category_id
            )
            db.session.add(record)
            created += 1
        except Exception:
            continue

    log_action("import", kind, None, {"count": created})
    db.session.commit()
    return jsonify({"message": "Import completed", "count": created})
