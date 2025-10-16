import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE } from '../api';
import { FaCheck, FaTimes, FaSpinner, FaEye } from 'react-icons/fa';
import './inventoryrequestreading.css';

const InventoryRequestReading = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  
  // Get auth token
  const token = useMemo(() => {
    try {
      const auth = JSON.parse(localStorage.getItem('auth') || '{}');
      return auth?.token || '';
    } catch {
      return '';
    }
  }, []);

  // Fetch all inventory requests
  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/inventory-requests`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch requests');
      }
      
      const data = await response.json();
      setRequests(data);
    } catch (error) {
      console.error('Error fetching requests:', error);
      alert('Failed to load inventory requests');
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
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!updateResponse.ok) {
        throw new Error('Failed to update status');
      }
      
      // Find the request in the current state to get its details
      const currentRequest = requests.find(req => req._id === requestId);
      
      if (currentRequest) {
        // Create a notification for this status change
        const notificationResponse = await fetch(`${API_BASE}/api/inventory-notifications`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requestId: requestId,
            dentistCode: currentRequest.dentistCode,
            items: currentRequest.items.map(item => ({
              itemName: item.itemName,
              itemCode: item.itemCode || '',
              quantity: item.quantity
            })),
            notes: currentRequest.notes || '',
            status: newStatus
          })
        });
        
        if (!notificationResponse.ok) {
          console.error('Failed to create notification, but status was updated');
          // Continue even if notification fails, as the main status update succeeded
        }
      }
      
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

  useEffect(() => {
    fetchRequests();
  }, [token]);

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
        <FaSpinner className="spinner" />
        <p>Loading requests...</p>
      </div>
    );
  }

  return (
    <div className="inventory-requests-container">
      <h2>Inventory Requests</h2>
      
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
            {requests.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-requests">
                  No inventory requests found
                </td>
              </tr>
            ) : (
              requests.map((request) => (
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
                            <FaSpinner className="spinner" />
                          ) : (
                            <FaCheck />
                          )}
                          Approve
                        </button>
                        <button
                          className="btn-reject"
                          onClick={() => updateStatus(request._id, 'Rejected')}
                          disabled={updatingId === request._id}
                        >
                          {updatingId === request._id ? (
                            <FaSpinner className="spinner" />
                          ) : (
                            <FaTimes />
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
                          <FaSpinner className="spinner" />
                        ) : (
                          <FaCheck />
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