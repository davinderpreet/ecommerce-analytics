/* backend/src/integrations/shopify.ts */
import fetch from "node-fetch";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN!;
const TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!;
const API_VER = "2024-07";

// Minimal response shapes so TS is happy:
type MoneyResp = { shopMoney: { amount: string } };
type LineItemResp = {
  id: string;
  title: string;
  sku: string | null;
  quantity: number;
  originalUnitPriceSet: MoneyResp;
  discountedTotalSet: MoneyResp;
};
type OrderResp = {
  id: string;
  name: string;
  createdAt: string;
  currencyCode: string;
  subtotalPriceSet: MoneyResp;
  totalTaxSet: MoneyResp;
  totalShippingPriceSet: MoneyResp;
  totalPriceSet: MoneyResp;
  customer: { email: string | null } | null;
  lineItems: { edges: { node: LineItemResp }[] };
};
type OrdersQueryResp = {
  data?: {
    orders?: {
      edges?: { cursor: string; node: OrderResp }[];
      pageInfo?: { hasNextPage: boolean; endCursor: string | null };
    };
  };
};

async function shopifyGraphQL<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`https://${SHOP}/admin/api/${API_VER}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify GraphQL ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

async function ensureShopifyChannel() {
  let ch = await prisma.channel.findUnique({ where: { code: "shopify" } }).catch(() => null);
  if (!ch) ch = await prisma.channel.create({ data: { name: "Shopify", code: "shopify" } });
  return ch;
}

export async function syncShopifyOrders(days = 7): Promise<void> {
  if (!SHOP || !TOKEN) throw new Error("Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN");

  const channel = await ensureShopifyChannel();

  const since = new Date();
  since.setDate(since.getDate() - days);

  const query = `
    query Orders($cursor: String, $since: DateTime) {
      orders(first: 100, query: $since ? "created_at:>=$since" : null, after: $cursor, reverse: true) {
        edges {
          cursor
          node {
            id name createdAt currencyCode
            subtotalPriceSet { shopMoney { amount } }
            totalTaxSet { shopMoney { amount } }
            totalShippingPriceSet { shopMoney { amount } }
            totalPriceSet { shopMoney { amount } }
            customer { email }
            lineItems(first: 250) {
              edges {
                node {
                  id title sku quantity
                  originalUnitPriceSet { shopMoney { amount } }
                  discountedTotalSet   { shopMoney { amount } }
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
    // ✅ Explicitly type 'data' to avoid TS7022
    const data: OrdersQueryResp = await shopifyGraphQL<OrdersQueryResp>(query, {
      cursor,
      since: since.toISOString(),
    });

    const edges = data?.data?.orders?.edges ?? [];
    for (const e of edges) {
      const o: OrderResp = e.node;
      const toCents = (s: string) => Math.round(parseFloat(s || "0") * 100);

      const subtotal = toCents(o.subtotalPriceSet.shopMoney.amount);
      const tax = toCents(o.totalTaxSet.shopMoney.amount);
      const ship = toCents(o.totalShippingPriceSet.shopMoney.amount);
      const total = toCents(o.totalPriceSet.shopMoney.amount);

      // Upsert order
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
        const li: LineItemResp = liEdge.node;
        const unit = toCents(li.originalUnitPriceSet.shopMoney.amount);
        const line = toCents(li.discountedTotalSet.shopMoney.amount);
        const sku = li.sku || undefined;

        // Ensure product by SKU
        let productId: string | undefined;
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
            totalCents: line,
          },
        });
      }
    }

    // ✅ Explicitly type 'pageInfo' to avoid TS7022
    const pageInfo: { hasNextPage?: boolean; endCursor?: string | null } =
      (data?.data?.orders?.pageInfo as any) ?? {};
    cursor = pageInfo?.hasNextPage ? (pageInfo.endCursor ?? null) : null;
  } while (cursor);
}
