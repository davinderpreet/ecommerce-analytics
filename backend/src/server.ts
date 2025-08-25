// backend/src/server.ts - REPLACE ENTIRE FILE WITH THIS
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 8080;
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Test logging endpoint
app.get('/api/v1/test-log', (req: Request, res: Response) => {
  console.log('🧪 TEST LOG - This endpoint was hit!');
  console.log('🧪 Environment variables:');
  console.log('  SHOPIFY_SHOP_DOMAIN:', process.env.SHOPIFY_SHOP_DOMAIN);
  console.log('  SHOPIFY_ADMIN_ACCESS_TOKEN exists:', !!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN);
  
  res.json({
    message: 'Test endpoint hit - check Railway logs',
    shop: process.env.SHOPIFY_SHOP_DOMAIN,
    tokenExists: !!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
  });
});

// Health endpoint
app.get('/api/v1/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ api: 'running', database: 'ok', ts: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ api: 'running', database: 'error', error: e?.message });
  }
});

// Shopify sync endpoint with inline sync code
app.all('/api/v1/sync/shopify', async (req: Request, res: Response) => {
  console.log('🧪 SYNC ENDPOINT HIT - Starting debug');
  
  const days = Number(req.query.days ?? 7);
  console.log('🧪 Days:', days);
  console.log('🧪 Shop domain:', process.env.SHOPIFY_SHOP_DOMAIN);
  console.log('🧪 Token exists:', !!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN);
  
  try {
    console.log('🧪 Starting inline Shopify sync...');
    
    const SHOP = process.env.SHOPIFY_SHOP_DOMAIN!;
    const TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!;
    const API_VER = '2024-07';
    
    if (!SHOP || !TOKEN) {
      res.status(400).json({ ok: false, error: 'Missing Shopify credentials' });
      return;
    }
    
    console.log('🧪 About to ensure channel...');
    
    // Ensure shopify channel exists
    let channel = await prisma.channel.findUnique({ where: { code: 'shopify' } });
    if (!channel) {
      console.log('🧪 Creating shopify channel...');
      channel = await prisma.channel.create({ data: { name: 'Shopify', code: 'shopify' } });
    }
    console.log('🧪 Channel ID:', channel.id);
    
    // Calculate date range
    const since = new Date();
    since.setDate(since.getDate() - days);
    console.log('🧪 Fetching orders since:', since.toISOString());
    
    // GraphQL query - fixed syntax
    const query = `
      query Orders($since: DateTime) {
        orders(first: 25, query: "created_at:>=$since", reverse: true) {
          edges {
            node {
              id name createdAt currencyCode
              totalPriceSet { shopMoney { amount } }
              subtotalPriceSet { shopMoney { amount } }
              totalTaxSet { shopMoney { amount } }
              totalShippingPriceSet { shopMoney { amount } }
              customer { email }
            }
          }
        }
      }`;
    
    console.log('🧪 About to make GraphQL request...');
    
    // Make API call
    const response = await fetch(`https://${SHOP}/admin/api/${API_VER}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': TOKEN,
      },
      body: JSON.stringify({ 
        query, 
        variables: { since: since.toISOString() } 
      }),
    });
    
    console.log('🧪 GraphQL response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🧪 GraphQL request failed:', errorText);
      res.status(500).json({ ok: false, error: `Shopify API error: ${response.status}` });
      return;
    }
    
    const data: any = await response.json();
    console.log('🧪 GraphQL response received');
    console.log('🧪 Response keys:', Object.keys(data || {}));
    
    if (data.errors) {
      console.error('🧪 GraphQL errors:', data.errors);
      res.status(500).json({ ok: false, error: 'GraphQL errors', details: data.errors });
      return;
    }
    
    const orders = data?.data?.orders?.edges ?? [];
    console.log('🧪 Found orders:', orders.length);
    
    let processedCount = 0;
    for (const edge of orders) {
      const order = edge.node;
      console.log('🧪 Processing order:', order.name, 'Total:', order.totalPriceSet.shopMoney.amount);
      
      const totalCents = Math.round(parseFloat(order.totalPriceSet.shopMoney.amount) * 100);
      const subtotalCents = Math.round(parseFloat(order.subtotalPriceSet.shopMoney.amount) * 100);
      const taxCents = Math.round(parseFloat(order.totalTaxSet.shopMoney.amount) * 100);
      const shippingCents = Math.round(parseFloat(order.totalShippingPriceSet.shopMoney.amount) * 100);
      
      try {
        const savedOrder = await prisma.order.create({
          data: {
            channelId: channel.id,
            channelRef: order.id,
            number: order.name,
            createdAt: new Date(order.createdAt),
            currency: order.currencyCode,
            subtotalCents,
            taxCents,
            shippingCents,
            totalCents,
            customerEmail: order.customer?.email ?? null,
          },
        });
        
        console.log('🧪 Saved order:', savedOrder.number, 'ID:', savedOrder.id);
        processedCount++;
        
      } catch (dbError: any) {
        if (dbError.code === 'P2002') {
          console.log('🧪 Order already exists:', order.name);
        } else {
          console.error('🧪 Database error:', dbError.message);
        }
      }
    }
    
    console.log('🧪 Sync complete! Processed:', processedCount, 'orders');
    
    res.json({ ok: true, source: 'shopify', days, found: orders.length, processed: processedCount });
    
  } catch (error: any) {
    console.error('🧪 Sync failed:', error.message);
    console.error('🧪 Error stack:', error.stack);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Analytics endpoints
app.get('/api/v1/analytics/dashboard-summary', async (req: Request, res: Response) => {
  try {
    const range = String(req.query.range ?? '7d');
    const days = Number(range.replace('d', '')) || 7;

    const end = new Date(); 
    end.setHours(23,59,59,999);
    const start = new Date(end); 
    start.setHours(0,0,0,0); 
    start.setDate(end.getDate() - (days - 1));

    const channels = await prisma.channel.findMany();
    const orders = await prisma.order.findMany({ 
      where: { createdAt: { gte: start, lte: end } } 
    });

    const totalOrders = orders.length;
    const revenueCents = orders.reduce((s, o) => s + (o.totalCents || 0), 0);
    const totalRevenue = revenueCents / 100;
    const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

    // Build sales trend
    const trendMap = new Map<string, { revenueCents: number; orders: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start); 
      d.setDate(start.getDate() + i);
      const dateKey = d.toISOString().slice(0,10);
      trendMap.set(dateKey, { revenueCents: 0, orders: 0 });
    }
    
    for (const o of orders) {
      const dateKey = o.createdAt.toISOString().slice(0,10);
      const trend = trendMap.get(dateKey);
      if (trend) {
        trend.revenueCents += (o.totalCents || 0);
        trend.orders += 1;
      }
    }

    const salesTrend = Array.from(trendMap.entries())
      .sort(([a],[b]) => a < b ? -1 : 1)
      .map(([date, v]) => ({
        date,
        revenue: v.revenueCents / 100,
        orders: v.orders,
        aov: v.orders ? (v.revenueCents / 100) / v.orders : 0
      }));

    res.json({
      success: true,
      range: { start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10), days },
      totalRevenue,
      totalOrders,
      avgOrderValue,
      revenueGrowth: null,
      platformComparison: [],
      salesTrend,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message });
  }
});

app.get('/api/v1/analytics/metrics', async (req: Request, res: Response) => {
  try {
    const platform = String(req.query.platform ?? 'all');
    const today = new Date();
    const start = new Date(req.query.start_date as string || today.toISOString().slice(0,10));
    const end = new Date(req.query.end_date as string || today.toISOString().slice(0,10));

    const orders = await prisma.order.findMany({ 
      where: { createdAt: { gte: start, lte: end } },
      select: { totalCents: true }
    });
    
    const totalOrders = orders.length;
    const totalRevenueCents = orders.reduce((s, o) => s + (o.totalCents || 0), 0);
    const avgOrderValueCents = totalOrders ? Math.round(totalRevenueCents / totalOrders) : 0;

    res.json({
      success: true,
      filters: { 
        start_date: start.toISOString().slice(0,10), 
        end_date: end.toISOString().slice(0,10), 
        platform 
      },
      totalRevenue: totalRevenueCents / 100,
      totalOrders,
      avgOrderValue: avgOrderValueCents / 100,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message });
  }
});

app.get('/api/v1/analytics/sales-trend', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const start = new Date(req.query.start_date as string || new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0,10));
    const end = new Date(req.query.end_date as string || today.toISOString().slice(0,10));

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdAt: true, totalCents: true },
    });

    const dayMap = new Map<string, { revenueCents: number; orders: number }>();
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86_400_000)) {
      dayMap.set(d.toISOString().slice(0,10), { revenueCents: 0, orders: 0 });
    }
    
    for (const o of orders) {
      const dateKey = o.createdAt.toISOString().slice(0,10);
      const agg = dayMap.get(dateKey);
      if (agg) {
        agg.revenueCents += (o.totalCents || 0);
        agg.orders += 1;
      }
    }

    const trend = Array.from(dayMap.entries())
      .sort(([a],[b]) => a < b ? -1 : 1)
      .map(([date, v]) => ({
        date,
        revenue: v.revenueCents / 100,
        orders: v.orders,
        aov: v.orders ? (v.revenueCents / 100) / v.orders : 0
      }));

    res.json({ 
      success: true, 
      start: start.toISOString().slice(0,10), 
      end: end.toISOString().slice(0,10), 
      data: trend 
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message });
  }
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'E-commerce Analytics API',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      'GET /api/v1/health',
      'GET /api/v1/test-log',
      'GET /api/v1/sync/shopify?days=7',
      'GET /api/v1/analytics/dashboard-summary?range=7d'
    ]
  });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err?.stack || err);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log('📊 E-commerce Analytics API ready');
});

export default app;
