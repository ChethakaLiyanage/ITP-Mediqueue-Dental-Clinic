import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DentistNav from "../Nav/DentistNav";
import DashboardMetrics from './DashboardMetrics';
import { useAuth } from '../../Contexts/AuthContext';
import "./Dentistdashboard.css";

function DentistDashboard() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Redirect if not authenticated or not a dentist
  useEffect(() => {
    if (!loading && (!user || user.role !== 'Dentist')) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

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
  if (!user || user.role !== 'Dentist') {
    return null;
  }

  return (
    <div className="dentist-dashboard">
      <DentistNav />
      <main className="dashboard-main">
        <div className="dashboard-header">
          <h1 className="dashboard-title">
            Welcome back, Dr. {user.name || 'Dentist'}
          </h1>
          <p className="dashboard-subtitle">
            Here's your daily overview and patient queue
          </p>
        </div>
        <DashboardMetrics />
      </main>
    </div>
  );
}

export default DentistDashboard;