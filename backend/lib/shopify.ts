// backend/lib/shopify.ts - COMPLETE FILE WITH ENHANCED DATE HANDLING AND DEBUGGING
import { prisma } from './prisma';

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
      body: JSON.stringify(requestBody),
      // Ensure fresh data, no caching
      cache: 'no-store',
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
    
    if (data.errors) {
      log('error', 'GraphQL errors in response', { errors: data.errors });
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }
    
    if (data.extensions?.cost) {
      log('info', 'GraphQL query cost', { cost: data.extensions.cost });
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

// FIXED: Enhanced date handling and parsing
function parseShopifyDate(dateString: string): Date {
  // Shopify returns ISO 8601 formatted dates
  const parsed = new Date(dateString);
  
  if (isNaN(parsed.getTime())) {
    log('warn', 'Invalid date string from Shopify', { dateString });
    throw new Error(`Invalid date format from Shopify: ${dateString}`);
  }
  
  return parsed;
}

function formatDateForQuery(date: Date): string {
  // Format date for Shopify GraphQL query (ISO 8601)
  return date.toISOString();
}

export async function syncShopifyOrders(days = 7) {
  const startTime = Date.now();
  log('info', 'Starting Shopify sync process', { 
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
    
    // FIXED: Calculate date range with proper timezone handling
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

    // Enhanced GraphQL query with better field selection
    const query = `
      query Orders($cursor: String, $since: DateTime, $until: DateTime) {
        orders(first: 50, query: $since ? "created_at:>=$since" : null, after: $cursor, reverse: true) {
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
              fulfillmentStatus
              financialStatus
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
    const maxBatches = 20; // Safety limit

    do {
      batchCount++;
      log('info', `Processing batch ${batchCount}`, { cursor: cursor || 'initial' });
      
      try {
        const data = await shopifyGraphQL<any>(query, { 
          cursor, 
          since: sinceISO,
          until: untilISO
        });
        
        const edges = data?.data?.orders?.edges ?? [];
        log('info', `Batch ${batchCount} retrieved`, { 
          ordersCount: edges.length,
          hasData: !!data?.data,
          hasOrders: !!data?.data?.orders
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
            createdAtParsed: orderCreatedAt.toISOString(),
            createdAtLocal: orderCreatedAt.toLocaleString(),
            total: order.totalPriceSet.shopMoney.amount,
            currency: order.currencyCode,
            lineItemsCount: order.lineItems.edges.length,
            fulfillmentStatus: order.fulfillmentStatus,
            financialStatus: order.financialStatus
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
          
          log('info', `Order ${order.name} amounts calculated`, {
            subtotalCents,
            taxCents,
            shippingCents,
            totalCents,
            totalDollars: totalCents / 100
          });

          try {
            // Upsert order with enhanced conflict handling
            const existingOrder = await prisma.order.findUnique({
              where: { channelRef: order.id }
            });

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
            log('info', `Processing ${lineItems.length} line items for order ${order.name}`);
            
            // First, clean up existing line items for updates
            if (existingOrder) {
              await prisma.orderItem.deleteMany({
                where: { orderId: savedOrder.id }
              });
              log('info', `Cleaned up existing line items for order ${order.name}`);
            }
            
            for (const liEdge of lineItems) {
              const lineItem = liEdge.node;
              const unitCents = toCents(lineItem.originalUnitPriceSet.shopMoney.amount);
              const totalItemCents = toCents(lineItem.discountedTotalSet.shopMoney.amount);
              const sku = lineItem.sku || undefined;

              log('info', `Processing line item`, {
                orderId: order.id,
                lineItemId: lineItem.id,
                title: lineItem.title,
                sku,
                quantity: lineItem.quantity,
                unitCents,
                totalItemCents
              });

              // Handle product creation/lookup by SKU
              let productId: string | undefined;
              if (sku) {
                try {
                  let product = await prisma.product.findUnique({ where: { sku } });
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
                    log('info', `Created product ${sku} - ${lineItem.title}`, { id: product.id });
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
                    log('info', `Updated product ${sku}`, { id: product.id });
                  }
                  productId = product.id;
                } catch (productError: any) {
                  log('error', `Failed to handle product ${sku}`, { 
                    error: productError.message,
                    sku,
                    title: lineItem.title 
                  });
                  // Continue without product ID
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
                log('info', `Created order item for ${lineItem.title}`);
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
            // Continue processing other orders
          }
        }
        
        // Check for next page
        const pageInfo = data?.data?.orders?.pageInfo;
        const hasNextPage = pageInfo?.hasNextPage;
        cursor = hasNextPage ? pageInfo.endCursor : null;
        
        log('info', `Batch ${batchCount} completed`, {
          processedInBatch: edges.length,
          hasNextPage,
          nextCursor: cursor || 'none',
          totalProcessedSoFar: totalOrdersProcessed
        });
        
      } catch (batchError: any) {
        log('error', `Failed to process batch ${batchCount}`, { 
          error: batchError.message,
          cursor 
        });
        // Break on batch errors to avoid infinite loops
        break;
      }
      
    } while (cursor && batchCount < maxBatches);

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    log('info', 'Shopify sync completed successfully', {
      totalBatches: batchCount,
      totalOrdersProcessed,
      totalOrdersCreated,
      totalOrdersUpdated,
      durationMs: duration,
      durationSeconds: Math.round(duration / 1000),
      averageOrdersPerSecond: Math.round((totalOrdersProcessed / duration) * 1000)
    });
    
    if (totalOrdersProcessed === 0) {
      log('warn', 'No orders were processed in the specified date range', {
        days,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
    }
    
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
