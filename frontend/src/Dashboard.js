import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, ComposedChart } from 'recharts';
import { TrendingUp, TrendingDown, ShoppingCart, DollarSign, Package, Users, ArrowUp, ArrowDown, Calendar, Download, RefreshCw, Brain, Target, Clock, Activity } from 'lucide-react';

const Dashboard = () => {
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '2024-07-25', end: '2024-08-24' });
  const [quickDateFilter, setQuickDateFilter] = useState('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [predictionModel, setPredictionModel] = useState('advanced');

  // Generate sample sales data
  const generateSalesData = () => {
    const data = [];
    const startDate = new Date('2024-07-25');
    const endDate = new Date('2024-08-24');
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      const weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 0.8 : 1.2;
      const randomVariation = 0.8 + Math.random() * 0.4;
      
      const baseBestbuy = 8000 + Math.random() * 4000;
      const baseShopify = 6000 + Math.random() * 3000;
      
      const bestbuyRevenue = Math.floor(baseBestbuy * weekendMultiplier * randomVariation);
      const shopifyRevenue = Math.floor(baseShopify * weekendMultiplier * randomVariation);
      
      data.push({
        date: currentDate.toISOString().split('T')[0],
        bestbuy: bestbuyRevenue,
        shopify: shopifyRevenue,
        total: bestbuyRevenue + shopifyRevenue,
        orders: Math.floor((bestbuyRevenue + shopifyRevenue) / 68),
        products: Math.floor((bestbuyRevenue + shopifyRevenue) / 28),
        visitors: Math.floor((bestbuyRevenue + shopifyRevenue) * 0.8),
        conversion: 2.1 + Math.random() * 1.5
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return data;
  };

  const [salesData] = useState(generateSalesData());

  // Quick date filter handler
  const handleQuickDateFilter = (filter) => {
    setQuickDateFilter(filter);
    const endDate = new Date('2024-08-24');
    let startDate = new Date(endDate);

    switch (filter) {
      case 'today':
        startDate = new Date(endDate);
        break;
      case 'yesterday':
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 1);
        endDate.setDate(endDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        return;
    }

    setDateRange({
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    });
  };

  // Filter data based on selected date range
  const getFilteredData = () => {
    return salesData.filter(item => {
      const itemDate = new Date(item.date);
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      return itemDate >= startDate && itemDate <= endDate;
    });
  };

  const filteredData = getFilteredData();

  // Calculate metrics from filtered data
  const calculateMetrics = () => {
    if (filteredData.length === 0) return {};

    const totalRevenue = filteredData.reduce((sum, day) => sum + day.total, 0);
    const totalOrders = filteredData.reduce((sum, day) => sum + day.orders, 0);
    const totalProducts = filteredData.reduce((sum, day) => sum + day.products, 0);
    const totalVisitors = filteredData.reduce((sum, day) => sum + day.visitors, 0);
    const avgOrderValue = totalRevenue / totalOrders;
    const avgConversion = filteredData.reduce((sum, day) => sum + day.conversion, 0) / filteredData.length;

    return {
      totalRevenue,
      revenueGrowth: 12.5,
      totalOrders,
      totalProducts,
      totalVisitors,
      avgOrderValue,
      avgConversion
    };
  };

  const metrics = calculateMetrics();

  const mainMetrics = [
    { 
      title: 'Total Revenue', 
      value: `$${metrics.totalRevenue?.toLocaleString() || '0'}`, 
      change: `+${metrics.revenueGrowth?.toFixed(1) || '0'}%`, 
      trend: 'up', 
      icon: DollarSign,
      color: 'from-emerald-400 to-teal-600'
    },
    { 
      title: 'Total Orders', 
      value: metrics.totalOrders?.toLocaleString() || '0', 
      change: '+8.2%', 
      trend: 'up', 
      icon: ShoppingCart,
      color: 'from-blue-400 to-indigo-600'
    },
    { 
      title: 'Products Sold', 
      value: metrics.totalProducts?.toLocaleString() || '0', 
      change: '+15.7%', 
      trend: 'up', 
      icon: Package,
      color: 'from-purple-400 to-pink-600'
    },
    { 
      title: 'Avg Order Value', 
      value: `$${metrics.avgOrderValue?.toFixed(2) || '0.00'}`, 
      change: '-2.1%', 
      trend: 'down', 
      icon: TrendingUp,
      color: 'from-orange-400 to-red-500'
    },
    { 
      title: 'Total Visitors', 
      value: metrics.totalVisitors?.toLocaleString() || '0', 
      change: '+12.5%', 
      trend: 'up', 
      icon: Users,
      color: 'from-cyan-400 to-blue-600'
    },
    { 
      title: 'Conversion Rate', 
      value: `${metrics.avgConversion?.toFixed(2) || '0.00'}%`, 
      change: '+0.3%', 
      trend: 'up', 
      icon: Target,
      color: 'from-green-400 to-emerald-600'
    }
  ];

  const platformData = [
    { name: 'BestBuy', sales: 152710, color: '#0066CC', percentage: 58.2, orders: 2243 },
    { name: 'Shopify', sales: 109930, color: '#96BF47', percentage: 41.8, orders: 1615 }
  ];

  const topProducts = [
    { name: 'Wireless Gaming Headset Pro', sales: 1247, revenue: 87290, platform: 'BestBuy', trend: 'up', growth: 12.5 },
    { name: 'Smart Home Security System', sales: 892, revenue: 67340, platform: 'Shopify', trend: 'up', growth: 18.3 },
    { name: 'Ultra HD 4K Monitor 27"', sales: 743, revenue: 59440, platform: 'BestBuy', trend: 'down', growth: -5.2 },
    { name: 'Premium Bluetooth Speaker', sales: 634, revenue: 44380, platform: 'Shopify', trend: 'up', growth: 8.7 },
    { name: 'Gaming Mechanical Keyboard', sales: 567, revenue: 39690, platform: 'BestBuy', trend: 'up', growth: 15.4 }
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 2000);
  };

  // Generate prediction data for AI cards
  const generatePredictionData = () => {
    const predictions = [];
    const startDate = new Date('2024-08-25');
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      const predictedTotal = Math.floor((21000 + Math.random() * 3000) * 1.18);
      
      predictions.push({
        date: date.toISOString().split('T')[0],
        predicted: predictedTotal,
        confidence: Math.floor((0.95 - (i / 30) * 0.15) * 100)
      });
    }
    return predictions;
  };

  const predictionData = generatePredictionData();
  const nextMonthPrediction = predictionData.reduce((sum, day) => sum + day.predicted, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
      </div>

      <div className="relative z-10 p-8">
        {/* Header */}
        <div className="mb-8 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                Sales Analytics Dashboard
              </h1>
              <p className="text-white/70 mt-2">Real-time insights across all your sales channels</p>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={handleRefresh}
                className={`bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 p-3 rounded-xl transition-all duration-300 ${isRefreshing ? 'animate-spin' : ''}`}
              >
                <RefreshCw className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Date Controls */}
        <div className="mb-8 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
            {/* Quick Date Filters */}
            <div className="flex flex-wrap gap-3">
              {[
                { id: 'today', name: 'Today' },
                { id: 'yesterday', name: 'Yesterday' },
                { id: '7d', name: 'Last 7 Days' },
                { id: '30d', name: 'Last 30 Days' }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => handleQuickDateFilter(filter.id)}
                  className={`px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                    quickDateFilter === filter.id 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg scale-105' 
                      : 'bg-white/10 text-white/80 hover:bg-white/20 hover:scale-105'
                  }`}
                >
                  {filter.name}
                </button>
              ))}
            </div>
            
            {/* Custom Date Range */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl px-4 py-2">
                <Calendar className="w-4 h-4 text-white/70" />
                <input 
                  type="date" 
                  value={dateRange.start}
                  onChange={(e) => {
                    setDateRange({...dateRange, start: e.target.value});
                    setQuickDateFilter('');
                  }}
                  className="bg-transparent text-white text-sm focus:outline-none"
                />
                <span className="text-white/50">to</span>
                <input 
                  type="date" 
                  value={dateRange.end}
                  onChange={(e) => {
                    setDateRange({...dateRange, end: e.target.value});
                    setQuickDateFilter('');
                  }}
                  className="bg-transparent text-white text-sm focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Platform Selector */}
        <div className="mb-8 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
          <div className="flex space-x-4">
            {[
              { id: 'all', name: 'All Platforms', color: 'from-white to-purple-200' },
              { id: 'bestbuy', name: 'BestBuy', color: 'from-blue-400 to-blue-600' },
              { id: 'shopify', name: 'Shopify', color: 'from-green-400 to-green-600' },
              { id: 'amazon', name: 'Amazon (Coming Soon)', color: 'from-orange-400 to-yellow-500', disabled: true }
            ].map(platform => (
              <button
                key={platform.id}
                onClick={() => !platform.disabled && setSelectedPlatform(platform.id)}
                disabled={platform.disabled}
                className={`px-6 py-3 rounded-2xl font-medium transition-all duration-300 ${
                  selectedPlatform === platform.id 
                    ? `bg-gradient-to-r ${platform.color} text-white shadow-lg scale-105` 
                    : platform.disabled 
                      ? 'bg-white/5 text-white/40 cursor-not-allowed'
                      : 'bg-white/10 text-white/80 hover:bg-white/20 hover:scale-105'
                }`}
              >
                {platform.name}
              </button>
            ))}
          </div>
        </div>

        {/* Main Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {mainMetrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div key={index} className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl hover:bg-white/15 transition-all duration-300 group">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-2xl bg-gradient-to-r ${metric.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className={`flex items-center space-x-1 text-sm ${metric.trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                    {metric.trend === 'up' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                    <span>{metric.change}</span>
                  </div>
                </div>
                <h3 className="text-white/70 text-sm font-medium">{metric.title}</h3>
                <p className="text-3xl font-bold text-white mt-1">{metric.value}</p>
              </div>
            );
          })}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Sales Trend Chart */}
          <div className="lg:col-span-2 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6">Sales Performance Trend</h3>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={filteredData}>
                <defs>
                  <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="bestbuyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0066CC" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#0066CC" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="shopifyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#96BF47" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#96BF47" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="date" 
                  stroke="rgba(255,255,255,0.7)" 
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis stroke="rgba(255,255,255,0.7)" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    borderRadius: '16px',
                    backdropFilter: 'blur(20px)'
                  }} 
                />
                <Area type="monotone" dataKey="total" stroke="#8B5CF6" fill="url(#totalGradient)" strokeWidth={3} />
                <Area type="monotone" dataKey="bestbuy" stroke="#0066CC" fill="url(#bestbuyGradient)" strokeWidth={2} />
                <Area type="monotone" dataKey="shopify" stroke="#96BF47" fill="url(#shopifyGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Platform Distribution */}
          <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6">Platform Revenue</h3>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={platformData}
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  innerRadius={60}
                  paddingAngle={5}
                  dataKey="sales"
                >
                  {platformData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    borderRadius: '16px',
                    backdropFilter: 'blur(20px)'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-6 space-y-3">
              {platformData.map((platform, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full`} style={{backgroundColor: platform.color}}></div>
                    <span className="text-white/80">{platform.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-semibold">${platform.sales.toLocaleString()}</p>
                    <p className="text-white/60 text-sm">{platform.orders} orders</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Products Table */}
        <div className="mb-8 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-white">Top Performing Products</h3>
            <button className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 px-4 py-2 rounded-xl text-white transition-all duration-300">
              <Download className="w-4 h-4 inline mr-2" />
              Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left py-4 px-2 text-white/80 font-semibold">Product</th>
                  <th className="text-left py-4 px-2 text-white/80 font-semibold">Platform</th>
                  <th className="text-right py-4 px-2 text-white/80 font-semibold">Sales</th>
                  <th className="text-right py-4 px-2 text-white/80 font-semibold">Revenue</th>
                  <th className="text-center py-4 px-2 text-white/80 font-semibold">Trend</th>
                  <th className="text-center py-4 px-2 text-white/80 font-semibold">Growth</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product, index) => (
                  <tr key={index} className="border-b border-white/10 hover:bg-white/5 transition-colors duration-200">
                    <td className="py-4 px-2">
                      <div className="text-white font-medium">{product.name}</div>
                    </td>
                    <td className="py-4 px-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        product.platform === 'BestBuy' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'
                      }`}>
                        {product.platform}
                      </span>
                    </td>
                    <td className="py-4 px-2 text-right text-white">{product.sales.toLocaleString()}</td>
                    <td className="py-4 px-2 text-right text-white font-semibold">${product.revenue.toLocaleString()}</td>
                    <td className="py-4 px-2 text-center">
                      {product.trend === 'up' ? (
                        <div className="inline-flex items-center justify-center w-8 h-8 bg-green-500/20 rounded-full">
                          <TrendingUp className="w-4 h-4 text-green-400" />
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-center w-8 h-8 bg-red-500/20 rounded-full">
                          <TrendingDown className="w-4 h-4 text-red-400" />
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-2 text-center">
                      <span className={`font-semibold ${product.growth > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {product.growth > 0 ? '+' : ''}{product.growth}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Prediction Cards Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* AI Sales Prediction Card */}
          <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center">
                  <Brain className="w-7 h-7 text-cyan-400 mr-3" />
                  AI Sales Prediction
                </h3>
                <p className="text-white/60 mt-1">Next 30-day forecast</p>
              </div>
              <select 
                value={predictionModel} 
                onChange={(e) => setPredictionModel(e.target.value)}
                className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="basic">Basic ARIMA</option>
                <option value="advanced">Advanced LSTM</option>
                <option value="ensemble">Ensemble Model</option>
                <option value="ml">Machine Learning</option>
              </select>
            </div>
            
            <div className="space-y-6">
              <div className="text-center p-6 bg-gradient-to-r from-cyan-500/10 to-blue-600/10 rounded-2xl border border-cyan-400/20">
                <div className="text-4xl font-bold text-cyan-400 mb-2">
                  ${nextMonthPrediction.toLocaleString()}
                </div>
                <div className="text-white/80 text-sm">Predicted Revenue (Next 30 Days)</div>
                <div className="text-cyan-400 text-sm mt-1">
                  +{((nextMonthPrediction - metrics.totalRevenue) / metrics.totalRevenue * 100).toFixed(1)}% vs Current Period
                </div>
              </div>

              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={predictionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="date" 
                    stroke="rgba(255,255,255,0.7)" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="rgba(255,255,255,0.7)" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                      border: '1px solid rgba(255,255,255,0.2)', 
                      borderRadius: '16px',
                      backdropFilter: 'blur(20px)'
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="predicted" 
                    stroke="#22D3EE" 
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    dot={{ fill: '#22D3EE', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Model Performance Card */}
          <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center">
                  <Target className="w-7 h-7 text-purple-400 mr-3" />
                  Model Performance
                </h3>
                <p className="text-white/60 mt-1">AI accuracy & insights</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400 text-sm font-medium">Active</span>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-white/80">Prediction Accuracy</span>
                <div className="flex items-center space-x-3">
                  <div className="w-24 h-2 bg-white/20 rounded-full">
                    <div className="w-[89%] h-2 bg-gradient-to-r from-green-400 to-emerald-600 rounded-full"></div>
                  </div>
                  <span className="text-white font-semibold">89%</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-white/80">Model Confidence</span>
                <div className="flex items-center space-x-3">
                  <div className="w-24 h-2 bg-white/20 rounded-full">
                    <div className="w-[92%] h-2 bg-gradient-to-r from-blue-400 to-cyan-600 rounded-full"></div>
                  </div>
                  <span className="text-white font-semibold">92%</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-white/80">Data Quality Score</span>
                <div className="flex items-center space-x-3">
                  <div className="w-24 h-2 bg-white/20 rounded-full">
                    <div className="w-[95%] h-2 bg-gradient-to-r from-purple-400 to-pink-600 rounded-full"></div>
                  </div>
                  <span className="text-white font-semibold">95%</span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gradient-to-r from-purple-500/10 to-pink-600/10 rounded-2xl border border-purple-400/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-5 h-5 text-purple-400" />
                    <span className="text-white font-medium">Model Status</span>
                  </div>
                  <span className="text-purple-400 text-sm">{predictionModel.toUpperCase()}</span>
                </div>
                <p className="text-white/70 text-sm mb-2">Next training session in 4 hours</p>
                <div className="flex items-center space-x-2 text-xs">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-400">Auto-learning enabled</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <div className="text-2xl font-bold text-white">2.1K</div>
                  <div className="text-white/60 text-xs">Data Points</div>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <div className="text-2xl font-bold text-white">24/7</div>
                  <div className="text-white/60 text-xs">Monitoring</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Updates Indicator */}
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 backdrop-blur-xl bg-white/10 rounded-full px-4 py-2 border border-white/20">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-white/70 text-sm">Dashboard loaded with sample data</span>
            <span className="text-white/40 text-sm">•</span>
            <span className="text-white/70 text-sm">Ready for backend integration</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
