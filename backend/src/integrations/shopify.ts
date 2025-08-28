// backend/src/integrations/shopify.ts - COMPLETE FIXED VERSION
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN!;
const TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!;
const API_VER = '2024-07';

// Enhanced logging with timestamps
const log = (level: 'info' | 'error' | 'warn', message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} [SHOPIFY-${level.toUpperCase()}] ${message}`;
  
  if (level === 'error') {
    console.error(logMessage, data ? JSON.stringify(data, null, 2) : '');
  } else if (level === 'warn') {
    console.warn(logMessage, data ? JSON.stringify(data, null, 2) : '');
  } else {
    console.log(logMessage, data ? JSON.stringify(data, null, 2) : '');
  }
};

async function shopifyGraphQL<T>(query: string, variables: any = {}): Promise<T> {
  log('info', 'Making Shopify GraphQL request');
  
  if (!SHOP || !TOKEN) {
    throw new Error('Missing required Shopify credentials: SHOPIFY_SHOP_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN');
  }
  
  const requestBody = { query, variables };
  log('info', 'GraphQL request details', { 
    shop: SHOP, 
    hasToken: !!TOKEN,
    queryLength: query.length,
    variables 
  });
  
  try {
    const res = await fetch(`https://${SHOP}/admin/api/${API_VER}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': TOKEN,
      },
      body: JSON.stringify(requestBody)
    });
    
    log('info', 'Shopify API response received', { 
      status: res.status,
      statusText: res.statusText,
      ok: res.ok 
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      log('error', 'Shopify API request failed', { 
        status: res.status, 
        statusText: res.statusText, 
        errorText 
      });
      throw new Error(`Shopify GraphQL ${res.status}: ${errorText}`);
    }
    
    const data = await res.json();
    
    if ((data as any).errors) {
      log('error', 'GraphQL errors in response', { errors: (data as any).errors });
      throw new Error(`GraphQL errors: ${JSON.stringify((data as any).errors)}`);
    }
    
    if ((data as any).extensions?.cost) {
      log('info', 'GraphQL query cost', { cost: (data as any).extensions.cost });
    }
    
    log('info', 'GraphQL request completed successfully');
    return data as T;
    
  } catch (error: any) {
    log('error', 'GraphQL request failed with exception', { 
      message: error.message, 
      stack: error.stack 
    });
    throw error;
  }
}

async function ensureShopifyChannel() {
  log('info', 'Ensuring Shopify channel exists');
  const code = 'shopify';
  
  try {
    let existing = await prisma.channel.findUnique({ where: { code } });
    if (existing) {
      log('info', 'Found existing Shopify channel', { id: existing.id, name: existing.name });
      return existing;
    }
    
    log('info', 'Creating new Shopify channel');
    const created = await prisma.channel.create({ 
      data: { name: 'Shopify', code } 
    });
    log('info', 'Created Shopify channel successfully', { id: created.id });
    return created;
    
  } catch (error: any) {
    log('error', 'Failed to ensure Shopify channel', { message: error.message });
    throw error;
  }
}

function parseShopifyDate(dateString: string): Date {
  const parsed = new Date(dateString);
  
  if (isNaN(parsed.getTime())) {
    log('warn', 'Invalid date string from Shopify', { dateString });
    throw new Error(`Invalid date format from Shopify: ${dateString}`);
  }
  
  return parsed;
}

function formatDateForQuery(date: Date): string {
  return date.toISOString();
}

