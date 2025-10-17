import React, { useState, useEffect } from 'react';
import './InventoryNotificationModal.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

const InventoryNotificationModal = ({ isOpen, onClose, dentistCode, onNotificationCountChange }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch inventory requests
  const fetchNotifications = async () => {
    if (!dentistCode) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/inventory/requests?dentistCode=${encodeURIComponent(dentistCode)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch inventory requests');
      }

      const data = await response.json();
      const requests = data.requests || [];
      
      setNotifications(requests);
      
      // Update notification count - count pending requests as "unread"
      const pendingCount = requests.filter(r => r.status === 'Pending').length;
      onNotificationCountChange(pendingCount);
      
    } catch (err) {
      console.error('Error fetching inventory requests:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  // Fetch notifications when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, dentistCode]);

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return '#f59e0b';
      case 'Approved': return '#10b981';
      case 'Rejected': return '#ef4444';
      case 'Fulfilled': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="inventory-notification-overlay" onClick={onClose}>
      <div className="inventory-notification-modal" onClick={(e) => e.stopPropagation()}>
        <div className="inventory-notification-header">
          <h3>📦 Inventory Requests Status</h3>
          <button className="inventory-notification-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="inventory-notification-content">
          {loading && (
            <div className="inventory-notification-loading">
              <div className="loading-spinner"></div>
              <p>Loading notifications...</p>
            </div>
          )}

          {error && (
            <div className="inventory-notification-error">
              <p>❌ {error}</p>
              <button onClick={fetchNotifications} className="retry-btn">
                Retry
              </button>
            </div>
          )}

          {!loading && !error && notifications.length === 0 && (
            <div className="inventory-notification-empty">
              <p>📭 No inventory requests found</p>
            </div>
          )}

          {!loading && !error && notifications.length > 0 && (
            <div className="inventory-notification-list">
              {notifications.map((request) => (
                <div 
                  key={request._id} 
                  className={`inventory-notification-item ${request.status === 'Pending' ? 'unread' : ''}`}
                >
                  <div className="notification-header">
                    <div className="notification-status">
                      <span 
                        className="status-dot" 
                        style={{ backgroundColor: getStatusColor(request.status) }}
                      ></span>
                      <span className="status-text">{request.status}</span>
                    </div>
                    <div className="notification-date">
                      {formatDate(request.createdAt)}
                    </div>
                  </div>

                  <div className="notification-request-info">
                    <div className="request-code">
                      <strong>Request Code:</strong> {request.requestCode}
                    </div>
                    {request.approvedBy && (
                      <div className="approved-by">
                        <strong>Approved by:</strong> {request.approvedBy}
                      </div>
                    )}
                    {request.approvedAt && (
                      <div className="approved-at">
                        <strong>Approved at:</strong> {formatDate(request.approvedAt)}
                      </div>
                    )}
                  </div>

                  <div className="notification-items">
                    <h4>Requested Items:</h4>
                    <ul>
                      {request.items.map((item, index) => (
                        <li key={index}>
                          <strong>{item.itemName}</strong> 
                          {item.itemCode && <span className="item-code">({item.itemCode})</span>}
                          <span className="item-quantity"> - Qty: {item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {request.notes && (
                    <div className="notification-notes">
                      <strong>Notes:</strong> {request.notes}
                    </div>
                  )}

                  {request.status === 'Pending' && (
                    <div className="notification-unread-indicator">
                      <span className="unread-dot"></span>
                      <span>Awaiting manager approval</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="inventory-notification-footer">
          <button onClick={fetchNotifications} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default InventoryNotificationModal;
