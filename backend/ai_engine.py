import os
from pathlib import Path
import time

import numpy as np
import requests
from sqlalchemy import extract, func
from sklearn.linear_model import LinearRegression
from dotenv import load_dotenv

from backend.extensions import db


MAX_GROWTH_RATE = 0.3
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"
AI_MODEL = "meta-llama/llama-3.3-70b-instruct:free"

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _prepare_monthly_data(model, user_id):
    data = (
        db.session.query(
            extract("year", model.date).label("year"),
            extract("month", model.date).label("month"),
            func.sum(model.amount).label("total"),
        )
        .filter(model.user_id == user_id)
        .group_by("year", "month")
        .order_by("year", "month")
        .all()
    )

    if len(data) < 2:
        return None, None, None

    totals = [float(row.total) for row in data]
    x = np.arange(len(totals)).reshape(-1, 1)
    y = np.array(totals)
    return x, y, totals[-1]


def _forecast_series(model, user_id, months):
    x, y, last_value = _prepare_monthly_data(model, user_id)
    if x is None:
        return None, None, None

    reg = LinearRegression()
    reg.fit(x, y)

    residuals = y - reg.predict(x)
    std = float(np.std(residuals)) if len(residuals) > 1 else 0
    predictions = []

    for month_offset in range(1, months + 1):
        next_point = np.array([[len(x) - 1 + month_offset]])
        raw_prediction = reg.predict(next_point)[0]
        max_allowed = last_value * (1 + MAX_GROWTH_RATE)
        adjusted_prediction = min(raw_prediction, max_allowed)
        lower = adjusted_prediction - 1.96 * std
        upper = adjusted_prediction + 1.96 * std
        predictions.append({
            "month_offset": month_offset,
            "prediction": round(float(adjusted_prediction), 2),
            "lower": round(float(lower), 2),
            "upper": round(float(upper), 2),
        })

    if y[-1] > y[-2]:
        trend = "growth"
    elif y[-1] < y[-2]:
        trend = "decline"
    else:
        trend = "stable"

    return predictions, trend, std


def _confidence_level(months_count):
    if months_count >= 6:
        return "high"
    if months_count >= 3:
        return "medium"
    return "low"


def forecast(model_income, model_expense, user_id, months):
    income_series, income_trend, _income_std = _forecast_series(model_income, user_id, months)
    expense_series, expense_trend, _expense_std = _forecast_series(model_expense, user_id, months)

    if income_series is None or expense_series is None:
        return {
            "message": "Not enough data for forecast (need at least 2 months)",
            "predicted_income": 0,
            "predicted_expense": 0,
            "predicted_profit": 0,
            "trend": {"income": "stable", "expense": "stable"},
            "confidence": "low",
            "series": None,
        }

    months_count = (
        db.session.query(extract("year", model_income.date), extract("month", model_income.date))
        .filter(model_income.user_id == user_id)
        .distinct()
        .count()
    )

    predicted_income = income_series[0]["prediction"]
    predicted_expense = expense_series[0]["prediction"]
    return {
        "predicted_income": predicted_income,
        "predicted_expense": predicted_expense,
        "predicted_profit": round(predicted_income - predicted_expense, 2),
        "trend": {"income": income_trend, "expense": expense_trend},
        "confidence": _confidence_level(months_count),
        "series": {"income": income_series, "expense": expense_series},
    }


def _dict_to_readable_text(financial_data: dict) -> str:
    lines = []
    for key, value in financial_data.items():
        if isinstance(value, (dict, list)):
            lines.append(f"{key}: {value}")
        else:
            lines.append(f"{key}: {value}")
    return "\n".join(lines)


def generate_recommendations(financial_data: dict) -> str:
    provider = (os.getenv("AI_PROVIDER", "openrouter") or "openrouter").strip().lower()
    api_key = (
        os.getenv("DEEPSEEK_API_KEY")
        if provider == "deepseek"
        else (os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY"))
    )
    if not api_key:
        raise RuntimeError("API key is missing in environment variables")

    system_prompt = (
        "You are an analytical assistant for a small business decision-support system. "
        "You do not calculate numbers; you interpret already calculated indicators and suggest actions. "
        "Respond in Russian language. "
        "Output plain text only. Do not use markdown symbols (#, **, *, tables)."
    )
    user_prompt = (
        "Here are enterprise indicators:\n"
        f"{_dict_to_readable_text(financial_data)}\n\n"
        "Generate concise response in Russian in this structure:\n"
        "1) Общая оценка финансового состояния.\n"
        "2) Основные риски (2-4 пункта).\n"
        "3) Управленческие рекомендации (3-6 пунктов, формат: Проблема - Причина - Действие).\n"
        "4) Краткий вывод (1-2 предложения).\n"
        "Use practical wording."
    )

    if provider == "deepseek":
        base_url = DEEPSEEK_URL
        primary_model = os.getenv("DEEPSEEK_MODEL", "deepseek-chat").strip() or "deepseek-chat"
        models = [primary_model]
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
    else:
        base_url = OPENROUTER_URL
        primary_model = os.getenv("OPENROUTER_MODEL", AI_MODEL).strip() or AI_MODEL
        fallback_models_raw = os.getenv(
            "OPENROUTER_FALLBACK_MODELS",
            "openai/gpt-4o-mini,mistralai/mistral-7b-instruct:free,google/gemma-2-9b-it:free",
        )
        models = [primary_model] + [m.strip() for m in fallback_models_raw.split(",") if m.strip()]
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": os.getenv("OPENROUTER_HTTP_REFERER", "http://localhost"),
            "X-Title": os.getenv("OPENROUTER_APP_NAME", "Decision Support System"),
        }

    last_error = None
    for model in models:
        payload = {
            "model": model,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        for attempt in range(3):
            try:
                response = requests.post(base_url, headers=headers, json=payload, timeout=30)
                if response.status_code == 429:
                    last_error = RuntimeError(f"429 Too Many Requests (model: {model})")
                    time.sleep(1.5 * (attempt + 1))
                    continue
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"].strip()
            except requests.RequestException as exc:
                last_error = exc
                # for non-429 HTTP/network errors, move to next model
                break
            except (KeyError, TypeError, ValueError) as exc:
                last_error = exc
                break

    # Soft fallback text to avoid 502 on free-tier throttling.
    return (
        "AI-сервис временно перегружен (лимит free-модели). "
        "Повторите запрос через 30-60 секунд или снизьте частоту генерации. "
        f"Провайдер: {provider}. Техническая деталь: {last_error}"
    )
