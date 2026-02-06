const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function apiRequest(path, options = {}) {
  const { method = "GET", body, headers } = options;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {})
    },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined
  });

  if (response.status === 204) {
    return null;
  }

  let payload = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      (typeof payload === "string" ? payload : "Request failed");
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function tryRequest(path, options) {
  try {
    return await apiRequest(path, options);
  } catch (error) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

export const api = {
  health: () => apiRequest("/api/health"),
  login: (data) => apiRequest("/api/auth/login", { method: "POST", body: data }),
  register: (data) => apiRequest("/api/auth/register", { method: "POST", body: data }),
  logout: () => apiRequest("/api/auth/logout", { method: "POST" }),

  getCategories: () => apiRequest("/api/categories"),
  addCategory: (data) => apiRequest("/api/categories", { method: "POST", body: data }),

  getIncome: () => apiRequest("/api/income"),
  addIncome: (data) => apiRequest("/api/income", { method: "POST", body: data }),

  getExpense: () => apiRequest("/api/expense"),
  addExpense: (data) => apiRequest("/api/expense", { method: "POST", body: data }),

  getSummary: () => apiRequest("/api/analytics/summary"),
  getMonthly: () => apiRequest("/api/analytics/monthly"),
  getCategoriesMonthly: () => apiRequest("/api/analytics/categories/monthly"),
  getBalanceMonthly: () => apiRequest("/api/analytics/balance/monthly"),
  getForecast: () => apiRequest("/api/analytics/forecast"),
  getDashboard: () => apiRequest("/api/analytics/dashboard"),

  getRecommendations: () => apiRequest("/api/recommendations"),

  getLimits: async () => {
    const primary = await tryRequest("/api/limits");
    if (primary) {
      return primary.map((item) => ({
        category_id: item.category_id,
        monthly_limit: item.monthly_limit ?? item.limit
      }));
    }

    const fallback = await apiRequest("/api/category-limits");
    return fallback.map((item) => ({
      category_id: item.category_id,
      monthly_limit: item.monthly_limit ?? item.limit
    }));
  },

  saveLimit: async ({ category_id, monthly_limit }) => {
    const payload = {
      category_id,
      monthly_limit,
      limit: monthly_limit
    };

    const primary = await tryRequest("/api/limits", {
      method: "POST",
      body: payload
    });

    if (primary !== null) {
      return primary;
    }

    return apiRequest("/api/category-limits", {
      method: "POST",
      body: { category_id, limit: monthly_limit }
    });
  }
};

export function toMoney(value) {
  if (value === null || value === undefined) return "—";
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2
  }).format(number);
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU");
}

