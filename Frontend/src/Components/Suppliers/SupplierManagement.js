import React, { useState, useEffect } from 'react';
import './supplier-management.css';
import SimpleSupplierForm from './SimpleSupplierForm';
import SupplierDetails from './SupplierDetails';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

const SupplierManagement = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({
    totalSuppliers: 0,
    activeSuppliers: 0,
    inactiveSuppliers: 0,
    avgRating: 0,
    totalValue: 0
  });

  const categories = [
    'Medical Equipment',
    'Dental Supplies', 
    'Pharmaceuticals',
    'Office Supplies',
    'Other'
  ];

  useEffect(() => {
    fetchSuppliers();
    fetchStats();
  }, [currentPage, searchTerm, categoryFilter, statusFilter]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10'
      });

      if (searchTerm) params.append('search', searchTerm);
      if (categoryFilter) params.append('category', categoryFilter);
      if (statusFilter) params.append('isActive', statusFilter);

      const response = await fetch(`${API_BASE}/api/suppliers?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch suppliers');
      }

      const data = await response.json();
      setSuppliers(data.suppliers);
      setTotalPages(Math.ceil(data.total / 10));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/suppliers/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      } else {
        console.error('Failed to fetch stats:', response.status, response.statusText);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleCreateSupplier = async (supplierData) => {
    try {
      const token = localStorage.getItem('token');
      console.log('Creating supplier with data:', supplierData);
      console.log('Token:', token ? 'Present' : 'Missing');
      
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }
      
      const response = await fetch(`${API_BASE}/api/suppliers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(supplierData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        console.error('Response status:', response.status);
        console.error('Detailed errors:', errorData.errors);
        throw new Error(errorData.message || `Failed to create supplier (${response.status})`);
      }

      setShowForm(false);
      fetchSuppliers();
      fetchStats();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateSupplier = async (id, supplierData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/suppliers/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(supplierData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update supplier');
      }

      setEditingSupplier(null);
      fetchSuppliers();
      fetchStats();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteSupplier = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this supplier?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/suppliers/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to deactivate supplier');
      }

      fetchSuppliers();
      fetchStats();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReactivateSupplier = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/suppliers/${id}/reactivate`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to reactivate supplier');
      }

      fetchSuppliers();
      fetchStats();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRatingUpdate = async (id, rating) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/suppliers/${id}/rating`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating })
      });

      if (!response.ok) {
        throw new Error('Failed to update rating');
      }

      fetchSuppliers();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`star ${i < rating ? 'filled' : ''}`}>
        ★
      </span>
    ));
  };

  if (loading && suppliers.length === 0) {
    return <div className="loading">Loading suppliers...</div>;
  }

  return (
    <div className="supplier-management">
      <div className="supplier-header">
        <h1>Supplier Management</h1>
        <button 
          className="btn-primary"
          onClick={() => setShowForm(true)}
        >
          Add New Supplier
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Suppliers</h3>
          <p>{stats.totalSuppliers}</p>
        </div>
        <div className="stat-card">
          <h3>Active Suppliers</h3>
          <p>{stats.activeSuppliers}</p>
        </div>
        <div className="stat-card">
          <h3>Average Rating</h3>
          <p>{stats.avgRating.toFixed(1)}/5</p>
        </div>
        <div className="stat-card">
          <h3>Total Value</h3>
          <p>Rs. {stats.totalValue.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search suppliers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">All Categories</option>
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Suppliers Table */}
      <div className="suppliers-table-container">
        <table className="suppliers-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Company</th>
              <th>Contact Person</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Category</th>
              <th>Rating</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map(supplier => (
              <tr key={supplier._id} className={!supplier.isActive ? 'inactive' : ''}>
                <td>{supplier.supplierCode}</td>
                <td>{supplier.companyName}</td>
                <td>{supplier.contactPerson}</td>
                <td>{supplier.email}</td>
                <td>{supplier.phone}</td>
                <td>{supplier.category}</td>
                <td>
                  <div className="rating-display">
                    {renderStars(supplier.rating)}
                    <span className="rating-number">({supplier.rating})</span>
                  </div>
                </td>
                <td>
                  <span className={`status ${supplier.isActive ? 'active' : 'inactive'}`}>
                    {supplier.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn-view"
                      onClick={() => setSelectedSupplier(supplier)}
                      title="View Details"
                    >
                      👁️
                    </button>
                    <button
                      className="btn-edit"
                      onClick={() => setEditingSupplier(supplier)}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    {supplier.isActive ? (
                      <button
                        className="btn-deactivate"
                        onClick={() => handleDeleteSupplier(supplier._id)}
                        title="Deactivate"
                      >
                        🚫
                      </button>
                    ) : (
                      <button
                        className="btn-activate"
                        onClick={() => handleReactivateSupplier(supplier._id)}
                        title="Reactivate"
                      >
                        ✅
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <SimpleSupplierForm
              onSubmit={handleCreateSupplier}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {editingSupplier && (
        <div className="modal-overlay">
          <div className="modal">
            <SimpleSupplierForm
              supplier={editingSupplier}
              onSubmit={(data) => handleUpdateSupplier(editingSupplier._id, data)}
              onCancel={() => setEditingSupplier(null)}
            />
          </div>
        </div>
      )}

      {selectedSupplier && (
        <div className="modal-overlay">
          <div className="modal">
            <SupplierDetails
              supplier={selectedSupplier}
              onClose={() => setSelectedSupplier(null)}
              onRatingUpdate={handleRatingUpdate}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierManagement;
