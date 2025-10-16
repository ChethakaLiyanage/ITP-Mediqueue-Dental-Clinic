import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../api';
import { useAuth } from '../../Contexts/AuthContext';
// Using Font Awesome classes instead of react-icons
import './inventoryrequestreading.css';

const InventoryRequestReading = () => {
  const navigate = useNavigate();
  const { token, user, isAuthenticated } = useAuth();
  
  // All hooks must be called at the top level, before any conditional returns
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('=== INVENTORY REQUEST USEEFFECT ===');
    console.log('isAuthenticated:', isAuthenticated);
    console.log('token exists:', !!token);
    
    if (!isAuthenticated || !token) {
      console.log('User not authenticated, redirecting to login');
      navigate('/login');
      return;
    }
    
    console.log('User authenticated, fetching requests...');
    fetchRequests();
  }, [token, isAuthenticated, navigate]);
  
  // Immediate redirect if not authenticated
  if (!isAuthenticated || !token) {
    console.log('Not authenticated, redirecting to login...');
    navigate('/login');
    return <div>Redirecting to login...</div>;
  }

  // Fetch all inventory requests
  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('=== FETCH INVENTORY REQUESTS ===');
      console.log('Token:', token ? 'Present' : 'Missing');
      console.log('API_BASE:', API_BASE);
      console.log('Request URL:', `${API_BASE}/api/inventory-requests`);
      
      const response = await fetch(`${API_BASE}/api/inventory-requests`, {
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
      console.log('Number of requests found:', Array.isArray(data) ? data.length : 0);
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching requests:', error);
      console.error('Fetch Error stack:', error.stack);
      setError(`Failed to load inventory requests: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Update request status and create notification
  const updateStatus = async (requestId, newStatus) => {
    try {
      setUpdatingId(requestId);
      
      // First, update the request status
      const updateResponse = await fetch(`${API_BASE}/api/inventory-requests/${requestId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!updateResponse.ok) {
        let errorMessage = `HTTP ${updateResponse.status}: Failed to update status`;
        try {
          const errorData = await updateResponse.json();
          console.error('Update Error response data:', errorData);
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          console.error('Could not parse update error response as JSON');
          const textResponse = await updateResponse.text().catch(() => 'Unknown error');
          console.error('Update Text response:', textResponse);
          errorMessage = textResponse || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      // Backend automatically creates notifications when status is updated
      console.log(`Request ${requestId} status updated to ${newStatus}`);
      
      // Refresh the list to show updated status
      await fetchRequests();
      
      // Show success message
      alert(`Request has been ${newStatus.toLowerCase()} successfully`);
      
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update request status: ' + error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter and search functionality
  const filteredRequests = requests.filter(request => {
    const matchesSearch = searchTerm === '' || 
      request.requestCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.dentistCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.dentistName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.items?.some(item => 
        item.itemName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    const matchesStatus = statusFilter === 'All' || request.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

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

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading inventory requests...</p>
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
        <h2>Inventory Requests</h2>
        <div className="requests-controls">
          <div className="search-box">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search requests, dentist, or items..."
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
      </div>
      
      <div className="requests-table-container">
        <table className="requests-table">
          <thead>
            <tr>
              <th>Request Code</th>
              <th>Dentist Code</th>
              <th>Items</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-requests">
                  {requests.length === 0 
                    ? 'No inventory requests found' 
                    : 'No requests match your search criteria'
                  }
                </td>
              </tr>
            ) : (
              filteredRequests.map((request) => (
                <tr key={request._id}>
                  <td>{request.requestCode}</td>
                  <td>{request.dentistCode}</td>
                  <td>
                    <div className="items-list">
                      {request.items.map((item, index) => (
                        <div key={index} className="item-row">
                          {item.itemName} - {item.quantity} {item.unit}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <StatusBadge status={request.status} />
                  </td>
                  <td>{new Date(request.createdAt).toLocaleDateString()}</td>
                  <td className="actions-cell">
                    {request.status === 'Pending' && (
                      <>
                        <button
                          className="btn-approve"
                          onClick={() => updateStatus(request._id, 'Approved')}
                          disabled={updatingId === request._id}
                        >
                          {updatingId === request._id ? (
                            <i className="fas fa-spinner fa-spin"></i>
                          ) : (
                            <i className="fas fa-check"></i>
                          )}
                          Approve
                        </button>
                        <button
                          className="btn-reject"
                          onClick={() => updateStatus(request._id, 'Rejected')}
                          disabled={updatingId === request._id}
                        >
                          {updatingId === request._id ? (
                            <i className="fas fa-spinner fa-spin"></i>
                          ) : (
                            <i className="fas fa-times"></i>
                          )}
                          Reject
                        </button>
                      </>
                    )}
                    {request.status === 'Approved' && (
                      <button
                        className="btn-fulfill"
                        onClick={() => updateStatus(request._id, 'Fulfilled')}
                        disabled={updatingId === request._id}
                      >
                        {updatingId === request._id ? (
                          <i className="fas fa-spinner fa-spin"></i>
                        ) : (
                          <i className="fas fa-check"></i>
                        )}
                        Mark as Fulfilled
                      </button>
                    )}
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

export default InventoryRequestReading;