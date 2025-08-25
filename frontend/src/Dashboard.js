// frontend/src/Dashboard.js
import React, { useEffect, useState } from "react";
import { api } from "./lib/api";

function StatCard({ title, value }) {
  return (
    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
      <div className="text-sm opacity-70">{title}</div>
      <div className="text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [range, setRange] = useState("7d");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load(r = range) {
    try {
      setLoading(true);
      setErr("");
      const data = await api.dashboardSummary(r);
      setSummary(data);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("7d");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-black p-6 text-white">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <div className="flex gap-2">
            {["7d", "30d", "90d"].map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRange(r);
                  load(r);
                }}
                className={`px-3 py-2 rounded-xl font-medium transition ${
                  range === r ? "bg-white/20" : "bg-white/10 hover:bg-white/20"
                }`}
              >
                Last {r}
              </button>
            ))}
            <button
              onClick={async () => {
                try {
                  await api.syncShopify(30);
                  await load(range);
                  alert("Shopify synced (30d).");
                } catch (e) {
                  alert("Shopify sync failed: " + (e.message || e));
                }
              }}
              className="px-3 py-2 rounded-xl font-medium bg-white/10 hover:bg-white/20"
            >
              Sync Shopify (30d)
            </button>
            <button
              onClick={async () => {
                try {
                  await api.syncBestBuy(30);
                  await load(range);
                  alert("BestBuy synced (30d).");
                } catch (e) {
                  alert("BestBuy sync failed: " + (e.message || e));
                }
              }}
              className="px-3 py-2 rounded-xl font-medium bg-white/10 hover:bg-white/20"
            >
              Sync BestBuy (30d)
            </button>
          </div>
        </header>

        {loading && <div className="opacity-80">Loading…</div>}
        {err && !loading && (
          <div className="bg-red-500/20 border border-red-500/40 rounded p-3 text-red-200">Error: {err}</div>
        )}

        {!loading && summary && (
          <>
            <section className="grid md:grid-cols-4 gap-4">
              <StatCard title="Total Revenue" value={`$${summary.totalRevenue.toFixed(2)}`} />
              <StatCard title="Orders" value={summary.totalOrders} />
              <StatCard title="Avg Order Value" value={`$${summary.avgOrderValue.toFixed(2)}`} />
              <StatCard
                title="Growth"
                value={summary.revenueGrowth == null ? "—" : `${summary.revenueGrowth.toFixed(1)}%`}
              />
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-8 mb-3">Platform comparison</h2>
              <ul className="space-y-2">
                {summary.platformComparison?.map((p) => (
                  <li
                    key={p.name}
                    className="flex justify-between items-center bg-white/5 rounded-lg p-4 border border-white/10"
                  >
                    <span>{p.name}</span>
                    <span>
                      ${p.revenue.toFixed(2)} • {p.orders} orders
                    </span>
                  </li>
                ))}
                {!summary.platformComparison?.length && (
                  <li className="opacity-60">No platform data in this range.</li>
                )}
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mt-8 mb-3">Sales trend</h2>
              <div className="text-sm opacity-90 space-y-1">
                {summary.salesTrend?.map((d) => (
                  <div
                    key={d.date}
                    className="flex justify-between bg-white/5 rounded p-2 border border-white/10"
                  >
                    <span>{d.date}</span>
                    <span>
                      ${d.revenue.toFixed(2)} • {d.orders} orders • AOV ${d.aov.toFixed(2)}
                    </span>
                  </div>
                ))}
                {!summary.salesTrend?.length && <div className="opacity-60">No sales in this range.</div>}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
