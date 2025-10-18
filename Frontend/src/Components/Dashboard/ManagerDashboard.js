import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../Contexts/AuthContext';
import './ManagerDashboard.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const { token, user, isAuthenticated } = useAuth();
  const [stats, setStats] = useState({
    totalAppointments: 0,
    pendingAppointments: 0,
    totalPatients: 0,
    totalRevenue: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      navigate('/login');
      return;
    }
    
    if (user?.role && !['Manager', 'Admin'].includes(user.role)) {
      setError('You do not have permission to view this dashboard. Only Managers and Admins can access this page.');
      return;
    }
    
    fetchStats();
    fetchRecentActivity();
  }, [token, isAuthenticated, navigate, user?.role]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE}/api/manager/reports/dashboard-stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard statistics');
      }
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setError(err.message);
      // Fallback to mock data if API fails
      setStats({
        totalAppointments: 124,
        pendingAppointments: 8,
        totalPatients: 89,
        totalRevenue: 12500,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      setActivityLoading(true);
      
      const response = await fetch(`${API_BASE}/api/manager/reports/recent-activity?limit=8`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch recent activity');
      }
      
      const data = await response.json();
      setRecentActivity(data.activities || []);
    } catch (err) {
      console.error('Error fetching recent activity:', err);
      // Set mock data for demo purposes
      setRecentActivity([
        {
          id: 'demo_1',
          type: 'appointment',
          title: 'New confirmed appointment',
          description: 'John Doe - Dr. Smith',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          status: 'confirmed',
          icon: '📅'
        },
        {
          id: 'demo_2',
          type: 'inventory',
          title: 'Inventory request',
          description: 'Dr. Johnson requested 5 items',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
          icon: '📦'
        },
        {
          id: 'demo_3',
          type: 'feedback',
          title: 'New patient feedback',
          description: 'Sarah Wilson rated 5/5 stars',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          status: 'completed',
          icon: '⭐'
        }
      ]);
    } finally {
      setActivityLoading(false);
    }
  };

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error-message">
          <p>{error}</p>
          <button onClick={fetchStats} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Loading dashboard data...</p>
        </div>
      )}
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Appointments</h3>
          <p className="stat-number">{stats.totalAppointments}</p>
          <button 
            className="view-details"
            onClick={() => navigate('/manager/reports')}
          >
            View All
          </button>
        </div>
        
        <div className="stat-card">
          <h3>Pending Appointments</h3>
          <p className="stat-number">{stats.pendingAppointments}</p>
          <button 
            className="view-details"
            onClick={() => navigate('/manager/reports')}
          >
            Review
          </button>
        </div>
        
        <div className="stat-card">
          <h3>Total Patients</h3>
          <p className="stat-number">{stats.totalPatients}</p>
          <button 
            className="view-details"
            onClick={() => navigate('/manager/reports')}
          >
            View All
          </button>
        </div>
        
        <div className="stat-card">
          <h3>Revenue (This Month)</h3>
          <p className="stat-number">${stats.totalRevenue.toLocaleString()}</p>
          <button 
            className="view-details"
            onClick={() => navigate('/manager/reports')}
          >
            View Reports
          </button>
        </div>
      </div>
      
      <div className="recent-activity">
        <div className="activity-header">
          <h2>Recent Activity</h2>
          <button 
            className="refresh-activity-btn"
            onClick={fetchRecentActivity}
            disabled={activityLoading}
            title="Refresh recent activity"
          >
            {activityLoading ? '⟳' : '↻'}
          </button>
        </div>
        {activityLoading ? (
          <div className="activity-loading">
            <div className="spinner"></div>
            <p>Loading recent activity...</p>
          </div>
        ) : recentActivity.length > 0 ? (
          <div className="activity-list">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="activity-item">
                <div className="activity-icon">{activity.icon}</div>
                <div className="activity-content">
                  <h4 className="activity-title">{activity.title}</h4>
                  <p className="activity-description">{activity.description}</p>
                  <span className="activity-time">
                    {new Date(activity.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className={`activity-status status-${activity.status}`}>
                  {activity.status}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-activity">No recent activity to display.</p>
        )}
      </div>
    </div>
  );
};

export default ManagerDashboard;