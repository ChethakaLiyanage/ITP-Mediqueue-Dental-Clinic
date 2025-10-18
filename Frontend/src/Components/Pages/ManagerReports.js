import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../Contexts/AuthContext';
import './ManagerReports.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

const ManagerReports = () => {
  const navigate = useNavigate();
  const { token, user, isAuthenticated } = useAuth();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Dashboard Stats
  const [dashboardStats, setDashboardStats] = useState({
    totalAppointments: 0,
    pendingAppointments: 0,
    completedAppointments: 0,
    totalPatients: 0,
    totalDentists: 0,
    activeDentists: 0,
    lowStockItems: 0,
    avgRating: 0,
    totalRevenue: 0
  });
  
  // Dentist Performance
  const [dentistPerformance, setDentistPerformance] = useState([]);
  
  // Inventory Report
  const [inventoryReport, setInventoryReport] = useState({
    lowStockItems: [],
    inventoryUsage: [],
    totalInventoryValue: 0,
    totalItems: 0,
    lowStockCount: 0
  });
  
  // Patient Statistics
  const [patientStats, setPatientStats] = useState({
    totalPatients: 0,
    newPatients: 0,
    ageGroups: [],
    genderDistribution: [],
    appointmentStatus: []
  });
  
  // Financial Report
  const [financialReport, setFinancialReport] = useState({
    period: '',
    totalRevenue: 0,
    totalAppointments: 0,
    averageRevenuePerAppointment: 0,
    dailyBreakdown: []
  });

  useEffect(() => {
    if (!isAuthenticated || !token) {
      navigate('/login');
      return;
    }
    
    if (user?.role && !['Manager', 'Admin'].includes(user.role)) {
      setError('You do not have permission to view reports. Only Managers and Admins can access this page.');
      return;
    }
    
    loadDashboardStats();
  }, [token, isAuthenticated, navigate, user?.role]);

  const loadDashboardStats = async () => {
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
      setDashboardStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDentistPerformance = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE}/api/manager/reports/dentist-performance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch dentist performance data');
      }
      
      const data = await response.json();
      setDentistPerformance(data.performance || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadInventoryReport = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE}/api/manager/reports/inventory`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch inventory report');
      }
      
      const data = await response.json();
      setInventoryReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPatientStatistics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE}/api/manager/reports/patients`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch patient statistics');
      }
      
      const data = await response.json();
      setPatientStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFinancialReport = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE}/api/manager/reports/financial`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch financial report');
      }
      
      const data = await response.json();
      setFinancialReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError(null);
    
    switch (tab) {
      case 'dashboard':
        loadDashboardStats();
        break;
      case 'dentists':
        loadDentistPerformance();
        break;
      case 'inventory':
        loadInventoryReport();
        break;
      case 'patients':
        loadPatientStatistics();
        break;
      case 'financial':
        loadFinancialReport();
        break;
      default:
        break;
    }
  };

  if (!isAuthenticated || !token) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Checking authentication...</p>
      </div>
    );
  }

  if (user?.role && !['Manager', 'Admin'].includes(user.role)) {
    return (
      <div className="reports-page">
        <div className="error-container">
          <i className="fas fa-exclamation-triangle"></i>
          <h3>Access Denied</h3>
          <p>You do not have permission to view reports. Only Managers and Admins can access this page.</p>
          <button 
            className="retry-btn"
            onClick={() => navigate('/')}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-page">
      <div className="reports-header">
        <h1>Manager Reports</h1>
        <p>Comprehensive analytics and insights for clinic management</p>
      </div>

      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i>
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="reports-tabs">
        <button 
          className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleTabChange('dashboard')}
        >
          <i className="fas fa-chart-pie"></i>
          Dashboard
        </button>
        <button 
          className={`tab ${activeTab === 'dentists' ? 'active' : ''}`}
          onClick={() => handleTabChange('dentists')}
        >
          <i className="fas fa-user-md"></i>
          Dentist Performance
        </button>
        <button 
          className={`tab ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => handleTabChange('inventory')}
        >
          <i className="fas fa-boxes"></i>
          Inventory
        </button>
        <button 
          className={`tab ${activeTab === 'patients' ? 'active' : ''}`}
          onClick={() => handleTabChange('patients')}
        >
          <i className="fas fa-users"></i>
          Patients
        </button>
        <button 
          className={`tab ${activeTab === 'financial' ? 'active' : ''}`}
          onClick={() => handleTabChange('financial')}
        >
          <i className="fas fa-dollar-sign"></i>
          Financial
        </button>
      </div>

      <div className="reports-content">
        {loading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p>Loading report data...</p>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="dashboard-stats">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-calendar-check"></i>
                </div>
                <div className="stat-content">
                  <h3>Total Appointments</h3>
                  <p className="stat-number">{dashboardStats.totalAppointments}</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-clock"></i>
                </div>
                <div className="stat-content">
                  <h3>Pending Appointments</h3>
                  <p className="stat-number">{dashboardStats.pendingAppointments}</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-check-circle"></i>
                </div>
                <div className="stat-content">
                  <h3>Completed Appointments</h3>
                  <p className="stat-number">{dashboardStats.completedAppointments}</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-users"></i>
                </div>
                <div className="stat-content">
                  <h3>Total Patients</h3>
                  <p className="stat-number">{dashboardStats.totalPatients}</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-user-md"></i>
                </div>
                <div className="stat-content">
                  <h3>Active Dentists</h3>
                  <p className="stat-number">{dashboardStats.activeDentists}</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-exclamation-triangle"></i>
                </div>
                <div className="stat-content">
                  <h3>Low Stock Items</h3>
                  <p className="stat-number">{dashboardStats.lowStockItems}</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-star"></i>
                </div>
                <div className="stat-content">
                  <h3>Average Rating</h3>
                  <p className="stat-number">{dashboardStats.avgRating.toFixed(1)}/5</p>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">
                  <i className="fas fa-dollar-sign"></i>
                </div>
                <div className="stat-content">
                  <h3>Total Revenue</h3>
                  <p className="stat-number">Rs. {dashboardStats.totalRevenue.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dentists' && (
          <div className="dentist-performance">
            <h2>Dentist Performance Report</h2>
            <div className="performance-table-container">
              <table className="performance-table">
                <thead>
                  <tr>
                    <th>Dentist</th>
                    <th>Specialization</th>
                    <th>Total Patients</th>
                    <th>Completed</th>
                    <th>In Treatment</th>
                    <th>Waiting</th>
                    <th>Completion Rate</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dentistPerformance.map((dentist) => (
                    <tr key={dentist.dentistId}>
                      <td>
                        <div className="dentist-info">
                          <strong>{dentist.name}</strong>
                          <small>{dentist.dentistCode}</small>
                        </div>
                      </td>
                      <td>{dentist.specialization}</td>
                      <td>{dentist.totalPatients}</td>
                      <td>{dentist.completedPatients}</td>
                      <td>{dentist.inTreatmentPatients}</td>
                      <td>{dentist.waitingPatients}</td>
                      <td>
                        <div className="completion-rate">
                          <span className="rate-text">{dentist.completionRate}%</span>
                          <div className="rate-bar">
                            <div 
                              className="rate-fill" 
                              style={{ width: `${dentist.completionRate}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`status ${dentist.isActive ? 'active' : 'inactive'}`}>
                          {dentist.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="inventory-report">
            <h2>Inventory Report</h2>
            
            <div className="inventory-summary">
              <div className="summary-card">
                <h3>Total Items</h3>
                <p>{inventoryReport.totalItems}</p>
              </div>
              <div className="summary-card">
                <h3>Low Stock Items</h3>
                <p className="warning">{inventoryReport.lowStockCount}</p>
              </div>
              <div className="summary-card">
                <h3>Total Value</h3>
                <p>Rs. {inventoryReport.totalInventoryValue.toLocaleString()}</p>
              </div>
            </div>

            <div className="inventory-sections">
              <div className="low-stock-section">
                <h3>Low Stock Items</h3>
                <div className="low-stock-table-container">
                  <table className="low-stock-table">
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th>SKU</th>
                        <th>Current Stock</th>
                        <th>Threshold</th>
                        <th>Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryReport.lowStockItems.map((item) => (
                        <tr key={item._id}>
                          <td>{item.name}</td>
                          <td>{item.sku}</td>
                          <td className="low-stock">{item.quantity}</td>
                          <td>{item.lowStockThreshold}</td>
                          <td>{item.category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="usage-section">
                <h3>Inventory Usage</h3>
                <div className="usage-table-container">
                  <table className="usage-table">
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th>SKU</th>
                        <th>Current Stock</th>
                        <th>Total Requested</th>
                        <th>Total Approved</th>
                        <th>Total Rejected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryReport.inventoryUsage.map((item, index) => (
                        <tr key={index}>
                          <td>{item.itemName}</td>
                          <td>{item.itemSku}</td>
                          <td>{item.currentStock}</td>
                          <td>{item.totalRequested}</td>
                          <td className="approved">{item.totalApproved}</td>
                          <td className="rejected">{item.totalRejected}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'patients' && (
          <div className="patient-statistics">
            <h2>Patient Statistics</h2>
            
            <div className="patient-summary">
              <div className="summary-card">
                <h3>Total Patients</h3>
                <p>{patientStats.totalPatients}</p>
              </div>
              <div className="summary-card">
                <h3>New Patients (30 days)</h3>
                <p>{patientStats.newPatients}</p>
              </div>
            </div>

            <div className="patient-charts">
              <div className="chart-section">
                <h3>Age Group Distribution</h3>
                <div className="age-groups">
                  {patientStats.ageGroups.map((group) => (
                    <div key={group._id} className="age-group-item">
                      <span className="age-label">{group._id}</span>
                      <div className="age-bar">
                        <div 
                          className="age-fill" 
                          style={{ 
                            width: `${(group.count / patientStats.totalPatients) * 100}%` 
                          }}
                        ></div>
                      </div>
                      <span className="age-count">{group.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="chart-section">
                <h3>Gender Distribution</h3>
                <div className="gender-distribution">
                  {patientStats.genderDistribution.map((gender) => (
                    <div key={gender._id} className="gender-item">
                      <span className="gender-label">{gender._id || 'Not Specified'}</span>
                      <span className="gender-count">{gender.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="financial-report">
            <h2>Financial Report</h2>
            
            <div className="financial-summary">
              <div className="summary-card">
                <h3>Total Revenue</h3>
                <p>Rs. {financialReport.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="summary-card">
                <h3>Total Appointments</h3>
                <p>{financialReport.totalAppointments}</p>
              </div>
              <div className="summary-card">
                <h3>Average per Appointment</h3>
                <p>Rs. {financialReport.averageRevenuePerAppointment.toLocaleString()}</p>
              </div>
            </div>

            <div className="revenue-breakdown">
              <h3>Daily Revenue Breakdown</h3>
              <div className="revenue-table-container">
                <table className="revenue-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Appointments</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialReport.dailyBreakdown.map((day, index) => (
                      <tr key={index}>
                        <td>{`${day._id.day}/${day._id.month}/${day._id.year}`}</td>
                        <td>{day.appointmentCount}</td>
                        <td>Rs. {day.dailyRevenue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerReports;
