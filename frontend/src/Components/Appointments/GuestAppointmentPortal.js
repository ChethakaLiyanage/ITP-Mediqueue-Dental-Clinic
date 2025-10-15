import React, { useState } from 'react';
import './guest-appointment-portal.css';
import UnregisteredAppointmentBooking from './UnregisteredAppointmentBooking';
import CheckGuestAppointment from './CheckGuestAppointment';

const GuestAppointmentPortal = () => {
  const [activeView, setActiveView] = useState('book'); // 'book' or 'check'

  return (
    <div className="guest-appointment-portal">
      <div className="portal-header">
        <h1>Dental Clinic Appointment Portal</h1>
        <p>Book new appointments or check your existing appointments</p>
      </div>

      <div className="portal-navigation">
        <button
          className={`nav-button ${activeView === 'book' ? 'active' : ''}`}
          onClick={() => setActiveView('book')}
        >
          📅 Book New Appointment
        </button>
        <button
          className={`nav-button ${activeView === 'check' ? 'active' : ''}`}
          onClick={() => setActiveView('check')}
        >
          🔍 Check My Appointments
        </button>
      </div>

      <div className="portal-content">
        {activeView === 'book' && (
          <div className="booking-section">
            <UnregisteredAppointmentBooking />
          </div>
        )}

        {activeView === 'check' && (
          <div className="check-section">
            <CheckGuestAppointment />
          </div>
        )}
      </div>

      <div className="portal-footer">
        <div className="contact-info">
          <h3>Need Help?</h3>
          <div className="contact-details">
            <div className="contact-item">
              <span className="icon">📞</span>
              <span>Phone: (123) 456-7890</span>
            </div>
            <div className="contact-item">
              <span className="icon">📧</span>
              <span>Email: appointments@clinic.com</span>
            </div>
            <div className="contact-item">
              <span className="icon">🕒</span>
              <span>Hours: Mon-Fri 9AM-5PM</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestAppointmentPortal;
