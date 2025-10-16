import React, { useState, useEffect } from 'react';
import { reportsService } from '../../services/apiService';
import './Manager.css';

const Reports = () => {
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
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch all necessary data
        const [appointmentsRes, dentistsRes, inventoryRes] = await Promise.all([
          fetch('/api/appointments'),
          fetch('/api/dentists'),
          fetch('/api/inventory/items')
        ]);

        const [allAppointments, allDentists, allInventory] = await Promise.all([
          appointmentsRes.json(),
          dentistsRes.json(),
          inventoryRes.json()
        ]);

        // Calculate workload from appointments
        const dentistWorkload = {};
        
        // Initialize workload for each dentist
        allDentists.forEach(dentist => {
          dentistWorkload[dentist._id] = {
            dentistId: dentist._id,
            dentistName: `${dentist.firstName || ''} ${dentist.lastName || ''}`.trim() || 'Unknown Dentist',
            specialty: dentist.specialization || 'General',
            appointments: 0,
            pending: 0,
            completed: 0
          };
        });

        // Count appointments per dentist
        allAppointments.forEach(appointment => {
          const dentistId = appointment.dentist;
          if (dentistWorkload[dentistId]) {
            dentistWorkload[dentistId].appointments++;
            if (appointment.status === 'pending') {
              dentistWorkload[dentistId].pending++;
            } else if (appointment.status === 'completed') {
              dentistWorkload[dentistId].completed++;
            }
          }
        });

        // Convert to array and sort by number of appointments
        const workloadData = Object.values(dentistWorkload).sort((a, b) => b.appointments - a.appointments);

        // Calculate total patients (unique patients with appointments)
        const uniquePatients = new Set(allAppointments.map(a => a.patient));
        const totalPatients = uniquePatients.size;
        
        // Get pending and completed appointments
        const pendingAppointments = allAppointments.filter(a => a.status === 'pending').length;
        const completedAppointments = allAppointments.filter(a => a.status === 'completed').length;

        // Get low stock items
        const lowStockItems = allInventory.filter(item => 
          item.quantity <= (item.lowStockThreshold || 10)
        );
        
        setOverview({
          appointmentsCount: allAppointments.length,
          dentistsCount: allDentists.length,
          totalPatients,
          pendingAppointments,
          completedAppointments,
          lowStock: lowStockItems.map(item => ({
            _id: item._id,
            name: item.itemName,
            quantity: item.quantity,
            lowStockThreshold: item.lowStockThreshold || 10,
            sku: item.itemCode || 'N/A'
          }))
        });
        
        setWorkload(workloadData);
      } catch (apiErr) {
        console.error('API Error:', apiErr);
        setError('Failed to load report data. Please try again later.');
      }
    } catch (err) {
      setError('Failed to load reports. Using sample data instead.');
      console.error('Error in loadReports:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportInventoryCsv = async () => {
    try {
      const response = await reportsService.exportInventoryCsv();
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'inventory-report.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to export CSV. Please try again.');
      console.error('Export CSV error:', err);
      
      // Fallback to direct download if the service fails
      try {
        window.open('/api/reports/export/inventory.csv', '_blank');
      } catch (fallbackErr) {
        console.error('Fallback export failed:', fallbackErr);
      }
    }
  };

  const exportInventoryPdf = async () => {
    try {
      const response = await reportsService.exportInventoryPdf();
      const url = window.URL.createObjectURL(new Blob([response], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (err) {
      setError('Failed to export PDF. Please try again.');
      console.error('Export PDF error:', err);
      
      // Fallback to direct download if the service fails
      try {
        window.open('/api/reports/export/inventory.pdf', '_blank');
      } catch (fallbackErr) {
        console.error('Fallback export failed:', fallbackErr);
      }
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading reports...</p>
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
      )}

      {/* Dentist Workload */}
      <div className="report-section">
        <div className="section-header">
          <h2>Dentist Workload</h2>
        </div>
        
        {workload.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Dentist Name</th>
                  <th>Specialty</th>
                  <th>Total Appointments</th>
                  <th>Pending</th>
                  <th>Completed</th>
                  <th>Workload Status</th>
                </tr>
              </thead>
              <tbody>
                {workload.map(dentist => (
                  <tr key={dentist.dentistId}>
                    <td>{dentist.dentistName}</td>
                    <td>{dentist.specialty}</td>
                    <td>{dentist.appointments}</td>
                    <td>{dentist.pending}</td>
                    <td>{dentist.completed}</td>
                    <td>
                      <span className={`badge ${
                        dentist.appointments > 15 ? 'badge-danger' : 
                        dentist.appointments > 8 ? 'badge-warning' : 'badge-success'
                      }`}>
                        {dentist.appointments > 15 ? 'High' : 
                         dentist.appointments > 8 ? 'Medium' : 'Normal'}
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
