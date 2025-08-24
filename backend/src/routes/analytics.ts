// backend/src/routes/analytics.ts
import express from 'express';
import { PrismaClient, Channel } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/** Helpers */
function parseDateISO(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function dateKey(d: Date | string) {
  const obj = typeof d === 'string' ? new Date(d) : d;
  return obj.toISOString().slice(0, 10);
}
function toDollars(cents?: number | null) {
  return ((cents ?? 0) / 100);
}
function pctGrowth(curr: number, prev: number) {
  if (prev <= 0) return null;
  return ((curr - prev) / prev) * 100;
}

async function getChannelMap() {
  const channels = await prisma.channel.findMany();
  const byId = new Map<string, Channel>();
  const byCode = new Map<string, Channel>();
  for (const c of channels) {
    byId.set(c.id, c);
    byCode.set(c.code, c);
  }
  return { byId, byCode };
}

/**
 * /metrics
 * Basic metrics for a date range (today by default).
 * Query: start_date=YYYY-MM-DD, end_date=YYYY-MM-DD, platform=shopify|bestbuy|all
 */
router.get('/metrics', async (req, res) => {
  try {
    const { platform = 'all' } = req.query as { start_date?: string; end_date?: string; platform?: string };
    const today = new Date();
    const start = startOfDay(parseDateISO(req.query.start_date as string, today));
    const end = endOfDay(parseDateISO(req.query.end_date as string, today));

    const { byCode } = await getChannelMap();

    const where: any = { createdAt: { gte: start, lte: end } };
    if (platform === 'shopify' && byCode.get('shopify')) where.channelId = byCode.get('shopify')!.id;
    if (platform === 'bestbuy' && byCode.get('bestbuy')) where.channelId = byCode.get('bestbuy')!.id;

    const orders = await prisma.order.findMany({ where, select: { totalCents: true } });
    const totalOrders = orders.length;
    const totalRevenueCents = orders.reduce((s, o) => s + (o.totalCents || 0), 0);
    const aovCents = totalOrders ? Math.round(totalRevenueCents / totalOrders) : 0;

    res.json({
      success: true,
      filters: {
        start_date: dateKey(start),
        end_date: dateKey(end),
        platform,
      },
      totalRevenue: toDollars(totalRevenueCents),
      totalOrders,
      avgOrderValue: toDollars(aovCents),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch metrics' });
  }
});

/**
 * /dashboard-summary
 * Summary block used by the dashboard:
 * - total revenue, orders, AOV in range (default 7d)
 * - revenue growth vs prior same-length period
 * - platform comparison
 * - sales trend (daily)
 */
router.get('/dashboard-summary', async (req, res) => {
  try {
    const range = String(req.query.range ?? '7d'); // '7d' | '30d' | '90d'
    const days = Number(range.replace('d', '')) || 7;

    const end = endOfDay(new Date());
    const start = startOfDay(new Date(new Date().setDate(end.getDate() - (days - 1))));
    const prevEnd = endOfDay(new Date(new Date(start).setDate(start.getDate() - 1)));
    const prevStart = startOfDay(new Date(new Date(prevEnd).setDate(prevEnd.getDate() - (days - 1))));

    const [{ byId, byCode }] = await Promise.all([getChannelMap()]);

    // Current period orders
    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { channelId: true, createdAt: true, totalCents: true },
    });

    // Previous period orders (for growth calc)
    const prevOrders = await prisma.order.findMany({
      where: { createdAt: { gte: prevStart, lte: prevEnd } },
      select: { totalCents: true },
    });

    // Aggregate current
    const totalOrders = orders.length;
    const revenueCents = orders.reduce((s, o) => s + (o.totalCents || 0), 0);
    const aovCents = totalOrders ? Math.round(revenueCents / totalOrders) : 0;

    // Platform comparison
    const byChannel = new Map<string, { revenueCents: number; orders: number }>();
    for (const o of orders) {
      const key = o.channelId;
      const agg = byChannel.get(key) || { revenueCents: 0, orders: 0 };
      agg.revenueCents += (o.totalCents || 0);
      agg.orders += 1;
      byChannel.set(key, agg);
    }
    const platformComparison: Array<{ name: string; revenue: number; orders: number }> = [];
    for (const [id, agg] of byChannel.entries()) {
      const ch = byId.get(id);
      platformComparison.push({
        name: ch?.name || 'Unknown',
        revenue: toDollars(agg.revenueCents),
        orders: agg.orders,
      });
    }

    // Sales trend (daily)
    // We’ll assemble day buckets for the current period.
    const trendMap = new Map<string, { revenueCents: number; orders: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      trendMap.set(dateKey(d), { revenueCents: 0, orders: 0 });
    }
    for (const o of orders) {
      const k = dateKey(o.createdAt);
      const curr = trendMap.get(k);
      if (curr) {
        curr.revenueCents += (o.totalCents || 0);
        curr.orders += 1;
      }
    }
    const salesTrend = Array.from(trendMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({
        date,
        revenue: toDollars(v.revenueCents),
        orders: v.orders,
        aov: v.orders ? toDollars(Math.round(v.revenueCents / v.orders)) : 0,
      }));

    // Growth vs previous period
    const prevRevenueCents = prevOrders.reduce((s, o) => s + (o.totalCents || 0), 0);
    const revenueGrowth = pctGrowth(revenueCents, prevRevenueCents);

    res.json({
      success: true,
      range: { start: dateKey(start), end: dateKey(end), days },
      totalRevenue: toDollars(revenueCents),
      totalOrders,
      avgOrderValue: toDollars(aovCents),
      revenueGrowth, // % number or null
      platformComparison,
      salesTrend,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch dashboard summary' });
  }
});

/**
 * /sales-trend
 * Returns daily revenue+orders for arbitrary start/end dates
 */
router.get('/sales-trend', async (req, res) => {
  try {
    const today = new Date();
    const start = startOfDay(parseDateISO(req.query.start_date as string, new Date(new Date().setDate(today.getDate() - 6))));
    const end = endOfDay(parseDateISO(req.query.end_date as string, today));

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdAt: true, totalCents: true },
    });

    const dayMap = new Map<string, { revenueCents: number; orders: number }>();
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
      dayMap.set(dateKey(d), { revenueCents: 0, orders: 0 });
    }
    for (const o of orders) {
      const k = dateKey(o.createdAt);
      const agg = dayMap.get(k)!;
      agg.revenueCents += (o.totalCents || 0);
      agg.orders += 1;
    }

    const trend = Array.from(dayMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({
        date,
        revenue: toDollars(v.revenueCents),
        orders: v.orders,
        aov: v.orders ? toDollars(Math.round(v.revenueCents / v.orders)) : 0,
      }));

    res.json({ success: true, start: dateKey(start), end: dateKey(end), data: trend });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch sales trend' });
  }
});

export default router;
