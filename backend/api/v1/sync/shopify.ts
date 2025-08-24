import type { VercelRequest, VercelResponse } from '@vercel/node';
import { syncShopifyOrders } from '../../../lib/shopify';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end(); // CORS preflight
  try {
    const days = Number((req.query.days as string) ?? 7);
    await syncShopifyOrders(days);
    res.status(200).json({ ok: true, source: 'shopify', days });
  } catch (e: any) {
    res.status(500).json({ ok: false, source: 'shopify', error: e?.message || 'sync_failed' });
  }
}
