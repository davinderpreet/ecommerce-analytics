import { prisma } from './prisma';

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN!;
const TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!;
const API_VER = '2024-07';

async function shopifyGraphQL<T>(query: string, variables: any = {}): Promise<T> {
  const res = await fetch(`https://${SHOP}/admin/api/${API_VER}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Shopify GraphQL ${res.status}: ${await res.text()}`);
  return (await res.json()) as any;
}

async function ensureShopifyChannel() {
  const code = 'shopify';
  const existing = await prisma.channel.findUnique({ where: { code } });
  if (existing) return existing;
  return prisma.channel.create({ data: { name: 'Shopify', code } });
}

export async function syncShopifyOrders(days = 7) {
  if (!SHOP || !TOKEN) throw new Error('Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN');

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
    const data = await shopifyGraphQL<any>(query, { cursor, since: since.toISOString() });
    const edges = data?.data?.orders?.edges ?? [];
    for (const e of edges) {
      const o = e.node;
      const cents = (x: string) => Math.round(parseFloat(x) * 100);

      const order = await prisma.order.upsert({
        where: { channelRef: o.id },
        update: {
          number: o.name,
          createdAt: new Date(o.createdAt),
          currency: o.currencyCode,
          subtotalCents: cents(o.subtotalPriceSet.shopMoney.amount),
          taxCents: cents(o.totalTaxSet.shopMoney.amount),
          shippingCents: cents(o.totalShippingPriceSet.shopMoney.amount),
          totalCents: cents(o.totalPriceSet.shopMoney.amount),
          customerEmail: o.customer?.email ?? null,
        },
        create: {
          channelId: channel.id,
          channelRef: o.id,
          number: o.name,
          createdAt: new Date(o.createdAt),
          currency: o.currencyCode,
          subtotalCents: cents(o.subtotalPriceSet.shopMoney.amount),
          taxCents: cents(o.totalTaxSet.shopMoney.amount),
          shippingCents: cents(o.totalShippingPriceSet.shopMoney.amount),
          totalCents: cents(o.totalPriceSet.shopMoney.amount),
          customerEmail: o.customer?.email ?? null,
        },
      });

      for (const liEdge of o.lineItems.edges) {
        const li = liEdge.node;
        const unit = Math.round(parseFloat(li.originalUnitPriceSet.shopMoney.amount) * 100);
        const line = Math.round(parseFloat(li.discountedTotalSet.shopMoney.amount) * 100);

        let productId: string | undefined;
        if (li.sku) {
          let product = await prisma.product.findUnique({ where: { sku: li.sku } });
          if (!product) {
            product = await prisma.product.create({
              data: { channelId: channel.id, sku: li.sku, title: li.title, currency: o.currencyCode },
            });
          }
          productId = product.id;
        }

        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            productId,
            sku: li.sku || undefined,
            title: li.title,
            quantity: li.quantity,
            priceCents: unit,
            totalCents: line,
          },
        });
      }
    }
    const pageInfo = data?.data?.orders?.pageInfo;
    cursor = pageInfo?.hasNextPage ? pageInfo.endCursor : null;
  } while (cursor);
}