export async function syncShopifyOrders(days = 7) {
  const startTime = Date.now();
  log('info', 'Starting Shopify sync process with FIXED PAGINATION', { 
    days,
    shop: SHOP,
    hasToken: !!TOKEN 
  });
  
  if (!SHOP || !TOKEN) {
    const error = 'Missing required environment variables: SHOPIFY_SHOP_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN';
    log('error', error);
    throw new Error(error);
  }

  try {
    const channel = await ensureShopifyChannel();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    log('info', 'Sync date range calculated', { 
      startDate: startDate.toISOString(), 
      endDate: endDate.toISOString(), 
      days 
    });

    const query = `
      query Orders($cursor: String) {
        orders(first: 100, after: $cursor, sortKey: CREATED_AT, reverse: true) {
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
                    variant {
                      id
                      sku
                      product {
                        id
                        title
                      }
                    }
                  }
                }
              }
            }
          }
          pageInfo { 
            hasNextPage 
            endCursor 
          }
        }
      }`;

    let cursor: string | null = null;
    let hasNextPage = true;
    let batchCount = 0;
    let totalOrdersProcessed = 0;
    let totalOrdersCreated = 0;
    let totalOrdersUpdated = 0;
    let shouldStop = false;

    while (hasNextPage && !shouldStop) {
      batchCount++;
      log('info', `Processing batch ${batchCount}`, { cursor: cursor ? cursor.substring(0, 20) + '...' : 'START' });
      
      const data: any = await shopifyGraphQL(query, { cursor });
      
      const edges = data?.data?.orders?.edges ?? [];
      hasNextPage = data?.data?.orders?.pageInfo?.hasNextPage ?? false;
      cursor = data?.data?.orders?.pageInfo?.endCursor ?? null;
      
      log('info', `Batch ${batchCount} received`, { 
        edgesCount: edges.length, 
        hasNextPage,
        nextCursor: cursor ? cursor.substring(0, 20) + '...' : null
      });
      
      if (edges.length === 0) {
        log('info', 'No more orders in this batch, stopping pagination');
        break;
      }
      
      for (const edge of edges) {
        const order = edge.node;
        const orderDate = parseShopifyDate(order.createdAt);
        
        if (orderDate < startDate) {
          log('info', 'Reached order outside date range, stopping sync', { 
            orderDate: orderDate.toISOString(), 
            startDate: startDate.toISOString() 
          });
          shouldStop = true;
          break;
        }
        
        totalOrdersProcessed++;
        
        // FIXED: Use compound unique constraint for order lookup
        const existingOrder = await prisma.order.findUnique({
          where: {
            channelId_channelRef: {
              channelId: channel.id,
              channelRef: order.id.toString()
            }
          }
        });
        
        const orderData = {
          channelId: channel.id,
          channelRef: order.id.toString(),
          number: order.name,
          createdAt: orderDate,
          currency: order.currencyCode || 'USD',
          subtotalCents: Math.round(parseFloat(order.subtotalPriceSet?.shopMoney?.amount || '0') * 100),
          taxCents: Math.round(parseFloat(order.totalTaxSet?.shopMoney?.amount || '0') * 100),
          shippingCents: Math.round(parseFloat(order.totalShippingPriceSet?.shopMoney?.amount || '0') * 100),
          totalCents: Math.round(parseFloat(order.totalPriceSet?.shopMoney?.amount || '0') * 100),
          customerEmail: order.customer?.email || null,
        };
        
        if (existingOrder) {
          // FIXED: Use compound unique constraint for order update
          await prisma.order.update({
            where: {
              channelId_channelRef: {
                channelId: channel.id,
                channelRef: order.id.toString()
              }
            },
            data: orderData
          });
          totalOrdersUpdated++;
          log('info', `Updated order ${order.name}`);
        } else {
          const createdOrder = await prisma.order.create({
            data: orderData
          });
          totalOrdersCreated++;
          log('info', `Created order ${order.name}`);
          
          // Process line items for new orders
          for (const itemEdge of order.lineItems?.edges || []) {
            const lineItem = itemEdge.node;
            
            // Create or find product first
            const variant = lineItem.variant;
            const productSku = variant?.sku || lineItem.sku;
            
            if (productSku) {
              // FIXED: Use compound unique constraint for product lookup
              const existingProduct = await prisma.product.findUnique({
                where: {
                  channelId_sku: {
                    channelId: channel.id,
                    sku: productSku
                  }
                }
              });
              
              let productId = existingProduct?.id;
              
              if (!productId) {
                const newProduct = await prisma.product.create({
                  data: {
                    channelId: channel.id,
                    sku: productSku,
                    title: variant?.product?.title || lineItem.title || 'Unknown Product',
                    active: true
                  }
                });
                productId = newProduct.id;
                log('info', `Created product: ${productSku}`);
              }
              
              // Create order item
              await prisma.orderItem.create({
                data: {
                  orderId: createdOrder.id,
                  productId,
                  sku: productSku,
                  title: lineItem.title || 'Unknown Item',
                  quantity: lineItem.quantity || 1,
                  priceCents: Math.round(parseFloat(lineItem.originalUnitPriceSet?.shopMoney?.amount || '0') * 100),
                  totalCents: Math.round(parseFloat(lineItem.discountedTotalSet?.shopMoney?.amount || '0') * 100)
                }
              });
            }
          }
        }
      }
      
      if (batchCount >= 50) {
        log('warn', 'Reached maximum batch limit of 50, stopping to prevent infinite loop');
        break;
      }
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    log('info', 'Shopify sync completed successfully', {
      totalOrdersProcessed,
      totalOrdersCreated,
      totalOrdersUpdated,
      totalBatches: batchCount,
      durationSeconds: duration,
      ordersPerSecond: Math.round((totalOrdersProcessed / duration) * 1000)
    });
    
    return {
      success: true,
      totalOrdersProcessed,
      totalOrdersCreated,
      totalOrdersUpdated,
      totalBatches: batchCount,
      duration,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days
      }
    };
    
  } catch (error: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    log('error', 'Shopify sync failed', { 
      error: error.message, 
      stack: error.stack,
      duration 
    });
    throw error;
  }
}

