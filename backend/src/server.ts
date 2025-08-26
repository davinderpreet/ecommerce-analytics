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

// FIXED: Robust date handling utilities with proper timezone support
const DateUtils = {
  // Parse date string to proper start/end of day in local timezone
  parseFilterDate: (dateStr: string | undefined, defaultDate?: Date) => {
    if (!dateStr) {
      if (!defaultDate) return null;
      dateStr = defaultDate.toISOString().slice(0, 10);
    }
    
    // Parse as local date, not UTC
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) {
      throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
    }
    
    // Create dates in local timezone
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
    
    if (isNaN(startOfDay.getTime()) || isNaN(endOfDay.getTime())) {
      throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
    }
    
    return {
      startOfDay,
      endOfDay,
      dateStr
    };
  },

  // Get date range for relative periods (7d, 30d, etc) in local timezone
  getRelativeDateRange: (days: number) => {
    const now = new Date();
    
    // End of today in local timezone
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    // Start of N days ago in local timezone
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1), 0, 0, 0, 0);
    
    return {
      start,
      end,
      startStr: DateUtils.formatDateKey(start),
      endStr: DateUtils.formatDateKey(end),
      days
    };
  },

  // Format date for consistent API responses (local date)
  formatDateKey: (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  
  // Convert cents to dollars
  toDollars: (cents: number | null | undefined) => ((cents ?? 0) / 100),

  // Get today's date range in local timezone
  getTodayRange: () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return {
      start: new Date(today.getTime()), // 00:00:00
      end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1), // 23:59:59.999
      dateStr: DateUtils.formatDateKey(today)
    };
  },

  // Get yesterday's date range in local timezone
  getYesterdayRange: () => {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return {
      start: new Date(yesterday.getTime()), // 00:00:00
      end: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1), // 23:59:59.999
      dateStr: DateUtils.formatDateKey(yesterday)
    };
  }
};

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
    
    // Calculate date range using improved date utilities
    const dateRange = DateUtils.getRelativeDateRange(days);
    console.log('🧪 Fetching orders since:', dateRange.start.toISOString());
    
    // GraphQL query - removed customer field due to permissions
    const sinceDate = dateRange.start.toISOString();
    const query = `
      query {
        orders(first: 25, query: "created_at:>=${sinceDate}", reverse: true) {
          edges {
            node {
              id name createdAt currencyCode
              totalPriceSet { shopMoney { amount } }
              subtotalPriceSet { shopMoney { amount } }
              totalTaxSet { shopMoney { amount } }
              totalShippingPriceSet { shopMoney { amount } }
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
      body: JSON.stringify({ query }),
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
      console.log('🧪 Processing order:', order.name, 'Total:', order.totalPriceSet.shopMoney.amount, 'Date:', order.createdAt);
      
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
            customerEmail: null, // Remove customer data due to permissions
          },
        });
        
        console.log('🧪 Saved order:', savedOrder.number, 'ID:', savedOrder.id, 'Created:', savedOrder.createdAt);
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

// NEW: Today's data endpoint
app.get('/api/v1/analytics/today', async (req: Request, res: Response) => {
  try {
    console.log('📅 Today endpoint hit');
    const platform = String(req.query.platform ?? 'all');
    const todayRange = DateUtils.getTodayRange();
    
    console.log('📅 Today range:', todayRange.start, 'to', todayRange.end);
    
    let whereClause: any = {
      createdAt: { gte: todayRange.start, lte: todayRange.end }
    };
    
    if (platform !== 'all') {
      const channel = await prisma.channel.findUnique({ where: { code: platform } });
      if (channel) whereClause.channelId = channel.id;
    }
    
    const orders = await prisma.order.findMany({ where: whereClause });
    console.log('📅 Today orders found:', orders.length);
    
    const totalRevenue = DateUtils.toDollars(orders.reduce((s, o) => s + (o.totalCents || 0), 0));
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
    
    res.json({
      success: true,
      date: todayRange.dateStr,
      totalRevenue,
      totalOrders,
      avgOrderValue,
      orders: orders.map(o => ({
        number: o.number,
        total: DateUtils.toDollars(o.totalCents),
        createdAt: o.createdAt
      }))
    });
  } catch (e: any) {
    console.error('📅 Today endpoint error:', e);
    res.status(500).json({ success: false, error: e?.message });
  }
});

// NEW: Yesterday's data endpoint
app.get('/api/v1/analytics/yesterday', async (req: Request, res: Response) => {
  try {
    console.log('📅 Yesterday endpoint hit');
    const platform = String(req.query.platform ?? 'all');
    const yesterdayRange = DateUtils.getYesterdayRange();
    
    console.log('📅 Yesterday range:', yesterdayRange.start, 'to', yesterdayRange.end);
    
    let whereClause: any = {
      createdAt: { gte: yesterdayRange.start, lte: yesterdayRange.end }
    };
    
    if (platform !== 'all') {
      const channel = await prisma.channel.findUnique({ where: { code: platform } });
      if (channel) whereClause.channelId = channel.id;
    }
    
    const orders = await prisma.order.findMany({ where: whereClause });
    console.log('📅 Yesterday orders found:', orders.length);
    
    const totalRevenue = DateUtils.toDollars(orders.reduce((s, o) => s + (o.totalCents || 0), 0));
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
    
    res.json({
      success: true,
      date: yesterdayRange.dateStr,
      totalRevenue,
      totalOrders,
      avgOrderValue,
      orders: orders.map(o => ({
        number: o.number,
        total: DateUtils.toDollars(o.totalCents),
        createdAt: o.createdAt
      }))
    });
  } catch (e: any) {
    console.error('📅 Yesterday endpoint error:', e);
    res.status(500).json({ success: false, error: e?.message });
  }
});

// FIXED: Dashboard summary endpoint with proper date handling
app.get('/api/v1/analytics/dashboard-summary', async (req: Request, res: Response) => {
  try {
    console.log('📊 Dashboard summary request:', req.query);
    
    const range = String(req.query.range ?? '7d');
    const platform = String(req.query.platform ?? 'all');
    const days = Number(range.replace('d', '')) || 7;
    
    const dateRange = DateUtils.getRelativeDateRange(days);
    console.log('📊 Date range:', dateRange.startStr, 'to', dateRange.endStr);
    
    // Build where clause with proper date filtering and platform filtering
    let whereClause: any = {
      createdAt: { gte: dateRange.start, lte: dateRange.end }
    };
    
    // Add platform filtering
    if (platform !== 'all') {
      const channel = await prisma.channel.findUnique({ where: { code: platform } });
      if (channel) {
        whereClause.channelId = channel.id;
      }
    }
    
    console.log('📊 Where clause:', whereClause);
    
    const [channels, orders] = await Promise.all([
      prisma.channel.findMany(),
      prisma.order.findMany({ where: whereClause })
    ]);
    
    console.log('📊 Found orders:', orders.length);
    orders.forEach(o => console.log('📊 Order:', o.number, 'Date:', o.createdAt, 'Total:', DateUtils.toDollars(o.totalCents)));
    
    const totalOrders = orders.length;
    const revenueCents = orders.reduce((s, o) => s + (o.totalCents || 0), 0);
    const totalRevenue = DateUtils.toDollars(revenueCents);
    const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

    // Build platform comparison
    const channelMap = new Map(channels.map(c => [c.id, c]));
    const platformStats = new Map<string, { revenueCents: number; orders: number }>();
    
    for (const order of orders) {
      const channelId = order.channelId;
      const stats = platformStats.get(channelId) || { revenueCents: 0, orders: 0 };
      stats.revenueCents += (order.totalCents || 0);
      stats.orders += 1;
      platformStats.set(channelId, stats);
    }
    
    const platformComparison = Array.from(platformStats.entries()).map(([channelId, stats]) => ({
      name: channelMap.get(channelId)?.name || 'Unknown',
      revenue: DateUtils.toDollars(stats.revenueCents),
      orders: stats.orders,
      color: channelMap.get(channelId)?.name.toLowerCase().includes('shopify') ? '#96BF47' : '#0066CC'
    }));

    // Build sales trend (daily buckets)
    const trendMap = new Map<string, { revenueCents: number; orders: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(dateRange.start);
      d.setDate(dateRange.start.getDate() + i);
      const dateKey = DateUtils.formatDateKey(d);
      trendMap.set(dateKey, { revenueCents: 0, orders: 0 });
    }
    
    for (const order of orders) {
      const dateKey = DateUtils.formatDateKey(order.createdAt);
      const trend = trendMap.get(dateKey);
      if (trend) {
        trend.revenueCents += (order.totalCents || 0);
        trend.orders += 1;
      }
    }

    const salesTrend = Array.from(trendMap.entries())
      .sort(([a], [b]) => a < b ? -1 : 1)
      .map(([date, v]) => ({
        date,
        revenue: DateUtils.toDollars(v.revenueCents),
        orders: v.orders,
        aov: v.orders ? DateUtils.toDollars(Math.round(v.revenueCents / v.orders)) : 0
      }));

    console.log('📊 Sales trend:', salesTrend);

    res.json({
      success: true,
      range: { start: dateRange.startStr, end: dateRange.endStr, days },
      totalRevenue,
      totalOrders,
      avgOrderValue,
      revenueGrowth: null,
      platformComparison,
      salesTrend,
    });
  } catch (e: any) {
    console.error('📊 Dashboard summary error:', e);
    res.status(500).json({ success: false, error: e?.message });
  }
});

// FIXED: Metrics endpoint with proper date handling
app.get('/api/v1/analytics/metrics', async (req: Request, res: Response) => {
  try {
    console.log('📈 Metrics request:', req.query);
    
    const platform = String(req.query.platform ?? 'all');
    const startDateStr = req.query.start_date as string;
    const endDateStr = req.query.end_date as string;
    
    if (!startDateStr || !endDateStr) {
      res.status(400).json({ 
        success: false, 
        error: 'start_date and end_date are required' 
      });
      return;
    }
    
    // Parse dates with proper timezone handling
    const startDate = DateUtils.parseFilterDate(startDateStr);
    const endDate = DateUtils.parseFilterDate(endDateStr);
    
    if (!startDate || !endDate) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      });
      return;
    }
    
    console.log('📈 Date range:', startDate.dateStr, 'to', endDate.dateStr);
    console.log('📈 Time range:', startDate.startOfDay, 'to', endDate.endOfDay);
    
    // Build where clause
    let whereClause: any = {
      createdAt: { gte: startDate.startOfDay, lte: endDate.endOfDay }
    };
    
    // Add platform filtering
    if (platform !== 'all') {
      const channel = await prisma.channel.findUnique({ where: { code: platform } });
      if (channel) {
        whereClause.channelId = channel.id;
        console.log('📈 Filtering by channel:', channel.name, channel.id);
      }
    }
    
    const orders = await prisma.order.findMany({ 
      where: whereClause,
      select: { totalCents: true, createdAt: true, number: true }
    });
    
    console.log('📈 Found orders:', orders.length);
    orders.forEach(o => console.log('📈 Order:', o.number, 'Date:', o.createdAt, 'Total:', DateUtils.toDollars(o.totalCents)));
    
    const totalOrders = orders.length;
    const totalRevenueCents = orders.reduce((s, o) => s + (o.totalCents || 0), 0);
    const avgOrderValueCents = totalOrders ? Math.round(totalRevenueCents / totalOrders) : 0;

    const result = {
      success: true,
      filters: { 
        start_date: startDate.dateStr, 
        end_date: endDate.dateStr, 
        platform 
      },
      totalRevenue: DateUtils.toDollars(totalRevenueCents),
      totalOrders,
      avgOrderValue: DateUtils.toDollars(avgOrderValueCents),
    };
    
    console.log('📈 Metrics result:', result);
    res.json(result);
    
  } catch (e: any) {
    console.error('📈 Metrics error:', e);
    res.status(500).json({ success: false, error: e?.message });
  }
});

// FIXED: Sales trend endpoint with proper date handling
app.get('/api/v1/analytics/sales-trend', async (req: Request, res: Response) => {
  try {
    console.log('📉 Sales trend request:', req.query);
    
    const startDateStr = req.query.start_date as string;
    const endDateStr = req.query.end_date as string;
    const platform = String(req.query.platform ?? 'all');
    
    if (!startDateStr || !endDateStr) {
      res.status(400).json({ 
        success: false, 
        error: 'start_date and end_date are required' 
      });
      return;
    }
    
    const startDate = DateUtils.parseFilterDate(startDateStr);
    const endDate = DateUtils.parseFilterDate(endDateStr);
    
    if (!startDate || !endDate) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      });
      return;
    }
    
    console.log('📉 Date range:', startDate.dateStr, 'to', endDate.dateStr);
    
    // Build where clause
    let whereClause: any = {
      createdAt: { gte: startDate.startOfDay, lte: endDate.endOfDay }
    };
    
    if (platform !== 'all') {
      const channel = await prisma.channel.findUnique({ where: { code: platform } });
      if (channel) {
        whereClause.channelId = channel.id;
      }
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      select: { createdAt: true, totalCents: true, number: true },
    });

    console.log('📉 Found orders:', orders.length);

    // Create day buckets for the entire range
    const dayMap = new Map<string, { revenueCents: number; orders: number }>();
    
    for (let d = new Date(startDate.startOfDay); d <= endDate.endOfDay; d = new Date(d.getTime() + 86_400_000)) {
      const dateKey = DateUtils.formatDateKey(d);
      dayMap.set(dateKey, { revenueCents: 0, orders: 0 });
    }
    
    // Fill in actual data
    for (const order of orders) {
      const dateKey = DateUtils.formatDateKey(order.createdAt);
      const agg = dayMap.get(dateKey);
      if (agg) {
        agg.revenueCents += (order.totalCents || 0);
        agg.orders += 1;
        console.log('📉 Adding order', order.number, 'to', dateKey, '- Total so far:', DateUtils.toDollars(agg.revenueCents));
      }
    }

    const trend = Array.from(dayMap.entries())
      .sort(([a], [b]) => a < b ? -1 : 1)
      .map(([date, v]) => ({
        date,
        revenue: DateUtils.toDollars(v.revenueCents),
        orders: v.orders,
        aov: v.orders ? DateUtils.toDollars(Math.round(v.revenueCents / v.orders)) : 0
      }));

    console.log('📉 Trend result:', trend);

    res.json({ 
      success: true, 
      start: startDate.dateStr, 
      end: endDate.dateStr, 
      data: trend 
    });
  } catch (e: any) {
    console.error('📉 Sales trend error:', e);
    res.status(500).json({ success: false, error: e?.message });
  }
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'E-commerce Analytics API',
    version: '2.0.0',
    status: 'running',
    features: ['Multi-platform support', 'Robust date handling', 'Real-time sync'],
    endpoints: [
      'GET /api/v1/health',
      'GET /api/v1/test-log',
      'GET /api/v1/sync/shopify?days=7',
      'GET /api/v1/analytics/dashboard-summary?range=7d',
      'GET /api/v1/analytics/metrics?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&platform=all',
      'GET /api/v1/analytics/sales-trend?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD'
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
  console.log('📊 E-commerce Analytics API v2.0 ready');
  console.log('🔧 Features: Multi-platform + Robust date handling');
});

export default app;
