import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../api';
import { useAuth } from '../../Contexts/AuthContext';
import './CreateInventoryRequest.css';

const CreateInventoryRequest = () => {
  const navigate = useNavigate();
  const { token, user, isAuthenticated } = useAuth();
  
  // All hooks must be called at the top level, before any conditional returns
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({
    dentistCode: '',
    dentistName: '',
    notes: ''
  });
  const [currentItem, setCurrentItem] = useState({
    itemName: '',
    itemCode: '',
    quantity: 1,
    unit: 'pcs'
  });

  // Immediate redirect if not authenticated
  if (!isAuthenticated || !token) {
    console.log('Not authenticated, redirecting to login...');
    navigate('/login');
    return <div>Redirecting to login...</div>;
  }

  // Auto-populate dentist info from user context
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        dentistCode: user.dentistCode || user.code || '',
        dentistName: user.name || user.fullName || ''
      }));
    }
  }, [user]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear errors when user starts typing
    if (error) setError('');
  };

  // Handle current item input changes
  const handleItemInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentItem(prev => ({
      ...prev,
      [name]: name === 'quantity' ? Math.max(1, parseInt(value) || 1) : value
    }));
  };

  // Add item to the list
  const addItem = () => {
    if (!currentItem.itemName.trim()) {
      setError('Item name is required');
      return;
    }

    if (currentItem.quantity < 1) {
      setError('Quantity must be at least 1');
      return;
    }

    // Check for duplicate item names
    const isDuplicate = items.some(item => 
      item.itemName.toLowerCase() === currentItem.itemName.toLowerCase()
    );

    if (isDuplicate) {
      setError('This item has already been added to the request');
      return;
    }

    setItems(prev => [...prev, { ...currentItem }]);
    setCurrentItem({
      itemName: '',
      itemCode: '',
      quantity: 1,
      unit: 'pcs'
    });
    setError('');
  };

  // Remove item from the list
  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Update item in the list
  const updateItem = (index, field, value) => {
    setItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  // Submit the inventory request
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.dentistCode.trim()) {
      setError('Dentist code is required');
      return;
    }
    
    if (!formData.dentistName.trim()) {
      setError('Dentist name is required');
      return;
    }

    if (items.length === 0) {
      setError('At least one item is required');
      return;
    }

    // Validate each item
    for (const item of items) {
      if (!item.itemName.trim()) {
        setError('All items must have a name');
        return;
      }
      if (item.quantity < 1) {
        setError('All items must have a valid quantity');
        return;
      }
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('=== CREATE INVENTORY REQUEST ===');
      console.log('Token:', token ? 'Present' : 'Missing');
      console.log('API_BASE:', API_BASE);
      console.log('Form Data:', formData);
      console.log('Items:', items);
      console.log('Request URL:', `${API_BASE}/api/inventory-requests`);

      const response = await fetch(`${API_BASE}/api/inventory-requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dentistCode: formData.dentistCode.trim(),
          dentistName: formData.dentistName.trim(),
          items: items,
          notes: formData.notes.trim()
        })
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: Failed to create inventory request`;
        
        // Handle specific HTTP status codes
        if (response.status === 401) {
          errorMessage = 'Unauthorized: Please log in first';
          console.log('401 Error - redirecting to login');
          navigate('/login');
        } else if (response.status === 403) {
          errorMessage = 'Forbidden: You do not have permission to create requests';
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

      setSuccess('Inventory request created successfully!');
      
      // Reset form
      setItems([]);
      setFormData({
        dentistCode: user?.dentistCode || user?.code || '',
        dentistName: user?.name || user?.fullName || '',
        notes: ''
      });
      setCurrentItem({
        itemName: '',
        itemCode: '',
        quantity: 1,
        unit: 'pcs'
      });

      // Redirect after success (optional)
      setTimeout(() => {
        navigate('/dentist/inventory-requests');
      }, 2000);

    } catch (error) {
      console.error('Error creating inventory request:', error);
      console.error('Error stack:', error.stack);
      
      // Show more detailed error message
      let errorMsg = error.message;
      if (!errorMsg || errorMsg === 'Failed to create inventory request') {
        errorMsg = 'Unknown error occurred. Please check console for details.';
      }
      
      setError(`Failed to create inventory request: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-inventory-request-container">
      <div className="request-header">
        <h2>Create Inventory Request</h2>
        <p>Request items from the clinic inventory</p>
      </div>

      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          <i className="fas fa-check-circle"></i>
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="inventory-request-form">
        {/* Dentist Information */}
        <div className="form-section">
          <h3>Dentist Information</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Dentist Code *</label>
              <input
                type="text"
                name="dentistCode"
                value={formData.dentistCode}
                onChange={handleInputChange}
                placeholder="Enter dentist code"
                required
                disabled={!!user?.dentistCode || !!user?.code}
              />
            </div>
            <div className="form-group">
              <label>Dentist Name *</label>
              <input
                type="text"
                name="dentistName"
                value={formData.dentistName}
                onChange={handleInputChange}
                placeholder="Enter dentist name"
                required
                disabled={!!user?.name || !!user?.fullName}
              />
            </div>
          </div>
        </div>

        {/* Items Section */}
        <div className="form-section">
          <h3>Requested Items</h3>
          
          {/* Add Item Form */}
          <div className="add-item-form">
            <div className="form-row">
              <div className="form-group">
                <label>Item Name *</label>
                <input
                  type="text"
                  name="itemName"
                  value={currentItem.itemName}
                  onChange={handleItemInputChange}
                  placeholder="Enter item name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Item Code</label>
                <input
                  type="text"
                  name="itemCode"
                  value={currentItem.itemCode}
                  onChange={handleItemInputChange}
                  placeholder="Enter item code (optional)"
                />
              </div>
              <div className="form-group">
                <label>Quantity *</label>
                <input
                  type="number"
                  name="quantity"
                  value={currentItem.quantity}
                  onChange={handleItemInputChange}
                  min="1"
                  required
                />
              </div>
              <div className="form-group">
                <label>Unit</label>
                <select
                  name="unit"
                  value={currentItem.unit}
                  onChange={handleItemInputChange}
                >
                  <option value="pcs">Pieces</option>
                  <option value="box">Box</option>
                  <option value="bottle">Bottle</option>
                  <option value="pack">Pack</option>
                  <option value="roll">Roll</option>
                  <option value="sheet">Sheet</option>
                  <option value="tube">Tube</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <button
                  type="button"
                  onClick={addItem}
                  className="add-item-btn"
                  disabled={!currentItem.itemName.trim()}
                >
                  <i className="fas fa-plus"></i> Add Item
                </button>
              </div>
            </div>
          </div>

          {/* Items List */}
          {items.length > 0 && (
            <div className="items-list">
              <h4>Items in Request ({items.length})</h4>
              <div className="items-table">
                <div className="items-header">
                  <span>Item Name</span>
                  <span>Code</span>
                  <span>Quantity</span>
                  <span>Unit</span>
                  <span>Action</span>
                </div>
                {items.map((item, index) => (
                  <div key={index} className="item-row">
                    <span>{item.itemName}</span>
                    <span>{item.itemCode || '-'}</span>
                    <span>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        min="1"
                        className="quantity-input"
                      />
                    </span>
                    <span>{item.unit}</span>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="remove-item-btn"
                      title="Remove item"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notes Section */}
        <div className="form-section">
          <h3>Additional Notes</h3>
          <div className="form-group">
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Add any additional notes or special requirements..."
              rows="4"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="form-actions">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="cancel-btn"
            disabled={loading}
          >
            <i className="fas fa-arrow-left"></i> Cancel
          </button>
          <button
            type="submit"
            className="submit-btn"
            disabled={loading || items.length === 0}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Creating Request...
              </>
            ) : (
              <>
                <i className="fas fa-paper-plane"></i> Submit Request
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateInventoryRequest;

