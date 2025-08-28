// frontend/src/Returns.js - ENHANCED VERSION WITH COST TRACKING
import React, { useState, useEffect } from 'react';
import {
  Package, AlertTriangle, TrendingUp, RotateCcw,
  Search, Filter, Plus, Check, X, Clock,
  DollarSign, Truck, AlertCircle, BarChart2,
  FileText, Download, ChevronRight, Calendar,
  TrendingDown, Target, Zap, Eye, ChevronDown
} from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8080';

const Returns = () => {
  const [returns, setReturns] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [costAnalysis, setCostAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showNewReturn, setShowNewReturn] = useState(false);
  const [showCostDetails, setShowCostDetails] = useState(false);
  const [activeView, setActiveView] = useState('returns'); // 'returns', 'analytics', 'pricing'
  const [filters, setFilters] = useState({
    status: 'all',
    reasonCategory: 'all',
    dateRange: '30d'
  });

  // Fetch returns data with cost information
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

  // Fetch cost analytics
  const fetchCostAnalysis = async () => {
    try {
      const days = parseInt(filters.dateRange);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const response = await fetch(
        `${API_BASE}/api/v1/returns/cost-analysis?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      const data = await response.json();
      
      if (data.success) {
        setCostAnalysis(data);
      }
    } catch (error) {
      console.error('Failed to fetch cost analysis:', error);
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
    fetchCostAnalysis();
  }, [filters]);

  // Enhanced New Return Form with Cost Awareness
  const NewReturnForm = () => {
    const [formData, setFormData] = useState({
      orderId: '',
      items: [],
      customerEmail: '',
      notes: '',
      searchOrderNumber: ''
    });
    const [orderData, setOrderData] = useState(null);
    const [costEstimate, setCostEstimate] = useState(null);
    const [showKeepItOffer, setShowKeepItOffer] = useState(false);

    // Search for order
    const searchOrder = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/v1/orders/search?number=${formData.searchOrderNumber}`
        );
        const data = await response.json();
        
        if (data.order) {
          setOrderData(data.order);
          setFormData({...formData, orderId: data.order.id});
          
          // Estimate return cost
          const returnValue = data.order.totalCents;
          const estimatedCost = (data.order.shippingCostCents || 1200) * 2 + 500; // Rough estimate
          
          if (estimatedCost > returnValue * 0.5) {
            setShowKeepItOffer(true);
          }
          
          setCostEstimate({
            returnValue: returnValue / 100,
            shippingCost: estimatedCost / 100,
            keepItRecommended: estimatedCost > returnValue * 0.5
          });
        }
      } catch (error) {
        console.error('Order search failed:', error);
      }
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      try {
        const response = await fetch(`${API_BASE}/api/v1/returns/create-with-cost`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            autoApprove: false
          })
        });
        
        const data = await response.json();
        
        if (data.offerKeepIt) {
          setShowKeepItOffer(true);
        } else if (data.success) {
          setShowNewReturn(false);
          fetchReturns();
          fetchCostAnalysis();
        }
      } catch (error) {
        console.error('Failed to create return:', error);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
        <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Create New Return</h2>
            <button
              onClick={() => setShowNewReturn(false)}
              className="text-white/60 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Order Search */}
            <div>
              <label className="block text-white/70 text-sm mb-2">Order Number</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.searchOrderNumber}
                  onChange={(e) => setFormData({...formData, searchOrderNumber: e.target.value})}
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
                  placeholder="Enter order number..."
                />
                <button
                  type="button"
                  onClick={searchOrder}
                  className="px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-xl text-white"
                >
                  Search
                </button>
              </div>
            </div>

            {/* Order Details & Cost Estimate */}
            {orderData && (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-white font-medium">Order #{orderData.number}</p>
                    <p className="text-white/60 text-sm">{orderData.customerEmail}</p>
                    <p className="text-white/60 text-sm">Total: ${(orderData.totalCents / 100).toFixed(2)}</p>
                  </div>
                  {costEstimate && (
                    <div className="text-right">
                      <p className="text-white/60 text-sm">Est. Return Cost</p>
                      <p className="text-red-400 font-bold text-lg">${costEstimate.shippingCost.toFixed(2)}</p>
                      {costEstimate.keepItRecommended && (
                        <span className="text-xs text-yellow-400">High cost!</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Keep It Offer Alert */}
                {showKeepItOffer && (
                  <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                      <div>
                        <p className="text-yellow-400 font-medium">Consider "Keep It" Refund</p>
                        <p className="text-yellow-400/70 text-sm mt-1">
                          Return costs exceed 50% of product value. Consider offering a refund 
                          without requiring the return.
                        </p>
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg text-sm"
                            onClick={() => {
                              // Process keep-it refund
                              console.log('Process keep-it refund');
                            }}
                          >
                            Offer Keep-It Refund
                          </button>
                          <button
                            type="button"
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm"
                            onClick={() => setShowKeepItOffer(false)}
                          >
                            Proceed with Return
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Item Selection */}
                <div>
                  <p className="text-white/70 text-sm mb-2">Select items to return:</p>
                  {orderData.items?.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded">
                      <input type="checkbox" className="rounded" />
                      <div className="flex-1">
                        <p className="text-white text-sm">{item.title}</p>
                        <p className="text-white/60 text-xs">SKU: {item.sku} • Qty: {item.quantity}</p>
                      </div>
                      <p className="text-white">${(item.totalCents / 100).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reason Selection */}
            <div>
              <label className="block text-white/70 text-sm mb-2">Return Reason</label>
              <select 
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
                onChange={(e) => setFormData({...formData, reasonCategory: e.target.value})}
              >
                <option value="">Select reason...</option>
                <option value="defective">Defective Product</option>
                <option value="not_as_described">Not as Described</option>
                <option value="changed_mind">Changed Mind</option>
                <option value="damaged_in_shipping">Damaged in Shipping</option>
                <option value="wrong_item">Wrong Item Received</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-white/70 text-sm mb-2">Additional Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
                rows={3}
                placeholder="Describe the issue..."
              />
            </div>

            {/* Action Buttons */}
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

  // Return Detail Modal with Cost Breakdown
  const ReturnDetailModal = ({ returnData }) => {
    const [costBreakdown, setCostBreakdown] = useState(null);

    useEffect(() => {
      // Fetch cost breakdown for this return
      if (returnData?.id) {
        // Cost data would be included with return
        setCostBreakdown({
          originalShipping: (returnData.order?.shippingCostCents || 0) / 100,
          returnLabel: (returnData.returnLabelCostCents || 0) / 100,
          processing: (returnData.processingCostCents || 0) / 100,
          productLoss: (returnData.productValueLossCents || 0) / 100,
          totalLoss: (returnData.totalActualLossCents || 0) / 100,
          restockingFee: (returnData.restockingFeeCents || 0) / 100
        });
      }
    }, [returnData]);

    if (!returnData) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
        <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Return #{returnData.returnNumber}</h2>
              <p className="text-white/60">Created {new Date(returnData.createdAt).toLocaleDateString()}</p>
            </div>
            <button
              onClick={() => setSelectedReturn(null)}
              className="text-white/60 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Return Information */}
            <div className="space-y-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h3 className="text-white font-medium mb-3">Return Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white/60">Status</span>
                    <StatusBadge status={returnData.status} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Order #</span>
                    <span className="text-white">{returnData.order?.number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Customer</span>
                    <span className="text-white">{returnData.customerEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Return Value</span>
                    <span className="text-white font-medium">
                      ${(returnData.totalReturnValueCents / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h3 className="text-white font-medium mb-3">Items</h3>
                <div className="space-y-2">
                  {returnData.items?.map((item, idx) => (
                    <div key={idx} className="p-2 bg-white/5 rounded-lg">
                      <p className="text-white text-sm font-medium">{item.productTitle}</p>
                      <p className="text-white/60 text-xs">SKU: {item.sku}</p>
                      <div className="flex justify-between mt-1">
                        <span className="text-white/60 text-xs">
                          Qty: {item.quantityReturned} • ${(item.unitPriceCents / 100).toFixed(2)} each
                        </span>
                        <span className="text-orange-400 text-xs">
                          {item.reasonCategory?.replace('_', ' ')}
                        </span>
                      </div>
                      {item.inspectedCondition && (
                        <div className="mt-1">
                          <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                            Condition: {item.inspectedCondition}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Cost Analysis */}
            <div className="space-y-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-red-400" />
                  Cost Breakdown
                </h3>
                {costBreakdown ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between py-2 border-b border-white/10">
                        <span className="text-white/60">Original Shipping</span>
                        <span className="text-red-400">-${costBreakdown.originalShipping.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/10">
                        <span className="text-white/60">Return Label</span>
                        <span className="text-red-400">-${costBreakdown.returnLabel.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/10">
                        <span className="text-white/60">Processing Cost</span>
                        <span className="text-red-400">-${costBreakdown.processing.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/10">
                        <span className="text-white/60">Product Value Loss</span>
                        <span className="text-red-400">-${costBreakdown.productLoss.toFixed(2)}</span>
                      </div>
                      {costBreakdown.restockingFee > 0 && (
                        <div className="flex justify-between py-2 border-b border-white/10">
                          <span className="text-white/60">Restocking Fee</span>
                          <span className="text-green-400">+${costBreakdown.restockingFee.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 font-bold">
                        <span className="text-white">Total Loss</span>
                        <span className="text-red-500 text-xl">-${costBreakdown.totalLoss.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    {returnData.keepItRefund && (
                      <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-yellow-400 text-sm">
                          ⚠️ Keep-It refund was recommended for this return
                        </p>
                      </div>
                    )}

                    {returnData.supplierChargebackCents > 0 && (
                      <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-green-400 text-sm">
                          ✓ Supplier chargeback: ${(returnData.supplierChargebackCents / 100).toFixed(2)}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-white/60 text-sm">Cost analysis pending...</p>
                )}
              </div>

              {/* Actions */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h3 className="text-white font-medium mb-3">Actions</h3>
                <div className="space-y-2">
                  {returnData.status === 'pending' && (
                    <>
                      <button className="w-full px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg">
                        Approve Return
                      </button>
                      <button className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg">
                        Reject Return
                      </button>
                    </>
                  )}
                  {returnData.status === 'approved' && (
                    <button className="w-full px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg">
                      Mark as Received
                    </button>
                  )}
                  <button className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg">
                    Print Label
                  </button>
                  <button className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg">
                    Email Customer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const statusConfig = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      approved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      received: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30'
    };

    return (
      <span className={`px-2 py-1 rounded-lg text-xs border ${statusConfig[status] || statusConfig.pending}`}>
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      {/* Header with Navigation */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
          Returns Management
        </h1>
        <p className="text-white/60 mt-2">Track returns, analyze costs, and optimize pricing</p>
        
        {/* View Toggle */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={() => setActiveView('returns')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeView === 'returns' 
                ? 'bg-purple-500 text-white' 
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            Returns List
          </button>
          <button
            onClick={() => setActiveView('analytics')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeView === 'analytics' 
                ? 'bg-purple-500 text-white' 
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            Cost Analytics
          </button>
          <button
            onClick={() => setActiveView('pricing')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeView === 'pricing' 
                ? 'bg-purple-500 text-white' 
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            Price Optimization
          </button>
        </div>
      </div>

      {/* Enhanced Metrics with Cost Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Total Returns</p>
              <p className="text-3xl font-bold text-white mt-1">{returns.length}</p>
              <p className="text-white/40 text-xs mt-1">Last {filters.dateRange}</p>
            </div>
            <Package className="w-10 h-10 text-purple-400" />
          </div>
        </div>

        <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Total Loss</p>
              <p className="text-3xl font-bold text-red-400 mt-1">
                ${costAnalysis?.summary?.totalReturnCost?.toFixed(0) || '0'}
              </p>
              <p className="text-white/40 text-xs mt-1">Actual cost impact</p>
            </div>
            <TrendingDown className="w-10 h-10 text-red-400" />
          </div>
        </div>

        <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Avg Cost/Return</p>
              <p className="text-3xl font-bold text-orange-400 mt-1">
                ${costAnalysis?.summary?.avgReturnCost?.toFixed(0) || '0'}
              </p>
              <p className="text-white/40 text-xs mt-1">Per return loss</p>
            </div>
            <DollarSign className="w-10 h-10 text-orange-400" />
          </div>
        </div>

        <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Keep-It Saves</p>
              <p className="text-3xl font-bold text-green-400 mt-1">
                ${costAnalysis?.summary?.potentialKeepItSavings?.toFixed(0) || '0'}
              </p>
              <p className="text-white/40 text-xs mt-1">Potential savings</p>
            </div>
            <Zap className="w-10 h-10 text-green-400" />
          </div>
        </div>

        <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Chargebacks</p>
              <p className="text-3xl font-bold text-blue-400 mt-1">
                ${costAnalysis?.summary?.supplierChargebackPotential?.toFixed(0) || '0'}
              </p>
              <p className="text-white/40 text-xs mt-1">Recoverable</p>
            </div>
            <RefreshCw className="w-10 h-10 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Main Content Based on Active View */}
      {activeView === 'returns' && (
        <>
          {/* Action Bar */}
          <div className="flex flex-wrap gap-4 mb-6">
            <button
              onClick={() => setShowNewReturn(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 rounded-2xl text-white font-semibold flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              New Return
            </button>

            <div className="flex gap-2">
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={filters.reasonCategory}
                onChange={(e) => setFilters({...filters, reasonCategory: e.target.value})}
                className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
              >
                <option value="all">All Reasons</option>
                <option value="defective">Defective</option>
                <option value="not_as_described">Not as Described</option>
                <option value="changed_mind">Changed Mind</option>
                <option value="damaged_in_shipping">Damaged</option>
              </select>

              <select
                value={filters.dateRange}
                onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
                className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
            </div>
          </div>

          {/* Returns Table with Cost Column */}
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
                    <th className="text-center p-4 text-white/80">Return Value</th>
                    <th className="text-center p-4 text-white/80">
                      <div className="flex items-center justify-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        Loss
                      </div>
                    </th>
                    <th className="text-left p-4 text-white/80">Reason</th>
                    <th className="text-center p-4 text-white/80">Date</th>
                    <th className="text-right p-4 text-white/80">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="10" className="text-center py-12 text-white/60">
                        Loading returns...
                      </td>
                    </tr>
                  ) : returns.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center py-12 text-white/60">
                        No returns found
                      </td>
                    </tr>
                  ) : (
                    returns.map(returnItem => (
                      <tr key={returnItem.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-4">
                          <p className="text-white font-medium">{returnItem.returnNumber}</p>
                          {returnItem.keepItRefund && (
                            <span className="text-xs text-yellow-400">Keep-it eligible</span>
                          )}
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
                        <td className="p-4 text-center">
                          <p className={`font-medium ${
                            returnItem.totalActualLossCents > 5000 ? 'text-red-500' : 'text-orange-400'
                          }`}>
                            ${((returnItem.totalActualLossCents || 0) / 100).toFixed(2)}
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
                            <Eye className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeView === 'analytics' && (
        /* Cost Analytics View - Add your analytics components here */
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-4">Return Cost Analytics</h2>
          {/* Add charts and analytics here */}
          <p className="text-white/60">Analytics dashboard coming soon...</p>
        </div>
      )}

      {activeView === 'pricing' && (
        /* Price Optimization View - Add pricing recommendations here */
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-4">Price Optimization</h2>
          {/* Add pricing recommendations here */}
          <p className="text-white/60">Pricing recommendations coming soon...</p>
        </div>
      )}

      {/* Modals */}
      {showNewReturn && <NewReturnForm />}
      {selectedReturn && <ReturnDetailModal returnData={selectedReturn} />}
    </div>
  );
};

export default Returns;
