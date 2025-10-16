import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import { API_BASE } from '../api';
import './Inventory.css';

const Inventory = () => {
  const navigate = useNavigate();
  
  // Get auth data from localStorage
  const auth = useMemo(() => {
    try { 
      return JSON.parse(localStorage.getItem("auth") || "{}");
    } catch (error) { 
      console.error('Error parsing auth data:', error);
      return {}; 
    }
  }, []);

  const token = auth?.token || "";

  const [items, setItems] = useState([]);
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

  // Fetch all inventory items
  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/inventory`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch inventory items');
      }
      
      const data = await response.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching items:', error);
      alert('Failed to load inventory items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [token]);

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
    if (!formData.itemName.trim()) {
      alert('Please enter item name');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/api/inventory`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to add item');
      }

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
      alert('Failed to add item');
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
      const response = await fetch(`${API_BASE}/inventory/${item._id}`, {
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
          <FaPlus /> Add Item
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
              <input
                type="text"
                name="supplier"
                value={formData.supplier}
                onChange={handleInputChange}
                placeholder="Enter supplier name"
              />
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
                      <FaEdit />
                    </button>
                    <button 
                      className="action-btn delete"
                      onClick={() => deleteItem(item._id)}
                      title="Delete item"
                    >
                      <FaTrash />
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