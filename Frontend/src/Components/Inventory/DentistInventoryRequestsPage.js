import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../Contexts/AuthContext';
import './DentistInventoryRequestsPage.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

const DentistInventoryRequestsPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [error, setError] = useState(null);

  // Redirect if not authenticated or not a dentist
  useEffect(() => {
    if (!loading && (!user || user.role !== 'Dentist')) {
      navigate('/login', { replace: true });
    }
  }, [user, loading, navigate]);

  // Fetch inventory requests
  const fetchRequests = async () => {
    if (!user?.dentistCode) return;
    
    setLoadingRequests(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/inventory/requests?dentistCode=${encodeURIComponent(user.dentistCode)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch inventory requests');
      }

      const data = await response.json();
      setRequests(data.requests || []);
      
    } catch (err) {
      console.error('Error fetching inventory requests:', err);
      setError(err.message);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Fetch requests when component mounts
  useEffect(() => {
    if (user?.dentistCode) {
      fetchRequests();
    }
  }, [user?.dentistCode]);

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

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending': return '⏳';
      case 'Approved': return '✅';
      case 'Rejected': return '❌';
      case 'Fulfilled': return '📦';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div className="inventory-requests-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="inventory-requests-page">
      <div className="inventory-requests-header">
        <div className="page-title-section">
          <h1>📦 Inventory Requests</h1>
          <p>Track the status of your inventory requests</p>
        </div>
        <div className="page-actions">
          <button 
            onClick={fetchRequests} 
            className="refresh-btn"
            disabled={loadingRequests}
          >
            🔄 Refresh
          </button>
          <button 
            onClick={() => navigate('/dentist/inventory/request')}
            className="new-request-btn"
          >
            ➕ New Request
          </button>
        </div>
      </div>

      <div className="inventory-requests-content">
        {loadingRequests && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Loading requests...</p>
          </div>
        )}

        {error && (
          <div className="error-message">
            <p>❌ {error}</p>
            <button onClick={fetchRequests} className="retry-btn">
              Retry
            </button>
          </div>
        )}

        {!loadingRequests && !error && requests.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No inventory requests found</h3>
            <p>You haven't made any inventory requests yet.</p>
            <button 
              onClick={() => navigate('/dentist/inventory/request')}
              className="create-first-btn"
            >
              Create Your First Request
            </button>
          </div>
        )}

        {!loadingRequests && !error && requests.length > 0 && (
          <div className="requests-grid">
            {requests.map((request) => (
              <div key={request._id} className="request-card">
                <div className="request-header">
                  <div className="request-code">
                    <span className="code-label">Request Code:</span>
                    <span className="code-value">{request.requestCode}</span>
                  </div>
                  <div className="request-status">
                    <span 
                      className="status-icon"
                      style={{ color: getStatusColor(request.status) }}
                    >
                      {getStatusIcon(request.status)}
                    </span>
                    <span 
                      className="status-text"
                      style={{ color: getStatusColor(request.status) }}
                    >
                      {request.status}
                    </span>
                  </div>
                </div>

                <div className="request-details">
                  <div className="request-date">
                    <strong>Created:</strong> {formatDate(request.createdAt)}
                  </div>
                  
                  {request.approvedBy && (
                    <div className="approved-info">
                      <strong>Approved by:</strong> {request.approvedBy}
                    </div>
                  )}
                  
                  {request.approvedAt && (
                    <div className="approved-date">
                      <strong>Approved at:</strong> {formatDate(request.approvedAt)}
                    </div>
                  )}
                </div>

                <div className="request-items">
                  <h4>Requested Items:</h4>
                  <div className="items-list">
                    {request.items.map((item, index) => (
                      <div key={index} className="item-row">
                        <div className="item-info">
                          <span className="item-name">{item.itemName}</span>
                          {item.itemCode && (
                            <span className="item-code">({item.itemCode})</span>
                          )}
                        </div>
                        <div className="item-quantity">
                          Qty: {item.quantity}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {request.notes && (
                  <div className="request-notes">
                    <strong>Notes:</strong>
                    <p>{request.notes}</p>
                  </div>
                )}

                <div className="request-footer">
                  {request.status === 'Pending' && (
                    <div className="pending-indicator">
                      <span className="pending-dot"></span>
                      <span>Awaiting manager approval</span>
                    </div>
                  )}
                  
                  {request.status === 'Approved' && (
                    <div className="approved-indicator">
                      <span className="approved-dot"></span>
                      <span>Request approved and ready for fulfillment</span>
                    </div>
                  )}
                  
                  {request.status === 'Rejected' && (
                    <div className="rejected-indicator">
                      <span className="rejected-dot"></span>
                      <span>Request was declined by manager</span>
                    </div>
                  )}
                  
                  {request.status === 'Fulfilled' && (
                    <div className="fulfilled-indicator">
                      <span className="fulfilled-dot"></span>
                      <span>Request has been fulfilled</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DentistInventoryRequestsPage;
