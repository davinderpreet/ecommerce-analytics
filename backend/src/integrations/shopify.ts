// backend/src/integrations/shopify.ts - COMPLETE FINAL FIXED VERSION
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
    hasToken: !!TOKEN,
    apiVersion: API_VER
  });
  
  if (!SHOP || !TOKEN) {
    const error = 'Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN';
    log('error', error);
    throw new Error(error);
  }

  try {
    // Ensure channel exists
    const channel = await ensureShopifyChannel();
    
    // Calculate date range with proper timezone handling
    const endDate = new Date(); // Current time
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    const sinceISO = formatDateForQuery(startDate);
    const untilISO = formatDateForQuery(endDate);
    
    log('info', 'Sync date range calculated', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      startLocal: startDate.toLocaleString(),
      endLocal: endDate.toLocaleString(),
      sinceISO,
      untilISO,
      daysDiff: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    });

    // FIXED: Corrected GraphQL query - removed invalid fields and fixed variable usage
    const query = `
      query Orders($cursor: String) {
        orders(first: 100, query: "created_at:>=${sinceISO}", after: $cursor, reverse: true) {
          edges {
            cursor
            node {
              id
              name
              createdAt
              updatedAt
              currencyCode
              subtotalPriceSet { shopMoney { amount currencyCode } }
              totalTaxSet { shopMoney { amount currencyCode } }
              totalShippingPriceSet { shopMoney { amount currencyCode } }
              totalPriceSet { shopMoney { amount currencyCode } }
              customer { 
                id
                email 
                firstName
                lastName
              }
              lineItems(first: 250) {
                edges {
                  node {
                    id
                    title
                    sku
                    quantity
                    originalUnitPriceSet { shopMoney { amount currencyCode } }
                    discountedTotalSet { shopMoney { amount currencyCode } }
                    product {
                      id
                      handle
                    }
                  }
                }
              }
              tags
            }
          }
          pageInfo { 
            hasNextPage 
            endCursor 
          }
        }
      }`;

    let cursor: string | null = null;
    let totalOrdersProcessed = 0;
    let totalOrdersCreated = 0;
    let totalOrdersUpdated = 0;
    let batchCount = 0;
    let hasNextPage = true;

    // FIXED: Proper pagination loop - continue until no more pages
    do {
      batchCount++;
      log('info', `Processing batch ${batchCount}`, { cursor: cursor || 'initial' });
      
      try {
        const data: any = await shopifyGraphQL<any>(query, { 
          cursor
        });
        
        const edges = data?.data?.orders?.edges ?? [];
        const pageInfo: any = data?.data?.orders?.pageInfo;
        hasNextPage = pageInfo?.hasNextPage || false;
        const nextCursor = pageInfo?.endCursor;
        
        log('info', `Batch ${batchCount} retrieved`, { 
          ordersCount: edges.length,
          hasNextPage,
          nextCursor: nextCursor || 'none',
          totalSoFar: totalOrdersProcessed
        });

        if (edges.length === 0) {
          log('info', `No orders found in batch ${batchCount}`);
          break;
        }

        // Process each order in the batch
        for (const edge of edges) {
          const order = edge.node;
          const orderCreatedAt = parseShopifyDate(order.createdAt);
          const orderUpdatedAt = parseShopifyDate(order.updatedAt);
          
          log('info', `Processing order ${order.name}`, {
            id: order.id,
            name: order.name,
            createdAt: order.createdAt,
            total: order.totalPriceSet.shopMoney.amount,
            currency: order.currencyCode,
            lineItemsCount: order.lineItems.edges.length
          });
          
          // Convert currency amounts to cents
          const toCents = (amountString: string) => {
            const amount = parseFloat(amountString || '0');
            if (isNaN(amount)) {
              log('warn', 'Invalid amount string', { amountString, orderId: order.id });
              return 0;
            }
            return Math.round(amount * 100);
          };

          const subtotalCents = toCents(order.subtotalPriceSet.shopMoney.amount);
          const taxCents = toCents(order.totalTaxSet.shopMoney.amount);
          const shippingCents = toCents(order.totalShippingPriceSet.shopMoney.amount);
          const totalCents = toCents(order.totalPriceSet.shopMoney.amount);

          try {
            // Upsert order with enhanced conflict handling
            const existingOrder = await prisma.order.findUnique({
  where: { 
    channelId_channelRef: {
      channelId: channel.id,
      channelRef: order.id.toString()
    }
  }
})

            let savedOrder;
            if (existingOrder) {
              // Update existing order
              savedOrder = await prisma.order.update({
                where: { channelRef: order.id },
                data: {
                  number: order.name,
                  createdAt: orderCreatedAt,
                  updatedAt: orderUpdatedAt,
                  currency: order.currencyCode,
                  subtotalCents,
                  taxCents,
                  shippingCents,
                  totalCents,
                  customerEmail: order.customer?.email || null,
                },
              });
              totalOrdersUpdated++;
              log('info', `Updated existing order ${order.name}`, { id: savedOrder.id });
            } else {
              // Create new order
              savedOrder = await prisma.order.create({
                data: {
                  channelId: channel.id,
                  channelRef: order.id,
                  number: order.name,
                  createdAt: orderCreatedAt,
                  updatedAt: orderUpdatedAt,
                  currency: order.currencyCode,
                  subtotalCents,
                  taxCents,
                  shippingCents,
                  totalCents,
                  customerEmail: order.customer?.email || null,
                },
              });
              totalOrdersCreated++;
              log('info', `Created new order ${order.name}`, { id: savedOrder.id });
            }

            // Process line items with enhanced error handling
            const lineItems = order.lineItems.edges;
            
            // First, clean up existing line items for updates
            if (existingOrder) {
              await prisma.orderItem.deleteMany({
                where: { orderId: savedOrder.id }
              });
            }
            
            for (const liEdge of lineItems) {
              const lineItem = liEdge.node;
              const unitCents = toCents(lineItem.originalUnitPriceSet.shopMoney.amount);
              const totalItemCents = toCents(lineItem.discountedTotalSet.shopMoney.amount);
              const sku = lineItem.sku || undefined;

              // Handle product creation/lookup by SKU
              let productId: string | undefined;
              if (sku) {
                try {
                  let product = await prisma.product.findUnique({where: { channelId_sku: {channelId: channel.id, sku: variant.sku }}})
                  if (!product) {
                    product = await prisma.product.create({
                      data: {
                        channelId: channel.id,
                        sku,
                        title: lineItem.title,
                        channelRef: lineItem.product?.id,
                        currency: order.currencyCode,
                        priceCents: unitCents,
                      },
                    });
                  } else {
                    // Update product info if needed
                    product = await prisma.product.update({
                      where: { id: product.id },
                      data: {
                        title: lineItem.title,
                        priceCents: unitCents,
                        updatedAt: new Date(),
                      },
                    });
                  }
                  productId = product.id;
                } catch (productError: any) {
                  log('error', `Failed to handle product ${sku}`, { 
                    error: productError.message,
                    sku,
                    title: lineItem.title 
                  });
                }
              }

              // Create order item
              try {
                await prisma.orderItem.create({
                  data: {
                    orderId: savedOrder.id,
                    productId,
                    sku,
                    title: lineItem.title,
                    quantity: lineItem.quantity,
                    priceCents: unitCents,
                    totalCents: totalItemCents,
                  },
                });
              } catch (itemError: any) {
                log('error', `Failed to create order item`, { 
                  error: itemError.message,
                  orderId: savedOrder.id,
                  title: lineItem.title 
                });
              }
            }

            totalOrdersProcessed++;
            
          } catch (dbError: any) {
            log('error', `Database error processing order ${order.name}`, { 
              error: dbError.message,
              code: dbError.code,
              orderId: order.id 
            });
          }
        }
        
        // Update cursor for next page
        cursor = hasNextPage ? nextCursor : null;
        
        log('info', `Batch ${batchCount} completed`, {
          processedInBatch: edges.length,
          hasNextPage,
          nextCursor: cursor || 'none',
          totalProcessedSoFar: totalOrdersProcessed
        });

        // Add small delay between batches to respect API limits
        if (hasNextPage) {
          await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
        }
        
      } catch (batchError: any) {
        log('error', `Failed to process batch ${batchCount}`, { 
          error: batchError.message,
          cursor 
        });
        break; // Break on batch errors
      }
      
    } while (hasNextPage && cursor); // FIXED: Continue while there are more pages

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    log('info', 'Shopify sync completed successfully with FIXED PAGINATION', {
      totalBatches: batchCount,
      totalOrdersProcessed,
      totalOrdersCreated,
      totalOrdersUpdated,
      durationMs: duration,
      durationSeconds: Math.round(duration / 1000),
      averageOrdersPerSecond: Math.round((totalOrdersProcessed / duration) * 1000)
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

export async function syncShopifyOrdersDateRange(startDate: Date, endDate: Date): Promise<void> {
  if (!SHOP || !TOKEN) throw new Error('Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN');

  const channel = await ensureShopifyChannel();

  // Build the date query string directly
  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();
  
  // FIXED: Simple query with embedded date values
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
  let orderCount = 0;
  let hasNextPage = true;

  console.log(`📅 Syncing orders from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

  // FIXED: Proper pagination for date range sync
  do {
    const data: any = await shopifyGraphQL(query, {
      cursor
    });

    const edges = data?.data?.orders?.edges ?? [];
    const pageInfo: any = data?.data?.orders?.pageInfo;
    hasNextPage = pageInfo?.hasNextPage || false;
    
    console.log(`📦 Found ${edges.length} orders in this batch`);
    
    for (const e of edges) {
      const o = e.node;
      const toCents = (s: string) => Math.round(parseFloat(s || "0") * 100);

      const subtotal = toCents(o.subtotalPriceSet.shopMoney.amount);
      const tax = toCents(o.totalTaxSet.shopMoney.amount);
      const ship = toCents(o.totalShippingPriceSet.shopMoney.amount);
      const total = toCents(o.totalPriceSet.shopMoney.amount);

      console.log(`📦 Processing order: ${o.name} from ${o.createdAt} - $${total/100}`);

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

      // Process line items
      for (const liEdge of o.lineItems.edges) {
        const li = liEdge.node;
        const unit = toCents(li.originalUnitPriceSet.shopMoney.amount);
        const line = toCents(li.discountedTotalSet.shopMoney.amount);
        const sku = li.sku || undefined;

        // Handle product
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

        // Check if order item already exists to avoid duplicates
        const existingItem = await prisma.orderItem.findFirst({
          where: {
            orderId: order.id,
            sku: sku || undefined,
            title: li.title,
          },
        });

        if (!existingItem) {
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
      
      orderCount++;
    }

    cursor = hasNextPage ? pageInfo?.endCursor : null;
    
    // Add delay between requests
    if (hasNextPage) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } while (hasNextPage && cursor);

  console.log(`✅ Synced ${orderCount} orders for date range`);
}
