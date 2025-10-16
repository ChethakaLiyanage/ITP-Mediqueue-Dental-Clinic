import React, { useState, useEffect } from 'react';
import './unregistered-user-appointments.css';
import { getJSON, patchJSON } from '../api';

const UnregisteredUserAppointments = ({ userCode }) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    if (userCode) {
      fetchUserAppointments();
    }
  }, [userCode]);

  const fetchUserAppointments = async () => {
    setLoading(true);
    try {
      // Fetch user details and appointments
      const response = await getJSON(`/unregistered-patients/${userCode}`);
      setUserInfo(response.patient);
      setAppointments(response.appointments || []);
    } catch (error) {
      console.error('Error fetching user appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (appointmentId, newStatus) => {
    setLoading(true);
    try {
      await patchJSON(`/appointments/${appointmentId}`, { status: newStatus });
      fetchUserAppointments(); // Refresh the list
    } catch (error) {
      console.error('Error updating appointment status:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#ffc107';
      case 'confirmed': return '#28a745';
      case 'completed': return '#17a2b8';
      case 'cancelled': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStatusActions = (appointment) => {
    switch (appointment.status) {
      case 'pending':
        return (
          <div className="status-actions">
            <button 
              className="btn-confirm"
              onClick={() => handleStatusUpdate(appointment._id, 'confirmed')}
            >
              Confirm
            </button>
            <button 
              className="btn-cancel"
              onClick={() => handleStatusUpdate(appointment._id, 'cancelled')}
            >
              Cancel
            </button>
          </div>
        );
      case 'confirmed':
        return (
          <div className="status-actions">
            <button 
              className="btn-complete"
              onClick={() => handleStatusUpdate(appointment._id, 'completed')}
            >
              Mark Complete
            </button>
            <button 
              className="btn-cancel"
              onClick={() => handleStatusUpdate(appointment._id, 'cancelled')}
            >
              Cancel
            </button>
          </div>
        );
      default:
        return <span className="no-actions">No actions available</span>;
    }
  };

  if (loading && !userInfo) {
    return <div className="loading">Loading user appointments...</div>;
  }

  if (!userInfo) {
    return <div className="error">User not found</div>;
  }

  return (
    <div className="unregistered-user-appointments">
      <div className="user-header">
        <h2>Appointments for {userInfo.name}</h2>
        <div className="user-info">
          <p><strong>Code:</strong> {userInfo.unregisteredPatientCode}</p>
          <p><strong>Phone:</strong> {userInfo.phone}</p>
          {userInfo.email && <p><strong>Email:</strong> {userInfo.email}</p>}
          {userInfo.age && <p><strong>Age:</strong> {userInfo.age}</p>}
        </div>
      </div>

      <div className="appointments-section">
        <h3>Appointment History</h3>
        
        {loading ? (
          <div className="loading">Loading appointments...</div>
        ) : appointments.length === 0 ? (
          <div className="no-appointments">
            <p>No appointments found for this user.</p>
          </div>
        ) : (
          <div className="appointments-list">
            {appointments.map((appointment) => (
              <div key={appointment._id} className="appointment-card">
                <div className="appointment-header">
                  <div className="appointment-code">
                    <strong>{appointment.appointmentCode}</strong>
                  </div>
                  <div className="appointment-status">
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(appointment.status) }}
                    >
                      {appointment.status}
                    </span>
                  </div>
                </div>
                
                <div className="appointment-details">
                  <div className="detail-row">
                    <span className="label">Dentist:</span>
                    <span className="value">{appointment.dentist_code}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Date & Time:</span>
                    <span className="value">{formatDateTime(appointment.appointment_date)}</span>
                  </div>
                  {appointment.reason && (
                    <div className="detail-row">
                      <span className="label">Reason:</span>
                      <span className="value">{appointment.reason}</span>
                    </div>
                  )}
                  {appointment.queue_no && (
                    <div className="detail-row">
                      <span className="label">Queue No:</span>
                      <span className="value">{appointment.queue_no}</span>
                    </div>
                  )}
                </div>
                
                <div className="appointment-actions">
                  {getStatusActions(appointment)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UnregisteredUserAppointments;
