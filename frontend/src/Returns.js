import React, { useState, useEffect } from 'react';
import {
  Package, AlertTriangle, TrendingUp, RotateCcw,
  Search, Filter, Plus, Check, X, Clock,
  DollarSign, Truck, AlertCircle, BarChart2,
  FileText, Download, ChevronRight, Calendar
} from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8080';

const Returns = () => {
  const [returns, setReturns] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showNewReturn, setShowNewReturn] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    reasonCategory: 'all',
    dateRange: '30d'
  });

  // Fetch returns data
  const fetchReturns = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/returns?${new URLSearchParams(filters)}`);
      const data = await response.json();
      
      if (data.success) {
        setReturns(data.returns);
      }
    } catch (error) {
      console.error('Failed to fetch returns:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch metrics
  const fetchMetrics = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/returns/metrics`);
      const data = await response.json();
      
      if (data.success) {
        setMetrics(data);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  useEffect(() => {
    fetchReturns();
    fetchMetrics();
  }, [filters]);

  // New Return Form Component
  const NewReturnForm = () => {
    const [formData, setFormData] = useState({
      orderId: '',
      items: [],
      customerEmail: '',
      notes: ''
    });

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      try {
        const response = await fetch(`${API_BASE}/api/v1/returns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        
        if (response.ok) {
          setShowNewReturn(false);
          fetchReturns();
        }
      } catch (error) {
        console.error('Failed to create return:', error);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Process New Return</h2>
            <button
              onClick={() => setShowNewReturn(false)}
              className="text-white/60 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-white/70 text-sm mb-2">Order Number</label>
              <input
                type="text"
                value={formData.orderId}
                onChange={(e) => setFormData({...formData, orderId: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
                placeholder="Enter order number or ID"
                required
              />
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-2">Customer Email</label>
              <input
                type="email"
                value={formData.customerEmail}
                onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
                placeholder="customer@example.com"
              />
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-2">Items to Return</label>
              {/* Item selection would go here */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-white/60 text-sm">Select items from the order...</p>
              </div>
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
                rows={3}
                placeholder="Additional notes about this return..."
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setShowNewReturn(false)}
                className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 rounded-xl text-white font-medium"
              >
                Create Return
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const statusColors = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      approved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      processing: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30'
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[status] || statusColors.pending}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="relative z-10">
        {/* Header */}
        <div className="mb-8 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                Return Management
              </h1>
              <p className="text-white/70 mt-2">Process and track product returns</p>
            </div>
            <button
              onClick={() => setShowNewReturn(true)}
              className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 px-6 py-3 rounded-xl text-white font-medium flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>New Return</span>
            </button>
          </div>
        </div>

        {/* Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <RotateCcw className="w-8 h-8 text-purple-400" />
                <span className="text-2xl font-bold text-white">
                  {metrics.dailyMetrics?.[0]?.return_count || 0}
                </span>
              </div>
              <p className="text-white/70">Returns Today</p>
            </div>

            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <DollarSign className="w-8 h-8 text-green-400" />
                <span className="text-2xl font-bold text-white">
                  ${metrics.dailyMetrics?.[0]?.total_return_value || 0}
                </span>
              </div>
              <p className="text-white/70">Return Value</p>
            </div>

            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <AlertTriangle className="w-8 h-8 text-orange-400" />
                <span className="text-2xl font-bold text-white">
                  {metrics.dailyMetrics?.[0]?.defective_units || 0}
                </span>
              </div>
              <p className="text-white/70">Defective Units</p>
            </div>

            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <Package className="w-8 h-8 text-blue-400" />
                <span className="text-2xl font-bold text-white">
                  {returns.filter(r => r.status === 'pending').length}
                </span>
              </div>
              <p className="text-white/70">Pending Returns</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
          <div className="flex flex-wrap gap-4">
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              value={filters.reasonCategory}
              onChange={(e) => setFilters({...filters, reasonCategory: e.target.value})}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white"
            >
              <option value="all">All Reasons</option>
              <option value="defective">Defective</option>
              <option value="damaged_in_shipping">Shipping Damage</option>
              <option value="not_as_described">Not as Described</option>
              <option value="wrong_item">Wrong Item</option>
              <option value="unwanted">Unwanted</option>
            </select>

            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
        </div>

        {/* Returns Table */}
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="text-left p-4 text-white/80">RMA #</th>
                  <th className="text-left p-4 text-white/80">Order</th>
                  <th className="text-left p-4 text-white/80">Customer</th>
                  <th className="text-center p-4 text-white/80">Status</th>
                  <th className="text-center p-4 text-white/80">Items</th>
                  <th className="text-center p-4 text-white/80">Value</th>
                  <th className="text-left p-4 text-white/80">Reason</th>
                  <th className="text-center p-4 text-white/80">Date</th>
                  <th className="text-right p-4 text-white/80">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" className="text-center py-12 text-white/60">
                      Loading returns...
                    </td>
                  </tr>
                ) : returns.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-12 text-white/60">
                      No returns found
                    </td>
                  </tr>
                ) : (
                  returns.map(returnItem => (
                    <tr key={returnItem.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-4">
                        <p className="text-white font-medium">{returnItem.returnNumber}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-white">{returnItem.order?.number}</p>
                        <p className="text-white/50 text-sm">{returnItem.order?.channel?.name}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-white/80 text-sm">{returnItem.customerEmail}</p>
                      </td>
                      <td className="p-4 text-center">
                        <StatusBadge status={returnItem.status} />
                      </td>
                      <td className="p-4 text-center">
                        <p className="text-white">{returnItem.items?.length || 0}</p>
                      </td>
                      <td className="p-4 text-center">
                        <p className="text-white font-medium">
                          ${(returnItem.totalReturnValueCents / 100).toFixed(2)}
                        </p>
                      </td>
                      <td className="p-4">
                        <p className="text-white/80 text-sm">
                          {returnItem.items?.[0]?.reasonCategory?.replace('_', ' ')}
                        </p>
                      </td>
                      <td className="p-4 text-center">
                        <p className="text-white/60 text-sm">
                          {new Date(returnItem.createdAt).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => setSelectedReturn(returnItem)}
                          className="text-purple-400 hover:text-purple-300"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
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
      {showNewReturn && <NewReturnForm />}
    </div>
  );
};

export default Returns;
