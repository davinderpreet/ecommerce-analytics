import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../../lib/prisma';

function dateKey(d: Date | string) { const o = typeof d === 'string' ? new Date(d) : d; return o.toISOString().slice(0,10); }
const dollars = (c?: number | null) => ((c ?? 0) / 100);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const range = String(req.query.range ?? '7d');
    const days = Number(range.replace('d', '')) || 7;

    const end = new Date(); end.setHours(23,59,59,999);
    const start = new Date(end); start.setHours(0,0,0,0); start.setDate(end.getDate() - (days - 1));
    const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1); prevEnd.setHours(23,59,59,999);
    const prevStart = new Date(prevEnd); prevStart.setHours(0,0,0,0); prevStart.setDate(prevEnd.getDate() - (days - 1));

    const [channels, orders, prevOrders] = await Promise.all([
      prisma.channel.findMany(),
      prisma.order.findMany({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.order.findMany({ where: { createdAt: { gte: prevStart, lte: prevEnd } } }),
    ]);
    const byId = new Map(channels.map(c => [c.id, c]));

    const totalOrders = orders.length;
    const revenueCents = orders.reduce((s, o) => s + (o.totalCents || 0), 0);
    const aovCents = totalOrders ? Math.round(revenueCents / totalOrders) : 0;

    const byChannel = new Map<string, { revenueCents: number; orders: number }>();
    for (const o of orders) {
      const agg = byChannel.get(o.channelId) || { revenueCents: 0, orders: 0 };
      agg.revenueCents += (o.totalCents || 0); agg.orders += 1;
      byChannel.set(o.channelId, agg);
    }
    const platformComparison = Array.from(byChannel.entries()).map(([id, v]) => ({
      name: byId.get(id)?.name || 'Unknown', revenue: dollars(v.revenueCents), orders: v.orders,
    }));

    // Trend
    const trendMap = new Map<string, { revenueCents: number; orders: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      trendMap.set(dateKey(d), { revenueCents: 0, orders: 0 });
    }
    for (const o of orders) {
      const k = dateKey(o.createdAt);
      const t = trendMap.get(k); if (t) { t.revenueCents += (o.totalCents || 0); t.orders += 1; }
    }
    const salesTrend = Array.from(trendMap.entries())
      .sort(([a],[b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({ date, revenue: dollars(v.revenueCents), orders: v.orders, aov: v.orders ? dollars(Math.round(v.revenueCents/v.orders)) : 0 }));

    const prevRevenueCents = prevOrders.reduce((s, o) => s + (o.totalCents || 0), 0);
    const revenueGrowth = prevRevenueCents > 0 ? ((revenueCents - prevRevenueCents) / prevRevenueCents) * 100 : null;

    res.status(200).json({
      success: true,
      range: { start: dateKey(start), end: dateKey(end), days },
      totalRevenue: dollars(revenueCents),
      totalOrders,
      avgOrderValue: dollars(aovCents),
      revenueGrowth,
      platformComparison,
      salesTrend,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Failed to fetch dashboard summary' });
  }
}
