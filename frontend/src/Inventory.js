// frontend/src/Inventory.js - FIXED VERSION
import React, { useState, useEffect } from 'react';
import { 
  Package, AlertTriangle, TrendingDown, ShoppingCart,
  RefreshCw, Download, Upload, Search, Filter, 
  Plus, Edit2, Bell, Clock, Truck, ChevronRight,
  BarChart2, AlertCircle, CheckCircle, XCircle,
  ArrowUp, ArrowDown, Settings, Calendar, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from './lib/api'; // Import the api object

const API_BASE = (process.env.REACT_APP_API_BASE || "").replace(/\/$/, "");

const Inventory = () => {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('stockout_risk');
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editQuantity, setEditQuantity] = useState(0);

 seed inventory:', error);
    }
  };

  // Set mock data for demonstration
  const setMockData = () => {
    const mockInventory = [
      {
        id: '1',
        sku: 'IPH15PRO',
        title: 'iPhone 15 Pro',
        channel: 'Shopify',
        quantity: 12,
        available: 10,
        reserved: 2,
        incoming: 50,
        reorderPoint: 20,
        reorderQuantity: 100,
        leadTime: 7,
        batchSize: 50,
        stockoutRisk: 'high',
        daysUntilStockout: 3,
        lastSold: '2024-12-28T10:30:00',
        salesVelocity: 4.2,
        unitCost: 899.99,
        totalValue: 10799.88
      },
      {
        id: '2',
        sku: 'MBAIR-M2',
        title: 'MacBook Air M2',
        channel: 'Shopify',
        quantity: 45,
        available: 42,
        reserved: 3,
        incoming: 0,
        reorderPoint: 15,
        reorderQuantity: 50,
        leadTime: 10,
        batchSize: 25,
        stockoutRisk: 'low',
        daysUntilStockout: 21,
        lastSold: '2024-12-27T14:20:00',
        salesVelocity: 2.1,
        unitCost: 1199.99,
        totalValue: 53999.55
      }
    ];

    const mockStats = {
      totalProducts: 2,
      totalValue: 64799.43,
      lowStockItems: 1,
      outOfStockItems: 0,
      criticalItems: 0,
      avgTurnoverDays: 14,
      totalReserved: 5,
      totalIncoming: 50,
      stockAccuracy: 98.5
    };

    const mockAlerts = [
      {
        id: '1',
        type: 'high',
        product: 'iPhone 15 Pro',
        message: 'Low stock: 3 days until stockout',
        time: '1 hour ago'
      }
    ];

    setInventory(mockInventory);
    setStats(mockStats);
    setAlerts(mockAlerts);
  };

  useEffect(() => {
    fetchInventory();
  }, [selectedPlatform]);

  useEffect(() => {
    console.log('Current inventory state:', inventory);
    console.log('Processed inventory:', processedInventory);
  }, [inventory]);ory]);

  // Rest of the component remains the same...
  // Filter and sort inventory
  const processedInventory = inventory
    .filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'all' || item.stockoutRisk === filterStatus;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      
      switch (sortBy) {
        case 'stockout_risk':
          return riskOrder[a.stockoutRisk] - riskOrder[b.stockoutRisk];
        case 'quantity':
          return a.quantity - b.quantity;
        case 'days_until_stockout':
          return a.daysUntilStockout - b.daysUntilStockout;
        case 'sales_velocity':
          return b.salesVelocity - a.salesVelocity;
        default:
          return 0;
      }
    });

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'critical': return 'from-red-500 to-red-600';
      case 'high': return 'from-orange-500 to-orange-600';
      case 'medium': return 'from-yellow-500 to-yellow-600';
      case 'low': return 'from-green-500 to-green-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getRiskBadgeColor = (risk) => {
    switch (risk) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const handleReorder = (product) => {
    setSelectedProduct(product);
    setShowReorderModal(true);
  };

  const handleEditInventory = (product) => {
    setSelectedProduct(product);
    setEditQuantity(product.quantity);
    setShowEditModal(true);
  };

  const saveInventoryUpdate = async () => {
    if (!selectedProduct) return;
    
    try {
      const result = await api.inventoryUpdate(selectedProduct.id, editQuantity);
      if (result.success) {
        // Refresh inventory
        await fetchInventory();
        setShowEditModal(false);
      }
    } catch (error) {
      console.error('Failed to update inventory:', error);
    }
  };

  const syncFromShopify = async () => {
    try {
      console.log('Syncing from Shopify...');
      const res = await fetch(`${API_BASE}/api/v1/inventory/sync-shopify`, {
        method: 'POST',
        headers: { Accept: "application/json" }
      });
      const result = await res.json();
      console.log('Shopify sync result:', result);
      if (result.success) {
        await fetchInventory();
      }
    } catch (error) {
      console.error('Failed to sync from Shopify:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
      </div>

      <div className="relative z-10 p-8">
        {/* Header */}
        <div className="mb-8 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-white/60 hover:text-white transition-colors"
              >
                <ChevronRight className="w-6 h-6 rotate-180" />
              </button>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                  Inventory Management
                </h1>
                <p className="text-white/70 mt-2">Real-time stock monitoring and reorder automation</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={syncFromShopify}
                className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 px-4 py-3 rounded-xl transition-all duration-300 flex items-center space-x-2"
                title="Sync inventory from Shopify"
              >
                <RefreshCw className="w-5 h-5 text-white" />
                <span className="text-white font-medium">Sync Shopify</span>
              </button>
              <button 
                onClick={seedInventory}
                className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 px-4 py-3 rounded-xl transition-all duration-300 flex items-center space-x-2"
                title="Seed inventory with random quantities"
              >
                <Plus className="w-5 h-5 text-white" />
                <span className="text-white font-medium">Seed Data</span>
              </button>
              <button className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-4 py-3 rounded-xl transition-all duration-300 flex items-center space-x-2">
                <Upload className="w-5 h-5 text-white" />
                <span className="text-white font-medium">Import</span>
              </button>
              <button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 px-4 py-3 rounded-xl transition-all duration-300 flex items-center space-x-2">
                <Download className="w-5 h-5 text-white" />
                <span className="text-white font-medium">Export</span>
              </button>
              <button
                onClick={fetchInventory}
                className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 p-3 rounded-xl transition-all duration-300"
              >
                <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg">
                <Package className="w-6 h-6 text-white" />
              </div>
              <span className="text-white/60 text-sm">Total</span>
            </div>
            <p className="text-3xl font-bold text-white">{formatNumber(stats?.totalProducts || 0)}</p>
            <p className="text-white/70 text-sm mt-1">Total Products</p>
            <p className="text-green-400 text-xs mt-2">
              Value: {formatCurrency(stats?.totalValue || 0)}
            </p>
          </div>

          <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl bg-gradient-to-r from-red-500 to-orange-600 shadow-lg">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <span className="text-white/60 text-sm">Alert</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats?.criticalItems || 0}</p>
            <p className="text-white/70 text-sm mt-1">Critical Items</p>
            <p className="text-red-400 text-xs mt-2">
              Low Stock: {stats?.lowStockItems || 0} items
            </p>
          </div>

          <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <span className="text-white/60 text-sm">Incoming</span>
            </div>
            <p className="text-3xl font-bold text-white">{formatNumber(stats?.totalIncoming || 0)}</p>
            <p className="text-white/70 text-sm mt-1">Units Incoming</p>
            <p className="text-green-400 text-xs mt-2">
              Next 7 days
            </p>
          </div>

          <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-600 shadow-lg">
                <TrendingDown className="w-6 h-6 text-white" />
              </div>
              <span className="text-white/60 text-sm">Turnover</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats?.avgTurnoverDays || 0}</p>
            <p className="text-white/70 text-sm mt-1">Avg Days</p>
            <p className="text-purple-400 text-xs mt-2">
              Accuracy: {stats?.stockAccuracy || 0}%
            </p>
          </div>
        </div>

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <div className="mb-8 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white flex items-center">
                <Bell className="w-5 h-5 mr-2" />
                Stock Alerts
              </h3>
              <span className="text-white/60 text-sm">{alerts.length} active</span>
            </div>
            <div className="space-y-3">
              {alerts.slice(0, 3).map(alert => (
                <div key={alert.id} className={`flex items-center justify-between p-4 rounded-xl border ${
                  alert.type === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                  alert.type === 'high' ? 'bg-orange-500/10 border-orange-500/30' :
                  'bg-blue-500/10 border-blue-500/30'
                }`}>
                  <div className="flex items-center space-x-3">
                    {alert.type === 'critical' ? 
                      <XCircle className="w-5 h-5 text-red-400" /> :
                      alert.type === 'high' ?
                      <AlertCircle className="w-5 h-5 text-orange-400" /> :
                      <Info className="w-5 h-5 text-blue-400" />
                    }
                    <div>
                      <p className="text-white font-medium">{alert.product}</p>
                      <p className="text-white/60 text-sm">{alert.message}</p>
                    </div>
                  </div>
                  <span className="text-white/40 text-xs">{alert.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="mb-6 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  placeholder="Search by SKU or product name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Platforms</option>
                <option value="shopify">Shopify</option>
                <option value="bestbuy" disabled>BestBuy (Coming)</option>
                <option value="amazon" disabled>Amazon (Coming)</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Status</option>
                <option value="critical">Critical</option>
                <option value="high">High Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="low">Low Risk</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="stockout_risk">Sort by Risk</option>
                <option value="quantity">Sort by Quantity</option>
                <option value="days_until_stockout">Days to Stockout</option>
                <option value="sales_velocity">Sales Velocity</option>
              </select>
            </div>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="text-left p-4 text-white/80 font-semibold">Product</th>
                  <th className="text-center p-4 text-white/80 font-semibold">Stock Level</th>
                  <th className="text-center p-4 text-white/80 font-semibold">Status</th>
                  <th className="text-center p-4 text-white/80 font-semibold">Sales Velocity</th>
                  <th className="text-center p-4 text-white/80 font-semibold">Days to Stockout</th>
                  <th className="text-center p-4 text-white/80 font-semibold">Reorder Info</th>
                  <th className="text-right p-4 text-white/80 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-12">
                      <RefreshCw className="w-8 h-8 text-white/40 animate-spin mx-auto" />
                      <p className="text-white/60 mt-4">Loading inventory...</p>
                    </td>
                  </tr>
                ) : processedInventory.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-12">
                      <Package className="w-8 h-8 text-white/40 mx-auto" />
                      <p className="text-white/60 mt-4">No products found</p>
                      <button
                        onClick={seedInventory}
                        className="mt-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 px-6 py-3 rounded-xl text-white font-medium transition-all"
                      >
                        Seed Sample Inventory
                      </button>
                    </td>
                  </tr>
                ) : (
                  processedInventory.map(item => (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div>
                          <p className="text-white font-medium">{item.title}</p>
                          <p className="text-white/50 text-sm">SKU: {item.sku}</p>
                          <p className="text-white/40 text-xs mt-1">{item.channel}</p>
                        </div>
                      </td>
                      
                      <td className="p-4">
                        <div className="text-center">
                          <div className="flex items-center justify-center space-x-4">
                            <div>
                              <p className="text-2xl font-bold text-white">{item.quantity}</p>
                              <p className="text-white/50 text-xs">On Hand</p>
                            </div>
                            <div className="text-left">
                              <p className="text-white/70 text-sm">Available: {item.available}</p>
                              <p className="text-white/70 text-sm">Reserved: {item.reserved}</p>
                              {item.incoming > 0 && (
                                <p className="text-green-400 text-sm">Incoming: {item.incoming}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="p-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRiskBadgeColor(item.stockoutRisk)}`}>
                          {item.stockoutRisk.toUpperCase()}
                        </span>
                      </td>
                      
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {item.salesVelocity > 5 ? 
                            <ArrowUp className="w-4 h-4 text-green-400" /> :
                            item.salesVelocity > 2 ?
                            <ArrowUp className="w-4 h-4 text-yellow-400" /> :
                            <ArrowDown className="w-4 h-4 text-red-400" />
                          }
                          <span className="text-white font-medium">{item.salesVelocity}</span>
                          <span className="text-white/50 text-sm">units/day</span>
                        </div>
                      </td>
                      
                      <td className="p-4 text-center">
                        <div className={`font-bold text-lg ${
                          item.daysUntilStockout <= 3 ? 'text-red-400' :
                          item.daysUntilStockout <= 7 ? 'text-orange-400' :
                          item.daysUntilStockout <= 14 ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>
                          {item.daysUntilStockout} days
                        </div>
                      </td>
                      
                      <td className="p-4">
                        <div className="text-center text-sm">
                          <p className="text-white/70">Reorder: {item.reorderPoint} units</p>
                          <p className="text-white/70">Quantity: {item.reorderQuantity}</p>
                          <p className="text-white/50 text-xs">Lead: {item.leadTime} days</p>
                          {item.reorderDate && (
                            <p className={`text-xs mt-1 ${item.shouldReorderNow ? 'text-red-400 font-bold' : 'text-yellow-400'}`}>
                              Reorder {item.shouldReorderNow ? 'NOW' : `by ${new Date(item.reorderDate).toLocaleDateString()}`}
                            </p>
                          )}
                        </div>
                      </td>
                      
                      <td className="p-4">
                        <div className="flex items-center justify-end space-x-2">
                          {(item.shouldReorderNow || item.quantity <= item.reorderPoint) && (
                            <button
                              onClick={() => handleReorder(item)}
                              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-3 py-2 rounded-lg transition-all duration-300 flex items-center space-x-1"
                            >
                              <ShoppingCart className="w-4 h-4 text-white" />
                              <span className="text-white text-sm">Reorder</span>
                            </button>
                          )}
                          <button 
                            onClick={() => handleEditInventory(item)}
                            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                          >
                            <Edit2 className="w-4 h-4 text-white/60" />
                          </button>
                          <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                            <BarChart2 className="w-4 h-4 text-white/60" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Inventory Modal */}
        {showEditModal && selectedProduct && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-md w-full mx-4">
              <h3 className="text-2xl font-bold text-white mb-4">Edit Inventory</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-white/70 text-sm mb-2">Product</p>
                  <p className="text-white font-medium">{selectedProduct.title}</p>
                  <p className="text-white/50 text-sm">SKU: {selectedProduct.sku}</p>
                </div>
                
                <div>
                  <label className="text-white/70 text-sm block mb-2">Current Quantity</label>
                  <input
                    type="number"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
                  />
                </div>
                
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                  <p className="text-blue-400 text-sm font-medium mb-2">Inventory Analysis</p>
                  <div className="space-y-1 text-sm">
                    <p className="text-white/70">Sales Velocity: {selectedProduct.salesVelocity} units/day</p>
                    <p className="text-white/70">Current Stock Days: {Math.floor(editQuantity / (selectedProduct.salesVelocity || 1))}</p>
                    <p className="text-white/70">Suggested Reorder: {selectedProduct.reorderQuantity} units</p>
                    <p className="text-white/70">Lead Time: {selectedProduct.leadTime} days</p>
                  </div>
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveInventoryUpdate}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl text-white font-medium transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reorder Modal */}
        {showReorderModal && selectedProduct && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-md w-full mx-4">
              <h3 className="text-2xl font-bold text-white mb-4">Create Reorder</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-white/70 text-sm mb-2">Product</p>
                  <p className="text-white font-medium">{selectedProduct.title}</p>
                  <p className="text-white/50 text-sm">SKU: {selectedProduct.sku}</p>
                </div>
                
                <div>
                  <label className="text-white/70 text-sm block mb-2">Quantity</label>
                  <input
                    type="number"
                    defaultValue={selectedProduct.reorderQuantity}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
                  />
                </div>
                
                <div>
                  <label className="text-white/70 text-sm block mb-2">Expected Delivery</label>
                  <input
                    type="date"
                    defaultValue={new Date(Date.now() + selectedProduct.leadTime * 86400000).toISOString().split('T')[0]}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
                  />
                </div>
                
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                  <p className="text-blue-400 text-sm font-medium mb-2">Reorder Information</p>
                  <div className="space-y-1 text-sm">
                    <p className="text-white/70">Batch Size: {selectedProduct.batchSize} units</p>
                    <p className="text-white/70">Lead Time: {selectedProduct.leadTime} days</p>
                    <p className="text-white/70">Unit Cost: {formatCurrency(selectedProduct.unitCost)}</p>
                    <p className="text-white font-medium">Total: {formatCurrency(selectedProduct.unitCost * selectedProduct.reorderQuantity)}</p>
                  </div>
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowReorderModal(false)}
                    className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // Handle reorder submission
                      setShowReorderModal(false);
                    }}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl text-white font-medium transition-all"
                  >
                    Create Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inventory;
