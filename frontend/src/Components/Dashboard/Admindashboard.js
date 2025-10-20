import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../Contexts/AuthContext';
import "./AdminDashboard.css";

function AdminDashboard() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [stats, setStats] = useState({
    totalStaff: null,
    totalPatients: null,
    appointmentsToday: null
  });

  // Redirect if not authenticated or not an admin
  useEffect(() => {
    if (!loading && (!user || user.role !== 'Admin')) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  // Fetch dashboard stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Simulate API calls - replace with actual API endpoints
        setTimeout(() => {
          setStats({
            totalStaff: 13,
            totalPatients: 10,
            appointmentsToday: 0
          });
        }, 1000);
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    if (user && user.role === 'Admin') {
      fetchStats();
    }
  }, [user]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!user || user.role !== 'Admin') {
    return null;
  }

  const handleAddStaff = (staffType) => {
    // Navigate to appropriate staff management page
    navigate(`/admin/staff?type=${staffType}`);
  };

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">
          Welcome back, {user.name || 'Administrator'}
        </h1>
        <p className="dashboard-subtitle">
          Here's your system overview and management tools
        </p>
      </div>

      {/* Administrator Information */}
      <div className="admin-info-section">
        <h2>Administrator Information</h2>
        <div className="admin-info-card">
          <div className="info-grid">
            <div className="info-item">
              <label>NAME</label>
              <span>{user.name || 'Prashan Wickramaarachchi'}</span>
            </div>
            <div className="info-item">
              <label>EMAIL</label>
              <span>{user.email || 'prashan123@gmail.com'}</span>
            </div>
            <div className="info-item">
              <label>ROLE</label>
              <span className="role-badge admin">ADMIN</span>
            </div>
            <div className="info-item">
              <label>ADMIN CODE</label>
              <span className="admin-code">AD-0001</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="stats-section">
        <div className="stats-grid">
          <div className="stat-card">
            <h3>TOTAL STAFF</h3>
            {stats.totalStaff !== null ? (
              <>
                <div className="stat-number">{stats.totalStaff}</div>
                <p className="stat-description">Active staff members</p>
              </>
            ) : (
              <div className="stat-loading">Loading...</div>
            )}
          </div>
          <div className="stat-card">
            <h3>TOTAL PATIENTS</h3>
            {stats.totalPatients !== null ? (
              <>
                <div className="stat-number">{stats.totalPatients}</div>
                <p className="stat-description">Registered patients</p>
              </>
            ) : (
              <div className="stat-loading">Loading...</div>
            )}
          </div>
          <div className="stat-card">
            <h3>APPOINTMENTS TODAY</h3>
            {stats.appointmentsToday !== null ? (
              <>
                <div className="stat-number">{stats.appointmentsToday}</div>
                <p className="stat-description">Scheduled for today</p>
              </>
            ) : (
              <div className="stat-loading">Loading...</div>
            )}
          </div>
        </div>
      </div>

      {/* Add Staff Section */}
      <div className="add-staff-section">
        <h2>Add Staff Members</h2>
        <div className="staff-buttons">
          <button 
            className="staff-btn dentist-btn"
            onClick={() => handleAddStaff('dentist')}
          >
            <div className="staff-btn-icon">🦷</div>
            <div className="staff-btn-text">Add Dentist</div>
          </button>
          <button 
            className="staff-btn admin-btn"
            onClick={() => handleAddStaff('admin')}
          >
            <div className="staff-btn-icon">👨‍💼</div>
            <div className="staff-btn-text">Add Admin</div>
          </button>
          <button 
            className="staff-btn receptionist-btn"
            onClick={() => handleAddStaff('receptionist')}
          >
            <div className="staff-btn-icon">📋</div>
            <div className="staff-btn-text">Add Receptionist</div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;