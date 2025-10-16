import React from 'react';
import './dentistnav.css';

const DentistNav = ({ activeItem = 'dashboard', user = { name: 'Dr. Amal Perera' } }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '💼' },
    { id: 'events', label: 'Events', icon: '📅' },
    { id: 'schedules', label: 'Schedules', icon: '🕐' },
    { id: 'treatment-plans', label: 'Treatment Plans', icon: '📋' },
    { id: 'prescriptions', label: 'Prescriptions', icon: '🧪' },
    { id: 'feedback', label: 'Feedback', icon: '💬' },
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'leave', label: 'Leave', icon: '🚪' }
  ];

  return (
    <nav className="dentist-nav">
      {/* Header/Logo Section */}
      <div className="dentist-nav-header">
        <div className="dentist-nav-logo">
          <div className="dentist-nav-logo-icon"></div>
          <div className="dentist-nav-logo-text">
            <h1 className="dentist-nav-clinic-name">Mediqueue Dental Clinic</h1>
            <p className="dentist-nav-slogan">Professional Healthcare</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="dentist-nav-menu">
        {navItems.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`dentist-nav-item ${activeItem === item.id ? 'active' : ''}`}
            data-item={item.id}
          >
            <div className="dentist-nav-item-icon"></div>
            <span>{item.label}</span>
          </a>
        ))}
      </div>

      {/* User Profile/Footer Section */}
      <div className="dentist-nav-footer">
        <div className="dentist-nav-user-profile">
          <div className="dentist-nav-user-icon"></div>
          <span className="dentist-nav-user-name">{user.name}</span>
        </div>
      </div>
    </nav>
  );
};

export default DentistNav;
