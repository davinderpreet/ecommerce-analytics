// Add this to your frontend Dashboard.js - insert after line 84 (after the handleRefresh function)

// NEW: Debug function to test specific date ranges
const testDebugEndpoint = async (dateType) => {
  try {
    console.log(`🔍 Testing debug endpoint for ${dateType}`);
    const platformParam = selectedPlatform !== 'all' ? `&platform=${selectedPlatform}` : '';
    const data = await http('GET', `/api/v1/debug/orders?dateType=${dateType}${platformParam}`);
    
    console.log(`🔍 Debug results for ${dateType}:`, data);
    
    // Show debug results in an alert for easy viewing
    const summary = data.summary;
    const breakdown = data.dailyBreakdown;
    
    let message = `Debug Results for ${dateType.toUpperCase()}:\n\n`;
    message += `Total: $${summary.totalRevenue} (${summary.totalOrders} orders)\n`;
    message += `Average: $${summary.averageOrderValue}\n`;
    message += `Timezone: ${data.timezone}\n`;
    message += `Current Time: ${data.currentTime}\n\n`;
    
    message += `Daily Breakdown:\n`;
    breakdown.forEach(day => {
      message += `${day.date}: $${day.revenue} (${day.orderCount} orders)\n`;
      day.orders.forEach(order => {
        message += `  - ${order.number}: $${order.total}\n`;
      });
    });
    
    alert(message);
    
  } catch (error) {
    console.error(`🔍 Debug test failed for ${dateType}:`, error);
    alert(`Debug test failed: ${error.message}`);
  }
};

// Then, add these debug buttons to your JSX - insert after the refresh button (around line 400)

{/* Add these debug buttons after the refresh button */}
<div className="flex items-center space-x-2">
  <button
    onClick={() => testDebugEndpoint('today')}
    className="bg-blue-500 hover:bg-blue-600 px-3 py-2 rounded text-white text-xs"
    title="Debug Today"
  >
    Debug Today
  </button>
  <button
    onClick={() => testDebugEndpoint('yesterday')}
    className="bg-blue-500 hover:bg-blue-600 px-3 py-2 rounded text-white text-xs"
    title="Debug Yesterday"
  >
    Debug Yesterday
  </button>
  <button
    onClick={() => testDebugEndpoint('7d')}
    className="bg-blue-500 hover:bg-blue-600 px-3 py-2 rounded text-white text-xs"
    title="Debug 7 Days"
  >
    Debug 7d
  </button>
</div>
