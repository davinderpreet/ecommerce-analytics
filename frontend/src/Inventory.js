import React, { useState, useEffect } from 'react';
import { 
  Package, AlertTriangle, TrendingDown, ShoppingCart,
  RefreshCw, Download, Upload, Search, Filter, 
  Plus, Edit2, Bell, Clock, Truck, ChevronRight,
  BarChart2, AlertCircle, CheckCircle, XCircle,
  ArrowUp, ArrowDown, Settings, Calendar, Info,
  Save, X
} from 'lucide-react';

// Configuration
const API_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:8080").replace(/\/$/, "");

// Settings Modal Component
const SettingsModal = ({ show, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white">Inventory Settings</h3>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Reorder Settings */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h4 className="text-lg font-semibold text-white mb-4">Reorder Configuration</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/70 text-sm block mb-2">Default Lead Time (days)</label>
                <input
                  type="number"
                  value={localSettings.defaultLeadTime}
                  onChange={(e) => setLocalSettings({...localSettings, defaultLeadTime: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-white/70 text-sm block mb-2">Safety Stock Days</label>
                <input
                  type="number"
                  value={localSettings.safetyStockDays}
                  onChange={(e) => setLocalSettings({...localSettings, safetyStockDays: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-white/70 text-sm block mb-2">Min Batch Size</label>
                <input
                  type="number"
                  value={localSettings.minBatchSize}
                  onChange={(e) => setLocalSettings({...localSettings, minBatchSize: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-white/70 text-sm block mb-2">Target Stock Days</label>
                <input
                  type="number"
                  value={localSettings.targetStockDays}
                  onChange={(e) => setLocalSettings({...localSettings, targetStockDays: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>
            </div>
          </div>

          {/* Alert Thresholds */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h4 className="text-lg font-semibold text-white mb-4">Alert Thresholds</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/70 text-sm block mb-2">Critical Stock Level</label>
                <input
                  type="number"
                  value={localSettings.criticalStockLevel}
                  onChange={(e) => setLocalSettings({...localSettings, criticalStockLevel: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-white/70 text-sm block mb-2">Low Stock Level</label>
                <input
                  type="number"
                  value={localSettings.lowStockLevel}
                  onChange={(e) => setLocalSettings({...localSettings, lowStockLevel: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>
            </div>
          </div>

          {/* Sync Settings */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h4 className="text-lg font-semibold text-white mb-4">Sync Configuration</h4>
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={localSettings.autoSync}
                  onChange={(e) => setLocalSettings({...localSettings, autoSync: e.target.checked})}
                  className="w-5 h-5 bg-white/10 border border-white/20 rounded"
                />
                <span className="text-white/80">Enable Auto-Sync</span>
              </label>
              <div>
                <label className="text-white/70 text-sm block mb-2">Sync Interval (minutes)</label>
                <select
                  value={localSettings.syncInterval}
                  onChange={(e) => setLocalSettings({...localSettings, syncInterval: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                >
                  <option value={5}>Every 5 minutes</option>
                  <option value={15}>Every 15 minutes</option>
                  <option value={30}>Every 30 minutes</option>
                  <option value={60}>Every hour</option>
                </select>
              </div>
            </div>
          </div>

          {/* Display Settings */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h4 className="text-lg font-semibold text-white mb-4">Display Options</h4>
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={localSettings.showAlerts}
                  onChange={(e) => setLocalSettings({...localSettings, showAlerts: e.target.checked})}
                  className="w-5 h-5 bg-white/10 border border-white/20 rounded"
                />
                <span className="text-white/80">Show Stock Alerts</span>
              </label>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={localSettings.showMetrics}
                  onChange={(e) => setLocalSettings({...localSettings, showMetrics: e.target.checked})}
                  className="w-5 h-5 bg-white/10 border border-white/20 rounded"
                />
                <span className="text-white/80">Show Metrics Dashboard</span>
              </label>
              <div>
                <label className="text-white/70 text-sm block mb-2">Default View</label>
                <select
                  value={localSettings.defaultView}
                  onChange={(e) => setLocalSettings({...localSettings, defaultView: e.target.value})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                >
                  <option value="table">Table View</option>
                  <option value="cards">Card View</option>
                  <option value="list">List View</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex space-x-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 rounded-xl text-white font-medium transition-all flex items-center justify-center space-x-2"
          >
            <Save className="w-5 h-5" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Reorder Modal Component
const ReorderModal = ({ show, onClose, product, onConfirm }) => {
  const [quantity, setQuantity] = useState(product?.reorderQuantity || 100);
  const [expectedDate, setExpectedDate] = useState('');

  useEffect(() => {
    if (product) {
      setQuantity(product.reorderQuantity);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + (product.leadTime || 7));
      setExpectedDate(futureDate.toISOString().split('T')[0]);
    }
  }, [product]);

  if (!show || !product) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-md w-full mx-4">
        <h3 className="text-2xl font-bold text-white mb-4">Create Purchase Order</h3>
        <div className="space-y-4">
          <div>
            <p className="text-white/70 text-sm mb-2">Product</p>
            <p className="text-white font-medium">{product.title}</p>
            <p className="text-white/50 text-sm">SKU: {product.sku}</p>
          </div>
          
          <div>
            <label className="text-white/70 text-sm block mb-2">Order Quantity</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
            />
          </div>
          
          <div>
            <label className="text-white/70 text-sm block mb-2">Expected Delivery</label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
            />
          </div>
          
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <p className="text-blue-400 text-sm font-medium mb-2">Order Summary</p>
            <div className="space-y-1 text-sm">
              <p className="text-white/70">Current Stock: {product.quantity} units</p>
              <p className="text-white/70">Lead Time: {product.leadTime} days</p>
              <p className="text-white/70">Unit Cost: ${product.unitCost?.toFixed(2) || '0.00'}</p>
              <p className="text-white font-medium">
                Total Cost: ${((product.unitCost || 0) * quantity).toFixed(2)}
              </p>
            </div>
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm({ productId: product.id, quantity, expectedDate })}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl text-white font-medium transition-all"
            >
              Create Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Inventory Component
const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('stockout_risk');
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');
  
  // Settings state
  const [settings, setSettings] = useState({
    defaultLeadTime: 7,
    safetyStockDays: 3,
    minBatchSize: 50,
    targetStockDays: 60,
    criticalStockLevel: 10,
    lowStockLevel: 20,
    autoSync: false,
    syncInterval: 30,
    showAlerts: true,
    showMetrics: true,
    defaultView: 'table'
  });

  // Fetch inventory data
  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/inventory${selectedPlatform !== 'all' ? `?platform=${selectedPlatform}` : ''}`);
      const data = await response.json();
      
      if (data.success) {
        setInventory(data.items || []);
        setStats(data.stats || {});
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
      // Set mock data for demonstration
      setMockData();
    } finally {
      setLoading(false);
    }
  };

  // Set mock data
  const setMockData = () => {
    setInventory([
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
        stockoutRisk: 'high',
        daysUntilStockout: 3,
        salesVelocity: 4.2,
        unitCost: 899.99,
        totalValue: 10799.88,
        shouldReorderNow: true
      }
    ]);
    
    setStats({
      totalProducts: 1,
      totalValue: 10799.88,
      lowStockItems: 1,
      criticalItems: 0
    });
    
    setAlerts([{
      id: '1',
      type: 'high',
      product: 'iPhone 15 Pro',
      message: 'Low stock: 3 days until stockout'
    }]);
  };

  // Update inventory
  const updateInventory = async (productId, newQuantity) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/inventory/${productId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: Number(newQuantity) })
      });
      
      if (response.ok) {
        setEditingItem(null);
        await fetchInventory();
      }
    } catch (error) {
      console.error('Failed to update inventory:', error);
    }
  };

  // Create purchase order
  const createPurchaseOrder = async (orderData) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/inventory/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      
      if (response.ok) {
        setShowReorderModal(false);
        await fetchInventory();
      }
    } catch (error) {
      console.error('Failed to create purchase order:', error);
    }
  };

  // Save settings
  const saveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('inventorySettings', JSON.stringify(newSettings));
  };

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('inventorySettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
    
    fetchInventory();
  }, [selectedPlatform]);

  // Filter and sort inventory
  const processedInventory = inventory
    .filter(item => {
      const matchesSearch = item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
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
        default:
          return 0;
      }
    });

  const getRiskBadgeColor = (risk) => {
    switch (risk) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Background animation */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
      </div>

      <div className="relative z-10 p-8">
        {/* Header */}
        <div className="mb-8 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
              Inventory Management
            </h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                title="Settings"
              >
                <Settings className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={fetchInventory}
                className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 p-3 rounded-xl transition-all"
              >
                <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Metrics - only show if enabled in settings */}
        {settings.showMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <p className="text-3xl font-bold text-white">{stats?.totalProducts || 0}</p>
              <p className="text-white/70 text-sm">Total Products</p>
            </div>
            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <p className="text-3xl font-bold text-white">${(stats?.totalValue || 0).toFixed(2)}</p>
              <p className="text-white/70 text-sm">Total Value</p>
            </div>
            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <p className="text-3xl font-bold text-orange-400">{stats?.lowStockItems || 0}</p>
              <p className="text-white/70 text-sm">Low Stock Items</p>
            </div>
            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <p className="text-3xl font-bold text-red-400">{stats?.criticalItems || 0}</p>
              <p className="text-white/70 text-sm">Critical Items</p>
            </div>
          </div>
        )}

        {/* Alerts - only show if enabled in settings */}
        {settings.showAlerts && alerts.length > 0 && (
          <div className="mb-8 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Bell className="w-5 h-5 mr-2" />
              Stock Alerts ({alerts.length})
            </h3>
            <div className="space-y-2">
              {alerts.slice(0, 3).map(alert => (
                <div key={alert.id} className="flex items-center justify-between p-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
                  <div>
                    <p className="text-white font-medium">{alert.product}</p>
                    <p className="text-white/60 text-sm">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
          <div className="flex flex-col lg:flex-row gap-4">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
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
              className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
            >
              <option value="stockout_risk">Sort by Risk</option>
              <option value="quantity">Sort by Quantity</option>
              <option value="days_until_stockout">Days to Stockout</option>
            </select>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="text-left p-4 text-white/80">Product</th>
                  <th className="text-center p-4 text-white/80">Stock</th>
                  <th className="text-center p-4 text-white/80">Status</th>
                  <th className="text-center p-4 text-white/80">Velocity</th>
                  <th className="text-center p-4 text-white/80">Days Left</th>
                  <th className="text-right p-4 text-white/80">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12">
                      <RefreshCw className="w-8 h-8 text-white/40 animate-spin mx-auto" />
                      <p className="text-white/60 mt-4">Loading inventory...</p>
                    </td>
                  </tr>
                ) : processedInventory.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12">
                      <Package className="w-8 h-8 text-white/40 mx-auto" />
                      <p className="text-white/60 mt-4">No products found</p>
                    </td>
                  </tr>
                ) : (
                  processedInventory.map(item => (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-4">
                        <p className="text-white font-medium">{item.title}</p>
                        <p className="text-white/50 text-sm">SKU: {item.sku}</p>
                      </td>
                      <td className="p-4 text-center">
                        {editingItem === item.id ? (
                          <div className="flex items-center justify-center space-x-2">
                            <input
                              type="number"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(e.target.value)}
                              className="w-20 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-center"
                              autoFocus
                            />
                            <button
                              onClick={() => updateInventory(item.id, editQuantity)}
                              className="p-1 bg-green-500/20 rounded"
                            >
                              <CheckCircle className="w-4 h-4 text-green-400" />
                            </button>
                            <button
                              onClick={() => setEditingItem(null)}
                              className="p-1 bg-red-500/20 rounded"
                            >
                              <XCircle className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setEditingItem(item.id);
                              setEditQuantity(String(item.quantity));
                            }}
                            className="cursor-pointer hover:bg-white/5 rounded p-2"
                          >
                            <p className="text-2xl font-bold text-white">{item.quantity}</p>
                            <p className="text-white/50 text-xs">Click to edit</p>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRiskBadgeColor(item.stockoutRisk)}`}>
                          {item.stockoutRisk?.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-white">{item.salesVelocity?.toFixed(1) || 0}</span>
                        <span className="text-white/50 text-sm"> /day</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`font-bold text-lg ${
                          item.daysUntilStockout <= 3 ? 'text-red-400' :
                          item.daysUntilStockout <= 7 ? 'text-orange-400' :
                          'text-green-400'
                        }`}>
                          {item.daysUntilStockout || 0}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {item.shouldReorderNow && (
                          <button
                            onClick={() => {
                              setSelectedProduct(item);
                              setShowReorderModal(true);
                            }}
                            className="bg-gradient-to-r from-green-500 to-emerald-600 px-3 py-2 rounded-lg text-white text-sm"
                          >
                            Reorder
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      <SettingsModal
        show={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={settings}
        onSave={saveSettings}
      />
      
      <ReorderModal
        show={showReorderModal}
        onClose={() => setShowReorderModal(false)}
        product={selectedProduct}
        onConfirm={createPurchaseOrder}
      />
    </div>
  );
};

export default Inventory;
