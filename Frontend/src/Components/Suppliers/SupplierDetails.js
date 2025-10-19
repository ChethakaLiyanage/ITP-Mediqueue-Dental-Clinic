import React, { useState } from 'react';

const SupplierDetails = ({ supplier, onClose, onRatingUpdate }) => {
  const [editingRating, setEditingRating] = useState(false);
  const [newRating, setNewRating] = useState(supplier.rating);

  const handleRatingSubmit = async () => {
    try {
      await onRatingUpdate(supplier._id, newRating);
      setEditingRating(false);
    } catch (error) {
      console.error('Failed to update rating:', error);
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`star ${i < rating ? 'filled' : ''}`}>
        ★
      </span>
    ));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount) => {
    return `Rs. ${amount.toLocaleString()}`;
  };

  return (
    <div className="supplier-details">
      <div className="details-header">
        <h2>Supplier Details</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="details-content">
        {/* Basic Information */}
        <div className="details-section">
          <h3>Basic Information</h3>
          <div className="details-grid">
            <div className="detail-item">
              <label>Supplier Code:</label>
              <span>{supplier.supplierCode}</span>
            </div>
            <div className="detail-item">
              <label>Company Name:</label>
              <span>{supplier.companyName}</span>
            </div>
            <div className="detail-item">
              <label>Contact Person:</label>
              <span>{supplier.contactPerson}</span>
            </div>
            <div className="detail-item">
              <label>Email:</label>
              <span>
                <a href={`mailto:${supplier.email}`}>{supplier.email}</a>
              </span>
            </div>
            <div className="detail-item">
              <label>Phone:</label>
              <span>
                <a href={`tel:${supplier.phone}`}>{supplier.phone}</a>
              </span>
            </div>
            <div className="detail-item">
              <label>Status:</label>
              <span className={`status ${supplier.isActive ? 'active' : 'inactive'}`}>
                {supplier.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* Address Information */}
        {supplier.address && (
          <div className="details-section">
            <h3>Address</h3>
            <div className="address-block">
              {supplier.address.street && <p>{supplier.address.street}</p>}
              <p>
                {[supplier.address.city, supplier.address.state, supplier.address.zipCode]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              {supplier.address.country && <p>{supplier.address.country}</p>}
            </div>
          </div>
        )}

        {/* Business Information */}
        <div className="details-section">
          <h3>Business Information</h3>
          <div className="details-grid">
            <div className="detail-item">
              <label>Category:</label>
              <span>{supplier.category}</span>
            </div>
            <div className="detail-item">
              <label>Payment Terms:</label>
              <span>{supplier.paymentTerms}</span>
            </div>
            {supplier.taxId && (
              <div className="detail-item">
                <label>Tax ID:</label>
                <span>{supplier.taxId}</span>
              </div>
            )}
            {supplier.website && (
              <div className="detail-item">
                <label>Website:</label>
                <span>
                  <a href={supplier.website} target="_blank" rel="noopener noreferrer">
                    {supplier.website}
                  </a>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Rating Section */}
        <div className="details-section">
          <h3>Rating & Performance</h3>
          <div className="rating-section">
            <div className="current-rating">
              <label>Current Rating:</label>
              <div className="rating-display">
                {renderStars(supplier.rating)}
                <span className="rating-number">({supplier.rating}/5)</span>
              </div>
            </div>
            
            {editingRating ? (
              <div className="rating-edit">
                <label>New Rating:</label>
                <select 
                  value={newRating} 
                  onChange={(e) => setNewRating(parseInt(e.target.value))}
                >
                  <option value={1}>1 Star</option>
                  <option value={2}>2 Stars</option>
                  <option value={3}>3 Stars</option>
                  <option value={4}>4 Stars</option>
                  <option value={5}>5 Stars</option>
                </select>
                <div className="rating-actions">
                  <button 
                    className="btn-primary btn-sm"
                    onClick={handleRatingSubmit}
                  >
                    Update
                  </button>
                  <button 
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      setEditingRating(false);
                      setNewRating(supplier.rating);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button 
                className="btn-secondary btn-sm"
                onClick={() => setEditingRating(true)}
              >
                Update Rating
              </button>
            )}
          </div>
        </div>

        {/* Statistics */}
        <div className="details-section">
          <h3>Statistics</h3>
          <div className="details-grid">
            <div className="detail-item">
              <label>Total Orders:</label>
              <span>{supplier.totalOrders || 0}</span>
            </div>
            <div className="detail-item">
              <label>Total Value:</label>
              <span>{formatCurrency(supplier.totalValue || 0)}</span>
            </div>
            <div className="detail-item">
              <label>Last Order Date:</label>
              <span>{formatDate(supplier.lastOrderDate)}</span>
            </div>
            <div className="detail-item">
              <label>Created Date:</label>
              <span>{formatDate(supplier.createdAt)}</span>
            </div>
            <div className="detail-item">
              <label>Last Updated:</label>
              <span>{formatDate(supplier.updatedAt)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {supplier.notes && (
          <div className="details-section">
            <h3>Notes</h3>
            <div className="notes-block">
              <p>{supplier.notes}</p>
            </div>
          </div>
        )}
      </div>

      <div className="details-actions">
        <button className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

export default SupplierDetails;
