import React, { useState, useEffect } from 'react';
import './unregistered-appointment-booking.css';
import { getJSON, postJSON } from '../api';

const UnregisteredAppointmentBooking = () => {
  const [formData, setFormData] = useState({
    // Guest information
    name: '',
    phone: '',
    email: '',
    address: '',
    age: '',
    gender: '',
    // Appointment information
    dentist_code: '',
    appointment_date: '',
    reason: ''
  });
  
  const [dentists, setDentists] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Guest info, 2: Select dentist, 3: Select time, 4: Confirmation
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  useEffect(() => {
    fetchDentists();
  }, []);

  const fetchDentists = async () => {
    try {
      // This would need to be implemented in your backend
      const response = await getJSON('/dentists');
      setDentists(response || []);
    } catch (error) {
      console.error('Error fetching dentists:', error);
    }
  };

  const fetchAvailableSlots = async (dentistCode, date) => {
    if (!dentistCode || !date) return;
    
    setLoading(true);
    try {
      const response = await getJSON(`/appointments/available-slots?dentistCode=${dentistCode}&date=${date}`);
      setAvailableSlots(response.availableSlots || []);
    } catch (error) {
      console.error('Error fetching available slots:', error);
      setAvailableSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDateChange = (e) => {
    const date = e.target.value;
    setSelectedDate(date);
    setFormData(prev => ({
      ...prev,
      appointment_date: date
    }));
    
    if (formData.dentist_code) {
      fetchAvailableSlots(formData.dentist_code, date);
    }
  };

  const handleDentistChange = (e) => {
    const dentistCode = e.target.value;
    setFormData(prev => ({
      ...prev,
      dentist_code: dentistCode
    }));
    
    if (selectedDate) {
      fetchAvailableSlots(dentistCode, selectedDate);
    }
  };

  const handleTimeSelect = (timeSlot) => {
    setSelectedTime(timeSlot.time);
    setFormData(prev => ({
      ...prev,
      appointment_date: timeSlot.time
    }));
  };

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const appointmentData = {
        // Guest information
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        age: formData.age,
        gender: formData.gender,
        // Appointment information
        dentist_code: formData.dentist_code,
        appointment_date: formData.appointment_date,
        reason: formData.reason
      };
      
      const response = await postJSON('/appointments/guest', appointmentData);
      
      if (response) {
        alert('Appointment booked successfully! You will receive a confirmation email.');
        // Reset form
        setFormData({
          name: '',
          phone: '',
          email: '',
          address: '',
          age: '',
          gender: '',
          dentist_code: '',
          appointment_date: '',
          reason: ''
        });
        setStep(1);
        setSelectedDate('');
        setSelectedTime('');
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      alert('Error booking appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 1:
        return formData.name && formData.phone && formData.email;
      case 2:
        return formData.dentist_code;
      case 3:
        return formData.appointment_date;
      default:
        return true;
    }
  };

  const formatTime = (timeString) => {
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="unregistered-appointment-booking">
      <div className="booking-header">
        <h2>Book an Appointment</h2>
        <div className="progress-steps">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>
            <span>1</span>
            <label>Guest Info</label>
          </div>
          <div className={`step ${step >= 2 ? 'active' : ''}`}>
            <span>2</span>
            <label>Select Dentist</label>
          </div>
          <div className={`step ${step >= 3 ? 'active' : ''}`}>
            <span>3</span>
            <label>Select Time</label>
          </div>
          <div className={`step ${step >= 4 ? 'active' : ''}`}>
            <span>4</span>
            <label>Confirm</label>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="booking-form">
        {step === 1 && (
          <div className="step-content">
            <h3>Guest Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Age</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  min="0"
                  max="120"
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>Gender</label>
                <select name="gender" value={formData.gender} onChange={handleInputChange}>
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="step-content">
            <h3>Select Dentist</h3>
            <div className="dentist-selection">
              <div className="form-group">
                <label>Choose a Dentist *</label>
                <select
                  name="dentist_code"
                  value={formData.dentist_code}
                  onChange={handleDentistChange}
                  required
                >
                  <option value="">Select a Dentist</option>
                  {dentists.map((dentist) => (
                    <option key={dentist._id} value={dentist.dentistCode}>
                      Dr. {dentist.name} - {dentist.specialization || 'General Dentistry'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="step-content">
            <h3>Select Date & Time</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Select Date *</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>
            
            {availableSlots.length > 0 ? (
              <div className="time-slots">
                <label>Available Time Slots:</label>
                <div className="slots-grid">
                  {availableSlots.map((slot, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`time-slot ${selectedTime === slot.time ? 'selected' : ''}`}
                      onClick={() => handleTimeSelect(slot)}
                    >
                      {slot.displayTime}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="no-slots">
                {loading ? 'Loading available slots...' : 'No available slots for the selected date.'}
              </div>
            )}
            
            <div className="form-group">
              <label>Reason for Visit</label>
              <textarea
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                rows="3"
                placeholder="Briefly describe the reason for your appointment..."
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="step-content">
            <h3>Confirm Your Appointment</h3>
            <div className="confirmation-details">
              <div className="detail-section">
                <h4>Guest Information</h4>
                <p><strong>Name:</strong> {formData.name}</p>
                <p><strong>Phone:</strong> {formData.phone}</p>
                <p><strong>Email:</strong> {formData.email}</p>
                {formData.age && <p><strong>Age:</strong> {formData.age}</p>}
                {formData.gender && <p><strong>Gender:</strong> {formData.gender}</p>}
                {formData.address && <p><strong>Address:</strong> {formData.address}</p>}
              </div>
              
              <div className="detail-section">
                <h4>Appointment Details</h4>
                <p><strong>Dentist:</strong> {dentists.find(d => d.dentistCode === formData.dentist_code)?.name}</p>
                <p><strong>Date & Time:</strong> {new Date(formData.appointment_date).toLocaleString()}</p>
                {formData.reason && <p><strong>Reason:</strong> {formData.reason}</p>}
              </div>
            </div>
          </div>
        )}

        <div className="form-actions">
          {step > 1 && (
            <button type="button" onClick={handlePrevious} className="btn-secondary">
              Previous
            </button>
          )}
          
          {step < 4 ? (
            <button 
              type="button" 
              onClick={handleNext} 
              className="btn-primary"
              disabled={!isStepValid()}
            >
              Next
            </button>
          ) : (
            <button 
              type="submit" 
              className="btn-primary"
              disabled={loading || !isStepValid()}
            >
              {loading ? 'Booking...' : 'Book Appointment'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default UnregisteredAppointmentBooking;
