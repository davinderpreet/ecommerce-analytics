import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../../lib/prisma';

function parseDateISO(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }
function dateKey(d: Date | string) { const o = typeof d === 'string' ? new Date(d) : d; return o.toISOString().slice(0,10); }
const dollars = (c?: number | null) => ((c ?? 0) / 100);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const today = new Date();
    const start = startOfDay(parseDateISO(req.query.start_date as string, new Date(new Date().setDate(today.getDate() - 6))));
    const end = endOfDay(parseDateISO(req.query.end_date as string, today));

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdAt: true, totalCents: true },
    });

    const dayMap = new Map<string, { revenueCents: number; orders: number }>();
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86_400_000)) {
      dayMap.set(dateKey(d), { revenueCents: 0, orders: 0 });
    }
    for (const o of orders) {
      const k = dateKey(o.createdAt);
      const agg = dayMap.get(k)!; agg.revenueCents += (o.totalCents || 0); agg.orders += 1;
    }

    const trend = Array.from(dayMap.entries())
      .sort(([a],[b]) => a < b ? -1 : 1)
      .map(([date, v]) => ({ date, revenue: dollars(v.revenueCents), orders: v.orders, aov: v.orders ? dollars(Math.round(v.revenueCents/v.orders)) : 0 }));

    res.status(200).json({ success: true, start: dateKey(start), end: dateKey(end), data: trend });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Failed to fetch sales trend' });
  }
}
