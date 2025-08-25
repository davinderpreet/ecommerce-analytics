// backend/lib/shopify.ts - REPLACE ENTIRE FILE WITH THIS
import { prisma } from './prisma';

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN!;
const TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!;
const API_VER = '2024-07';

async function shopifyGraphQL<T>(query: string, variables: any = {}): Promise<T> {
  console.log('🔄 Making Shopify GraphQL request...');
  
  const res = await fetch(`https://${SHOP}/admin/api/${API_VER}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });
  
  console.log('📡 Shopify API response status:', res.status);
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('❌ Shopify API error:', res.status, errorText);
    throw new Error(`Shopify GraphQL ${res.status}: ${errorText}`);
  }
  
  const data = await res.json();
  console.log('✅ Shopify API response received successfully');
  
  if (data.errors) {
    console.error('❌ GraphQL errors:', data.errors);
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
  }
  
  return data as T;
}

async function ensureShopifyChannel() {
  console.log('🏪 Ensuring Shopify channel exists...');
  const code = 'shopify';
  let existing = await prisma.channel.findUnique({ where: { code } });
  if (existing) {
    console.log('✅ Found existing Shopify channel:', existing.id);
    return existing;
  }
  
  console.log('🔧 Creating new Shopify channel');
  const created = await prisma.channel.create({ data: { name: 'Shopify', code } });
  console.log('✅ Created Shopify channel:', created.id);
  return created;
}

export async function syncShopifyOrders(days = 7) {
  console.log('🛍️ Starting Shopify sync process...');
  console.log('📊 Shop:', SHOP);
  console.log('🔑 Token exists:', !!TOKEN);
  console.log('📅 Days to sync:', days);
  
  if (!SHOP || !TOKEN) {
    console.error('❌ Missing Shopify credentials');
    throw new Error('Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN');
  }

  try {
    const channel = await ensureShopifyChannel();
    const since = new Date();
    since.setDate(since.getDate() - days);
    console.log('📅 Fetching orders since:', since.toISOString());

    const query = `
      query Orders($cursor: String, $since: DateTime) {
        orders(first: 25, query: $since ? "created_at:>=$since" : null, after: $cursor, reverse: true) {
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
    let totalOrdersProcessed = 0;
    let batchCount = 0;

    do {
      batchCount++;
      console.log(`🔄 Fetching batch #${batchCount} (cursor: ${cursor || 'initial'})`);
      
      const data = await shopifyGraphQL<any>(query, { cursor, since: since.toISOString() });
      
      console.log('📦 Raw GraphQL response keys:', Object.keys(data));
      console.log('📦 Data structure:', data.data ? Object.keys(data.data) : 'No data key');
      
      const edges = data?.data?.orders?.edges ?? [];
      console.log(`📦 Found ${edges.length} orders in this batch`);

      if (edges.length === 0) {
        console.log('📭 No orders found in this batch');
      }

      for (const e of edges) {
        const o = e.node;
        console.log(`💾 Processing order: ${o.name} (${o.id}) - $${o.totalPriceSet.shopMoney.amount}`);
        
        const cents = (x: string) => Math.round(parseFloat(x || '0') * 100);

        try {
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

          console.log(`✅ Saved order: ${order.number} ($${order.totalCents/100})`);

          // Process line items
          const lineItems = o.lineItems.edges;
          console.log(`📝 Processing ${lineItems.length} line items for order ${o.name}`);
          
          for (const liEdge of lineItems) {
            const li = liEdge.node;
            const unit = cents(li.originalUnitPriceSet.shopMoney.amount);
            const line = cents(li.discountedTotalSet.shopMoney.amount);
            const sku = li.sku || undefined;

            let productId: string | undefined;
            if (sku) {
              let product = await prisma.product.findUnique({ where: { sku } });
              if (!product) {
                product = await prisma.product.create({
                  data: { channelId: channel.id, sku, title: li.title, currency: o.currencyCode },
                });
                console.log(`➕ Created product: ${sku} - ${li.title}`);
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

          totalOrdersProcessed++;
          
        } catch (dbError: any) {
          console.error(`❌ Database error for order ${o.name}:`, dbError.message);
        }
      }
      
      const pageInfo = data?.data?.orders?.pageInfo;
      cursor = pageInfo?.hasNextPage ? pageInfo.endCursor : null;
      console.log(`📄 Has next page: ${pageInfo?.hasNextPage}, Next cursor: ${cursor || 'none'}`);
      
    } while (cursor && batchCount < 10); // Safety limit

    console.log(`🎉 Shopify sync completed! Processed ${totalOrdersProcessed} orders in ${batchCount} batches`);
    
    if (totalOrdersProcessed === 0) {
      console.log('⚠️  No orders were found or processed in the specified date range');
    }
    
  } catch (error: any) {
    console.error('💥 Shopify sync failed:', error.message);
    console.error('💥 Error stack:', error.stack);
    throw error;
  }
}
