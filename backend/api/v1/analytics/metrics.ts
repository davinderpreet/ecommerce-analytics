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
    const platform = String((req.query.platform as string) ?? 'all');
    const today = new Date();
    const start = startOfDay(parseDateISO(req.query.start_date as string, today));
    const end = endOfDay(parseDateISO(req.query.end_date as string, today));

    const channels = await prisma.channel.findMany();
    const byCode = new Map(channels.map(c => [c.code, c.id]));
    const where: any = { createdAt: { gte: start, lte: end } };
    if (platform === 'shopify' && byCode.get('shopify')) where.channelId = byCode.get('shopify');

    const orders = await prisma.order.findMany({ where, select: { totalCents: true } });
    const totalOrders = orders.length;
    const totalRevenueCents = orders.reduce((s, o) => s + (o.totalCents || 0), 0);
    const aovCents = totalOrders ? Math.round(totalRevenueCents / totalOrders) : 0;

    res.status(200).json({
      success: true,
      filters: { start_date: dateKey(start), end_date: dateKey(end), platform },
      totalRevenue: dollars(totalRevenueCents),
      totalOrders,
      avgOrderValue: dollars(aovCents),
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Failed to fetch metrics' });
  }
}