// Additional function for date range sync
export async function syncShopifyOrdersDateRange(startDate: Date, endDate: Date): Promise<void> {
  if (!SHOP || !TOKEN) throw new Error('Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN');

  const channel = await ensureShopifyChannel();

  // Build the date query string directly
  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();
  
  const query = `
    query Orders($cursor: String) {
      orders(first: 100, query: "created_at:>=${startISO} AND created_at:<=${endISO}", after: $cursor, reverse: true) {
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
                  discountedTotalSet { shopMoney { amount } }
                  variant {
                    id
                    sku
                    product {
                      id
                      title
                    }
                  }
                }
              }
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`;

  let cursor: string | null = null;
  let orderCount = 0;
  let hasNextPage = true;

  console.log(`📅 Syncing orders from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

  do {
    const data: any = await shopifyGraphQL(query, { cursor });

    const edges = data?.data?.orders?.edges ?? [];
    hasNextPage = data?.data?.orders?.pageInfo?.hasNextPage ?? false;
    cursor = data?.data?.orders?.pageInfo?.endCursor ?? null;

    for (const edge of edges) {
      const order = edge.node;
      
      // FIXED: Use compound unique constraint for upsert
      await prisma.order.upsert({
        where: {
          channelId_channelRef: {
            channelId: channel.id,
            channelRef: order.id.toString()
          }
        },
        update: {
          number: order.name,
          createdAt: new Date(order.createdAt),
          currency: order.currencyCode,
          subtotalCents: Math.round(parseFloat(order.subtotalPriceSet?.shopMoney?.amount || '0') * 100),
          taxCents: Math.round(parseFloat(order.totalTaxSet?.shopMoney?.amount || '0') * 100),
          shippingCents: Math.round(parseFloat(order.totalShippingPriceSet?.shopMoney?.amount || '0') * 100),
          totalCents: Math.round(parseFloat(order.totalPriceSet?.shopMoney?.amount || '0') * 100),
          customerEmail: order.customer?.email || null,
        },
        create: {
          channelId: channel.id,
          channelRef: order.id.toString(),
          number: order.name,
          createdAt: new Date(order.createdAt),
          currency: order.currencyCode,
          subtotalCents: Math.round(parseFloat(order.subtotalPriceSet?.shopMoney?.amount || '0') * 100),
          taxCents: Math.round(parseFloat(order.totalTaxSet?.shopMoney?.amount || '0') * 100),
          shippingCents: Math.round(parseFloat(order.totalShippingPriceSet?.shopMoney?.amount || '0') * 100),
          totalCents: Math.round(parseFloat(order.totalPriceSet?.shopMoney?.amount || '0') * 100),
          customerEmail: order.customer?.email || null,
        },
      });

      // Process line items
      for (const itemEdge of order.lineItems?.edges || []) {
        const lineItem = itemEdge.node;
        const productSku = lineItem.variant?.sku || lineItem.sku;
        
        if (productSku) {
          // FIXED: Use compound unique constraint for product lookup
          const product = await prisma.product.findUnique({
            where: {
              channelId_sku: {
                channelId: channel.id,
                sku: productSku
              }
            }
          });
          
          if (!product) {
            await prisma.product.create({
              data: {
                channelId: channel.id,
                sku: productSku,
                title: lineItem.variant?.product?.title || lineItem.title || 'Unknown Product',
                active: true
              }
            });
          }
        }
      }

      orderCount++;
    }

    console.log(`📋 Processed ${orderCount} orders so far...`);
  } while (hasNextPage);

  console.log(`✅ Completed: ${orderCount} orders synced`);
}
