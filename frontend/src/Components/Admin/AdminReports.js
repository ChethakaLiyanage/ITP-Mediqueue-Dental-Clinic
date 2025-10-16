import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminReports.css';

const AdminReports = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    staff: { total: 0, dentists: 0, receptionists: 0, managers: 0, admins: 0 },
    patients: { total: 0, totalRegistered: 0, totalUnregistered: 0, newThisPeriod: 0 },
    appointments: { total: 0, pending: 0, confirmed: 0, completed: 0 },
    activities: { clinicEvents: 0, inquiries: 0 },
    trends: []
  });
  const [reportData, setReportData] = useState({ 
    summary: { 
      total: 0,
      active: 0,
      inactive: 0,
      byStatus: {
        pending: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0
      }
    }, 
    staff: [], 
    patients: [], 
    appointments: [], 
    activities: [] 
  });
  const [filters, setFilters] = useState({
    period: '30',
    role: 'all',
    status: 'all',
    patientType: 'all',
    format: 'json'
  });

  // Get auth token
  const getAuthToken = () => {
    try {
      const auth = JSON.parse(localStorage.getItem('auth') || '{}');
      return auth.token;
    } catch {
      return null;
    }
  };

  // Fetch dashboard statistics
  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

      const response = await axios.get(
        `http://localhost:5000/admin/reports/dashboard-stats?period=${filters.period}`,
        config
      );

      if (response.data.success) {
        setDashboardStats(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      alert('Failed to fetch dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  // Fetch specific report data
  const fetchReportData = async (reportType) => {
    try {
      setLoading(true);
      const token = getAuthToken();
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

      let url = `http://localhost:5000/admin/reports/${reportType}`;
      const params = new URLSearchParams();
      
      // Add relevant filters based on report type
      if (reportType === 'staff') {
        if (filters.role !== 'all') params.append('role', filters.role);
        if (filters.status !== 'all') params.append('status', filters.status);
      } else if (reportType === 'patients') {
        if (filters.patientType !== 'all') params.append('patientType', filters.patientType);
        params.append('period', filters.period);
      } else if (reportType === 'appointments') {
        if (filters.status !== 'all') params.append('status', filters.status);
        params.append('period', filters.period);
      } else if (reportType === 'activities') {
        params.append('period', filters.period);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await axios.get(url, config);

      if (response.data.success) {
        setReportData(response.data.data);
      }
    } catch (error) {
      console.error(`Error fetching ${reportType} report:`, error);
      alert(`Failed to fetch ${reportType} report`);
    } finally {
      setLoading(false);
    }
  };

  // Download report as CSV
  const downloadReport = async (reportType) => {
    try {
      const token = getAuthToken();
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

      let url = `http://localhost:5000/admin/reports/${reportType}`;
      const params = new URLSearchParams();
      params.append('format', 'csv');
      
      // Add relevant filters
      if (reportType === 'staff') {
        if (filters.role !== 'all') params.append('role', filters.role);
        if (filters.status !== 'all') params.append('status', filters.status);
      } else if (reportType === 'patients') {
        if (filters.patientType !== 'all') params.append('patientType', filters.patientType);
        params.append('period', filters.period);
      } else if (reportType === 'appointments') {
        if (filters.status !== 'all') params.append('status', filters.status);
        params.append('period', filters.period);
      } else if (reportType === 'activities') {
        params.append('period', filters.period);
      }

      url += `?${params.toString()}`;

      const response = await axios.get(url, { 
        ...config, 
        responseType: 'blob' 
      });

      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error(`Error downloading ${reportType} report:`, error);
      alert(`Failed to download ${reportType} report`);
    }
  };

  // Load dashboard stats on component mount
  useEffect(() => {
    fetchDashboardStats();
  }, [filters.period]);

  // Load report data when tab changes
  useEffect(() => {
    if (activeTab !== 'dashboard') {
      fetchReportData(activeTab);
    }
  }, [activeTab, filters]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatNumber = (num) => {
    return num?.toLocaleString() || '0';
  };

  return (
    <div className="admin-reports">
      <div className="reports-header">
        <h1>Reports & Analytics</h1>
        <div className="period-selector">
          <label>Period:</label>
          <select 
            value={filters.period} 
            onChange={(e) => setFilters({...filters, period: e.target.value})}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="reports-tabs">
        <button 
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>
        <button 
          className={`tab-btn ${activeTab === 'staff' ? 'active' : ''}`}
          onClick={() => setActiveTab('staff')}
        >
          👥 Staff Report
        </button>
        <button 
          className={`tab-btn ${activeTab === 'patients' ? 'active' : ''}`}
          onClick={() => setActiveTab('patients')}
        >
          🏥 Patient Report
        </button>
        <button 
          className={`tab-btn ${activeTab === 'appointments' ? 'active' : ''}`}
          onClick={() => setActiveTab('appointments')}
        >
          📅 Appointments
        </button>
        <button 
          className={`tab-btn ${activeTab === 'activities' ? 'active' : ''}`}
          onClick={() => setActiveTab('activities')}
        >
          📋 Activities
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading report data...</p>
        </div>
      )}

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && dashboardStats && !loading && (
        <div className="dashboard-content">
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Staff Overview</h3>
              <div className="stat-number">{formatNumber(dashboardStats?.staff?.total || 0)}</div>
              <div className="stat-breakdown">
                <div>Dentists: {dashboardStats?.staff?.dentists || 0}</div>
                <div>Receptionists: {dashboardStats?.staff?.receptionists || 0}</div>
                <div>Managers: {dashboardStats?.staff?.managers || 0}</div>
                <div>Admins: {dashboardStats?.staff?.admins || 0}</div>
              </div>
            </div>

            <div className="stat-card">
              <h3>Patients</h3>
              <div className="stat-number">{formatNumber(dashboardStats?.patients?.total || 0)}</div>
              <div className="stat-breakdown">
                <div>Registered: {dashboardStats?.patients?.totalRegistered || 0}</div>
                <div>Unregistered: {dashboardStats?.patients?.totalUnregistered || 0}</div>
                <div>New this period: {dashboardStats?.patients?.newThisPeriod || 0}</div>
              </div>
            </div>

            <div className="stat-card">
              <h3>Appointments</h3>
              <div className="stat-number">{formatNumber(dashboardStats?.appointments?.total || 0)}</div>
              <div className="stat-breakdown">
                <div>Pending: {dashboardStats?.appointments?.pending || 0}</div>
                <div>Confirmed: {dashboardStats?.appointments?.confirmed || 0}</div>
                <div>Completed: {dashboardStats?.appointments?.completed || 0}</div>
              </div>
            </div>

            <div className="stat-card">
              <h3>Activities</h3>
              <div className="stat-number">{formatNumber((dashboardStats?.activities?.clinicEvents || 0) + (dashboardStats?.activities?.inquiries || 0))}</div>
              <div className="stat-breakdown">
                <div>Clinic Events: {dashboardStats?.activities?.clinicEvents || 0}</div>
                <div>Inquiries: {dashboardStats?.activities?.inquiries || 0}</div>
              </div>
            </div>
          </div>

          {/* Activity Trends Chart */}
          <div className="trends-section">
            <h3>Activity Trends (Last 7 Days)</h3>
            <div className="trends-chart">
              {(dashboardStats?.trends || []).length > 0 ? (
                (dashboardStats?.trends || []).map((day, index) => (
                  <div key={index} className="trend-day">
                    <div className="trend-date">{day?.date ? new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }) : 'N/A'}</div>
                    <div className="trend-bars">
                      <div className="trend-bar appointments" style={{height: `${Math.max((day?.appointments || 0) * 10, 5)}px`}} title={`${day?.appointments || 0} appointments`}></div>
                      <div className="trend-bar patients" style={{height: `${Math.max((day?.patients || 0) * 10, 5)}px`}} title={`${day?.patients || 0} patients`}></div>
                      <div className="trend-bar inquiries" style={{height: `${Math.max((day?.inquiries || 0) * 10, 5)}px`}} title={`${day?.inquiries || 0} inquiries`}></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-trends">No trend data available</div>
              )}
            </div>
            <div className="trends-legend">
              <span className="legend-item"><span className="legend-color appointments"></span> Appointments</span>
              <span className="legend-item"><span className="legend-color patients"></span> Patients</span>
              <span className="legend-item"><span className="legend-color inquiries"></span> Inquiries</span>
            </div>
          </div>
        </div>
      )}

      {/* Staff Report Tab */}
      {activeTab === 'staff' && (
        <div className="report-content">
          <div className="report-filters">
            <div className="filter-group">
              <label>Role:</label>
              <select 
                value={filters.role} 
                onChange={(e) => setFilters({...filters, role: e.target.value})}
              >
                <option value="all">All Roles</option>
                <option value="Dentist">Dentist</option>
                <option value="Manager">Manager</option>
                <option value="Receptionist">Receptionist</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Status:</label>
              <select 
                value={filters.status} 
                onChange={(e) => setFilters({...filters, status: e.target.value})}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <button 
              className="download-btn"
              onClick={() => downloadReport('staff')}
            >
              📥 Download CSV
            </button>
          </div>

          {reportData && !loading && (
            <>
              <div className="report-summary">
                <div className="summary-item">
                  <span className="summary-label">Total Staff:</span>
                  <span className="summary-value">{reportData.summary.total}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Active:</span>
                  <span className="summary-value">{reportData.summary.active}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Inactive:</span>
                  <span className="summary-value">{reportData.summary.inactive}</span>
                </div>
              </div>

              <div className="report-table-container">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Contact</th>
                      <th>Status</th>
                      <th>Join Date</th>
                      <th>Role Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData?.staff || []).length > 0 ? (
                      (reportData?.staff || []).map((staff, index) => (
                        <tr key={index}>
                          <td>{staff.name || 'N/A'}</td>
                          <td>{staff.email || 'N/A'}</td>
                          <td>
                            <span className={`role-badge ${staff?.role?.toLowerCase() || 'unknown'}`}>
                              {staff.role || 'N/A'}
                            </span>
                          </td>
                          <td>{staff.contact_no || 'N/A'}</td>
                          <td>
                            <span className={`status-badge ${staff.isActive ? 'active' : 'inactive'}`}>
                              {staff.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>{staff.createdAt ? formatDate(staff.createdAt) : 'N/A'}</td>
                          <td>{staff.roleData?.dentistCode || staff.roleData?.managerCode || staff.roleData?.receptionistCode || staff.roleData?.adminCode || 'N/A'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="no-data">No staff data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Patient Report Tab */}
      {activeTab === 'patients' && (
        <div className="report-content">
          <div className="report-filters">
            <div className="filter-group">
              <label>Patient Type:</label>
              <select 
                value={filters.patientType} 
                onChange={(e) => setFilters({...filters, patientType: e.target.value})}
              >
                <option value="all">All Patients</option>
                <option value="registered">Registered</option>
                <option value="unregistered">Unregistered</option>
              </select>
            </div>
            <button 
              className="download-btn"
              onClick={() => downloadReport('patients')}
            >
              📥 Download CSV
            </button>
          </div>

          {reportData && !loading && (
            <>
              <div className="report-summary">
                <div className="summary-item">
                  <span className="summary-label">Total Patients:</span>
                  <span className="summary-value">{reportData.summary.total}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Registered:</span>
                  <span className="summary-value">{reportData.summary.registered}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Unregistered:</span>
                  <span className="summary-value">{reportData.summary.unregistered}</span>
                </div>
              </div>

              <div className="report-table-container">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Patient Code</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Contact</th>
                      <th>Age</th>
                      <th>Gender</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Registered Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData?.patients || []).length > 0 ? (
                      (reportData?.patients || []).map((patient, index) => (
                        <tr key={index}>
                          <td>{patient.patientCode}</td>
                          <td>{patient.name}</td>
                          <td>{patient.email}</td>
                          <td>{patient.contact}</td>
                          <td>{patient.age}</td>
                          <td>{patient.gender}</td>
                          <td>
                            <span className={`type-badge ${patient.type.toLowerCase()}`}>
                              {patient.type}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${patient.status.toLowerCase()}`}>
                              {patient.status}
                            </span>
                          </td>
                          <td>{formatDate(patient.registeredDate)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="9" className="no-data">No patient data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Appointment Report Tab */}
      {activeTab === 'appointments' && (
        <div className="report-content">
          <div className="report-filters">
            <div className="filter-group">
              <label>Status:</label>
              <select 
                value={filters.status} 
                onChange={(e) => setFilters({...filters, status: e.target.value})}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <button 
              className="download-btn"
              onClick={() => downloadReport('appointments')}
            >
              📥 Download CSV
            </button>
          </div>

          {reportData && !loading && (
            <>
              <div className="report-summary">
                <div className="summary-item">
                  <span className="summary-label">Total Appointments:</span>
                  <span className="summary-value">{reportData?.summary?.total || 0}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Pending:</span>
                  <span className="summary-value">{reportData?.summary?.byStatus?.pending || 0}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Confirmed:</span>
                  <span className="summary-value">{reportData?.summary?.byStatus?.confirmed || 0}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Completed:</span>
                  <span className="summary-value">{reportData?.summary?.byStatus?.completed || 0}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Cancelled:</span>
                  <span className="summary-value">{reportData?.summary?.byStatus?.cancelled || 0}</span>
                </div>
              </div>

              <div className="report-table-container">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Dentist</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Status</th>
                      <th>Reason</th>
                      <th>Created By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData?.appointments || []).length > 0 ? (
                      reportData.appointments.map((appointment, index) => (
                        <tr key={index}>
                          <td>{appointment.patientName || 'N/A'}</td>
                          <td>{appointment.dentistName || 'N/A'}</td>
                          <td>{appointment.appointmentDate ? formatDate(appointment.appointmentDate) : 'N/A'}</td>
                          <td>{appointment.timeSlot || 'N/A'}</td>
                          <td>
                            <span className={`status-badge ${appointment.status?.toLowerCase() || 'unknown'}`}>
                              {appointment.status || 'N/A'}
                            </span>
                          </td>
                          <td>{appointment.reason || 'N/A'}</td>
                          <td>{appointment.createdAt ? formatDate(appointment.createdAt) : 'N/A'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="no-data">No appointments found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Activities Report Tab */}
      {activeTab === 'activities' && (
        <div className="report-content">
          <div className="report-filters">
            <button 
              className="download-btn"
              onClick={() => downloadReport('activities')}
            >
              📥 Download CSV
            </button>
          </div>

          {reportData && !loading && (
            <>
              <div className="report-summary">
                <div className="summary-item">
                  <span className="summary-label">Total Activities:</span>
                  <span className="summary-value">{reportData.summary.total}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Clinic Events:</span>
                  <span className="summary-value">{reportData.summary.clinicEvents}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Inquiries:</span>
                  <span className="summary-value">{reportData.summary.inquiries}</span>
                </div>
              </div>

              <div className="report-table-container">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Title</th>
                      <th>Description</th>
                      <th>Created By</th>
                      <th>Created Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.activities.map((activity, index) => (
                      <tr key={index}>
                        <td>
                          <span className={`type-badge ${activity.type.toLowerCase().replace(' ', '-')}`}>
                            {activity.type}
                          </span>
                        </td>
                        <td>{activity.title}</td>
                        <td className="description-cell">{activity.description}</td>
                        <td>{activity.createdBy}</td>
                        <td>{formatDate(activity.createdDate)}</td>
                        <td>
                          <span className={`status-badge ${activity.status.toLowerCase()}`}>
                            {activity.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminReports;
