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
  const [selectedDuration, setSelectedDuration] = useState(30);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [preferredTimeLabel, setPreferredTimeLabel] = useState('All Times');
  const [workingWindow, setWorkingWindow] = useState(''); // e.g., "15:00-17:00"
  
  // Book for someone else state
  const [isBookingForSomeoneElse, setIsBookingForSomeoneElse] = useState(false);
  const [actualPatientName, setActualPatientName] = useState('');
  const [actualPatientEmail, setActualPatientEmail] = useState('');
  const [actualPatientPhone, setActualPatientPhone] = useState('');
  const [actualPatientAge, setActualPatientAge] = useState('');
  const [relationshipToPatient, setRelationshipToPatient] = useState('Self');
  
  // Reschedule state
  const [rescheduleAppointment, setRescheduleAppointment] = useState(null);
  const [verificationData, setVerificationData] = useState(null);
  
  // OTP state
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: All-in-one booking form
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Check authentication - allow both registered and unregistered users
  useEffect(() => {
    console.log('BookAppointment - Auth check:', { isAuthenticated, user, role: user?.role });
    // Allow both authenticated patients and unregistered users
    if (isAuthenticated && user?.role !== 'Patient') {
      console.log('Redirecting to login - not a patient');
      navigate('/login');
    }
    // If user is not authenticated, show unregistered user interface
    if (!isAuthenticated) {
      console.log('User not authenticated - showing unregistered booking interface');
    }
  }, [isAuthenticated, user, navigate]);

  // Fetch dentists on component mount
  useEffect(() => {
    fetchDentists();
  }, []);

  // Handle reschedule data from navigation state
  useEffect(() => {
    const state = window.history.state?.usr;
    if (state?.rescheduleAppointment) {
      setRescheduleAppointment(state.rescheduleAppointment);
      setVerificationData(state.verificationData);
      if (state.selectedDate) {
        setSelectedDate(new Date(state.selectedDate).toISOString().split('T')[0]);
      }
      if (state.rescheduleAppointment.dentistCode) {
        setSelectedDentist(state.rescheduleAppointment.dentistCode);
      }
    }
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

  const fetchAvailableSlots = async (dentistCode, date, duration = 30) => {
    try {
      console.log('🔍 fetchAvailableSlots called with:', { dentistCode, date, duration });
      setLoading(true);
      const response = await api.get('/appointments/available-slots', {
        params: { dentistCode, date, duration }
      });
      // Backend already filters slots by working hours, so use them directly
      const apiSlots = response.data?.slots || [];
      setAvailableSlots(apiSlots);
      return apiSlots;
    } catch (error) {
      console.error('Error fetching available slots:', error);
      setError('Failed to load available time slots. Please try again.');
      setAvailableSlots([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const sendOTP = async () => {
    // Only send OTP for authenticated users
    if (!isAuthenticated) {
      setError('Please login to send OTP');
      return;
    }

    try {
      setOtpLoading(true);
      setError('');
      
      // Debug: Check authentication state
      console.log('🔍 Current user:', user);
      console.log('🔍 Is authenticated:', isAuthenticated);
      console.log('🔍 User role:', user?.role);
      
      console.log('🔍 Making request to /appointments/send-otp');
      const response = await api.post('/appointments/send-otp');
      setOtpSent(true);
      
      // Display OTP in console and show to user
      const otp = response.data.otp;
      console.log('🔐 OTP for testing:', otp);
      setSuccess(`OTP sent successfully! Your OTP is: ${otp} (check console for details)`);
      console.log('OTP Response:', response.data);
    } catch (error) {
      console.error('Error sending OTP:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      const errorMessage = error.response?.data?.message || 'Failed to send OTP. Please try again.';
      setError(errorMessage);
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOTP = async () => {
    // Only verify OTP for authenticated users
    if (!isAuthenticated) {
      setError('Please login to verify OTP');
      return;
    }

    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP.');
      return;
    }

    try {
      setOtpLoading(true);
      setError('');
      const response = await api.post('/appointments/verify-otp', { otp });
      setOtpVerified(true);
      setSuccess('OTP verified successfully! You can now book your appointment.');
    } catch (error) {
      console.error('Error verifying OTP:', error);
      const errorMessage = error.response?.data?.message || 'Failed to verify OTP. Please try again.';
      setError(errorMessage);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleDentistSelect = (dentistCode) => {
    setSelectedDentist(dentistCode);
    setError('');
    updateWorkingWindow(dentistCode, selectedDate);
    // Auto-fetch slots if date and duration are already selected
    if (selectedDate && selectedDuration) {
      fetchAvailableSlots(dentistCode, selectedDate, selectedDuration);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setError('');
    updateWorkingWindow(selectedDentist, date);
    // Auto-fetch slots if dentist and duration are already selected
    if (selectedDentist && selectedDuration) {
      fetchAvailableSlots(selectedDentist, date, selectedDuration);
    }
  };

  const handleDurationSelect = (duration) => {
    setSelectedDuration(duration);
    setError('');
    // Auto-fetch slots if dentist and date are already selected
    if (selectedDentist && selectedDate) {
      fetchAvailableSlots(selectedDentist, selectedDate, duration);
    }
  };

  // Compute dentist working window for selected date and set preferred time dropdown label
  const updateWorkingWindow = (dentistCode, date) => {
    if (!dentistCode || !date) {
      setWorkingWindow('');
      setPreferredTimeLabel('All Times');
        return;
      }
    try {
      const d = dentists.find(x => x.dentistCode === dentistCode);
      if (!d || !d.availability_schedule) {
        setWorkingWindow('');
        setPreferredTimeLabel('All Times');
        return; 
      }
      const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
      const win = d.availability_schedule[dayName];
      if (typeof win === 'string' && /\d{2}:\d{2}-\d{2}:\d{2}/.test(win)) {
        setWorkingWindow(win);
        setPreferredTimeLabel(`All Times (${win})`);
      } else {
        setWorkingWindow('');
        setPreferredTimeLabel('All Times');
      }
    } catch (_) {
      setWorkingWindow('');
      setPreferredTimeLabel('All Times');
    }
  };

  const filterSlotsByWorkingWindow = (slots) => {
    if (!workingWindow) return slots;
    const [s, e] = workingWindow.split('-');
    const [sh, sm] = s.split(':').map(Number);
    const [eh, em] = e.split(':').map(Number);
    const startM = sh * 60 + sm;
    const endM = eh * 60 + em;
    return (slots || []).filter((slot) => {
      const dt = new Date(slot.time);
      const m = dt.getHours() * 60 + dt.getMinutes();
      return m >= startM && m + selectedDuration <= endM;
    });
  };

  const handleSearch = async () => {
    if (!selectedDentist || !selectedDate) {
      setError('Please select dentist and date');
      return;
    }
    setError('');
    await fetchAvailableSlots(selectedDentist, selectedDate, selectedDuration);
  };

  const handleSlotSelect = (slotTime) => {
    setSelectedSlot(slotTime);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedDentist || !selectedDate || !selectedSlot) {
      setError('Please complete all required fields.');
      return;
    }

    // For unregistered users, require patient details for searching appointments later
    if (!isAuthenticated && (!actualPatientName || !actualPatientEmail || !actualPatientPhone)) {
      setError('Please provide your name, email, and phone number. This information is required to search for your appointments later.');
      return;
    }

    // Only require OTP verification for authenticated users
    if (isAuthenticated && !otpVerified) {
      setError('Please verify your OTP before booking the appointment.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      let response;
      
      if (rescheduleAppointment) {
        // Handle rescheduling
        const updateData = {
          dentistCode: selectedDentist,
          appointmentDate: selectedSlot,
          duration: selectedDuration,
          reason: reason.trim(),
          notes: notes.trim(),
          // Include verification data for unregistered users
          ...(verificationData && verificationData)
        };
        
        response = await api.put(`/appointments/${rescheduleAppointment._id}`, updateData);
        setSuccess('Appointment rescheduled successfully!');
      } else {
        // Handle new booking
        const appointmentData = {
          dentistCode: selectedDentist,
          appointmentDate: selectedSlot, // This is already in ISO format from backend
          duration: selectedDuration,
          reason: reason.trim(),
          notes: notes.trim(),
          // Include patient code for authenticated users
          ...(isAuthenticated && { patientCode: user.patientCode }),
          // Include booking for someone else data if applicable
          isBookingForSomeoneElse: isBookingForSomeoneElse,
          // Include patient details for unregistered users OR when booking for someone else
          ...((!isAuthenticated || isBookingForSomeoneElse) && {
            actualPatientName: actualPatientName.trim(),
            actualPatientEmail: actualPatientEmail.trim(),
            actualPatientPhone: actualPatientPhone.trim(),
            actualPatientAge: actualPatientAge ? parseInt(actualPatientAge) : null,
            relationshipToPatient: relationshipToPatient
          })
        };
        
        response = await api.post('/appointments', appointmentData);
        setSuccess('Appointment booked successfully!');
      }
      setTimeout(() => {
        if (rescheduleAppointment) {
          // For rescheduling, redirect to check appointments page
          navigate('/check-appointment');
        } else {
          // Redirect based on user authentication status for new bookings
          if (isAuthenticated) {
            navigate('/profile'); // Registered users go to profile
          } else {
            navigate('/'); // Unregistered users go to home page
          }
        }
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
    setOtp('');
    setOtpSent(false);
    setOtpVerified(false);
    setError('');
    setSuccess('');
    // Reset booking for someone else fields
    setIsBookingForSomeoneElse(false);
    setActualPatientName('');
    setActualPatientEmail('');
    setActualPatientPhone('');
    setActualPatientAge('');
    setRelationshipToPatient('Self');
  };

  const getSelectedDentistInfo = () => {
    return dentists.find(d => d.dentistCode === selectedDentist);
  };

  const formatTime = (timeString) => {
    const date = new Date(timeString);
    // Extract the time portion from the ISO string to avoid timezone conversion
    // The backend sends times like "2025-10-29T09:00:00.000Z" for 09:00
    const timeOnly = timeString.split('T')[1].split('.')[0]; // Get "09:00:00"
    return timeOnly.substring(0, 5); // Return "09:00"
  };

  const formatEndTime = (timeString, duration) => {
    const date = new Date(timeString);
    const endTime = new Date(date.getTime() + duration * 60000); // Add duration in milliseconds
    const timeOnly = endTime.toISOString().split('T')[1].split('.')[0]; // Get "09:30:00"
    return timeOnly.substring(0, 5); // Return "09:30"
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

  // Allow both authenticated patients and unregistered users
  if (isAuthenticated && user?.role !== 'Patient') {
    return null;
  }

  return (
    <div className="book-appointment-container">
      <div className="book-appointment-header">
        <h1>Book an Appointment</h1>
        {isAuthenticated ? (
          <p>Schedule your dental appointment with our qualified dentists</p>
        ) : (
          <p>Book your dental appointment as a guest - no registration required!</p>
        )}
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

      <div className="booking-content">
        <div className="booking-form">
          {/* Compact controls row */}
          <div className="controls-row">
            <div className="control">
              <label>Choose Doctor</label>
                  <select
                className="control-select"
                value={selectedDentist}
                onChange={(e) => handleDentistSelect(e.target.value)}
              >
                <option value="">Select a dentist</option>
                {dentists.map(d => (
                  <option key={d.dentistCode} value={d.dentistCode}>
                    {d.userId?.name || 'Dr. Unknown'}
                          </option>
                ))}
                  </select>
                </div>
            <div className="control">
              <label>Preferred Date</label>
                  <input
                    type="date"
                className="control-input"
                value={selectedDate}
                onChange={(e) => handleDateSelect(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                  />
                </div>
            <div className="control">
              <label>Duration</label>
                  <select
                className="control-select"
                value={selectedDuration}
                onChange={(e) => handleDurationSelect(parseInt(e.target.value, 10))}
              >
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={90}>90 minutes</option>
                <option value={120}>120 minutes</option>
                  </select>
                </div>
            <div className="control">
              <label>Preferred Time</label>
              <select className="control-select" value={workingWindow || ''} onChange={() => { /* single option for now */ }}>
                <option value={workingWindow || ''}>{preferredTimeLabel}</option>
                  </select>
                </div>
            <div className="control control-button">
              <button type="button" className="search-button" onClick={handleSearch} disabled={loading}>
                {loading ? <Loader2 className="spinner" /> : 'Search Slots'}
              </button>
            </div>
          </div>

          {/* Available Time Slots */}
          {selectedDentist && selectedDate && (
            <div className="form-section">
              <h3>Available Time Slots</h3>
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
                      <span>{slot.displayTime || formatTime(slot.time)}</span>
                    </button>
                  ))}
                      </div>
              ) : (
                <div className="no-slots">
                  <AlertCircle className="no-slots-icon" />
                  <p>No available time slots for the selected date and duration.</p>
                      </div>
                      )}
              </div>
            )}

          {/* Appointment Details Form */}
          {selectedSlot && (
            <div className="form-section">
              <h3>Appointment Details</h3>
              <div className="appointment-summary">
                <div className="summary-header">
                  <h4>Appointment Summary</h4>
                  <div className="appointment-status pending">
                    <div className="status-dot"></div>
                    <span>Pending Confirmation</span>
                  </div>
                </div>
                
                <div className="summary-grid">
                  <div className="summary-card">
                    <div className="card-header">
                      <User className="card-icon" />
                      <h5>Dentist Information</h5>
                    </div>
                    <div className="card-content">
                      <div className="info-row">
                        <span className="label">Name:</span>
                        <span className="value">{getSelectedDentistInfo()?.userId?.name || 'Unknown'}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Specialization:</span>
                        <span className="value">{getSelectedDentistInfo()?.specialization || 'General Dentistry'}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Code:</span>
                        <span className="value">{selectedDentist}</span>
                      </div>
                    </div>
                  </div>

                  <div className="summary-card">
                    <div className="card-header">
                      <Calendar className="card-icon" />
                      <h5>Appointment Details</h5>
                    </div>
                    <div className="card-content">
                      <div className="info-row">
                        <span className="label">Date:</span>
                        <span className="value">{formatDate(selectedDate)}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Time:</span>
                        <span className="value time-highlight">{formatTime(selectedSlot)}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Duration:</span>
                        <span className="value">{selectedDuration} minutes</span>
                      </div>
                      <div className="info-row">
                        <span className="label">End Time:</span>
                        <span className="value">{formatEndTime(selectedSlot, selectedDuration)}</span>
                      </div>
                    </div>
                  </div>

                      <div className="summary-card">
                        <div className="card-header">
                          <Clock className="card-icon" />
                          <h5>Patient Information</h5>
                        </div>
                        <div className="card-content">
                          <div className="info-row">
                            <span className="label">Name:</span>
                            <span className="value">
                              {isAuthenticated 
                                ? (user?.name || 'Unknown')
                                : (actualPatientName || 'Please fill in your details below')
                              }
                            </span>
                          </div>
                          <div className="info-row">
                            <span className="label">Email:</span>
                            <span className="value">
                              {isAuthenticated 
                                ? (user?.email || 'Unknown')
                                : (actualPatientEmail || 'Please fill in your details below')
                              }
                            </span>
                          </div>
                          <div className="info-row">
                            <span className="label">Phone:</span>
                            <span className="value">
                              {isAuthenticated 
                                ? (user?.phone || 'Unknown')
                                : (actualPatientPhone || 'Please fill in your details below')
                              }
                            </span>
                          </div>
                          {isAuthenticated && (
                            <div className="info-row">
                              <span className="label">Patient Code:</span>
                              <span className="value">{user?.patientCode || 'P-0001'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                </div>
              </div>

                  <form onSubmit={handleSubmit} className="appointment-form">
                    {/* Book for Someone Else Toggle - Only for authenticated users */}
                    {isAuthenticated && (
                      <div className="form-section">
                        <div className="booking-toggle">
                          <label className="toggle-label">
                            <input
                              type="checkbox"
                              checked={isBookingForSomeoneElse}
                              onChange={(e) => setIsBookingForSomeoneElse(e.target.checked)}
                              className="toggle-input"
                            />
                            <span className="toggle-text">
                              <User className="toggle-icon" />
                              Book for someone else (family member, friend, etc.)
                            </span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Patient Details Form - Show for unregistered users or when booking for someone else */}
                    {(!isAuthenticated || isBookingForSomeoneElse) && (
                        <div className="patient-details-form">
                          <h4>
                            {!isAuthenticated ? 'Your Details' : 'Patient Details'}
                          </h4>
                          {!isAuthenticated && (
                            <p className="form-description">
                              Please provide your information for the appointment booking.
                            </p>
                          )}
                          <div className="form-row">
                            <div className="form-group">
                              <label htmlFor="actualPatientName">
                                {!isAuthenticated ? 'Your Name *' : 'Patient Name *'}
                              </label>
                              <input
                                type="text"
                                id="actualPatientName"
                                value={actualPatientName}
                                onChange={(e) => setActualPatientName(e.target.value)}
                                placeholder={!isAuthenticated ? "Enter your full name" : "Enter patient's full name"}
                                className="form-input"
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label htmlFor="actualPatientAge">Age</label>
                              <input
                                type="number"
                                id="actualPatientAge"
                                value={actualPatientAge}
                                onChange={(e) => setActualPatientAge(e.target.value)}
                                placeholder="Age"
                                className="form-input"
                                min="1"
                                max="120"
                              />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label htmlFor="actualPatientEmail">
                                {!isAuthenticated ? 'Your Email *' : 'Email'}
                              </label>
                              <input
                                type="email"
                                id="actualPatientEmail"
                                value={actualPatientEmail}
                                onChange={(e) => setActualPatientEmail(e.target.value)}
                                placeholder={!isAuthenticated ? "your@email.com" : "patient@email.com"}
                                className="form-input"
                                required={!isAuthenticated}
                              />
                            </div>
                            <div className="form-group">
                              <label htmlFor="actualPatientPhone">
                                {!isAuthenticated ? 'Your Phone *' : 'Phone'}
                              </label>
                              <input
                                type="tel"
                                id="actualPatientPhone"
                                value={actualPatientPhone}
                                onChange={(e) => setActualPatientPhone(e.target.value)}
                                placeholder="+94 77 123 4567"
                                className="form-input"
                                required={!isAuthenticated}
                              />
                            </div>
                          </div>
                          {isAuthenticated && (
                            <div className="form-group">
                              <label htmlFor="relationshipToPatient">Your Relationship to Patient</label>
                              <select
                                id="relationshipToPatient"
                                value={relationshipToPatient}
                                onChange={(e) => setRelationshipToPatient(e.target.value)}
                                className="form-select"
                              >
                                <option value="Self">Self</option>
                                <option value="Spouse">Spouse</option>
                                <option value="Child">Child</option>
                                <option value="Parent">Parent</option>
                                <option value="Sibling">Sibling</option>
                                <option value="Friend">Friend</option>
                                <option value="Other">Other</option>
                              </select>
                            </div>
                          )}
                        </div>
                      )}

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
                        placeholder="Any specific concerns or requests..."
                        className="form-textarea"
                        rows="3"
                      />
                    </div>

                {/* OTP Verification Section - Only for authenticated users */}
                {isAuthenticated && (
                  <div className="otp-section">
                    <h4>Verify Your Identity</h4>
                    <p>Please verify your identity with an OTP to complete the booking.</p>
                    
                    {!otpSent ? (
                      <div className="otp-send">
                        <button 
                          type="button" 
                          className="otp-send-button" 
                          onClick={sendOTP}
                          disabled={otpLoading}
                        >
                          {otpLoading ? (
                            <>
                              <Loader2 className="spinner" />
                              Sending OTP...
                            </>
                          ) : (
                            'Send OTP'
                          )}
                        </button>
                      </div>
                    ) : !otpVerified ? (
                      <div className="otp-verify">
                        <div className="form-group">
                          <label htmlFor="otp">Enter 6-digit OTP</label>
                          <input
                            type="text"
                            id="otp"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="123456"
                            className="form-input otp-input"
                            maxLength="6"
                          />
                        </div>
                        <div className="otp-actions">
                          <button 
                            type="button" 
                            className="otp-verify-button" 
                            onClick={verifyOTP}
                            disabled={otpLoading || otp.length !== 6}
                          >
                            {otpLoading ? (
                              <>
                                <Loader2 className="spinner" />
                                Verifying...
                              </>
                            ) : (
                              'Verify OTP'
                            )}
                          </button>
                          <button 
                            type="button" 
                            className="otp-resend-button" 
                            onClick={sendOTP}
                            disabled={otpLoading}
                          >
                            Resend OTP
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="otp-success">
                        <CheckCircle className="success-icon" />
                        <span>OTP verified successfully!</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Unregistered User Notice */}
                {!isAuthenticated && (
                  <div className="unregistered-notice">
                    <h4>Booking as Guest</h4>
                    <p>You're booking as a guest. Your contact information (name, email, phone) is required so you can search for your appointments later using the "Check Appointments" feature on the home page.</p>
                    <div className="guest-benefits">
                      <div className="benefit-item">
                        <CheckCircle className="benefit-icon" />
                        <span>No registration required</span>
                      </div>
                      <div className="benefit-item">
                        <CheckCircle className="benefit-icon" />
                        <span>Search appointments by email/phone</span>
                      </div>
                      <div className="benefit-item">
                        <CheckCircle className="benefit-icon" />
                        <span>Quick and easy booking</span>
                      </div>
                    </div>
                    <div className="guest-actions">
                      <button 
                        type="button" 
                        onClick={() => navigate('/register-patient')} 
                        className="register-btn"
                      >
                        Create Account for Better Experience
                      </button>
                      <button 
                        type="button" 
                        onClick={() => navigate('/login')} 
                        className="login-btn"
                      >
                        Already Have Account? Login
                      </button>
                    </div>
                  </div>
                )}

                <div className="form-actions">
                  <button type="submit" className="submit-button" disabled={loading || (isAuthenticated && !otpVerified)}>
                    {loading ? (
                      <>
                        <Loader2 className="spinner" />
                        Booking...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="button-icon" />
                    {rescheduleAppointment ? 'Reschedule Appointment' : 'Book Appointment'}
                      </>
                    )}
                  </button>
                  <button type="button" onClick={() => navigate('/profile')} className="cancel-button">
                    Cancel
                  </button>
                        </div>
              </form>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default BookAppointment;


            <div className="control">

              <label>Preferred Time</label>

              <select className="control-select" value={workingWindow || ''} onChange={() => { /* single option for now */ }}>

                <option value={workingWindow || ''}>{preferredTimeLabel}</option>

                  </select>

                </div>

            <div className="control control-button">

              <button type="button" className="search-button" onClick={handleSearch} disabled={loading}>

                {loading ? <Loader2 className="spinner" /> : 'Search Slots'}

              </button>

            </div>

          </div>



          {/* Available Time Slots */}

          {selectedDentist && selectedDate && (

            <div className="form-section">

              <h3>Available Time Slots</h3>

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

                      <span>{slot.displayTime || formatTime(slot.time)}</span>

                    </button>

                  ))}

                      </div>

              ) : (

                <div className="no-slots">

                  <AlertCircle className="no-slots-icon" />

                  <p>No available time slots for the selected date and duration.</p>

                      </div>

                      )}

              </div>

            )}



          {/* Appointment Details Form */}

          {selectedSlot && (

            <div className="form-section">

              <h3>Appointment Details</h3>

              <div className="appointment-summary">

                <div className="summary-header">

                  <h4>Appointment Summary</h4>

                  <div className="appointment-status pending">

                    <div className="status-dot"></div>

                    <span>Pending Confirmation</span>

                  </div>

                </div>

                

                <div className="summary-grid">

                  <div className="summary-card">

                    <div className="card-header">

                      <User className="card-icon" />

                      <h5>Dentist Information</h5>

                    </div>

                    <div className="card-content">

                      <div className="info-row">

                        <span className="label">Name:</span>

                        <span className="value">{getSelectedDentistInfo()?.userId?.name || 'Unknown'}</span>

                      </div>

                      <div className="info-row">

                        <span className="label">Specialization:</span>

                        <span className="value">{getSelectedDentistInfo()?.specialization || 'General Dentistry'}</span>

                      </div>

                      <div className="info-row">

                        <span className="label">Code:</span>

                        <span className="value">{selectedDentist}</span>

                      </div>

                    </div>

                  </div>



                  <div className="summary-card">

                    <div className="card-header">

                      <Calendar className="card-icon" />

                      <h5>Appointment Details</h5>

                    </div>

                    <div className="card-content">

                      <div className="info-row">

                        <span className="label">Date:</span>

                        <span className="value">{formatDate(selectedDate)}</span>

                      </div>

                      <div className="info-row">

                        <span className="label">Time:</span>

                        <span className="value time-highlight">{formatTime(selectedSlot)}</span>

                      </div>

                      <div className="info-row">

                        <span className="label">Duration:</span>

                        <span className="value">{selectedDuration} minutes</span>

                      </div>

                      <div className="info-row">

                        <span className="label">End Time:</span>

                        <span className="value">{formatEndTime(selectedSlot, selectedDuration)}</span>

                      </div>

                    </div>

                  </div>



                      <div className="summary-card">

                        <div className="card-header">

                          <Clock className="card-icon" />

                          <h5>Patient Information</h5>

                        </div>

                        <div className="card-content">

                          <div className="info-row">

                            <span className="label">Name:</span>

                            <span className="value">

                              {isAuthenticated 

                                ? (user?.name || 'Unknown')

                                : (actualPatientName || 'Please fill in your details below')

                              }

                            </span>

                          </div>

                          <div className="info-row">

                            <span className="label">Email:</span>

                            <span className="value">

                              {isAuthenticated 

                                ? (user?.email || 'Unknown')

                                : (actualPatientEmail || 'Please fill in your details below')

                              }

                            </span>

                          </div>

                          <div className="info-row">

                            <span className="label">Phone:</span>

                            <span className="value">

                              {isAuthenticated 

                                ? (user?.phone || 'Unknown')

                                : (actualPatientPhone || 'Please fill in your details below')

                              }

                            </span>

                          </div>

                          {isAuthenticated && (

                            <div className="info-row">

                              <span className="label">Patient Code:</span>

                              <span className="value">{user?.patientCode || 'P-0001'}</span>

                            </div>

                          )}

                        </div>

                      </div>

                </div>

              </div>



                  <form onSubmit={handleSubmit} className="appointment-form">

                    {/* Book for Someone Else Toggle - Only for authenticated users */}

                    {isAuthenticated && (

                      <div className="form-section">

                        <div className="booking-toggle">

                          <label className="toggle-label">

                            <input

                              type="checkbox"

                              checked={isBookingForSomeoneElse}

                              onChange={(e) => setIsBookingForSomeoneElse(e.target.checked)}

                              className="toggle-input"

                            />

                            <span className="toggle-text">

                              <User className="toggle-icon" />

                              Book for someone else (family member, friend, etc.)

                            </span>

                          </label>

                        </div>

                      </div>

                    )}



                    {/* Patient Details Form - Show for unregistered users or when booking for someone else */}

                    {(!isAuthenticated || isBookingForSomeoneElse) && (

                        <div className="patient-details-form">

                          <h4>

                            {!isAuthenticated ? 'Your Details' : 'Patient Details'}

                          </h4>

                          {!isAuthenticated && (

                            <p className="form-description">

                              Please provide your information for the appointment booking.

                            </p>

                          )}

                          <div className="form-row">

                            <div className="form-group">

                              <label htmlFor="actualPatientName">

                                {!isAuthenticated ? 'Your Name *' : 'Patient Name *'}

                              </label>

                              <input

                                type="text"

                                id="actualPatientName"

                                value={actualPatientName}

                                onChange={(e) => setActualPatientName(e.target.value)}

                                placeholder={!isAuthenticated ? "Enter your full name" : "Enter patient's full name"}

                                className="form-input"

                                required

                              />

                            </div>

                            <div className="form-group">

                              <label htmlFor="actualPatientAge">Age</label>

                              <input

                                type="number"

                                id="actualPatientAge"

                                value={actualPatientAge}

                                onChange={(e) => setActualPatientAge(e.target.value)}

                                placeholder="Age"

                                className="form-input"

                                min="1"

                                max="120"

                              />

                            </div>

                          </div>

                          <div className="form-row">

                            <div className="form-group">

                              <label htmlFor="actualPatientEmail">

                                {!isAuthenticated ? 'Your Email *' : 'Email'}

                              </label>

                              <input

                                type="email"

                                id="actualPatientEmail"

                                value={actualPatientEmail}

                                onChange={(e) => setActualPatientEmail(e.target.value)}

                                placeholder={!isAuthenticated ? "your@email.com" : "patient@email.com"}

                                className="form-input"

                                required={!isAuthenticated}

                              />

                            </div>

                            <div className="form-group">

                              <label htmlFor="actualPatientPhone">

                                {!isAuthenticated ? 'Your Phone *' : 'Phone'}

                              </label>

                              <input

                                type="tel"

                                id="actualPatientPhone"

                                value={actualPatientPhone}

                                onChange={(e) => setActualPatientPhone(e.target.value)}

                                placeholder="+94 77 123 4567"

                                className="form-input"

                                required={!isAuthenticated}

                              />

                            </div>

                          </div>

                          {isAuthenticated && (

                            <div className="form-group">

                              <label htmlFor="relationshipToPatient">Your Relationship to Patient</label>

                              <select

                                id="relationshipToPatient"

                                value={relationshipToPatient}

                                onChange={(e) => setRelationshipToPatient(e.target.value)}

                                className="form-select"

                              >

                                <option value="Self">Self</option>

                                <option value="Spouse">Spouse</option>

                                <option value="Child">Child</option>

                                <option value="Parent">Parent</option>

                                <option value="Sibling">Sibling</option>

                                <option value="Friend">Friend</option>

                                <option value="Other">Other</option>

                              </select>

                            </div>

                          )}

                        </div>

                      )}



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

                        placeholder="Any specific concerns or requests..."

                        className="form-textarea"

                        rows="3"

                      />

                    </div>



                {/* OTP Verification Section - Only for authenticated users */}

                {isAuthenticated && (

                  <div className="otp-section">

                    <h4>Verify Your Identity</h4>

                    <p>Please verify your identity with an OTP to complete the booking.</p>

                    

                    {!otpSent ? (

                      <div className="otp-send">

                        <button 

                          type="button" 

                          className="otp-send-button" 

                          onClick={sendOTP}

                          disabled={otpLoading}

                        >

                          {otpLoading ? (

                            <>

                              <Loader2 className="spinner" />

                              Sending OTP...

                            </>

                          ) : (

                            'Send OTP'

                          )}

                        </button>

                      </div>

                    ) : !otpVerified ? (

                      <div className="otp-verify">

                        <div className="form-group">

                          <label htmlFor="otp">Enter 6-digit OTP</label>

                          <input

                            type="text"

                            id="otp"

                            value={otp}

                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}

                            placeholder="123456"

                            className="form-input otp-input"

                            maxLength="6"

                          />

                        </div>

                        <div className="otp-actions">

                          <button 

                            type="button" 

                            className="otp-verify-button" 

                            onClick={verifyOTP}

                            disabled={otpLoading || otp.length !== 6}

                          >

                            {otpLoading ? (

                              <>

                                <Loader2 className="spinner" />

                                Verifying...

                              </>

                            ) : (

                              'Verify OTP'

                            )}

                          </button>

                          <button 

                            type="button" 

                            className="otp-resend-button" 

                            onClick={sendOTP}

                            disabled={otpLoading}

                          >

                            Resend OTP

                          </button>

                        </div>

                      </div>

                    ) : (

                      <div className="otp-success">

                        <CheckCircle className="success-icon" />

                        <span>OTP verified successfully!</span>

                      </div>

                    )}

                  </div>

                )}



                {/* Unregistered User Notice */}

                {!isAuthenticated && (

                  <div className="unregistered-notice">

                    <h4>Booking as Guest</h4>

                    <p>You're booking as a guest. Your contact information (name, email, phone) is required so you can search for your appointments later using the "Check Appointments" feature on the home page.</p>

                    <div className="guest-benefits">

                      <div className="benefit-item">

                        <CheckCircle className="benefit-icon" />

                        <span>No registration required</span>

                      </div>

                      <div className="benefit-item">

                        <CheckCircle className="benefit-icon" />

                        <span>Search appointments by email/phone</span>

                      </div>

                      <div className="benefit-item">

                        <CheckCircle className="benefit-icon" />

                        <span>Quick and easy booking</span>

                      </div>

                    </div>

                    <div className="guest-actions">

                      <button 

                        type="button" 

                        onClick={() => navigate('/register-patient')} 

                        className="register-btn"

                      >

                        Create Account for Better Experience

                      </button>

                      <button 

                        type="button" 

                        onClick={() => navigate('/login')} 

                        className="login-btn"

                      >

                        Already Have Account? Login

                      </button>

                    </div>

                  </div>

                )}



                <div className="form-actions">

                  <button type="submit" className="submit-button" disabled={loading || (isAuthenticated && !otpVerified)}>

                    {loading ? (

                      <>

                        <Loader2 className="spinner" />

                        Booking...

                      </>

                    ) : (

                      <>

                        <CheckCircle className="button-icon" />

                    Book Appointment

                      </>

                    )}

                  </button>

                  <button type="button" onClick={() => navigate('/profile')} className="cancel-button">

                    Cancel

                  </button>

                        </div>

              </form>

            </div>

          )}

        </div>

      </div>



    </div>

  );

};



export default BookAppointment;


