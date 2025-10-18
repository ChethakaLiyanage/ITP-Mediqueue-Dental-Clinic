import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
// Using Font Awesome classes instead of react-icons
import { API_BASE } from '../../api';
import { useAuth } from "../../Contexts/AuthContext";
import './Inventory.css';

const Inventory = () => {
  const navigate = useNavigate();
  const { token, user, isAuthenticated } = useAuth();
  
  // All hooks must be called at the top level, before any conditional returns
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    itemName: '',
    quantity: 1,
    unit: 'pcs',
    category: '',
    minStockLevel: 10,
    supplier: ''
  });

  // Fetch only active suppliers for the dropdown
  const fetchSuppliers = async () => {
    try {
      // Query parameter filters for active suppliers only
      const response = await fetch(`${API_BASE}/api/suppliers?isActive=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.suppliers || data);
      } else {
        console.error('Failed to fetch active suppliers');
      }
    } catch (error) {
      console.error('Error fetching active suppliers:', error);
    }
  };

  // Fetch all inventory items
  const fetchItems = async () => {
    setLoading(true);
    
    // Debug: Log the fetch request details
    console.log('=== FETCH INVENTORY ITEMS ===');
    console.log('Token:', token ? 'Present' : 'Missing');
      console.log('API_BASE:', API_BASE);
      console.log('Request URL:', `${API_BASE}/api/inventory`);
    
    try {
      const response = await fetch(`${API_BASE}/api/inventory`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Fetch Response status:', response.status);
      console.log('Fetch Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: Failed to fetch inventory items`;
        try {
          const errorData = await response.json();
          console.log('Fetch Error response data:', errorData);
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          console.log('Could not parse fetch error response as JSON');
          const textResponse = await response.text().catch(() => 'Unknown error');
          console.log('Fetch Text response:', textResponse);
          errorMessage = textResponse || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('Fetch Success data:', data);
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching items:', error);
      console.error('Fetch Error stack:', error.stack);
      alert(`Failed to load inventory items: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('=== INVENTORY USEEFFECT ===');
    console.log('isAuthenticated:', isAuthenticated);
    console.log('token exists:', !!token);
    console.log('token length:', token ? token.length : 0);
    
    if (!isAuthenticated || !token) {
      console.log('User not authenticated, redirecting to login');
      alert('Please log in to access inventory');
      navigate('/login');
      return;
    }
    
    console.log('User authenticated, fetching items and suppliers...');
    fetchItems();
    fetchSuppliers();
  }, [token, isAuthenticated, navigate]);
  
  console.log('=== INVENTORY AUTH DEBUG ===');
  console.log('isAuthenticated:', isAuthenticated);
  console.log('token exists:', !!token);
  console.log('user:', user);
  console.log('user role:', user?.role);
  
  // Temporarily allow any authenticated user for testing
  // if (isAuthenticated && user && user.role !== 'Manager' && user.role !== 'manager') {
  //   console.log('User is not a manager, redirecting...');
  //   navigate('/');
  //   return <div>Access denied. Managers only.</div>;
  // }
  
  // Immediate redirect if not authenticated
  if (!isAuthenticated || !token) {
    console.log('Not authenticated, redirecting to login...');
    navigate('/login');
    return <div>Redirecting to login...</div>;
  }

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'minStockLevel' 
        ? Math.max(0, parseInt(value) || 0) 
        : value
    }));
  };

  // Add new item
  const handleAddItem = async () => {
    if (!isAuthenticated || !token) {
      alert('Please log in to add items');
      navigate('/login');
      return;
    }

    if (!formData.itemName.trim()) {
      alert('Please enter item name');
      return;
    }

    // Debug: Log the request details
    console.log('=== ADD ITEM REQUEST ===');
    console.log('Token:', token ? 'Present' : 'Missing');
    console.log('API_BASE:', API_BASE);
    console.log('Form Data:', formData);
      console.log('Request URL:', `${API_BASE}/api/inventory`);
    
    try {
      const response = await fetch(`${API_BASE}/api/inventory`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: Failed to add item`;
        
        // Handle specific HTTP status codes
        if (response.status === 401) {
          errorMessage = 'Unauthorized: Please log in first';
          console.log('401 Error - redirecting to login');
          navigate('/login');
        } else if (response.status === 403) {
          errorMessage = 'Forbidden: You do not have permission to add items';
        } else if (response.status === 500) {
          errorMessage = 'Server error: Please try again later';
        }
        
        try {
          const errorData = await response.json();
          console.log('Error response data:', errorData);
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          console.log('Could not parse error response as JSON');
          const textResponse = await response.text().catch(() => 'Unknown error');
          console.log('Text response:', textResponse);
          errorMessage = textResponse || errorMessage;
        }
        console.error('API Error:', errorMessage);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Success response:', result);

      await fetchItems();
      setFormData({ 
        itemName: '', 
        quantity: 1, 
        unit: 'pcs',
        category: '',
        minStockLevel: 10,
        supplier: ''
      });
      setIsAdding(false);
      alert('Item added successfully');
    } catch (error) {
      console.error('Error adding item:', error);
      console.error('Error stack:', error.stack);
      
      // Show more detailed error message
      let errorMsg = error.message;
      if (!errorMsg || errorMsg === 'Failed to add item') {
        errorMsg = 'Unknown error occurred. Please check console for details.';
      }
      
      alert(`Failed to add item: ${errorMsg}`);
    }
  };

  // Start editing an item
  const startEditing = (item) => {
    setEditingId(item._id);
    setFormData({
      itemName: item.itemName,
      quantity: item.quantity,
      unit: item.unit || 'pcs',
      category: item.category || '',
      minStockLevel: item.minStockLevel || 10,
      supplier: item.supplier || ''
    });
  };

  // Save edited item
  const saveEdit = async () => {
    if (!formData.itemName.trim()) {
      alert('Please enter item name');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/inventory/${editingId}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to update item');
      }

      await fetchItems();
      setEditingId(null);
      setFormData({ 
        itemName: '', 
        quantity: 1, 
        unit: 'pcs',
        category: '',
        minStockLevel: 10,
        supplier: ''
      });
      alert('Item updated successfully');
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Failed to update item');
    }
  };

  // Delete an item
  const deleteItem = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/inventory/${id}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      await fetchItems();
      alert('Item deleted successfully');
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    }
  };

  // Increase quantity by 1
  const increaseQuantity = async (item) => {
    try {
      const response = await fetch(`${API_BASE}/api/inventory/${item._id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          itemName: item.itemName,
          quantity: item.quantity + 1,
          unit: item.unit,
          category: item.category,
          minStockLevel: item.minStockLevel,
          supplier: item.supplier
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update quantity');
      }

      await fetchItems();
    } catch (error) {
      console.error('Error updating quantity:', error);
      alert('Failed to update quantity');
    }
  };

  if (loading) {
    return (
      <div className="inventory-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inventory-container">
      <div className="inventory-header">
        <h2>Inventory Management</h2>
        <button 
          className="add-btn" 
          onClick={() => {
            setIsAdding(true);
            setFormData({ 
              itemName: '', 
              quantity: 1, 
              unit: 'pcs',
              category: '',
              minStockLevel: 10,
              supplier: ''
            });
          }}
        >
          <i className="fas fa-plus"></i> Add Item
        </button>
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId !== null) && (
        <div className="inventory-form">
          <h3>{editingId !== null ? 'Edit Item' : 'Add New Item'}</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Item Name *</label>
              <input
                type="text"
                name="itemName"
                value={formData.itemName}
                onChange={handleInputChange}
                placeholder="Enter item name"
                required
              />
            </div>
            <div className="form-group">
              <label>Quantity *</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                min="0"
                required
              />
            </div>
            <div className="form-group">
              <label>Unit</label>
              <input
                type="text"
                name="unit"
                value={formData.unit}
                onChange={handleInputChange}
                placeholder="e.g., pcs, box, bottle"
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                placeholder="Enter category"
              />
            </div>
            <div className="form-group">
              <label>Min Stock Level</label>
              <input
                type="number"
                name="minStockLevel"
                value={formData.minStockLevel}
                onChange={handleInputChange}
                min="0"
              />
            </div>
            <div className="form-group">
              <label>Supplier</label>
              <select
                name="supplier"
                value={formData.supplier}
                onChange={handleInputChange}
                disabled={suppliers.length === 0}
              >
                <option value="">
                  {suppliers.length === 0 ? 'Loading active suppliers...' : 'Select an active supplier...'}
                </option>
                {suppliers.map((supplier) => (
                  <option key={supplier._id} value={supplier.companyName}>
                    {supplier.companyName}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button 
              className="save-btn"
              onClick={editingId !== null ? saveEdit : handleAddItem}
            >
              {editingId !== null ? 'Save Changes' : 'Add Item'}
            </button>
            <button 
              className="cancel-btn"
              onClick={() => {
                setIsAdding(false);
                setEditingId(null);
                setFormData({ 
                  itemName: '', 
                  quantity: 1, 
                  unit: 'pcs',
                  category: '',
                  minStockLevel: 10,
                  supplier: ''
                });
                // Refresh suppliers list when canceling
                fetchSuppliers();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="inventory-table-container">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Item Code</th>
              <th>Item Name</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Category</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-items">
                  No items in inventory. Click 'Add Item' to get started.
                </td>
              </tr>
            ) : (
              items.map(item => (
                <tr key={item._id}>
                  <td className="item-code">{item.itemCode}</td>
                  <td>{item.itemName}</td>
                  <td>
                    <div className="quantity-controls">
                      <span className="quantity-value">{item.quantity}</span>
                      <button 
                        className="quantity-btn"
                        onClick={() => increaseQuantity(item)}
                        title="Increase quantity by 1"
                      >
                        +1
                      </button>
                    </div>
                  </td>
                  <td>{item.unit || 'pcs'}</td>
                  <td>{item.category || '-'}</td>
                  <td className="actions">
                    <button 
                      className="action-btn edit"
                      onClick={() => startEditing(item)}
                      title="Edit item"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button 
                      className="action-btn delete"
                      onClick={() => deleteItem(item._id)}
                      title="Delete item"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Inventory;