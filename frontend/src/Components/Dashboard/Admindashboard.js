import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import "./AdminDashboard.css";

const API_BASE_URL = "http://localhost:5000";

// Fetch dashboard statistics using admin endpoints
const fetchDashboardStats = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/admin/reports/dashboard-stats`);
    return res.data.data || res.data; // Handle both response formats
  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    return {
      staff: { total: 0, active: 0 },
      patients: { total: 0, registered: 0, unregistered: 0 },
      appointments: { today: 0, total: 0 },
      inquiries: { total: 0, unread: 0 }
    };
  }
};

// Fetch patient overview statistics
const fetchPatientStats = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/admin/patient-management/overview-stats`);
    return res.data.data || res.data; // Handle both response formats
  } catch (err) {
    console.error("Error fetching patient stats:", err);
    return {
      total: { registered: 0, unregistered: 0, total: 0 },
      today: { registered: 0, unregistered: 0, total: 0 }
    };
  }
};

function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  // Get admin info from localStorage auth
  const [auth, setAuth] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem('auth') || '{}');
    } catch (error) {
      console.error('Error parsing auth data:', error);
      return {};
    }
  });
  
  const loggedInAdmin = auth?.user || {};
  const adminCode = loggedInAdmin?.adminCode || '';
  const adminName = loggedInAdmin?.name || 'Admin';
  const adminEmail = loggedInAdmin?.email || '';

  const [stats, setStats] = useState({
    staffCount: 0,
    patientsCount: 0,
    todaysAppointments: 0,
    unreadMessages: 5 // Keeping this as is for now
  });
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [dashboardStats, patientStats] = await Promise.all([
          fetchDashboardStats(),
          fetchPatientStats()
        ]);
        
        setStats({
          staffCount: dashboardStats.staff?.total || 0,
          patientsCount: patientStats.total?.total || 0,
          todaysAppointments: dashboardStats.appointments?.today || 0,
          unreadMessages: dashboardStats.inquiries?.unread || 0
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, []);
  
  // Fetch recent staff
  useEffect(() => {
    const fetchRecentStaff = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/admin/reports/staff`);
        const data = res.data.data || res.data; // Handle both response formats
        if (data && data.staff) {
          // Take only the first 5 staff members for recent display
          setUsers(data.staff.slice(0, 5));
        }
      } catch (err) {
        console.error("Error fetching recent staff:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRecentStaff();
  }, []);

  const handleAddStaff = (staffType) => {
    // Navigate to staff management with add modal and role parameter
    navigate(`/admin/staff?add=${staffType}`);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth');
    localStorage.removeItem('token');
    window.dispatchEvent(new Event("auth-change"));
    window.dispatchEvent(new Event("storage"));
    navigate("/login");
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await axios.delete(`${URL}/${userId}`);
        setUsers(users.filter(user => user._id !== userId));
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user');
      }
    }
  };

  return (
    <div className="admin-dashboard-content">
      {/* Admin Details Section */}
      <div className="admin-details-section">
        <h2>Administrator Information</h2>
        {Object.keys(loggedInAdmin).length > 0 ? (
          <div className="admin-card">
            <div className="admin-avatar">
              {adminName.charAt(0).toUpperCase()}
            </div>
            <div className="admin-info-grid">
              <div className="admin-info-item">
                <div className="admin-info-label">Name</div>
                <div className="admin-info-value">{adminName}</div>
              </div>
              <div className="admin-info-item">
                <div className="admin-info-label">Email</div>
                <div className="admin-info-value">{adminEmail}</div>
              </div>
              <div className="admin-info-item">
                <div className="admin-info-label">Role</div>
                <div className="admin-info-value">
                  <span className="role-badge admin">
                    {loggedInAdmin.role || 'Administrator'}
                  </span>
                </div>
              </div>
              {adminCode && (
                <div className="admin-info-item">
                  <div className="admin-info-label">Admin Code</div>
                  <div className="admin-info-value">
                    <span className="admin-code">{adminCode}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="admin-card">
            <p>Loading admin information...</p>
            <button 
              onClick={() => window.location.reload()}
              className="refresh-btn"
            >
              Refresh Page
            </button>
          </div>
        )}
      </div>

      {/* Stats Overview */}
      <div className="stats-overview">
        <div className="stat-card">
          <h3>Total Staff</h3>
          {statsLoading ? (
            <div className="stat-loading">Loading...</div>
          ) : (
            <>
              <p className="stat-number">{stats.staffCount}</p>
              <p className="stat-description">Active staff members</p>
            </>
          )}
        </div>
        
        <div className="stat-card">
          <h3>Total Patients</h3>
          {statsLoading ? (
            <div className="stat-loading">Loading...</div>
          ) : (
            <>
              <p className="stat-number">{stats.patientsCount}</p>
              <p className="stat-description">Registered patients</p>
            </>
          )}
        </div>
        
        <div className="stat-card">
          <h3>Appointments Today</h3>
          {statsLoading ? (
            <div className="stat-loading">Loading...</div>
          ) : (
            <>
              <p className="stat-number">{stats.todaysAppointments}</p>
              <p className="stat-description">Scheduled for today</p>
            </>
          )}
        </div>
      </div>

      {/* Add Staff Section */}
      <div className="add-staff-section">
        <h2>Add Staff Members</h2>
        <div className="staff-buttons">
          <button className="staff-btn dentist-btn" onClick={() => handleAddStaff("dentist")}>
            <div className="staff-btn-icon">🦷</div>
            <div className="staff-btn-text">Add Dentist</div>
          </button>
          <button className="staff-btn admin-btn" onClick={() => handleAddStaff("admin")}>
            <div className="staff-btn-icon">👨‍💼</div>
            <div className="staff-btn-text">Add Admin</div>
          </button>
          <button className="staff-btn receptionist-btn" onClick={() => handleAddStaff("receptionist")}>
            <div className="staff-btn-icon">📋</div>
            <div className="staff-btn-text">Add Receptionist</div>
          </button>
          <button className="staff-btn manager-btn" onClick={() => handleAddStaff("manager")}>
            <div className="staff-btn-icon">📊</div>
            <div className="staff-btn-text">Add Manager</div>
          </button>
        </div>
      </div>

      {/* Recent Users */}
      <div className="recent-users">
        <h2>Recent System Users</h2>
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading users...</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Contact</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? (
                  users.slice(0, 10).map((user, idx) => (
                    <tr key={user._id || idx}>
                      <td>
                        <div className="user-info">
                          <div className="user-avatar">
                            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div className="user-details">
                            <div className="user-name">{user.name || 'No Name'}</div>
                            <div className="user-email">{user.email || 'No Email'}</div>
                          </div>
                        </div>
                      </td>
                      <td>{user.email || 'N/A'}</td>
                      <td>{user.contact_no || 'N/A'}</td>
                      <td>
                        <span className={`role-badge ${(user.role || 'user').toLowerCase()}`}>
                          {user.role || 'User'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${user.isActive !== false ? 'status-active' : 'status-inactive'}`}>
                          {user.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td>
                        <div className="action-buttons-inline">
                          <button 
                            className="action-btn view-btn"
                            onClick={() => navigate(`/admin/users/${user._id}`)}
                            title="View User"
                          >
                            👁️
                          </button>
                          <button 
                            className="action-btn edit-btn"
                            onClick={() => navigate(`/admin/users/edit/${user._id}`)}
                            title="Edit User"
                          >
                            ✏️
                          </button>
                          <button 
                            className="action-btn delete-btn"
                            onClick={() => handleDeleteUser(user._id)}
                            title="Delete User"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="no-data">No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
