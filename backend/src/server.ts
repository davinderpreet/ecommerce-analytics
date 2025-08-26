// Add this to your backend/src/server.ts

// Import inventory routes (add with other route imports)
import inventoryRoutes from './routes/inventory';
// DO NOT import inventoryService - we don't need it

// Add the inventory route (add after other routes)
app.use('/api/v1/inventory', inventoryRoutes);

// Update your root endpoint to show inventory is available
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'E-commerce Analytics API',
    version: '2.7.0',
    status: 'running',
    features: [
      'Shopify integration', 
      'Real-time sync', 
      'Debug endpoints', 
      'Automated sync', 
      'Caching',
      'Inventory Management' // Added
    ],
    timezone: USER_TIMEZONE,
    currentTime: DateUtils.getCurrentDateInTimezone().toLocaleString(),
    scheduler: scheduler.getStatus(),
    endpoints: [
      // ... existing endpoints ...
      
      // Add these inventory endpoints
      'GET /api/v1/inventory - Get all inventory items with metrics',
      'POST /api/v1/inventory/:productId/update - Update inventory quantity',
      'POST /api/v1/inventory/sync - Sync inventory (placeholder)'
    ]
  });
});
