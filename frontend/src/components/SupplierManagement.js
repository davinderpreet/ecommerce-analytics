// frontend/src/components/SupplierManagement.js
// Complete Supplier Management Component matching your design

import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Search, Edit2, Trash2, Package, Calendar,
  DollarSign, MapPin, Phone, Mail, Clock, CheckCircle,
  XCircle, Building2, CreditCard, Globe, TrendingUp,
  AlertCircle, X, Save
} from 'lucide-react';

// Supplier Add/Edit Modal
const SupplierModal = ({ show, onClose, supplier, onSave, API_BASE }) => {
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    country: '',
    currency: 'USD',
    paymentTerms: 'NET30',
    leadTimeDays: 7,
    minimumOrderValue: '',
    notes: '',
    bankDetails: '',
    taxId: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (supplier) {
      setFormData({
        companyName: supplier.companyName || '',
        contactName: supplier.contactName || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        country: supplier.country || '',
        currency: supplier.currency || 'USD',
        paymentTerms: supplier.paymentTerms || 'NET30',
        leadTimeDays: supplier.leadTimeDays || 7,
        minimumOrderValue: supplier.minimumOrderValue || '',
        notes: supplier.notes || '',
        bankDetails: supplier.bankDetails || '',
        taxId: supplier.taxId || ''
      });
    } else {
      // Reset form for new supplier
      setFormData({
        companyName: '',
        contactName: '',
        email: '',
        phone: '',
        address: '',
        country: '',
        currency: 'USD',
        paymentTerms: 'NET30',
        leadTimeDays: 7,
        minimumOrderValue: '',
        notes: '',
        bankDetails: '',
        taxId: ''
      });
    }
    setErrors({});
  }, [supplier]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.companyName) newErrors.companyName = 'Company name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      const url = supplier 
        ? `${API_BASE}/api/v2/inventory/suppliers/${supplier.id}`
        : `${API_BASE}/api/v2/inventory/suppliers`;
      
      const method = supplier ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        onSave();
        onClose();
      }
    } catch (error) {
      console.error('Error saving supplier:', error);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white">
            {supplier ? 'Edit Supplier' : 'Add New Supplier'}
          </h3>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Company Information */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Building2 className="w-5 h-5 mr-2" />
              Company Information
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/70 text-sm block mb-2">Company Name *</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                  className={`w-full px-4 py-2 bg-white/10 border ${errors.companyName ? 'border-red-500' : 'border-white/20'} rounded-lg text-white`}
                />
                {errors.companyName && <p className="text-red-400 text-xs mt-1">{errors.companyName}</p>}
              </div>
              <div>
                <label className="text-white/70 text-sm block mb-2">Contact Name</label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Phone className="w-5 h-5 mr-2" />
              Contact Details
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/70 text-sm block mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className={`w-full px-4 py-2 bg-white/10 border ${errors.email ? 'border-red-500' : 'border-white/20'} rounded-lg text-white`}
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="text-white/70 text-sm block mb-2">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="text-white/70 text-sm block mb-2">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
              />
            </div>
          </div>

          {/* Business Details */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
              <CreditCard className="w-5 h-5 mr-2" />
              Business Details
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-white/70 text-sm block mb-2">Country</label>
                <select
                  value={formData.country}
                  onChange={(e) => setFormData({...formData, country: e.target.value})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                >
                  <option value="">Select Country</option>
                  <option value="China">China</option>
                  <option value="USA">USA</option>
                  <option value="Vietnam">Vietnam</option>
                  <option value="India">India</option>
                  <option value="Bangladesh">Bangladesh</option>
                  <option value="Turkey">Turkey</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-white/70 text-sm block mb-2">Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({...formData, currency: e.target.value})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CNY">CNY</option>
                  <option value="CAD">CAD</option>
                </select>
              </div>
              <div>
                <label className="text-white/70 text-sm block mb-2">Payment Terms</label>
                <select
                  value={formData.paymentTerms}
                  onChange={(e) => setFormData({...formData, paymentTerms: e.target.value})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                >
                  <option value="PREPAID">Prepaid</option>
                  <option value="NET30">Net 30</option>
                  <option value="NET60">Net 60</option>
                  <option value="NET90">Net 90</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-white/70 text-sm block mb-2">Lead Time (days)</label>
                <input
                  type="number"
                  value={formData.leadTimeDays}
                  onChange={(e) => setFormData({...formData, leadTimeDays: parseInt(e.target.value) || 0})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-white/70 text-sm block mb-2">Min Order Value</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.minimumOrderValue}
                  onChange={(e) => setFormData({...formData, minimumOrderValue: e.target.value})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-white/70 text-sm block mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
              placeholder="Additional notes about this supplier..."
            />
          </div>
        </div>

        <div className="flex space-x-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 rounded-xl text-white font-medium flex items-center justify-center space-x-2"
          >
            <Save className="w-5 h-5" />
            <span>{supplier ? 'Update Supplier' : 'Add Supplier'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Supplier Management Component
const SupplierManagement = ({ API_BASE }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCountry, setFilterCountry] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterCountry !== 'all') params.append('country', filterCountry);
      
      const response = await fetch(`${API_BASE}/api/v2/inventory/suppliers?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setSuppliers(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      // Set mock data for testing
      setSuppliers([
        {
          id: '1',
          companyName: 'TechSupply Co.',
          contactName: 'John Doe',
          email: 'john@techsupply.com',
          phone: '+86 123 4567890',
          country: 'China',
          currency: 'USD',
          leadTimeDays: 14,
          paymentTerms: 'NET30',
          rating: 4.5,
          isActive: true,
          minimumOrderValue: 5000,
          _count: { products: 12, purchaseOrders: 25 }
        },
        {
          id: '2',
          companyName: 'Global Imports Ltd',
          contactName: 'Jane Smith',
          email: 'jane@globalimports.com',
          phone: '+84 234 5678901',
          country: 'Vietnam',
          currency: 'USD',
          leadTimeDays: 21,
          paymentTerms: 'NET60',
          rating: 4.8,
          isActive: true,
          minimumOrderValue: 3000,
          _count: { products: 8, purchaseOrders: 15 }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [searchTerm, filterCountry]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this supplier?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/v2/inventory/suppliers/${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        fetchSuppliers();
      } else {
        alert(data.error || 'Failed to deactivate supplier');
      }
    } catch (error) {
      console.error('Error deleting supplier:', error);
    }
  };

  const handleEdit = (supplier) => {
    setSelectedSupplier(supplier);
    setShowModal(true);
  };

  const handleAdd = () => {
    setSelectedSupplier(null);
    setShowModal(true);
  };

  return (
    <div>
      {/* Header and Search */}
      <div className="mb-6 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-white/50" size={20} />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40"
            />
          </div>
          <select
            value={filterCountry}
            onChange={(e) => setFilterCountry(e.target.value)}
            className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
          >
            <option value="all">All Countries</option>
            <option value="China">China</option>
            <option value="USA">USA</option>
            <option value="Vietnam">Vietnam</option>
            <option value="India">India</option>
          </select>
          <button
            onClick={handleAdd}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 rounded-xl text-white font-medium flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Supplier Cards */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-white/60">Loading suppliers...</div>
        </div>
      ) : suppliers.length === 0 ? (
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-12 border border-white/20 text-center">
          <Users className="w-16 h-16 text-white/40 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Suppliers Found</h2>
          <p className="text-white/60 mb-6">Add your first supplier to get started</p>
          <button
            onClick={handleAdd}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl text-white font-medium"
          >
            Add Your First Supplier
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {suppliers.map(supplier => (
            <div key={supplier.id} className="backdrop-blur-xl bg-white/10 rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white">{supplier.companyName}</h3>
                  <p className="text-white/60 text-sm">{supplier.contactName}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  supplier.isActive 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {supplier.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-white/70 text-sm">
                  <MapPin className="w-4 h-4" />
                  <span>{supplier.country || 'Not specified'}</span>
                </div>
                <div className="flex items-center gap-2 text-white/70 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>{supplier.leadTimeDays} days lead time</span>
                </div>
                <div className="flex items-center gap-2 text-white/70 text-sm">
                  <DollarSign className="w-4 h-4" />
                  <span>{supplier.paymentTerms || 'NET30'}</span>
                </div>
                <div className="flex items-center gap-2 text-white/70 text-sm">
                  <Package className="w-4 h-4" />
                  <span>{supplier._count?.products || 0} Products</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(supplier)}
                  className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-all flex items-center justify-center gap-1"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(supplier.id)}
                  className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 text-sm transition-all flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <SupplierModal
        show={showModal}
        onClose={() => setShowModal(false)}
        supplier={selectedSupplier}
        onSave={() => {
          fetchSuppliers();
          setShowModal(false);
        }}
        API_BASE={API_BASE}
      />
    </div>
  );
};

export default SupplierManagement;
