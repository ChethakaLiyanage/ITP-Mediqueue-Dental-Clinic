import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ManagerDashboard.css';

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalAppointments: 0,
    pendingAppointments: 0,
    totalPatients: 0,
    revenue: 0,
  });

  // Mock data - replace with actual API calls
  useEffect(() => {
    // TODO: Replace with actual API calls
    const fetchStats = async () => {
      try {
        // Example API call:
        // const response = await axios.get('/api/manager/stats');
        // setStats(response.data);
        
        // Mock data for now
        setStats({
          totalAppointments: 124,
          pendingAppointments: 8,
          totalPatients: 89,
          revenue: 12500,
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="dashboard-container">
      <h1>Manager Dashboard</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Appointments</h3>
          <p className="stat-number">{stats.totalAppointments}</p>
          <button 
            className="view-details"
            onClick={() => navigate('/appointments')}
          >
            View All
          </button>
        </div>
        
        <div className="stat-card">
          <h3>Pending Appointments</h3>
          <p className="stat-number">{stats.pendingAppointments}</p>
          <button 
            className="view-details"
            onClick={() => navigate('/appointments?status=pending')}
          >
            Review
          </button>
        </div>
        
        <div className="stat-card">
          <h3>Total Patients</h3>
          <p className="stat-number">{stats.totalPatients}</p>
          <button 
            className="view-details"
            onClick={() => navigate('/patients')}
          >
            View All
          </button>
        </div>
        
        <div className="stat-card">
          <h3>Revenue (This Month)</h3>
          <p className="stat-number">${stats.revenue.toLocaleString()}</p>
          <button 
            className="view-details"
            onClick={() => navigate('/reports')}
          >
            View Reports
          </button>
        </div>
      </div>
      
      <div className="recent-activity">
        <h2>Recent Activity</h2>
        <p>Recent appointments, messages, or other important updates will appear here.</p>
        {/* Add actual recent activity component here */}
      </div>
    </div>
  );
};

export default ManagerDashboard;