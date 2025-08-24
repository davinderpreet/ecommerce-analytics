// backend/src/integrations/bestbuy.ts
import fetch from "node-fetch";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const BASE = process.env.MIRAKL_BASE_URL!;
const API_KEY = process.env.MIRAKL_API_KEY!;
const SHOP_ID = process.env.MIRAKL_SHOP_ID!; // some endpoints require it

async function mirakl<T>(path: string, params: Record<string, any> = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) qs.append(k, String(v));
  const url = `${BASE}${path}${qs.toString() ? `?${qs}` : ""}`;

  const res = await fetch(url, {
    headers: { "X-AUTH-TOKEN": API_KEY, "Accept": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mirakl ${path} ${res.status}: ${text}`);
  }
  return res.json() as any;
}

async function ensureBestBuyChannel() {
  let channel = await prisma.channel.findUnique({ where: { code: "bestbuy" } });
  if (!channel) {
    channel = await prisma.channel.create({ data: { name: "BestBuy", code: "bestbuy" } });
  }
  return channel;
}

export async function syncBestBuyOrders(days = 7) {
  const channel = await ensureBestBuyChannel();
  const since = new Date();
  since.setDate(since.getDate() - days);

  // Mirakl list orders: /api/orders?start_date=YYYY-MM-DDTHH:mm:ssZ
  // The exact field names vary a bit by tenant; adjust once you see your payload.
  const data = await mirakl<any>("/api/orders", {
    start_date: since.toISOString(),
    // states: 'WAITING_ACCEPTANCE,SHIPPING', etc. if you wish
  });

  for (const o of data.orders ?? data.data ?? []) {
    const orderId = o.order_id || o.id;
    const created = new Date(o.created_date || o.created_at || o.date_created);
    const currency = o.currency_iso_code || "CAD";
    const subtotalCents = Math.round(((o.order_price || o.total_price || 0) - (o.tax_amount || 0) - (o.shipping_amount || 0)) * 100);
    const taxCents = Math.round((o.tax_amount || 0) * 100);
    const shippingCents = Math.round((o.shipping_amount || 0) * 100);
    const totalCents = Math.round((o.order_price || o.total_price || 0) * 100);

    const order = await prisma.order.upsert({
      where: { channelRef: String(orderId) },
      update: {
        number: String(orderId),
        createdAt: created,
        currency,
        subtotalCents,
        taxCents,
        shippingCents,
        totalCents,
        customerEmail: null,
      },
      create: {
        channelId: channel.id,
        channelRef: String(orderId),
        number: String(orderId),
        createdAt: created,
        currency,
        subtotalCents,
        taxCents,
        shippingCents,
        totalCents,
        customerEmail: null,
      },
    });

    for (const li of o.order_lines || o.lines || []) {
      const qty = li.quantity || li.quantity_ordered || 1;
      const sku = li.offer_sku || li.sku || li.product_sku || undefined;
      const title = li.product_title || li.title || sku || "Item";
      const unit = Math.round((li.price_unit || li.price || 0) * 100);
      const total = Math.round((li.price_total || li.total_price || unit * qty) * 100);

      let productId: string | undefined = undefined;
      if (sku) {
        let product = await prisma.product.findUnique({ where: { sku } });
        if (!product) {
          product = await prisma.product.create({
            data: {
              channelId: channel.id,
              sku,
              title,
              channelRef: li.product_sku ? String(li.product_sku) : undefined,
              currency,
            },
          });
        }
        productId = product.id;
      }

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId,
          sku,
          title,
          quantity: qty,
          priceCents: unit,
          totalCents: total,
        },
      });
    }
  }

  // Aggregate daily metrics for BestBuy
  await prisma.$executeRawUnsafe(`
    INSERT INTO daily_metrics (id, date, channel_id, revenue_cents, orders, visitors, conversion_pct, aov_cents)
    SELECT gen_random_uuid(),
           DATE(o.created_at) as date,
           '${channel.id}' as channel_id,
           SUM(o.total_cents) as revenue_cents,
           COUNT(*) as orders,
           NULL::int as visitors,
           NULL::float as conversion_pct,
           (CASE WHEN COUNT(*)=0 THEN 0 ELSE SUM(o.total_cents)/COUNT(*) END)::int as aov_cents
    FROM orders o
    WHERE o.channel_id='${channel.id}'
      AND o.created_at >= NOW() - INTERVAL '${days} days'
    GROUP BY DATE(o.created_at)
  ON CONFLICT (date, channel_id) DO UPDATE SET
    revenue_cents = EXCLUDED.revenue_cents,
    orders = EXCLUDED.orders,
    aov_cents = EXCLUDED.aov_cents;
  `);
}
