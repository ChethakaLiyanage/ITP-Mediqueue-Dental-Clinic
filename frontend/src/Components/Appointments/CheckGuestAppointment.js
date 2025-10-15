import React, { useState } from 'react';
import './check-guest-appointment.css';
import { getJSON } from '../api';

const CheckGuestAppointment = () => {
  const [searchMethod, setSearchMethod] = useState('email'); // 'email' or 'phone'
  const [searchValue, setSearchValue] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [newDate, setNewDate] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchValue.trim()) {
      setError('Please enter a search value');
      return;
    }

    setLoading(true);
    setError('');
    setHasSearched(true);

    try {
      const params = new URLSearchParams();
      if (searchMethod === 'email') {
        params.append('guest_email', searchValue.trim());
      } else {
        params.append('guest_phone', searchValue.trim());
      }

      const response = await getJSON(`/appointments?${params.toString()}`);
      setAppointments(response.items || []);
      
      if (response.items && response.items.length === 0) {
        setError('No appointments found with the provided information.');
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setError('Failed to fetch appointments. Please try again.');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setSearchValue(e.target.value);
    setError('');
  };

  const handleMethodChange = (method) => {
    setSearchMethod(method);
    setSearchValue('');
    setError('');
    setAppointments([]);
    setHasSearched(false);
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

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Awaiting Confirmation';
      case 'confirmed': return 'Confirmed';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const handleReschedule = async (appointmentCode) => {
    if (!newDate) {
      alert('Please select a new date and time');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/guest-appointments/${appointmentCode}/reschedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newDate: new Date(newDate).toISOString(),
          phone: searchMethod === 'phone' ? searchValue : undefined,
          email: searchMethod === 'email' ? searchValue : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message || 'Appointment rescheduled successfully!');
        setRescheduleModal(null);
        setNewDate('');
        handleSearch({ preventDefault: () => {} }); // Refresh appointments
      } else {
        alert(data.message || 'Failed to reschedule appointment');
      }
    } catch (error) {
      console.error('Error rescheduling:', error);
      alert('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (appointmentCode) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/guest-appointments/${appointmentCode}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: searchMethod === 'phone' ? searchValue : undefined,
          email: searchMethod === 'email' ? searchValue : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message || 'Appointment cancelled successfully!');
        handleSearch({ preventDefault: () => {} }); // Refresh appointments
      } else {
        alert(data.message || 'Failed to cancel appointment');
      }
    } catch (error) {
      console.error('Error cancelling:', error);
      alert('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const canManageAppointment = (status) => {
    return status === 'pending' || status === 'confirmed';
  };

  return (
    <div className="check-guest-appointment">
      <div className="header">
        <h2>Check Your Appointments</h2>
        <p>Enter your email or phone number to view your booked appointments</p>
      </div>

      <div className="search-section">
        <div className="search-method-tabs">
          <button
            className={`tab ${searchMethod === 'email' ? 'active' : ''}`}
            onClick={() => handleMethodChange('email')}
          >
            Search by Email
          </button>
          <button
            className={`tab ${searchMethod === 'phone' ? 'active' : ''}`}
            onClick={() => handleMethodChange('phone')}
          >
            Search by Phone
          </button>
        </div>

        <form onSubmit={handleSearch} className="search-form">
          <div className="input-group">
            <input
              type={searchMethod === 'email' ? 'email' : 'tel'}
              value={searchValue}
              onChange={handleInputChange}
              placeholder={searchMethod === 'email' ? 'Enter your email address' : 'Enter your phone number'}
              required
            />
            <button type="submit" disabled={loading} className="search-btn">
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
      </div>

      {hasSearched && (
        <div className="results-section">
          <h3>Your Appointments</h3>
          
          {loading ? (
            <div className="loading">Searching for appointments...</div>
          ) : appointments.length === 0 ? (
            <div className="no-appointments">
              <p>No appointments found.</p>
              <p>Please check your email/phone number or contact the clinic for assistance.</p>
            </div>
          ) : (
            <div className="appointments-list">
              {appointments.map((appointment) => (
                <div key={appointment._id} className="appointment-card">
                  <div className="appointment-header">
                    <div className="appointment-code">
                      <strong>Appointment #{appointment.appointmentCode}</strong>
                    </div>
                    <div className="appointment-status">
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(appointment.status) }}
                      >
                        {getStatusText(appointment.status)}
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
                        <span className="label">Queue Number:</span>
                        <span className="value">{appointment.queue_no}</span>
                      </div>
                    )}
                    {appointment.guestInfo && (
                      <div className="detail-row">
                        <span className="label">Guest Name:</span>
                        <span className="value">{appointment.guestInfo.name}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="appointment-notes">
                    {appointment.status === 'pending' && (
                      <p className="note pending">
                        ⏳ Your appointment is pending confirmation. You will be notified once confirmed.
                      </p>
                    )}
                    {appointment.status === 'confirmed' && (
                      <p className="note confirmed">
                        ✅ Your appointment is confirmed. Please arrive 10 minutes early.
                      </p>
                    )}
                    {appointment.status === 'completed' && (
                      <p className="note completed">
                        ✅ This appointment has been completed.
                      </p>
                    )}
                    {appointment.status === 'cancelled' && (
                      <p className="note cancelled">
                        ❌ This appointment has been cancelled.
                      </p>
                    )}
                  </div>

                  {canManageAppointment(appointment.status) && (
                    <div className="appointment-actions">
                      <button
                        className="action-btn reschedule-btn"
                        onClick={() => setRescheduleModal(appointment)}
                        disabled={actionLoading}
                      >
                        📅 Reschedule
                      </button>
                      <button
                        className="action-btn cancel-btn"
                        onClick={() => handleCancel(appointment.appointmentCode)}
                        disabled={actionLoading}
                      >
                        ❌ Cancel Appointment
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="help-section">
        <h4>Need Help?</h4>
        <p>If you can't find your appointment or need to make changes, please contact the clinic directly:</p>
        <div className="contact-info">
          <p>📞 Phone: (123) 456-7890</p>
          <p>📧 Email: appointments@clinic.com</p>
        </div>
      </div>

      {/* Reschedule Modal */}
      {rescheduleModal && (
        <div className="modal-overlay" onClick={() => setRescheduleModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reschedule Appointment</h3>
              <button className="close-btn" onClick={() => setRescheduleModal(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <p className="modal-subtitle">
                Appointment: <strong>{rescheduleModal.appointmentCode}</strong>
              </p>
              <p className="current-date">
                Current Date: {formatDateTime(rescheduleModal.appointment_date)}
              </p>
              
              <div className="form-group">
                <label htmlFor="newDate">Select New Date & Time:</label>
                <input
                  type="datetime-local"
                  id="newDate"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setRescheduleModal(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => handleReschedule(rescheduleModal.appointmentCode)}
                disabled={actionLoading || !newDate}
              >
                {actionLoading ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckGuestAppointment;
