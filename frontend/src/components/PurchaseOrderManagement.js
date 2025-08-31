// frontend/src/components/PurchaseOrderManagement.js
import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  ChevronRight, 
  Package,
  Truck,
  Clock,
  DollarSign,
  AlertCircle,
  Check,
  X,
  Edit2,
  Eye,
  Download,
  Calendar,
  Building2,
  Hash,
  ChevronDown
} from 'lucide-react';

// Status Badge Component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    'DRAFT': { bg: 'bg-gray-500/20', text: 'text-gray-300', label: 'Draft' },
    'SENT': { bg: 'bg-blue-500/20', text: 'text-blue-300', label: 'Sent' },
    'CONFIRMED': { bg: 'bg-purple-500/20', text: 'text-purple-300', label: 'Confirmed' },
    'SHIPPED': { bg: 'bg-orange-500/20', text: 'text-orange-300', label: 'Shipped' },
    'PARTIAL_RECEIVED': { bg: 'bg-yellow-500/20', text: 'text-yellow-300', label: 'Partial' },
    'RECEIVED': { bg: 'bg-green-500/20', text: 'text-green-300', label: 'Received' },
    'CANCELLED': { bg: 'bg-red-500/20', text: 'text-red-300', label: 'Cancelled' }
  };

  const config = statusConfig[status] || statusConfig['DRAFT'];
  
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};

