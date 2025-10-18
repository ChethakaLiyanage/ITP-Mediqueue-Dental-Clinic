import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, Clock, User, Phone, Mail, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import api from '../../services/apiService';
import './CheckAppointment.css';

const CheckAppointment = () => {
  const navigate = useNavigate();
  
  // State management
  const [searchMethod, setSearchMethod] = useState('email'); // 'email' or 'phone'
  const [searchValue, setSearchValue] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchValue.trim()) {
      setError('Please enter a search value');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      const response = await api.get('/appointments/check', {
        params: {
          method: searchMethod,
          value: searchValue.trim()
        }
      });
      
      setAppointments(response.data.appointments || []);
      if (response.data.appointments?.length > 0) {
        setSuccess(`Found ${response.data.appointments.length} appointment(s)`);
      } else {
        setError('No appointments found for the provided information');
      }
    } catch (error) {
      console.error('Error checking appointments:', error);
      setError(error.response?.data?.message || 'Failed to check appointments. Please try again.');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'status-confirmed';
      case 'pending':
        return 'status-pending';
      case 'completed':
        return 'status-completed';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return 'status-pending';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'confirmed':
        return 'Confirmed';
      case 'pending':
        return 'Pending';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Pending';
    }
  };

  return (
    <div className="check-appointment-container">
      <div className="check-appointment-header">
        <h1>Check Your Appointments</h1>
        <p>Search for your appointments using your email or phone number</p>
      </div>

      {success && (
        <div className="success-message">
          <CheckCircle className="success-icon" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="error-message">
          <AlertCircle className="error-icon" />
          <span>{error}</span>
        </div>
      )}

      <div className="check-appointment-content">
        {/* Search Form */}
        <div className="search-section">
          <div className="search-form">
            <h3>Search Appointments</h3>
            
            <div className="search-method">
              <label className="method-label">
                <input
                  type="radio"
                  name="searchMethod"
                  value="email"
                  checked={searchMethod === 'email'}
                  onChange={(e) => setSearchMethod(e.target.value)}
                />
                <span>Search by Email</span>
              </label>
              <label className="method-label">
                <input
                  type="radio"
                  name="searchMethod"
                  value="phone"
                  checked={searchMethod === 'phone'}
                  onChange={(e) => setSearchMethod(e.target.value)}
                />
                <span>Search by Phone</span>
              </label>
            </div>

            <form onSubmit={handleSearch} className="search-form-content">
              <div className="search-input-group">
                <div className="search-input-wrapper">
                  {searchMethod === 'email' ? (
                    <Mail className="input-icon" />
                  ) : (
                    <Phone className="input-icon" />
                  )}
                  <input
                    type={searchMethod === 'email' ? 'email' : 'tel'}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder={searchMethod === 'email' ? 'Enter your email address' : 'Enter your phone number'}
                    className="search-input"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  className="search-button"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="spinner" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="search-icon" />
                      Search Appointments
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Appointments Results */}
        {appointments.length > 0 && (
          <div className="appointments-results">
            <h3>Your Appointments</h3>
            <div className="appointments-list">
              {appointments.map((appointment, index) => (
                <div key={index} className="appointment-card">
                  <div className="appointment-header">
                    <div className="appointment-code">
                      <Calendar className="appointment-icon" />
                      <span>{appointment.appointmentCode}</span>
                    </div>
                    <div className={`appointment-status ${getStatusColor(appointment.status)}`}>
                      {getStatusText(appointment.status)}
                    </div>
                  </div>
                  
                  <div className="appointment-details">
                    <div className="detail-row">
                      <Clock className="detail-icon" />
                      <div className="detail-content">
                        <span className="detail-label">Date & Time</span>
                        <span className="detail-value">
                          {formatDate(appointment.appointmentDate)} at {formatTime(appointment.appointmentDate)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="detail-row">
                      <User className="detail-icon" />
                      <div className="detail-content">
                        <span className="detail-label">Patient</span>
                        <span className="detail-value">
                          {appointment.isBookingForSomeoneElse && appointment.actualPatientName 
                            ? appointment.actualPatientName 
                            : 'Registered Patient'
                          }
                        </span>
                      </div>
                    </div>
                    
                    {appointment.isBookingForSomeoneElse && appointment.relationshipToPatient && (
                      <div className="detail-row">
                        <User className="detail-icon" />
                        <div className="detail-content">
                          <span className="detail-label">Relationship</span>
                          <span className="detail-value">{appointment.relationshipToPatient}</span>
                        </div>
                      </div>
                    )}
                    
                    {appointment.reason && (
                      <div className="detail-row">
                        <Calendar className="detail-icon" />
                        <div className="detail-content">
                          <span className="detail-label">Reason</span>
                          <span className="detail-value">{appointment.reason}</span>
                        </div>
                      </div>
                    )}
                    
                    {appointment.notes && (
                      <div className="detail-row">
                        <Calendar className="detail-icon" />
                        <div className="detail-content">
                          <span className="detail-label">Notes</span>
                          <span className="detail-value">{appointment.notes}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Results Message */}
        {appointments.length === 0 && !loading && searchValue && (
          <div className="no-results">
            <AlertCircle className="no-results-icon" />
            <h3>No Appointments Found</h3>
            <p>We couldn't find any appointments matching your search criteria.</p>
            <div className="no-results-actions">
              <button 
                onClick={() => navigate('/book-appointment')} 
                className="book-appointment-btn"
              >
                Book New Appointment
              </button>
              <button 
                onClick={() => navigate('/register-patient')} 
                className="register-btn"
              >
                Create Account
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button 
          onClick={() => navigate('/book-appointment')} 
          className="action-btn primary"
        >
          <Calendar className="btn-icon" />
          Book New Appointment
        </button>
        <button 
          onClick={() => navigate('/register-patient')} 
          className="action-btn secondary"
        >
          <User className="btn-icon" />
          Create Account
        </button>
        <button 
          onClick={() => navigate('/login')} 
          className="action-btn secondary"
        >
          <User className="btn-icon" />
          Login
        </button>
      </div>
    </div>
  );
};

export default CheckAppointment;
