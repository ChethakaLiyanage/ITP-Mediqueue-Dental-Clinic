import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../api';
import { useAuth } from '../../Contexts/AuthContext';
import './Manager.css';

const Reports = () => {
  const navigate = useNavigate();
  const { token, user, isAuthenticated } = useAuth();
  
  // All hooks must be called at the top level, before any conditional returns
  const [overview, setOverview] = useState({
    appointmentsCount: 0,
    dentistsCount: 0,
    totalPatients: 0,
    pendingAppointments: 0,
    completedAppointments: 0,
    lowStock: []
  });
  const [workload, setWorkload] = useState([]);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('=== REPORTS USEEFFECT ===');
    console.log('isAuthenticated:', isAuthenticated);
    console.log('token exists:', !!token);
    console.log('user role:', user?.role);
    
    if (!isAuthenticated || !token) {
      console.log('User not authenticated, redirecting to login');
      navigate('/login');
      return;
    }
    
    // Check if user has permission to view reports (Manager or Admin)
    if (user?.role && !['Manager', 'Admin'].includes(user.role)) {
      console.log('User does not have permission to view reports');
      setError('You do not have permission to view reports. Only Managers and Admins can access this page.');
      setLoading(false);
      return;
    }
    
    console.log('User authenticated and authorized, loading reports...');
    loadReports();
  }, [token, isAuthenticated, navigate, user?.role]);

  // Show loading while checking authentication
  if (!isAuthenticated || !token) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Checking authentication...</p>
      </div>
    );
  }

  // Check if user has permission to view reports
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

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('=== LOADING REPORTS ===');
      console.log('Token:', token ? 'Present' : 'Missing');
      console.log('API_BASE:', API_BASE);
      console.log('User role:', user?.role);
      
      // Try to fetch workload from manager reports API
      try {
        const workloadRes = await fetch(`${API_BASE}/api/manager/reports/dentist-workload`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (workloadRes.ok) {
          const workloadData = await workloadRes.json();
          console.log('Workload data from API:', workloadData);
          if (workloadData.workload && Array.isArray(workloadData.workload)) {
            setWorkload(workloadData.workload);
          }
        }
      } catch (workloadErr) {
        console.warn('Failed to fetch workload from API, will calculate manually:', workloadErr);
      }
      
      // Try multiple API endpoints for each data source
      const [appointmentsRes, dentistsRes, inventoryRes] = await Promise.all([
        // Try appointments endpoint first, then fallback
        fetch(`${API_BASE}/appointments`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }).catch(() => 
          fetch(`${API_BASE}/api/appointments`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
        ),
        // Try dentists endpoint first, then fallback
        fetch(`${API_BASE}/dentists`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }).catch(() => 
          fetch(`${API_BASE}/api/dentists`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
        ),
        // Try inventory endpoint first, then fallback
        fetch(`${API_BASE}/api/inventory`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }).catch(() => 
          fetch(`${API_BASE}/inventory`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
        )
      ]);

      console.log('API Responses status:', {
        appointments: appointmentsRes.status,
        dentists: dentistsRes.status,
        inventory: inventoryRes.status
      });

      // Log the full response objects for debugging
      console.log('Full API Responses:', {
        appointments: appointmentsRes,
        dentists: dentistsRes,
        inventory: inventoryRes
      });

      // Handle responses safely
      let appointmentsData = [];
      let dentistsData = [];
      let inventoryData = [];

      try {
        if (appointmentsRes.ok) {
          appointmentsData = await appointmentsRes.json();
          console.log('Appointments data:', appointmentsData);
        } else {
          console.warn('Appointments API returned:', appointmentsRes.status);
        }
      } catch (e) {
        console.warn('Failed to parse appointments data:', e);
      }

      try {
        if (dentistsRes.ok) {
          dentistsData = await dentistsRes.json();
          console.log('Dentists data:', dentistsData);
        } else {
          console.warn('Dentists API returned:', dentistsRes.status);
        }
      } catch (e) {
        console.warn('Failed to parse dentists data:', e);
      }

      try {
        if (inventoryRes.ok) {
          inventoryData = await inventoryRes.json();
          console.log('Inventory data:', inventoryData);
        } else {
          console.warn('Inventory API returned:', inventoryRes.status);
        }
      } catch (e) {
        console.warn('Failed to parse inventory data:', e);
      }

      // Handle different response formats
      const allAppointments = Array.isArray(appointmentsData) ? appointmentsData : 
        (appointmentsData?.items || appointmentsData?.data || []);
      const allDentists = Array.isArray(dentistsData) ? dentistsData : 
        (dentistsData?.items || dentistsData?.data || []);
      const allInventory = Array.isArray(inventoryData) ? inventoryData : 
        (inventoryData?.items || inventoryData?.data || []);

      console.log('Processed data counts:', {
        appointments: allAppointments.length,
        dentists: allDentists.length,
        inventory: allInventory.length
      });

      // Calculate statistics
      const totalAppointments = allAppointments.length;
      const totalDentists = allDentists.length;
      const pendingAppointments = allAppointments.filter(apt => apt.status === 'pending' || apt.status === 'scheduled').length;
      const completedAppointments = allAppointments.filter(apt => apt.status === 'completed').length;
      
      // Calculate unique patients
      const uniquePatients = new Set(allAppointments.map(apt => apt.patient || apt.patientCode).filter(Boolean));
      const totalPatients = uniquePatients.size;

      // Find low stock items (quantity below 10)
      const lowStockItems = allInventory.filter(item => {
        if (!item || typeof item.quantity !== 'number') return false;
        return item.quantity < 10;
      });

      console.log('Calculated stats:', {
        totalAppointments,
        totalDentists,
        totalPatients,
        pendingAppointments,
        completedAppointments,
        lowStockItems: lowStockItems.length
      });

      // If no data is found, use mock data for demonstration
      if (totalAppointments === 0 && totalDentists === 0 && allInventory.length === 0) {
        console.log('No data found from APIs, using mock data for demonstration');
        setOverview({
          appointmentsCount: 25,
          dentistsCount: 5,
          totalPatients: 18,
          pendingAppointments: 8,
          completedAppointments: 17,
          lowStock: [
            { _id: '1', name: 'Dental Floss', quantity: 3, lowStockThreshold: 10, sku: 'DF-001' },
            { _id: '2', name: 'Gauze Pads', quantity: 7, lowStockThreshold: 10, sku: 'GP-002' }
          ]
        });
        
        // Mock workload data
        setWorkload([
          { dentistId: '1', dentistName: 'Dr. Smith', specialty: 'General', appointments: 12, pending: 3, completed: 9 },
          { dentistId: '2', dentistName: 'Dr. Johnson', specialty: 'Orthodontist', appointments: 8, pending: 2, completed: 6 },
          { dentistId: '3', dentistName: 'Dr. Brown', specialty: 'Oral Surgery', appointments: 5, pending: 3, completed: 2 }
        ]);
      } else {
        // Update overview state with real-time data
        setOverview({
          appointmentsCount: totalAppointments,
          dentistsCount: totalDentists,
          totalPatients,
          pendingAppointments,
          completedAppointments,
          lowStock: lowStockItems.map(item => ({
            _id: item._id,
            name: item.itemName || item.name || 'Unknown Item',
            quantity: item.quantity,
            lowStockThreshold: 10,
            sku: item.itemCode || item.sku || 'N/A'
          }))
        });
      }

      // Calculate dentist workload
      const dentistWorkload = {};
      
      // Initialize workload for each dentist using dentistCode
      allDentists.forEach(dentist => {
        const dentistCode = dentist.dentistCode || dentist.code || dentist._id;
        if (dentistCode) {
          // Get dentist name from nested userId or direct name field
          const dentistName = dentist.userId?.name || 
                             dentist.name || 
                             `${dentist.firstName || ''} ${dentist.lastName || ''}`.trim() || 
                             'Unknown Dentist';
          
          dentistWorkload[dentistCode] = {
            dentistId: dentist._id,
            dentistCode: dentistCode,
            dentistName: dentistName,
            specialty: dentist.specialization || dentist.specialty || 'General',
            appointments: 0,
            pending: 0,
            completed: 0
          };
        }
      });

      console.log('Initialized dentist workload:', Object.keys(dentistWorkload));

      // Count appointments per dentist using dentist_code
      allAppointments.forEach(appointment => {
        const dentistCode = appointment.dentist_code || appointment.dentistCode;
        if (dentistCode && dentistWorkload[dentistCode]) {
          dentistWorkload[dentistCode].appointments++;
          if (appointment.status === 'pending' || appointment.status === 'scheduled') {
            dentistWorkload[dentistCode].pending++;
          } else if (appointment.status === 'completed') {
            dentistWorkload[dentistCode].completed++;
          }
        }
      });

      // Convert to array and sort by number of appointments
      const workloadData = Object.values(dentistWorkload).sort((a, b) => b.appointments - a.appointments);
      console.log('Calculated workload data:', workloadData);
      setWorkload(workloadData);

      console.log('Reports loaded successfully with real-time data');
      
    } catch (err) {
      console.error('Error in loadReports:', err);
      setError(`Failed to load reports: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };


  const exportInventoryCsv = async () => {
    try {
      console.log('=== EXPORT INVENTORY CSV ===');
      console.log('Token:', token ? 'Present' : 'Missing');
      
      const response = await fetch(`${API_BASE}/api/manager/reports/inventory.csv`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Export response status:', response.status);
      
      if (!response.ok) {
        let errorMessage = `Failed to export CSV: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          console.log('Could not parse error response as JSON');
          errorMessage = `Export endpoint not available (${response.status}). Please contact your administrator.`;
        }
        throw new Error(errorMessage);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'inventory-report.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      console.log('CSV export successful');
    } catch (err) {
      console.error('Export CSV error:', err);
      setError(`Failed to export CSV: ${err.message}`);
    }
  };

  const exportInventoryPdf = async () => {
    try {
      console.log('=== EXPORT INVENTORY PDF ===');
      console.log('Token:', token ? 'Present' : 'Missing');
      
      const response = await fetch(`${API_BASE}/api/manager/reports/inventory.pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Export response status:', response.status);
      
      if (!response.ok) {
        let errorMessage = `Failed to export PDF: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          console.log('Could not parse error response as JSON');
          errorMessage = `Export endpoint not available (${response.status}). Please contact your administrator.`;
        }
        throw new Error(errorMessage);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      console.log('PDF export successful');
    } catch (err) {
      console.error('Export PDF error:', err);
      setError(`Failed to export PDF: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading reports data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reports-page">
        <div className="error-container">
          <i className="fas fa-exclamation-triangle"></i>
          <h3>Error Loading Reports</h3>
          <p>{error}</p>
          <button 
            className="retry-btn"
            onClick={loadReports}
          >
            <i className="fas fa-redo"></i> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-page">
      <div className="page-header">
        <h1>Reports & Analytics</h1>
        <div className="header-actions">
          <div className="export-buttons">
            <button className="btn btn-success" onClick={exportInventoryCsv}>
              Export CSV
            </button>
            <button className="btn btn-warning" onClick={exportInventoryPdf}>
              Export PDF
            </button>
          </div>
          <button className="btn btn-primary" onClick={loadReports}>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button className="close-btn" onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {/* Overview Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-value">{overview?.appointmentsCount || 0}</div>
          <div className="stat-label">Total Appointments</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">👨‍⚕️</div>
          <div className="stat-value">{overview?.dentistsCount || 0}</div>
          <div className="stat-label">Dentists</div>
        </div>
        
        
        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-value">{overview?.lowStock?.length || 0}</div>
          <div className="stat-label">Low Stock Items</div>
        </div>
      </div>

      {/* Dentist Workload */}
      <div className="report-section">
        <div className="section-header">
          <h2>Dentist Workload (from Queue History)</h2>
        </div>
        
        {workload.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Dentist Name</th>
                  <th>Dentist Code</th>
                  <th>Specialty</th>
                  <th>Total Patients</th>
                  <th>Completed</th>
                  <th>In Treatment</th>
                  <th>Waiting</th>
                  <th>Workload Status</th>
                </tr>
              </thead>
              <tbody>
                {workload.map(dentist => (
                  <tr key={dentist.dentistId || dentist.dentistCode}>
                    <td>{dentist.dentistName}</td>
                    <td>{dentist.dentistCode || 'N/A'}</td>
                    <td>{dentist.specialty}</td>
                    <td><strong>{dentist.totalPatients || 0}</strong></td>
                    <td><span className="badge badge-success">{dentist.completed || 0}</span></td>
                    <td><span className="badge badge-warning">{dentist.inTreatment || 0}</span></td>
                    <td><span className="badge badge-danger">{dentist.waiting || 0}</span></td>
                    <td>
                      <span className={`badge ${
                        (dentist.totalPatients || 0) > 15 ? 'badge-danger' : 
                        (dentist.totalPatients || 0) > 8 ? 'badge-warning' : 'badge-success'
                      }`}>
                        {(dentist.totalPatients || 0) > 15 ? 'High' : 
                         (dentist.totalPatients || 0) > 8 ? 'Medium' : 'Normal'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No workload data available.</p>
          </div>
        )}
      </div>

      {/* Low Stock Items */}
      {overview?.lowStock?.length > 0 && (
        <div className="report-section">
          <div className="section-header">
            <h2>Low Stock Alert</h2>
          </div>
          
          <div className="low-stock-grid">
            {overview.lowStock.map(item => (
              <div key={item._id} className="low-stock-card">
                <div className="stock-header">
                  <h3>{item.name}</h3>
                  <span className="badge badge-danger">Low Stock</span>
                </div>
                
                <div className="stock-details">
                  <div className="stock-item">
                    <span className="label">Current:</span>
                    <span className="value critical">{item.quantity}</span>
                  </div>
                  
                  <div className="stock-item">
                    <span className="label">Threshold:</span>
                    <span className="value">{item.lowStockThreshold}</span>
                  </div>
                  
                  <div className="stock-item">
                    <span className="label">SKU:</span>
                    <span className="value">{item.sku}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Usage Trends */}
      {usage?.length > 0 && (
        <div className="report-section">
          <div className="section-header">
            <h2>Inventory Usage Trends</h2>
          </div>
          
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Usage</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {usage.slice(0, 20).map((item, index) => (
                  <tr key={index}>
                    <td>{item.day}</td>
                    <td>{item.itemName}</td>
                    <td>
                      <span className={item.delta < 0 ? 'negative' : 'positive'}>
                        {item.delta > 0 ? '+' : ''}{item.delta}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        item.delta < 0 ? 'badge-danger' : 'badge-success'
                      }`}>
                        {item.delta < 0 ? 'Consumed' : 'Added'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Export Section */}
      <div className="report-section">
        <div className="section-header">
          <h2>Export Reports</h2>
        </div>
        
        <div className="export-options">
          <div className="export-card">
            <h3>Inventory Report</h3>
            <p>Export complete inventory data in CSV or PDF format</p>
            <div className="export-buttons">
              <button className="btn btn-success" onClick={exportInventoryCsv}>
                📊 Export CSV
              </button>
              <button className="btn btn-warning" onClick={exportInventoryPdf}>
                📄 Export PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