// Create PO Modal
const CreatePOModal = ({ show, onClose, onSuccess, API_BASE }) => {
  const [formData, setFormData] = useState({
    supplierId: '',
    expectedDate: '',
    shippingMethod: '',
    freightCost: 0,
    notes: ''
  });
  const [items, setItems] = useState([
    { productId: '', quantity: 0, unitCost: 0, supplierSku: '' }
  ]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show) {
      fetchSuppliers();
      fetchProducts();
    }
  }, [show]);

  const fetchSuppliers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v2/inventory/suppliers`);
      const data = await response.json();
      if (data.success) {
        setSuppliers(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/products`);
      const data = await response.json();
      if (data.products) {
        setProducts(data.products);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const addItem = () => {
    setItems([...items, { productId: '', quantity: 0, unitCost: 0, supplierSku: '' }]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
    const total = subtotal + parseFloat(formData.freightCost || 0);
    return { subtotal, total };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/v2/inventory/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items: items.filter(item => item.productId && item.quantity > 0)
        })
      });

      const data = await response.json();
      if (data.success) {
        onSuccess(data.data);
        onClose();
        resetForm();
      }
    } catch (error) {
      console.error('Error creating PO:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      supplierId: '',
      expectedDate: '',
      shippingMethod: '',
      freightCost: 0,
      notes: ''
    });
    setItems([{ productId: '', quantity: 0, unitCost: 0, supplierSku: '' }]);
  };

  const { subtotal, total } = calculateTotals();

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-bold text-white mb-6">Create Purchase Order</h3>
        
        <div className="space-y-6">
          {/* Supplier & Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white/70 text-sm block mb-2">Supplier *</label>
              <select
                required
                value={formData.supplierId}
                onChange={(e) => setFormData({...formData, supplierId: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
              >
                <option value="">Select Supplier</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-white/70 text-sm block mb-2">Expected Date</label>
              <input
                type="date"
                value={formData.expectedDate}
                onChange={(e) => setFormData({...formData, expectedDate: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
              />
            </div>

            <div>
              <label className="text-white/70 text-sm block mb-2">Shipping Method</label>
              <input
                type="text"
                value={formData.shippingMethod}
                onChange={(e) => setFormData({...formData, shippingMethod: e.target.value})}
                placeholder="e.g., Air Freight, Sea Freight"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30"
              />
            </div>

            <div>
              <label className="text-white/70 text-sm block mb-2">Freight Cost</label>
              <input
                type="number"
                step="0.01"
                value={formData.freightCost}
                onChange={(e) => setFormData({...formData, freightCost: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
              />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="text-white/70 text-sm">Line Items *</label>
              <button
                type="button"
                onClick={addItem}
                className="px-3 py-1 bg-green-500/20 text-green-300 rounded-lg text-sm hover:bg-green-500/30"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-5 gap-3 items-center">
                  <select
                    required
                    value={item.productId}
                    onChange={(e) => updateItem(index, 'productId', e.target.value)}
                    className="col-span-2 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                  >
                    <option value="">Select Product</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.title} - {product.sku}
                      </option>
                    ))}
                  </select>
                  
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                    className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                  />
                  
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    placeholder="Unit Cost"
                    value={item.unitCost}
                    onChange={(e) => updateItem(index, 'unitCost', parseFloat(e.target.value))}
                    className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                  />
                  
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-white/70 text-sm block mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30"
              placeholder="Additional notes..."
            />
          </div>

          {/* Totals */}
          <div className="bg-white/5 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-white/70">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-white/70">
              <span>Freight</span>
              <span>${parseFloat(formData.freightCost || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-white font-bold text-lg">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl text-white font-medium disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Purchase Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// View/Receive PO Modal
const ViewPOModal = ({ show, onClose, poId, onUpdate, API_BASE }) => {
  const [po, setPO] = useState(null);
  const [loading, setLoading] = useState(false);
  const [receiveMode, setReceiveMode] = useState(false);
  const [receiveItems, setReceiveItems] = useState([]);

  useEffect(() => {
    if (show && poId) {
      fetchPODetails();
    }
  }, [show, poId]);

  const fetchPODetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v2/inventory/purchase-orders/${poId}`);
      const data = await response.json();
      if (data.success) {
        setPO(data.data);
        // Initialize receive items
        setReceiveItems(data.data.items.map(item => ({
          poItemId: item.id,
          quantityReceived: item.quantityOrdered - (item.quantityReceived || 0),
          quantityRejected: 0
        })));
      }
    } catch (error) {
      console.error('Error fetching PO:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v2/inventory/purchase-orders/${poId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: receiveItems,
          receivedDate: new Date().toISOString(),
          notes: 'Received via PO Management System'
        })
      });

      const data = await response.json();
      if (data.success) {
        onUpdate(data.data);
        setReceiveMode(false);
        fetchPODetails();
      }
    } catch (error) {
      console.error('Error receiving PO:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateReceiveItem = (index, field, value) => {
    const newItems = [...receiveItems];
    newItems[index][field] = parseInt(value);
    setReceiveItems(newItems);
  };

  if (!show || !po) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-2xl font-bold text-white mb-2">{po.poNumber}</h3>
            <div className="flex items-center space-x-4 text-white/60">
              <span className="flex items-center">
                <Building2 className="w-4 h-4 mr-1" />
                {po.supplier?.companyName}
              </span>
              <span className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {new Date(po.createdAt).toLocaleDateString()}
              </span>
              <StatusBadge status={po.status} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-white/60 text-sm mb-1">Expected Date</p>
            <p className="text-white font-medium">
              {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : 'Not set'}
            </p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-white/60 text-sm mb-1">Shipping Method</p>
            <p className="text-white font-medium">{po.shippingMethod || 'Not specified'}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-white/60 text-sm mb-1">Tracking Number</p>
            <p className="text-white font-medium">{po.trackingNumber || 'Not available'}</p>
          </div>
        </div>

        {/* Line Items */}
        <div className="mb-6">
          <h4 className="text-white font-medium mb-3">Line Items</h4>
          <div className="bg-white/5 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-white/10">
                <tr>
                  <th className="text-left p-4 text-white/60 text-sm">Product</th>
                  <th className="text-left p-4 text-white/60 text-sm">SKU</th>
                  <th className="text-center p-4 text-white/60 text-sm">Ordered</th>
                  {receiveMode ? (
                    <>
                      <th className="text-center p-4 text-white/60 text-sm">Receive</th>
                      <th className="text-center p-4 text-white/60 text-sm">Reject</th>
                    </>
                  ) : (
                    <>
                      <th className="text-center p-4 text-white/60 text-sm">Received</th>
                      <th className="text-right p-4 text-white/60 text-sm">Unit Cost</th>
                      <th className="text-right p-4 text-white/60 text-sm">Total</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {po.items.map((item, index) => (
                  <tr key={item.id} className="border-b border-white/5">
                    <td className="p-4 text-white">{item.product?.title}</td>
                    <td className="p-4 text-white/60">{item.product?.sku}</td>
                    <td className="text-center p-4 text-white">{item.quantityOrdered}</td>
                    {receiveMode ? (
                      <>
                        <td className="text-center p-4">
                          <input
                            type="number"
                            min="0"
                            max={item.quantityOrdered - (item.quantityReceived || 0)}
                            value={receiveItems[index]?.quantityReceived || 0}
                            onChange={(e) => updateReceiveItem(index, 'quantityReceived', e.target.value)}
                            className="w-20 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-center"
                          />
                        </td>
                        <td className="text-center p-4">
                          <input
                            type="number"
                            min="0"
                            max={item.quantityOrdered}
                            value={receiveItems[index]?.quantityRejected || 0}
                            onChange={(e) => updateReceiveItem(index, 'quantityRejected', e.target.value)}
                            className="w-20 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-center"
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="text-center p-4 text-white">
                          {item.quantityReceived || 0}
                          {item.quantityReceived < item.quantityOrdered && (
                            <span className="text-orange-400 text-xs ml-1">
                              ({item.quantityOrdered - item.quantityReceived} pending)
                            </span>
                          )}
                        </td>
                        <td className="text-right p-4 text-white">${item.unitCost.toFixed(2)}</td>
                        <td className="text-right p-4 text-white">${item.totalCost.toFixed(2)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cost Summary */}
        <div className="bg-white/5 rounded-xl p-4 mb-6">
          <div className="space-y-2">
            <div className="flex justify-between text-white/70">
              <span>Subtotal</span>
              <span>${po.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-white/70">
              <span>Freight Cost</span>
              <span>${po.freightCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-white font-bold text-lg">
              <span>Total Cost</span>
              <span>${po.totalCost.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-3">
          {po.status !== 'RECEIVED' && po.status !== 'CANCELLED' && !receiveMode && (
            <button
              onClick={() => setReceiveMode(true)}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl text-white font-medium"
            >
              <Package className="w-4 h-4 inline mr-2" />
              Receive Shipment
            </button>
          )}
          
          {receiveMode && (
            <>
              <button
                onClick={() => setReceiveMode(false)}
                className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleReceive}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl text-white font-medium disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Confirm Receipt'}
              </button>
            </>
          )}
          
          {!receiveMode && (
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Main Purchase Order Component
const PurchaseOrderManagement = ({ API_BASE }) => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    fetchPurchaseOrders();
  }, [filterStatus, pagination.page]);

  const fetchPurchaseOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });
      
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`${API_BASE}/api/v2/inventory/purchase-orders?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setPurchaseOrders(data.data || []);
        setPagination(data.pagination);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination({...pagination, page: 1});
    fetchPurchaseOrders();
  };

  const viewPODetails = (po) => {
    setSelectedPO(po.id);
    setShowViewModal(true);
  };

  const handlePOUpdate = (updatedPO) => {
    setPurchaseOrders(prevPOs => 
      prevPOs.map(po => po.id === updatedPO.id ? updatedPO : po)
    );
  };

  const handlePOCreate = (newPO) => {
    fetchPurchaseOrders();
  };

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-white/60 text-sm">Pending Orders</p>
              <p className="text-3xl font-bold text-white mt-1">
                {stats?.totalPending || 0}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-white/60 text-sm">Total Value</p>
              <p className="text-3xl font-bold text-white mt-1">
                ${stats?.totalValue?.toFixed(2) || '0.00'}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-white/60 text-sm">In Transit</p>
              <p className="text-3xl font-bold text-white mt-1">
                {purchaseOrders.filter(po => po.status === 'SHIPPED').length}
              </p>
            </div>
            <Truck className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-white/60 text-sm">This Month</p>
              <p className="text-3xl font-bold text-white mt-1">
                {purchaseOrders.filter(po => {
                  const poDate = new Date(po.createdAt);
                  const now = new Date();
                  return poDate.getMonth() === now.getMonth() && 
                         poDate.getFullYear() === now.getFullYear();
                }).length}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-purple-400" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 flex-1">
            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch(e);
                    }
                  }}
                  placeholder="Search PO number, tracking..."
                  className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30"
                />
              </div>
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
            >
              <option value="all">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="SHIPPED">Shipped</option>
              <option value="RECEIVED">Received</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Create Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl text-white font-medium flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Create PO</span>
          </button>
        </div>
      </div>

      {/* Purchase Orders Table */}
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-white/20 bg-white/5">
              <tr>
                <th className="text-left p-4 text-white/60 font-medium">PO Number</th>
                <th className="text-left p-4 text-white/60 font-medium">Supplier</th>
                <th className="text-left p-4 text-white/60 font-medium">Status</th>
                <th className="text-left p-4 text-white/60 font-medium">Items</th>
                <th className="text-right p-4 text-white/60 font-medium">Total</th>
                <th className="text-left p-4 text-white/60 font-medium">Expected</th>
                <th className="text-left p-4 text-white/60 font-medium">Created</th>
                <th className="text-center p-4 text-white/60 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center p-8">
                    <div className="text-white/40">Loading purchase orders...</div>
                  </td>
                </tr>
              ) : purchaseOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center p-8">
                    <div className="text-white/40">No purchase orders found</div>
                  </td>
                </tr>
              ) : (
                purchaseOrders.map(po => (
                  <tr key={po.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <Hash className="w-4 h-4 text-white/40" />
                        <span className="text-white font-medium">{po.poNumber}</span>
                      </div>
                    </td>
                    <td className="p-4 text-white/80">{po.supplier?.companyName}</td>
                    <td className="p-4">
                      <StatusBadge status={po.status} />
                    </td>
                    <td className="p-4 text-white/60">{po._count?.items || 0} items</td>
                    <td className="p-4 text-right text-white font-medium">
                      ${po.totalCost?.toFixed(2) || '0.00'}
                    </td>
                    <td className="p-4 text-white/60">
                      {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : '-'}
                    </td>
                    <td className="p-4 text-white/60">
                      {new Date(po.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => viewPODetails(po)}
                          className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-white/60" />
                        </button>
                        {po.status === 'DRAFT' && (
                          <button
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4 text-white/60" />
                          </button>
                        )}
                        {(po.status === 'CONFIRMED' || po.status === 'SHIPPED') && (
                          <button
                            onClick={() => viewPODetails(po)}
                            className="p-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg transition-colors"
                            title="Receive"
                          >
                            <Package className="w-4 h-4 text-green-300" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center p-4 border-t border-white/10">
            <p className="text-white/60 text-sm">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} orders
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => setPagination({...pagination, page: pagination.page - 1})}
                disabled={pagination.page === 1}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-white disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination({...pagination, page: pagination.page + 1})}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-white disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreatePOModal
        show={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handlePOCreate}
        API_BASE={API_BASE}
      />

      <ViewPOModal
        show={showViewModal}
        onClose={() => setShowViewModal(false)}
        poId={selectedPO}
        onUpdate={handlePOUpdate}
        API_BASE={API_BASE}
      />
    </>
  );
};

export default PurchaseOrderManagement;
