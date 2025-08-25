// Frontend API client (Vite + React).
// If you're on Next.js, see the variant at the bottom.

type DashboardSummary = {
  success: boolean;
  range: { start: string; end: string; days: number };
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  revenueGrowth: number | null;
  platformComparison: { name: string; revenue: number; orders: number }[];
  salesTrend: { date: string; revenue: number; orders: number; aov: number }[];
};

type MetricsResponse = {
  success: boolean;
  filters: { start_date: string; end_date: string; platform: string };
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
};

type SalesTrendResponse = {
  success: boolean;
  start: string;
  end: string;
  data: { date: string; revenue: number; orders: number; aov: number }[];
};

const API_BASE = import.meta.env.VITE_API_BASE as string | undefined;

function base() {
  if (!API_BASE) {
    throw new Error(
      "VITE_API_BASE is not set. Add it in your Vercel frontend project's Environment Variables."
    );
  }
  return API_BASE.replace(/\/$/, "");
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${base()}${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

async function post<T>(path: string): Promise<T> {
  const res = await fetch(`${base()}${path}`, { method: "POST", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

export const api = {
  health: () => get<{ api: string; database: string; ts: string }>("/api/v1/health"),
  dashboardSummary: (range = "7d") =>
    get<DashboardSummary>(`/api/v1/analytics/dashboard-summary?range=${encodeURIComponent(range)}`),
  metrics: (params: { start_date?: string; end_date?: string; platform?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.start_date) qs.set("start_date", params.start_date);
    if (params.end_date) qs.set("end_date", params.end_date);
    if (params.platform) qs.set("platform", params.platform);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return get<MetricsResponse>(`/api/v1/analytics/metrics${suffix}`);
  },
  salesTrend: (start_date: string, end_date: string) =>
    get<SalesTrendResponse>(
      `/api/v1/analytics/sales-trend?start_date=${encodeURIComponent(start_date)}&end_date=${encodeURIComponent(
        end_date
      )}`
    ),
  // sync triggers (optional UI buttons)
  syncShopify: (days = 30) => post<{ ok: boolean; source: string; days: number; error?: string }>(`/api/v1/sync/shopify?days=${days}`),
  syncBestBuy: (days = 30) => post<{ ok: boolean; source: string; days: number; error?: string }>(`/api/v1/sync/bestbuy?days=${days}`),
};
