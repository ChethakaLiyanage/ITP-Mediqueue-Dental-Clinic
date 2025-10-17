import React, { useState } from 'react';
import './unregistered-user-dashboard.css';
import UnregisteredUserManagement from './UnregisteredUserManagement';
import UnregisteredUserAppointments from './UnregisteredUserAppointments';

const UnregisteredUserDashboard = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [selectedUserCode, setSelectedUserCode] = useState(null);

  const tabs = [
    { id: 'users', label: 'Manage Users', component: UnregisteredUserManagement },
    { id: 'user-appointments', label: 'User Appointments', component: UnregisteredUserAppointments }
  ];

  const handleUserSelect = (userCode) => {
    setSelectedUserCode(userCode);
    setActiveTab('user-appointments');
  };

  const renderActiveComponent = () => {
    const tab = tabs.find(t => t.id === activeTab);
    if (!tab) return null;

    const Component = tab.component;
    
    if (activeTab === 'user-appointments') {
      return <Component userCode={selectedUserCode} />;
    }
    
    return <Component />;
  };

  return (
    <div className="unregistered-user-dashboard">
      <div className="dashboard-header">
        <h1>Unregistered Users & Appointments</h1>
        <p>Manage unregistered users and their appointments</p>
      </div>

      <div className="dashboard-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="dashboard-content">
        {renderActiveComponent()}
      </div>

      {activeTab === 'users' && (
        <div className="quick-actions">
          <h3>Quick Actions</h3>
          <div className="action-buttons">
            <button 
              className="btn-primary"
              onClick={() => setActiveTab('book')}
            >
              Book New Appointment
            </button>
            <button 
              className="btn-secondary"
              onClick={() => setActiveTab('appointments')}
            >
              View All Appointments
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnregisteredUserDashboard;
