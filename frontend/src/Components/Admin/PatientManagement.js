import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './PatientManagement.css';

const PatientManagement = () => {
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    registered: 0,
    unregistered: 0,
    active: 0,
    temporary: 0
  });
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  
  const [filters, setFilters] = useState({
    search: '',
    patientType: 'all',
    status: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });


  // Fetch patients on component mount and filter changes
  useEffect(() => {
    fetchPatients();
  }, [filters]);

  // Fetch stats on component mount
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const response = await axios.get(
        'http://localhost:5000/admin/patient-management/overview-stats'
      );

      if (response.data.success && response.data.data) {
        // Map the backend response to the expected format
        const backendData = response.data.data;
        setStats({
          total: backendData.total?.total || 0,
          registered: backendData.total?.registered || 0,
          unregistered: backendData.total?.unregistered || 0,
          active: backendData.total?.total || 0, // Assuming all are active for now
          temporary: 0 // Not provided by backend
        });
      } else {
        console.warn('Invalid response format or missing data');
        // Keep default stats values
      }
    } catch (error) {
      console.error('Error fetching patient stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.search) {
        queryParams.append('search', filters.search);
      }
      if (filters.patientType !== 'all') {
        queryParams.append('patientType', filters.patientType);
      }
      if (filters.status !== 'all') {
        queryParams.append('status', filters.status);
      }
      queryParams.append('sortBy', filters.sortBy);
      queryParams.append('sortOrder', filters.sortOrder);

      const response = await axios.get(
        `http://localhost:5000/admin/patient-management/all?${queryParams.toString()}`
      );

      if (response.data.success) {
        setPatients(response.data.patients);
        setFilteredPatients(response.data.patients);
        // Don't update stats here - they're fetched separately
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
      setPatients([]);
      setFilteredPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    const searchValue = e.target.value;
    setFilters(prev => ({ ...prev, search: searchValue }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };


  const handlePromotePatient = (patient) => {
    if (patient.patientType !== 'unregistered') {
      alert('Only unregistered patients can be promoted.');
      return;
    }
    setSelectedPatient(patient);
    setShowPromoteModal(true);
  };

  const handlePromoteConfirm = async (userId) => {
    if (!selectedPatient || !userId) return;
    
    setPromoteLoading(true);
    try {
      await axios.put(
        `http://localhost:5000/admin/patient-management/promote/${selectedPatient.id}`,
        { userId }
      );
      
      // Refresh the patient list and stats
      fetchPatients();
      fetchStats();
      setShowPromoteModal(false);
      setSelectedPatient(null);
      alert('Patient promoted to registered status successfully!');
    } catch (error) {
      console.error('Error promoting patient:', error);
      alert('Failed to promote patient. Please try again.');
    } finally {
      setPromoteLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      patientType: 'all',
      status: 'all',
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
  };

  const handleViewPatient = (patient) => {
    // Create a detailed view modal or navigate to patient details
    const details = `
Patient Details:
- Code: ${patient.patientCode}
- Name: ${patient.name}
- Email: ${patient.email || 'N/A'}
- Phone: ${patient.phone || 'N/A'}
- Type: ${patient.patientType}
- Status: ${patient.status}
- Age: ${patient.age || 'Unknown'}
- Gender: ${patient.gender || 'Unknown'}
- Registered By: ${patient.registeredBy || 'System'}
- Date Added: ${formatDateTime(patient.createdAt)}
${patient.address ? `- Address: ${patient.address}` : ''}
${patient.allergies ? `- Allergies: ${patient.allergies}` : ''}
    `;
    alert(details);
  };

  const handleDeletePatient = async (patient) => {
    if (!window.confirm(`Are you sure you want to delete patient ${patient.name} (${patient.patientCode})? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = getAuthToken();
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      
      await axios.delete(
        `http://localhost:5000/admin/patient-management/${patient.id}?patientType=${patient.patientType}`,
        config
      );
      
      // Refresh the patient list and stats
      fetchPatients();
      fetchStats();
      alert('Patient deleted successfully!');
    } catch (error) {
      console.error('Error deleting patient:', error);
      alert('Failed to delete patient. Please try again.');
    }
  };

  const getAuthToken = () => {
    try {
      const auth = JSON.parse(localStorage.getItem('auth') || '{}');
      return auth.token;
    } catch {
      return null;
    }
  };

  if (loading) {
    return (
      <div className="patient-management">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading patients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="patient-management">
      {/* Header */}
      <div className="page-header">
        <h1>Patient Management</h1>
        <p>Manage all registered and unregistered patients in the system</p>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{statsLoading ? '...' : stats.total}</h3>
            <p>Total Patients</p>
          </div>
        </div>
        <div className="stat-card registered">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{statsLoading ? '...' : stats.registered}</h3>
            <p>Registered</p>
          </div>
        </div>
        <div className="stat-card unregistered">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <h3>{statsLoading ? '...' : stats.unregistered}</h3>
            <p>Unregistered</p>
          </div>
        </div>
        <div className="stat-card active">
          <div className="stat-icon">🟢</div>
          <div className="stat-content">
            <h3>{statsLoading ? '...' : stats.active}</h3>
            <p>Active</p>
          </div>
        </div>
        {stats.temporary > 0 && (
          <div className="stat-card guest">
            <div className="stat-icon">👤</div>
            <div className="stat-content">
              <h3>{statsLoading ? '...' : stats.temporary}</h3>
              <p>Temporary Patients</p>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-group">
          <div className="search-input-container">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={handleSearchChange}
              className="search-input"
            />
            <span className="search-icon">🔍</span>
          </div>
        </div>

        <div className="filter-controls">
          <div className="filter-group">
            <label>Patient Type:</label>
            <select
              value={filters.patientType}
              onChange={(e) => handleFilterChange('patientType', e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="registered">Registered</option>
              <option value="unregistered">Unregistered</option>
              <option value="guest">Guest Bookings</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Status:</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="temporary">Temporary</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Sort By:</label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            >
              <option value="createdAt">Date Added</option>
              <option value="name">Name</option>
              <option value="updatedAt">Last Updated</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Order:</label>
            <select
              value={filters.sortOrder}
              onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>

          {(filters.search || filters.patientType !== 'all' || filters.status !== 'all') && (
            <button className="clear-filters-btn" onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </div>
      </div>


      {/* Patients Table */}
      <div className="table-container">
        <table className="patients-table">
          <thead>
            <tr>
              <th>Patient Code</th>
              <th>Name</th>
              <th>Email</th>
              <th>Contact</th>
              <th>Type</th>
              <th>Status</th>
              <th>Age</th>
              <th>Registered By</th>
              <th>Date Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.length > 0 ? (
              filteredPatients.map(patient => (
                <tr key={patient.id}>
                  <td>
                    <span className="patient-code">{patient.patientCode}</span>
                  </td>
                  <td>
                    <div className="patient-name">
                      <span className="name">{patient.name}</span>
                      {patient.gender && (
                        <span className="gender">({patient.gender})</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {patient.email ? (
                      <a href={`mailto:${patient.email}`} className="email-link">
                        {patient.email}
                      </a>
                    ) : (
                      <span className="no-data">No email</span>
                    )}
                  </td>
                  <td>
                    {patient.phone ? (
                      <a href={`tel:${patient.phone}`} className="phone-link">
                        {patient.phone}
                      </a>
                    ) : (
                      <span className="no-data">No phone</span>
                    )}
                  </td>
                  <td>
                    <span className={`patient-type-badge ${patient.patientType}`}>
                      {patient.patientType === 'registered' ? 'Registered' : 'Unregistered'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${patient.status.toLowerCase()}`}>
                      {patient.status}
                    </span>
                  </td>
                  <td>
                    {patient.age ? (
                      <span className="age-info">{patient.age} years</span>
                    ) : (
                      <span className="no-data">Unknown</span>
                    )}
                  </td>
                  <td>
                    {patient.registeredByCode || patient.createdByCode ? (
                      <div className="registered-by">
                        {/* Show code prominently; name if backend provides */}
                        <span className="code">{patient.registeredByCode || patient.createdByCode}</span>
                        {patient.registeredBy && (
                          <span className="name">&nbsp;— {patient.registeredBy}</span>
                        )}
                      </div>
                    ) : (
                      <span className="no-data">System</span>
                    )}
                  </td>
                  <td>
                    <span className="date-info" title={formatDateTime(patient.createdAt)}>
                      {formatDate(patient.createdAt)}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="action-btn view-btn"
                        onClick={() => handleViewPatient(patient)}
                        title="View Details"
                      >
                        👁️
                      </button>
                      {patient.patientType === 'unregistered' && (
                        <button 
                          className="action-btn promote-btn"
                          onClick={() => handlePromotePatient(patient)}
                          title="Promote to Registered"
                        >
                          ⬆️
                        </button>
                      )}
                      <button 
                        className="action-btn delete-btn"
                        onClick={() => handleDeletePatient(patient)}
                        title="Delete Patient"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className="no-data-row">
                  {filters.search || filters.patientType !== 'all' || filters.status !== 'all' 
                    ? 'No patients found matching your filters' 
                    : 'No patients found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Patient Promotion Modal */}
      {showPromoteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Promote Patient to Registered</h3>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowPromoteModal(false);
                  setSelectedPatient(null);
                }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>Promote <strong>{selectedPatient?.name}</strong> ({selectedPatient?.patientCode}) to registered status?</p>
              <div className="form-group">
                <label>User ID to link this patient to:</label>
                <input
                  type="text"
                  id="userId"
                  placeholder="Enter User ID"
                  className="form-input"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => {
                  setShowPromoteModal(false);
                  setSelectedPatient(null);
                }}
                disabled={promoteLoading}
              >
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={() => {
                  const userId = document.getElementById('userId').value;
                  handlePromoteConfirm(userId);
                }}
                disabled={promoteLoading}
              >
                {promoteLoading ? 'Promoting...' : 'Promote Patient'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PatientManagement;
