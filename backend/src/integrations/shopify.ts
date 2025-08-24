import fetch from "node-fetch";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN!;
const TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!;
const API_VER = "2024-07"; // stable admin version

async function shopifyGraphQL<T>(query: string, variables: any = {}): Promise<T> {
  const res = await fetch(`https://${SHOP}/admin/api/${API_VER}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify GraphQL ${res.status}: ${text}`);
  }
  return res.json() as any;
}

async function ensureShopifyChannel() {
  let ch = await prisma.channel.findUnique({ where: { code: "shopify" } });
  if (!ch) ch = await prisma.channel.create({ data: { name: "Shopify", code: "shopify" } });
  return ch;
}

export async function syncShopifyOrders(days = 7) {
  const channel = await ensureShopifyChannel();

  const since = new Date();
  since.setDate(since.getDate() - days);

  const query = `
    query Orders($cursor: String, $since: DateTime) {
      orders(first: 100, query: $since ? "created_at:>=$since" : null, after: $cursor, reverse: true) {
        edges {
          cursor
          node {
            id
            name
            createdAt
            currencyCode
            subtotalPriceSet { shopMoney { amount } }
            totalTaxSet { shopMoney { amount } }
            totalShippingPriceSet { shopMoney { amount } }
            totalPriceSet { shopMoney { amount } }
            customer { email }
            lineItems(first: 250) {
              edges {
                node {
                  id
                  title
                  sku
                  quantity
                  originalUnitPriceSet { shopMoney { amount } }
                  discountedTotalSet { shopMoney { amount } }
                }
              }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`;

  let cursor: string | null = null;
  do {
    const data = await shopifyGraphQL<any>(query, { cursor, since: since.toISOString() });
    const edges = data?.data?.orders?.edges ?? [];
    for (const e of edges) {
      const o = e.node;

      const subtotal = Math.round(parseFloat(o.subtotalPriceSet.shopMoney.amount) * 100);
      const tax = Math.round(parseFloat(o.totalTaxSet.shopMoney.amount) * 100);
      const ship = Math.round(parseFloat(o.totalShippingPriceSet.shopMoney.amount) * 100);
      const total = Math.round(parseFloat(o.totalPriceSet.shopMoney.amount) * 100);

      // Upsert the order
      const order = await prisma.order.upsert({
        where: { channelRef: o.id },
        update: {
          number: o.name,
          createdAt: new Date(o.createdAt),
          currency: o.currencyCode,
          subtotalCents: subtotal,
          taxCents: tax,
          shippingCents: ship,
          totalCents: total,
          customerEmail: o.customer?.email ?? null,
        },
        create: {
          channelId: channel.id,
          channelRef: o.id,
          number: o.name,
          createdAt: new Date(o.createdAt),
          currency: o.currencyCode,
          subtotalCents: subtotal,
          taxCents: tax,
          shippingCents: ship,
          totalCents: total,
          customerEmail: o.customer?.email ?? null,
        },
      });

      // Line items
      for (const liEdge of o.lineItems.edges) {
        const li = liEdge.node;
        const unit = Math.round(parseFloat(li.originalUnitPriceSet.shopMoney.amount) * 100);
        const lineTotal = Math.round(parseFloat(li.discountedTotalSet.shopMoney.amount) * 100);
        const sku = li.sku || undefined;

        // Ensure product by SKU
        let productId: string | undefined = undefined;
        if (sku) {
          let product = await prisma.product.findUnique({ where: { sku } });
          if (!product) {
            product = await prisma.product.create({
              data: {
                channelId: channel.id,
                sku,
                title: li.title,
                currency: o.currencyCode,
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
            title: li.title,
            quantity: li.quantity,
            priceCents: unit,
            totalCents: lineTotal,
          },
        });
      }
    }
    const pageInfo = data?.data?.orders?.pageInfo;
    cursor = pageInfo?.hasNextPage ? pageInfo.endCursor : null;
  } while (cursor);
}
