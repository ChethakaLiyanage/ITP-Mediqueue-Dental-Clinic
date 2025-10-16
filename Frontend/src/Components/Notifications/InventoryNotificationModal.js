import React, { useState, useEffect } from 'react';
import './InventoryNotificationModal.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

const InventoryNotificationModal = ({ isOpen, onClose, dentistCode, onNotificationCountChange }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!dentistCode) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/inventory-notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      const dentistNotifications = data.data?.filter(notification => 
        notification.dentistCode === dentistCode
      ) || [];
      
      setNotifications(dentistNotifications);
      
      // Update notification count
      const unreadCount = dentistNotifications.filter(n => !n.read).length;
      onNotificationCountChange(unreadCount);
      
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/inventory-notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification._id === notificationId 
            ? { ...notification, read: true, readAt: new Date() }
            : notification
        )
      );

      // Update notification count
      const unreadCount = notifications.filter(n => !n.read && n._id !== notificationId).length;
      onNotificationCountChange(unreadCount);
      
    } catch (err) {
      console.error('Error marking notification as read:', err);
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
          <h3>📦 Inventory Notifications</h3>
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
              <p>📭 No inventory notifications found</p>
            </div>
          )}

          {!loading && !error && notifications.length > 0 && (
            <div className="inventory-notification-list">
              {notifications.map((notification) => (
                <div 
                  key={notification._id} 
                  className={`inventory-notification-item ${!notification.read ? 'unread' : ''}`}
                  onClick={() => !notification.read && markAsRead(notification._id)}
                >
                  <div className="notification-header">
                    <div className="notification-status">
                      <span 
                        className="status-dot" 
                        style={{ backgroundColor: getStatusColor(notification.status) }}
                      ></span>
                      <span className="status-text">{notification.status}</span>
                    </div>
                    <div className="notification-date">
                      {formatDate(notification.createdAt)}
                    </div>
                  </div>

                  <div className="notification-items">
                    <h4>Requested Items:</h4>
                    <ul>
                      {notification.items.map((item, index) => (
                        <li key={index}>
                          <strong>{item.itemName}</strong> 
                          {item.itemCode && <span className="item-code">({item.itemCode})</span>}
                          <span className="item-quantity"> - Qty: {item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {notification.notes && (
                    <div className="notification-notes">
                      <strong>Notes:</strong> {notification.notes}
                    </div>
                  )}

                  {!notification.read && (
                    <div className="notification-unread-indicator">
                      <span className="unread-dot"></span>
                      <span>Click to mark as read</span>
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
