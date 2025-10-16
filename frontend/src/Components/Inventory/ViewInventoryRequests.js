import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../api';
import { useAuth } from '../../Contexts/AuthContext';
import './ViewInventoryRequests.css';

const ViewInventoryRequests = () => {
  const navigate = useNavigate();
  const { token, user, isAuthenticated } = useAuth();
  
  // All hooks must be called at the top level, before any conditional returns
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Immediate redirect if not authenticated
  if (!isAuthenticated || !token) {
    console.log('Not authenticated, redirecting to login...');
    navigate('/login');
    return <div>Redirecting to login...</div>;
  }

  // Fetch dentist's inventory requests
  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('=== FETCH DENTIST INVENTORY REQUESTS ===');
      console.log('Token:', token ? 'Present' : 'Missing');
      console.log('User:', user);
      console.log('Dentist Code:', user?.dentistCode || user?.code);
      console.log('API_BASE:', API_BASE);
      
      const dentistCode = user?.dentistCode || user?.code;
      if (!dentistCode) {
        throw new Error('Dentist code not found in user profile');
      }
      
      const response = await fetch(`${API_BASE}/api/inventory-requests/dentist/${dentistCode}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Fetch Response status:', response.status);
      console.log('Fetch Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: Failed to fetch inventory requests`;
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
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching requests:', error);
      console.error('Fetch Error stack:', error.stack);
      setError(`Failed to load inventory requests: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter and search functionality
  const filteredRequests = requests.filter(request => {
    const matchesSearch = searchTerm === '' || 
      request.requestCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.items?.some(item => 
        item.itemName?.toLowerCase().includes(searchTerm.toLowerCase())
      ) ||
      request.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || request.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    console.log('=== VIEW INVENTORY REQUESTS USEEFFECT ===');
    console.log('isAuthenticated:', isAuthenticated);
    console.log('token exists:', !!token);
    console.log('user:', user);
    
    if (!isAuthenticated || !token) {
      console.log('User not authenticated, redirecting to login');
      navigate('/login');
      return;
    }
    
    console.log('User authenticated, fetching requests...');
    fetchRequests();
  }, [token, isAuthenticated, navigate, user]);

  // Status badge component
  const StatusBadge = ({ status }) => {
    const statusClasses = {
      Pending: 'status-pending',
      Approved: 'status-approved',
      Rejected: 'status-rejected',
      Fulfilled: 'status-fulfilled'
    };
    
    return (
      <span className={`status-badge ${statusClasses[status] || ''}`}>
        {status}
      </span>
    );
  };

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

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading your inventory requests...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="inventory-requests-container">
        <div className="error-container">
          <i className="fas fa-exclamation-triangle"></i>
          <h3>Error Loading Requests</h3>
          <p>{error}</p>
          <button 
            className="retry-btn"
            onClick={fetchRequests}
          >
            <i className="fas fa-redo"></i> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="inventory-requests-container">
      <div className="requests-header">
        <div className="header-content">
          <h2>My Inventory Requests</h2>
          <p>Track the status of your inventory requests</p>
        </div>
        <button 
          className="create-request-btn"
          onClick={() => navigate('/dentist/create-inventory-request')}
        >
          <i className="fas fa-plus"></i> New Request
        </button>
      </div>
      
      <div className="requests-controls">
        <div className="search-box">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search requests or items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-box">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Fulfilled">Fulfilled</option>
          </select>
        </div>
      </div>
      
      <div className="requests-table-container">
        <table className="requests-table">
          <thead>
            <tr>
              <th>Request Code</th>
              <th>Items</th>
              <th>Status</th>
              <th>Requested</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan="5" className="no-requests">
                  {requests.length === 0 
                    ? 'No inventory requests found. Create your first request!' 
                    : 'No requests match your search criteria'
                  }
                </td>
              </tr>
            ) : (
              filteredRequests.map((request) => (
                <tr key={request._id}>
                  <td className="request-code">
                    <strong>{request.requestCode}</strong>
                  </td>
                  <td>
                    <div className="items-list">
                      {request.items.map((item, index) => (
                        <div key={index} className="item-row">
                          <span className="item-name">{item.itemName}</span>
                          <span className="item-quantity">{item.quantity} {item.unit}</span>
                          {item.itemCode && (
                            <span className="item-code">({item.itemCode})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={request.status} />
                    {request.approvedBy && (
                      <div className="approval-info">
                        <small>Approved by: {request.approvedBy}</small>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="date-info">
                      <div className="request-date">{formatDate(request.createdAt)}</div>
                      {request.approvedAt && (
                        <div className="approval-date">
                          <small>Approved: {formatDate(request.approvedAt)}</small>
                        </div>
                      )}
                      {request.fulfilledAt && (
                        <div className="fulfillment-date">
                          <small>Fulfilled: {formatDate(request.fulfilledAt)}</small>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="notes-cell">
                      {request.notes ? (
                        <div className="notes-content">
                          {request.notes.length > 50 
                            ? `${request.notes.substring(0, 50)}...` 
                            : request.notes
                          }
                        </div>
                      ) : (
                        <span className="no-notes">No notes</span>
                      )}
                    </div>
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

export default ViewInventoryRequests;

