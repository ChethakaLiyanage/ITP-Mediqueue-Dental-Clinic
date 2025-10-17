import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../Contexts/AuthContext';
import { Calendar, Clock, User, MapPin, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../services/apiService';
import './BookAppointment.css';

const BookAppointment = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  // State management
  const [dentists, setDentists] = useState([]);
  const [selectedDentist, setSelectedDentist] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Select dentist, 2: Select date, 3: Select time, 4: Confirm
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Check authentication
  useEffect(() => {
    console.log('BookAppointment - Auth check:', { isAuthenticated, user, role: user?.role });
    if (!isAuthenticated || user?.role !== 'Patient') {
      console.log('Redirecting to login - not authenticated or not a patient');
      navigate('/login');
    }
  }, [isAuthenticated, user, navigate]);

  // Fetch dentists on component mount
  useEffect(() => {
    fetchDentists();
  }, []);

  const fetchDentists = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dentists');
      setDentists(response.data.dentists || []);
    } catch (error) {
      console.error('Error fetching dentists:', error);
      setError('Failed to load dentists. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableSlots = async (dentistCode, date) => {
    try {
      setLoading(true);
      const response = await api.get('/appointments/available-slots', {
        params: { dentistCode, date }
      });
      setAvailableSlots(response.data.slots || []);
    } catch (error) {
      console.error('Error fetching available slots:', error);
      setError('Failed to load available time slots. Please try again.');
      setAvailableSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDentistSelect = (dentistCode) => {
    setSelectedDentist(dentistCode);
    setStep(2);
    setError('');
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    if (selectedDentist) {
      fetchAvailableSlots(selectedDentist, date);
    }
    setStep(3);
    setError('');
  };

  const handleSlotSelect = (slotTime) => {
    setSelectedSlot(slotTime);
    setStep(4);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedDentist || !selectedDate || !selectedSlot) {
      setError('Please complete all required fields.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const appointmentData = {
        dentistCode: selectedDentist,
        appointmentDate: selectedSlot,
        reason: reason.trim(),
        notes: notes.trim()
      };

      const response = await api.post('/appointments', appointmentData);
      
      setSuccess('Appointment booked successfully!');
      setTimeout(() => {
        navigate('/profile');
      }, 2000);
      
    } catch (error) {
      console.error('Error booking appointment:', error);
      setError(error.response?.data?.message || 'Failed to book appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedDentist('');
    setSelectedDate('');
    setSelectedSlot('');
    setAvailableSlots([]);
    setReason('');
    setNotes('');
    setStep(1);
    setError('');
    setSuccess('');
  };

  const getSelectedDentistInfo = () => {
    return dentists.find(d => d.dentistCode === selectedDentist);
  };

  const formatTime = (timeString) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  if (!isAuthenticated || user?.role !== 'Patient') {
    return null;
  }

  return (
    <div className="book-appointment-container">
      <div className="book-appointment-header">
        <h1>Book an Appointment</h1>
        <p>Schedule your dental appointment with our qualified dentists</p>
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

      <div className="booking-steps">
        <div className={`step ${step >= 1 ? 'active' : ''}`}>
          <div className="step-number">1</div>
          <div className="step-label">Select Dentist</div>
        </div>
        <div className={`step ${step >= 2 ? 'active' : ''}`}>
          <div className="step-number">2</div>
          <div className="step-label">Select Date</div>
        </div>
        <div className={`step ${step >= 3 ? 'active' : ''}`}>
          <div className="step-number">3</div>
          <div className="step-label">Select Time</div>
        </div>
        <div className={`step ${step >= 4 ? 'active' : ''}`}>
          <div className="step-number">4</div>
          <div className="step-label">Confirm</div>
        </div>
      </div>

      <div className="booking-content">
        {step === 1 && (
          <div className="step-content">
            <h2>Select a Dentist</h2>
            {loading ? (
              <div className="loading">
                <Loader2 className="spinner" />
                <span>Loading dentists...</span>
              </div>
            ) : (
              <div className="dentists-grid">
                {dentists.map((dentist) => (
                  <div 
                    key={dentist.dentistCode}
                    className={`dentist-card ${selectedDentist === dentist.dentistCode ? 'selected' : ''}`}
                    onClick={() => handleDentistSelect(dentist.dentistCode)}
                  >
                    <div className="dentist-avatar">
                      <User size={24} />
                    </div>
                    <div className="dentist-info">
                      <h3>{dentist.userId?.name || 'Dr. Unknown'}</h3>
                      <p className="specialization">{dentist.specialization || 'General Dentistry'}</p>
                      <p className="dentist-code">{dentist.dentistCode}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="step-content">
            <h2>Select a Date</h2>
            <div className="date-picker">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateSelect(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="date-input"
              />
            </div>
            {selectedDate && (
              <div className="selected-date">
                <Calendar className="date-icon" />
                <span>{formatDate(selectedDate)}</span>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="step-content">
            <h2>Select a Time Slot</h2>
            {loading ? (
              <div className="loading">
                <Loader2 className="spinner" />
                <span>Loading available slots...</span>
              </div>
            ) : availableSlots.length > 0 ? (
              <div className="time-slots">
                {availableSlots.map((slot, index) => (
                  <button
                    key={index}
                    className={`time-slot ${selectedSlot === slot.time ? 'selected' : ''}`}
                    onClick={() => handleSlotSelect(slot.time)}
                  >
                    <Clock className="time-icon" />
                    <span>{formatTime(slot.time)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="no-slots">
                <AlertCircle className="no-slots-icon" />
                <p>No available time slots for this date.</p>
                <button onClick={() => setStep(2)} className="back-button">
                  Choose Different Date
                </button>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="step-content">
            <h2>Confirm Your Appointment</h2>
            <div className="appointment-summary">
              <div className="summary-item">
                <User className="summary-icon" />
                <div>
                  <label>Dentist:</label>
                  <span>{getSelectedDentistInfo()?.userId?.name || 'Unknown'}</span>
                </div>
              </div>
              <div className="summary-item">
                <Calendar className="summary-icon" />
                <div>
                  <label>Date:</label>
                  <span>{formatDate(selectedDate)}</span>
                </div>
              </div>
              <div className="summary-item">
                <Clock className="summary-icon" />
                <div>
                  <label>Time:</label>
                  <span>{formatTime(selectedSlot)}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="appointment-form">
              <div className="form-group">
                <label htmlFor="reason">Reason for Visit (Optional)</label>
                <input
                  type="text"
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Regular checkup, tooth pain, cleaning"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="notes">Additional Notes (Optional)</label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special requirements or concerns..."
                  rows={3}
                  className="form-textarea"
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={resetForm}
                  className="cancel-button"
                  disabled={loading}
                >
                  Start Over
                </button>
                <button
                  type="submit"
                  className="submit-button"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="spinner" />
                      Booking...
                    </>
                  ) : (
                    'Book Appointment'
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {step > 1 && (
        <div className="navigation-buttons">
          <button
            onClick={() => setStep(step - 1)}
            className="back-button"
            disabled={loading}
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
};

export default BookAppointment;
