import json
import os
from urllib import error, request

from backend.finance_engine import get_baseline_monthly, get_kpi, get_recommendations, get_summary


OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"


def _safe_json_loads(text):
    try:
        return json.loads(text)
    except Exception:
        return None


def _build_prompt_payload(user_id):
    summary = get_summary(user_id)
    kpi = get_kpi(user_id)
    baseline = get_baseline_monthly(user_id)[-6:]
    rule_based = get_recommendations(user_id)

    return {
        "summary": summary,
        "kpi": kpi,
        "baseline_last_6_months": baseline,
        "rule_based": rule_based,
    }


def _call_openai(payload):
    provider = os.getenv("AI_PROVIDER", "openrouter").strip().lower() or "openrouter"
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    model = os.getenv("OPENAI_MODEL", "openai/gpt-4o-mini").strip() or "openai/gpt-4o-mini"
    timeout_sec = float(os.getenv("OPENAI_TIMEOUT_SEC", "15"))

    if not api_key:
        return None, "missing_api_key", model, provider

    system_prompt = (
        "Ты финансовый аналитик для малого бизнеса. "
        "Верни только JSON без markdown. "
        "Формат: "
        "{\"alerts\": string[], \"recommendations\": string[], "
        "\"detailed\": [{\"type\":\"alert|tip\",\"priority\":\"high|medium|low\","
        "\"message\": string, \"reason\": string}]}. "
        "Рекомендации должны быть конкретными управленческими действиями."
    )
    user_prompt = (
        "На основе данных сформируй управленческие рекомендации.\n"
        f"DATA:\n{json.dumps(payload, ensure_ascii=False)}"
    )

    body = {
        "model": model,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    url = OPENROUTER_CHAT_URL if provider == "openrouter" else OPENAI_CHAT_URL
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if provider == "openrouter":
        headers["HTTP-Referer"] = os.getenv("OPENROUTER_HTTP_REFERER", "http://localhost")
        headers["X-Title"] = os.getenv("OPENROUTER_APP_NAME", "Decision Support System")

    req = request.Request(
        url,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with request.urlopen(req, timeout=timeout_sec) as resp:
            raw = resp.read().decode("utf-8")
            response_json = json.loads(raw)
            content = response_json["choices"][0]["message"]["content"]
            ai_json = _safe_json_loads(content)
            if not ai_json:
                return None, "invalid_ai_json", model, provider
            return ai_json, "ok", model, provider
    except error.HTTPError as exc:
        return None, f"http_{exc.code}", model, provider
    except Exception:
        return None, "request_failed", model, provider


def build_recommendations(user_id):
    rule_based = get_recommendations(user_id)

    payload = _build_prompt_payload(user_id)
    ai_result, ai_status, model, provider = _call_openai(payload)

    if not ai_result:
        return {
            **rule_based,
            "meta": {
                "provider": provider,
                "model": model,
                "ai_used": False,
                "ai_status": ai_status,
                "fallback": "rule_based",
            },
        }

    alerts = ai_result.get("alerts")
    recommendations = ai_result.get("recommendations")
    detailed = ai_result.get("detailed")

    if not isinstance(alerts, list) or not isinstance(recommendations, list) or not isinstance(detailed, list):
        return {
            **rule_based,
            "meta": {
                "provider": provider,
                "model": model,
                "ai_used": False,
                "ai_status": "schema_mismatch",
                "fallback": "rule_based",
            },
        }

    return {
        "alerts": [str(x) for x in alerts],
        "recommendations": [str(x) for x in recommendations],
        "detailed": [
            {
                "type": str(item.get("type", "tip")),
                "priority": str(item.get("priority", "medium")),
                "message": str(item.get("message", "")),
                "reason": str(item.get("reason", "")),
            }
            for item in detailed
        ],
        "meta": {
            "provider": provider,
            "model": model,
            "ai_used": True,
            "ai_status": ai_status,
            "fallback": None,
        },
    }
