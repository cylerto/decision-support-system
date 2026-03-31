const API_BASE = import.meta.env.VITE_API_URL ?? "";
let formatCurrency = "RUB";
let formatTimezone = "UTC";

async function apiRequest(path, options = {}) {
  const { method = "GET", body, headers } = options;
  const isForm = body instanceof FormData;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(headers ?? {})
    },
    credentials: "include",
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined
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

function buildQuery(params = {}) {
  const filtered = Object.entries(params).filter(([, value]) => {
    if (value === undefined || value === null) return false;
    if (value === "" || value === "undefined") return false;
    return true;
  });
  return new URLSearchParams(filtered).toString();
}

async function fetchBlob(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error("Export failed");
  }
  return response.blob();
}

export const api = {
  health: () => apiRequest("/api/health"),
  login: (data) => apiRequest("/api/auth/login", { method: "POST", body: data }),
  register: (data) => apiRequest("/api/auth/register", { method: "POST", body: data }),
  logout: () => apiRequest("/api/auth/logout", { method: "POST" }),

  getCategories: (params = {}) => {
    const query = buildQuery(params);
    return apiRequest(`/api/categories${query ? `?${query}` : ""}`);
  },
  addCategory: (data) => apiRequest("/api/categories", { method: "POST", body: data }),
  updateCategory: (id, data) => apiRequest(`/api/categories/${id}`, { method: "PUT", body: data }),
  deleteCategory: (id) => apiRequest(`/api/categories/${id}`, { method: "DELETE" }),

  getDirectories: (kind) => apiRequest(`/api/directories/${kind}`),
  addDirectory: (kind, data) => apiRequest(`/api/directories/${kind}`, { method: "POST", body: data }),
  updateDirectory: (kind, id, data) => apiRequest(`/api/directories/${kind}/${id}`, { method: "PUT", body: data }),
  deleteDirectory: (kind, id) => apiRequest(`/api/directories/${kind}/${id}`, { method: "DELETE" }),

  getIncome: (params = {}) => {
    const query = buildQuery(params);
    return apiRequest(`/api/income${query ? `?${query}` : ""}`);
  },
  addIncome: (data) => apiRequest("/api/income", { method: "POST", body: data }),
  updateIncome: (id, data) => apiRequest(`/api/income/${id}`, { method: "PUT", body: data }),
  deleteIncome: (id) => apiRequest(`/api/income/${id}`, { method: "DELETE" }),

  getExpense: (params = {}) => {
    const query = buildQuery(params);
    return apiRequest(`/api/expense${query ? `?${query}` : ""}`);
  },
  addExpense: (data) => apiRequest("/api/expense", { method: "POST", body: data }),
  updateExpense: (id, data) => apiRequest(`/api/expense/${id}`, { method: "PUT", body: data }),
  deleteExpense: (id) => apiRequest(`/api/expense/${id}`, { method: "DELETE" }),

  getSummary: () => apiRequest("/api/analytics/summary"),
  getMonthly: () => apiRequest("/api/analytics/monthly"),
  getCategoriesMonthly: () => apiRequest("/api/analytics/categories/monthly"),
  getBalanceMonthly: () => apiRequest("/api/analytics/balance/monthly"),
  getForecast: () => apiRequest("/api/analytics/forecast"),
  getForecastSeries: (months) => apiRequest(`/api/analytics/forecast?months=${months}`),
  getDashboard: () => apiRequest("/api/analytics/dashboard"),
  getKpi: () => apiRequest("/api/analytics/kpi"),
  getSegments: () => apiRequest("/api/analytics/segments"),
  getBaselineMonthly: () => apiRequest("/api/analytics/baseline/monthly"),
  getFormatSettings: () => apiRequest("/api/analytics/format"),
  runScenario: (data) => apiRequest("/api/analytics/scenario", { method: "POST", body: data }),
  getDataQuality: () => apiRequest("/api/analytics/data-quality"),
  fixDataQualityCategories: () => apiRequest("/api/analytics/data-quality/fix-categories", { method: "POST" }),
  getAiRecommendations: (financialData) => apiRequest("/api/ai/recommendations", { method: "POST", body: financialData }),

  getRecommendations: () => apiRequest("/api/recommendations"),

  getSettings: () => apiRequest("/api/settings"),
  updateSettings: (data) => apiRequest("/api/settings", { method: "PUT", body: data }),

  getAudit: (params = {}) => {
    const query = buildQuery(params);
    return apiRequest(`/api/audit${query ? `?${query}` : ""}`);
  },

  exportData: (kind, format = "csv") => fetchBlob(`/api/export/${kind}?format=${format}`),
  importData: (kind, file) => {
    const form = new FormData();
    form.append("file", file);
    return apiRequest(`/api/import/${kind}`, { method: "POST", body: form });
  }
};

export function configureFormatting({ currency, timezone } = {}) {
  if (currency) formatCurrency = currency;
  if (timezone) formatTimezone = timezone;
}

export function toMoney(value) {
  if (value === null || value === undefined) return "—";
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: formatCurrency,
    maximumFractionDigits: 2
  }).format(number);
}

export function formatDate(value) {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = String(value).split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return new Intl.DateTimeFormat("ru-RU", { timeZone: formatTimezone }).format(date);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU", { timeZone: formatTimezone });
}


