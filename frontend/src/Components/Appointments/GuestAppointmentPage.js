import React from 'react';
import CheckGuestAppointment from './CheckGuestAppointment';
import './guest-appointment-page.css';

const GuestAppointmentPage = () => {
  return (
    <div className="guest-appointment-page">
      <div className="page-header">
        <h1>Check Your Appointments</h1>
        <p>Enter your email or phone number to view your booked appointments</p>
      </div>
      
      <CheckGuestAppointment />
      
      <div className="page-footer">
        <div className="quick-links">
          <h3>Quick Actions</h3>
          <div className="action-buttons">
            <button className="btn-primary">
              📅 Book New Appointment
            </button>
            <button className="btn-secondary">
              📞 Contact Clinic
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestAppointmentPage;
