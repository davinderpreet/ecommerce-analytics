// frontend/src/Dashboard.js
import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  TrendingUp, TrendingDown, ShoppingCart, DollarSign,
  ArrowUp, ArrowDown, Calendar, Download, RefreshCw,
  Brain, Target, Clock, Activity
} from 'lucide-react';

/** ====== API base ====== **/
const API_BASE = (process.env.REACT_APP_API_BASE || '').replace(/\/$/, '');
if (!API_BASE) {
  // eslint-disable-next-line no-console
  console.warn('REACT_APP_API_BASE is not set. Set it in Vercel → Project → Environment Variables.');
}

async function http(method, path) {
  const res = await fetch(`${API_BASE}${path}`, { method, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(await res.text().catch(() => `Request failed: ${res.status}`));
  return res.json();
}

const Dashboard = () => {
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' }); // ISO yyyy-mm-dd for custom
  const [quickDateFilter, setQuickDateFilter] = useState('7d');        // today | yesterday | 7d | 30d | 90d
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [predictionModel, setPredictionModel] = useState('advanced');

  // Live data state
  const [summary, setSummary] = useState(null);        // from /dashboard-summary or constructed from /metrics
  const [trend, setTrend] = useState([]);              // [{date, revenue, orders, aov}]
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  /** ====== Loaders ====== **/
  async function loadSummary(range = '7d') {
    setLoading(true); setErr('');
    try {
      const data = await http('GET', `/api/v1/analytics/dashboard-summary?range=${encodeURIComponent(range)}`);
      setSummary(data);
      setTrend(data.salesTrend || []);
      setQuickDateFilter(range);
      setDateRange({ start: '', end: '' });
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomRange(startISO, endISO) {
    setLoading(true); setErr('');
    try {
      // trend for the chart
      const t = await http('GET', `/api/v1/analytics/sales-trend?start_date=${encodeURIComponent(startISO)}&end_date=${encodeURIComponent(endISO)}`);
      setTrend(t.data || []);

      // totals for cards (platform-agnostic)
      const m = await http('GET', `/api/v1/analytics/metrics?start_date=${encodeURIComponent(startISO)}&end_date=${encodeURIComponent(endISO)}&platform=all`);
      // build a "summary-like" object so UI stays consistent
      setSummary({
        success: true,
        range: { start: startISO, end: endISO, days: Math.max(1, (new Date(endISO) - new Date(startISO)) / 86400000 + 1) },
        totalRevenue: m.totalRevenue,
        totalOrders: m.totalOrders,
        avgOrderValue: m.avgOrderValue,
        revenueGrowth: null,              // not available for arbitrary range (could add later)
        platformComparison: [],           // not available for arbitrary range with current API
        salesTrend: t.data || []
      });
      setQuickDateFilter('');
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  /** ====== UI handlers ====== **/
  const handleQuickDateFilter = async (filter) => {
    setQuickDateFilter(filter);
    if (filter === '7d' || filter === '30d' || filter === '90d') {
      await loadSummary(filter);
      return;
    }
    const today = new Date();
    const toISO = (d) => d.toISOString().slice(0, 10);
    if (filter === 'today') {
      const start = toISO(today);
      const end = toISO(today);
      setDateRange({ start, end });
      await loadCustomRange(start, end);
    } else if (filter === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const start = toISO(y);
      const end = toISO(y);
      setDateRange({ start, end });
      await loadCustomRange(start, end);
    }
  };

  const handleCustomDateChange = async (next) => {
    setDateRange(next);
    setQuickDateFilter('');
    if (next.start && next.end) {
      await loadCustomRange(next.start, next.end);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (quickDateFilter) {
        await loadSummary(quickDateFilter);
      } else if (dateRange.start && dateRange.end) {
        await loadCustomRange(dateRange.start, dateRange.end);
      } else {
        await loadSummary('7d');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  /** ====== initial load ====== **/
  useEffect(() => {
    loadSummary('7d');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ====== Derived UI data ====== **/
  const totalRevenue = summary?.totalRevenue ?? 0;
  const totalOrders  = summary?.totalOrders ?? 0;
  const avgOrderVal  = summary?.avgOrderValue ?? 0;
  const revenueGrowth = summary?.revenueGrowth;

  // pie: platform comparison (when available; empty on custom ranges)
  const platformData = (summary?.platformComparison || []).map(p => ({
    name: p.name,
    sales: p.revenue,
    orders: p.orders,
    color: p.name.toLowerCase().includes('shopify') ? '#96BF47'
         : p.name.toLowerCase().includes('best') ? '#0066CC'
         : '#8B5CF6'
  }));

  // prediction mock (kept from your original UI)
  const generatePredictionData = () => {
    const predictions = [];
    const startDate = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate); date.setDate(date.getDate() + i);
      const predictedTotal = Math.floor((15000 + Math.random() * 4000));
      predictions.push({ date: date.toISOString().slice(0,10), predicted: predictedTotal, confidence: Math.floor(95 - i*0.5) });
    }
    return predictions;
  };
  const predictionData = generatePredictionData();
  const nextMonthPrediction = predictionData.reduce((s, d) => s + d.predicted, 0);

  // Main cards (use only metrics we truly have)
  const mainMetrics = [
    { title: 'Total Revenue', value: `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, change: revenueGrowth == null ? '—' : `${revenueGrowth.toFixed(1)}%`, trend: revenueGrowth == null ? 'flat' : (revenueGrowth >= 0 ? 'up' : 'down'), icon: DollarSign, color: 'from-emerald-400 to-teal-600' },
    { title: 'Total Orders',  value: totalOrders.toLocaleString(), change: '—', trend: 'flat', icon: ShoppingCart, color: 'from-blue-400 to-indigo-600' },
    { title: 'Avg Order Value', value: `$${avgOrderVal.toFixed(2)}`, change: '—', trend: 'flat', icon: TrendingUp, color: 'from-orange-400 to-red-500' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated background */}
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
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Date Controls */}
        <div className="mb-8 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
            {/* Quick Date Filters */}
            <div className="flex flex-wrap gap-3">
              {[
                { id: 'today', name: 'Today' },
                { id: 'yesterday', name: 'Yesterday' },
                { id: '7d', name: 'Last 7 Days' },
                { id: '30d', name: 'Last 30 Days' },
                { id: '90d', name: 'Last 90 Days' }
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
                  onChange={(e) => handleCustomDateChange({ ...dateRange, start: e.target.value })}
                  className="bg-transparent text-white text-sm focus:outline-none"
                />
                <span className="text-white/50">to</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => handleCustomDateChange({ ...dateRange, end: e.target.value })}
                  className="bg-transparent text-white text-sm focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Platform Selector (kept for future use) */}
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
          {selectedPlatform !== 'all' && (
            <p className="text-xs text-white/60 mt-2">
              Platform-specific trend coming soon. Totals already include all platforms.
            </p>
          )}
        </div>

        {/* Status / errors */}
        {loading && <div className="opacity-80 mb-6">Loading…</div>}
        {err && !loading && (
          <div className="bg-red-500/20 border border-red-500/40 rounded p-3 text-red-200 mb-6">Error: {err}</div>
        )}

        {/* Main Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {mainMetrics.map((metric, index) => {
            const Icon = metric.icon;
            const up = metric.trend === 'up';
            const down = metric.trend === 'down';
            return (
              <div key={index} className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl hover:bg-white/15 transition-all duration-300 group">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-2xl bg-gradient-to-r ${metric.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className={`flex items-center space-x-1 text-sm ${up ? 'text-green-400' : down ? 'text-red-400' : 'text-white/60'}`}>
                    {up ? <ArrowUp className="w-4 h-4" /> : down ? <ArrowDown className="w-4 h-4" /> : null}
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
          {/* Sales Trend (revenue only – API provides total per day) */}
          <div className="lg:col-span-2 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6">Sales Performance Trend</h3>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1}/>
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
                  formatter={(value, name) => {
                    if (name === 'revenue') return [`$${Number(value).toFixed(2)}`, 'Revenue'];
                    if (name === 'orders') return [Number(value), 'Orders'];
                    if (name === 'aov') return [`$${Number(value).toFixed(2)}`, 'AOV'];
                    return [value, name];
                  }}
                />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#8B5CF6" fill="url(#revenueGradient)" strokeWidth={3} />
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
                  formatter={(value, name, item) => {
                    const orders = item?.payload?.orders ?? 0;
                    return [`$${Number(value).toFixed(2)} • ${orders} orders`, name];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {!platformData.length && (
              <div className="mt-4 text-sm text-white/70">
                Platform breakdown isn’t available for custom dates yet. Use 7d/30d/90d for comparison.
              </div>
            )}
          </div>
        </div>

        {/* Top Products Table (placeholder until we expose a /top-products API) */}
        <div className="mb-8 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-white">Top Performing Products</h3>
            <button className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 px-4 py-2 rounded-xl text-white transition-all duration-300">
              <Download className="w-4 h-4 inline mr-2" />
              Export
            </button>
          </div>
          <div className="text-white/70">
            Live product leaderboard coming next. (We’ll add an endpoint to aggregate by SKU across orders.)
          </div>
        </div>

        {/* AI Prediction Cards (kept from your original) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
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
                  {/* simple compare against current total in visible range */}
                  {summary ? `+${((nextMonthPrediction - totalRevenue) / Math.max(1, totalRevenue) * 100).toFixed(1)}% vs Current Period` : '—'}
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
            <span className="text-white/70 text-sm">
              {summary ? 'Dashboard connected to live API' : 'Dashboard loaded with sample data'}
            </span>
            <span className="text-white/40 text-sm">•</span>
            <span className="text-white/70 text-sm">Backend: {API_BASE || 'not set'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
