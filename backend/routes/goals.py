from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from ..extensions import db
from ..models import SavingsGoal
from ..utils import log_action

goals_bp = Blueprint("goals_bp", __name__, url_prefix="/api/goals")


@goals_bp.route("", methods=["GET"])
@login_required
def get_goals():
    goals = SavingsGoal.query.filter_by(user_id=current_user.id).order_by(SavingsGoal.created_at.desc()).all()
    return jsonify([
        {
            "id": g.id,
            "name": g.name,
            "target_amount": g.target_amount,
            "current_amount": g.current_amount,
            "due_date": g.due_date.isoformat() if g.due_date else None
        } for g in goals
    ])


@goals_bp.route("", methods=["POST"])
@login_required
def create_goal():
    data = request.get_json() or {}
    name = data.get("name")
    target_amount = data.get("target_amount")
    due_date = data.get("due_date")
    if not name or target_amount is None:
        return jsonify({"message": "name and target_amount required"}), 400

    goal = SavingsGoal(
        user_id=current_user.id,
        name=name,
        target_amount=target_amount,
        current_amount=data.get("current_amount", 0),
        due_date=datetime.strptime(due_date, "%Y-%m-%d").date() if due_date else None
    )
    db.session.add(goal)
    log_action("create", "goal", None, data)
    db.session.commit()
    return jsonify({"message": "Goal created", "id": goal.id}), 201


@goals_bp.route("/<int:goal_id>", methods=["PUT"])
@login_required
def update_goal(goal_id):
    data = request.get_json() or {}
    goal = SavingsGoal.query.filter_by(id=goal_id, user_id=current_user.id).first()
    if not goal:
        return jsonify({"message": "Goal not found"}), 404

    if "name" in data:
        goal.name = data["name"]
    if "target_amount" in data:
        goal.target_amount = data["target_amount"]
    if "current_amount" in data:
        goal.current_amount = data["current_amount"]
    if "due_date" in data:
        goal.due_date = datetime.strptime(data["due_date"], "%Y-%m-%d").date() if data["due_date"] else None

    log_action("update", "goal", goal.id, data)
    db.session.commit()
    return jsonify({"message": "Goal updated"})


@goals_bp.route("/<int:goal_id>/contribute", methods=["POST"])
@login_required
def contribute_goal(goal_id):
    data = request.get_json() or {}
    amount = data.get("amount")
    if amount is None:
        return jsonify({"message": "amount required"}), 400

    goal = SavingsGoal.query.filter_by(id=goal_id, user_id=current_user.id).first()
    if not goal:
        return jsonify({"message": "Goal not found"}), 404

    goal.current_amount += amount
    log_action("contribute", "goal", goal.id, {"amount": amount})
    db.session.commit()
    return jsonify({"message": "Contribution added"})


@goals_bp.route("/<int:goal_id>", methods=["DELETE"])
@login_required
def delete_goal(goal_id):
    goal = SavingsGoal.query.filter_by(id=goal_id, user_id=current_user.id).first()
    if not goal:
        return jsonify({"message": "Goal not found"}), 404
    db.session.delete(goal)
    log_action("delete", "goal", goal.id)
    db.session.commit()
    return jsonify({"message": "Goal deleted"})
