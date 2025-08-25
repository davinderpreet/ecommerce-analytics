// Replace the sync endpoint in your backend/src/server.ts with this:

app.all('/api/v1/sync/shopify', async (req, res) => {
  const days = Number(req.query.days ?? 7);
  
  console.log('🔄 Starting Shopify sync for', days, 'days');
  console.log('📊 SHOPIFY_SHOP_DOMAIN:', process.env.SHOPIFY_SHOP_DOMAIN);
  console.log('🔑 SHOPIFY_ADMIN_ACCESS_TOKEN exists:', !!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN);
  console.log('🗄️ DATABASE_URL exists:', !!process.env.DATABASE_URL);
  
  try {
    // Test database connection first
    console.log('🔄 Testing database connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected');
    
    // Test Shopify credentials
    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    
    if (!shop || !token) {
      const error = `Missing credentials: shop=${!!shop}, token=${!!token}`;
      console.error('❌', error);
      return res.status(400).json({ ok: false, error });
    }
    
    console.log('🔄 Testing Shopify connection...');
    const testResponse = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query: '{ shop { name } }' }),
    });
    
    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error('❌ Shopify connection failed:', testResponse.status, errorText);
      return res.status(500).json({ ok: false, error: `Shopify API error: ${testResponse.status}` });
    }
    
    const testData = await testResponse.json();
    console.log('✅ Shopify connected to shop:', testData.data?.shop?.name);
    
    if (testData.errors) {
      console.error('❌ Shopify GraphQL errors:', testData.errors);
      return res.status(500).json({ ok: false, error: 'Shopify GraphQL errors', details: testData.errors });
    }
    
    // Now try the actual sync
    console.log('🔄 Running syncShopifyOrders...');
    await syncShopifyOrders(days);
    
    console.log('✅ Shopify sync completed');
    res.json({ ok: true, source: 'shopify', days });
    
  } catch (error: any) {
    console.error('❌ Shopify sync failed with error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      ok: false, 
      source: 'shopify', 
      error: error?.message || 'sync_failed',
      stack: error?.stack 
    });
  }
});
