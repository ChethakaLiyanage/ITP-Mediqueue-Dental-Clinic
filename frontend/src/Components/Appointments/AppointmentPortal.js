import React, { useState } from 'react';
import './appointment-portal.css';
import UnregisteredAppointmentBooking from './UnregisteredAppointmentBooking';
import CheckGuestAppointment from './CheckGuestAppointment';

const AppointmentPortal = () => {
  const [activeTab, setActiveTab] = useState('book');

  return (
    <div className="appointment-portal">
      <div className="portal-header">
        <h1>Dental Appointment Portal</h1>
        <p>Book appointments or check your existing bookings</p>
      </div>

      <div className="tab-navigation">
        <button
          className={`tab ${activeTab === 'book' ? 'active' : ''}`}
          onClick={() => setActiveTab('book')}
        >
          <span className="tab-icon">📅</span>
          <span className="tab-text">Book Appointment</span>
        </button>
        <button
          className={`tab ${activeTab === 'check' ? 'active' : ''}`}
          onClick={() => setActiveTab('check')}
        >
          <span className="tab-icon">🔍</span>
          <span className="tab-text">Check Appointments</span>
        </button>
      </div>

      <div className="portal-content">
        {activeTab === 'book' && (
          <div className="tab-content">
            <UnregisteredAppointmentBooking />
          </div>
        )}

        {activeTab === 'check' && (
          <div className="tab-content">
            <CheckGuestAppointment />
          </div>
        )}
      </div>

      <div className="portal-footer">
        <div className="help-section">
          <h3>Need Assistance?</h3>
          <div className="contact-grid">
            <div className="contact-card">
              <div className="contact-icon">📞</div>
              <div className="contact-info">
                <h4>Call Us</h4>
                <p>(123) 456-7890</p>
              </div>
            </div>
            <div className="contact-card">
              <div className="contact-icon">📧</div>
              <div className="contact-info">
                <h4>Email Us</h4>
                <p>appointments@clinic.com</p>
              </div>
            </div>
            <div className="contact-card">
              <div className="contact-icon">🕒</div>
              <div className="contact-info">
                <h4>Office Hours</h4>
                <p>Mon-Fri: 9AM-5PM</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentPortal;
