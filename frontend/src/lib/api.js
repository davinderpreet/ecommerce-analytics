// frontend/src/lib/api.js (CRA / react-scripts)

const API_BASE = (process.env.REACT_APP_API_BASE || "").replace(/\/$/, "");

if (!API_BASE) {
  // Fail fast to make it obvious in the console if env var isn't set at build time
  // (CRA requires rebuild when env vars change)
  // eslint-disable-next-line no-console
  console.warn("REACT_APP_API_BASE is NOT set. Set it in Vercel → Project → Environment Variables.");
}

async function http(method, path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Accept: "application/json", ...options.headers },
    ...options
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => http("GET", "/api/v1/health"),

  dashboardSummary: (range = "7d") =>
    http("GET", `/api/v1/analytics/dashboard-summary?range=${encodeURIComponent(range)}`),

  metrics: ({ start_date, end_date, platform } = {}) => {
    const qs = new URLSearchParams();
    if (start_date) qs.set("start_date", start_date);
    if (end_date) qs.set("end_date", end_date);
    if (platform) qs.set("platform", platform);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return http("GET", `/api/v1/analytics/metrics${suffix}`);
  },

  salesTrend: (start_date, end_date) =>
    http(
      "GET",
      `/api/v1/analytics/sales-trend?start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(
        end_date
      )}`
    ),

  // Optional: trigger imports from the UI
  syncShopify: (days = 30) => http("POST", `/api/v1/sync/shopify?days=${days}`),
  syncBestBuy: (days = 30) => http("POST", `/api/v1/sync/bestbuy?days=${days}`),
  
  // Add inventory methods
  inventory: (platform = 'all') => {
    const suffix = platform !== 'all' ? `?platform=${platform}` : '';
    return http("GET", `/api/v1/inventory${suffix}`);
  },
  
  inventorySeed: () => http("POST", "/api/v1/inventory/seed"),
  
  inventorySyncShopify: () => http("POST", "/api/v1/inventory/sync-shopify"),
  
  inventoryUpdate: (productId, quantity) => 
    http("POST", `/api/v1/inventory/${productId}/update`, {
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ quantity })
    }),
    
  inventoryReorder: (data) =>
    http("POST", "/api/v1/inventory/reorder", {
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    })
};
