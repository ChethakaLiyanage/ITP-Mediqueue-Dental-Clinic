import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ReceptionistActivities.css';

const ReceptionistActivities = () => {
  const [activities, setActivities] = useState({
    appointments: [],
    patientRegistrations: [],
    inquiryResponses: [],
    clinicEvents: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('appointments');
  const [filters, setFilters] = useState({
    receptionist: '',
    dateRange: 'all',
    status: 'all'
  });
  const [receptionists, setReceptionists] = useState([]);
  const [error, setError] = useState(null);

  console.log('ReceptionistActivities component rendered');

  // Fetch receptionists on component mount
  useEffect(() => {
    fetchReceptionists();
  }, []);

  // Fetch activities when filters change or receptionists are loaded
  useEffect(() => {
    if (receptionists.length > 0 || !filters.receptionist) {
      fetchReceptionistActivities();
    }
  }, [filters, receptionists]);

  const fetchReceptionists = async () => {
    try {
      // Fetch receptionists from all activity types
      const [clinicEventsRes, inquiriesRes, patientsRes, appointmentsRes] = await Promise.all([
        axios.get('http://localhost:5000/admin/clinic-events/receptionists').catch(() => ({ data: { receptionists: [] } })),
        axios.get('http://localhost:5000/admin/inquiries/receptionists').catch(() => ({ data: { receptionists: [] } })),
        axios.get('http://localhost:5000/admin/patients/receptionists').catch(() => ({ data: { receptionists: [] } })),
        axios.get('http://localhost:5000/admin/appointments/receptionists').catch(() => ({ data: { receptionists: [] } }))
      ]);

      // Combine all receptionists and remove duplicates
      const allReceptionists = [
        ...(clinicEventsRes.data.receptionists || []),
        ...(inquiriesRes.data.receptionists || []),
        ...(patientsRes.data.receptionists || []),
        ...(appointmentsRes.data.receptionists || [])
      ];

      // Remove duplicates based on ID
      const uniqueReceptionists = allReceptionists.reduce((acc, current) => {
        const existing = acc.find(item => item.id.toString() === current.id.toString());
        if (!existing) {
          acc.push(current);
        }
        return acc;
      }, []);

      // Sort by name
      uniqueReceptionists.sort((a, b) => a.name.localeCompare(b.name));
      
      setReceptionists(uniqueReceptionists);
    } catch (error) {
      console.error('Error fetching receptionists:', error);
    }
  };

  const fetchReceptionistActivities = async () => {
    setLoading(true);
    setError(null);
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();
      if (filters.receptionist) {
        // Find the selected receptionist from the list to get the actual ID
        const selectedReceptionist = receptionists.find(r => 
          `${r.name} (${r.userCode})` === filters.receptionist
        );
        if (selectedReceptionist) {
          queryParams.append('receptionistId', selectedReceptionist.id);
        }
      }
      if (filters.dateRange !== 'all') {
        queryParams.append('dateRange', filters.dateRange);
      }
      if (filters.status !== 'all') {
        queryParams.append('status', filters.status);
      }

      console.log('Fetching receptionist activities with params:', queryParams.toString());

      // Fetch all data with better error handling
      const endpoints = [
        { key: 'clinicEvents', url: `http://localhost:5000/admin/clinic-events/receptionist-activities?${queryParams.toString()}` },
        { key: 'inquiryResponses', url: `http://localhost:5000/admin/inquiries/receptionist-activities?${queryParams.toString()}` },
        { key: 'patientRegistrations', url: `http://localhost:5000/admin/patients/receptionist-activities?${queryParams.toString()}` },
        { key: 'appointments', url: `http://localhost:5000/admin/appointments/receptionist-activities?${queryParams.toString()}` }
      ];

      const results = {};
      
      for (const endpoint of endpoints) {
        try {
          console.log(`Fetching ${endpoint.key} from:`, endpoint.url);
          const response = await axios.get(endpoint.url, {
            timeout: 10000, // 10 second timeout
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (response.data && response.data.success) {
            results[endpoint.key] = response.data.activities || [];
            console.log(`${endpoint.key} loaded successfully:`, results[endpoint.key].length, 'items');
          } else {
            console.warn(`${endpoint.key} returned unsuccessful response:`, response.data);
            results[endpoint.key] = [];
          }
        } catch (error) {
          console.error(`Error fetching ${endpoint.key}:`, error.message);
          if (error.response) {
            console.error(`${endpoint.key} response status:`, error.response.status);
            console.error(`${endpoint.key} response data:`, error.response.data);
          }
          results[endpoint.key] = [];
        }
      }

      // Set data from API responses
      const activitiesData = {
        appointments: results.appointments || [],
        patientRegistrations: results.patientRegistrations || [],
        inquiryResponses: results.inquiryResponses || [],
        clinicEvents: results.clinicEvents || []
      };

      console.log('Receptionist activities data loaded:', activitiesData);
      setActivities(activitiesData);
      
      // Check if all endpoints failed
      const totalItems = Object.values(activitiesData).reduce((sum, arr) => sum + arr.length, 0);
      if (totalItems === 0) {
        console.warn('No data received from any endpoint');
        // Don't set error, just show empty state
      }
      
    } catch (error) {
      console.error('Error in fetchReceptionistActivities:', error);
      setError(`Failed to load receptionist activities: ${error.message}`);
      // Fallback to empty data on error
      setActivities({
        appointments: [],
        patientRegistrations: [],
        inquiryResponses: [],
        clinicEvents: []
      });
    } finally {
      setLoading(false);
    }
  };

  const getUniqueReceptionists = () => {
    const receptionists = new Set();
    Object.values(activities).forEach(activityList => {
      activityList.forEach(activity => {
        if (activity.receptionistName) {
          receptionists.add(`${activity.receptionistName} (${activity.receptionistId})`);
        }
      });
    });
    return Array.from(receptionists);
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

  const renderAppointments = () => (
    <div className="activity-section">
      <div className="section-header">
        <h3>Appointments Scheduled by Receptionists</h3>
        <div className="stats">
          <span className="stat-item">
            Total Appointments: {activities.appointments.length}
          </span>
          <span className="stat-item">
            Registered Patients: {activities.appointments.filter(a => a.isRegisteredPatient).length}
          </span>
          <span className="stat-item">
            Unregistered: {activities.appointments.filter(a => !a.isRegisteredPatient).length}
          </span>
          <span className="stat-item">
            Confirmed: {activities.appointments.filter(a => a.status === 'confirmed').length}
          </span>
        </div>
      </div>
      
      <div className="table-container">
        <table className="activities-table">
          <thead>
            <tr>
              <th>Appointment Code</th>
              <th>Patient Name</th>
              <th>Patient Code</th>
              <th>Appointment Date</th>
              <th>Time</th>
              <th>Dentist</th>
              <th>Scheduled By</th>
              <th>Patient Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {activities.appointments.length > 0 ? (
              activities.appointments.map(appointment => (
                <tr key={appointment.id}>
                  <td>
                    <span className="patient-code">{appointment.appointmentCode}</span>
                  </td>
                  <td>
                    <div className="patient-info">
                      <span className="name">{appointment.patientName}</span>
                      {appointment.patientAge && (
                        <span className="age">({appointment.patientAge} years)</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {appointment.patientCode ? (
                      <span className="patient-code">{appointment.patientCode}</span>
                    ) : (
                      <span className="no-response">No code</span>
                    )}
                  </td>
                  <td>{formatDate(appointment.appointmentDate)}</td>
                  <td>
                    <span className="appointment-time">{appointment.appointmentTime}</span>
                  </td>
                  <td>
                    <span className="dentist-code">{appointment.dentistCode}</span>
                  </td>
                  <td>
                    <div className="receptionist-info">
                      <span className="name">{appointment.receptionistName}</span>
                      <span className="id">({appointment.receptionistCode})</span>
                    </div>
                  </td>
                  <td>
                    <span className={`patient-type ${appointment.isRegisteredPatient ? 'registered' : 'unregistered'}`}>
                      {appointment.isRegisteredPatient ? 'Registered' : 'Unregistered'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${appointment.status.toLowerCase()}`}>
                      {appointment.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="no-data">No appointments found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPatientRegistrations = () => (
    <div className="activity-section">
      <div className="section-header">
        <h3>Patient Registrations by Receptionists</h3>
        <div className="stats">
          <span className="stat-item">
            Total Registrations: {activities.patientRegistrations.length}
          </span>
          <span className="stat-item">
            Male: {activities.patientRegistrations.filter(p => p.gender === 'Male').length}
          </span>
          <span className="stat-item">
            Female: {activities.patientRegistrations.filter(p => p.gender === 'Female').length}
          </span>
        </div>
      </div>
      
      <div className="table-container">
        <table className="activities-table">
          <thead>
            <tr>
              <th>Patient Code</th>
              <th>Patient Name</th>
              <th>Age</th>
              <th>Gender</th>
              <th>Contact</th>
              <th>NIC</th>
              <th>Registered By</th>
              <th>Registration Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {activities.patientRegistrations.length > 0 ? (
              activities.patientRegistrations.map(registration => (
                <tr key={registration.id}>
                  <td>
                    <span className="patient-code">{registration.patientCode}</span>
                  </td>
                  <td>{registration.patientName}</td>
                  <td>
                    {registration.age ? (
                      <span className="age-info">{registration.age} years</span>
                    ) : (
                      <span className="no-response">N/A</span>
                    )}
                  </td>
                  <td>
                    <span className={`gender-badge ${registration.gender.toLowerCase()}`}>
                      {registration.gender}
                    </span>
                  </td>
                  <td>
                    <div className="contact-info">
                      {registration.patientEmail && (
                        <div className="email">{registration.patientEmail}</div>
                      )}
                      {registration.patientPhone && (
                        <div className="phone">{registration.patientPhone}</div>
                      )}
                      {!registration.patientEmail && !registration.patientPhone && (
                        <span className="no-response">No contact</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="nic-info">{registration.nic}</span>
                  </td>
                  <td>
                    <div className="receptionist-info">
                      <span className="name">{registration.receptionistName}</span>
                      <span className="id">({registration.receptionistCode})</span>
                    </div>
                  </td>
                  <td>{formatDate(registration.registrationDate)}</td>
                  <td>
                    <span className={`status-badge ${registration.status.toLowerCase()}`}>
                      {registration.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="no-data">No patient registrations found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderInquiryResponses = () => (
    <div className="activity-section">
      <div className="section-header">
        <h3>Inquiry Responses by Receptionists</h3>
        <div className="stats">
          <span className="stat-item">
            Total Activities: {activities.inquiryResponses.length}
          </span>
          <span className="stat-item">
            Responses: {activities.inquiryResponses.filter(r => r.activityType === 'Response').length}
          </span>
          <span className="stat-item">
            Assignments: {activities.inquiryResponses.filter(r => r.activityType === 'Assigned').length}
          </span>
        </div>
      </div>
      
      <div className="table-container">
        <table className="activities-table">
          <thead>
            <tr>
              <th>Inquiry Code</th>
              <th>Subject</th>
              <th>Patient</th>
              <th>Inquiry Date</th>
              <th>Response Date</th>
              <th>Receptionist</th>
              <th>Response Time</th>
              <th>Activity Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {activities.inquiryResponses.length > 0 ? (
              activities.inquiryResponses.map(response => (
                <tr key={response.id}>
                  <td>
                    <span className="patient-code">{response.inquiryCode}</span>
                  </td>
                  <td>{response.inquirySubject}</td>
                  <td>
                    <div className="patient-info">
                      <span className="name">{response.patientName}</span>
                      <span className="code">({response.patientCode})</span>
                    </div>
                  </td>
                  <td>{formatDate(response.inquiryDate)}</td>
                  <td>
                    {response.responseDate ? formatDate(response.responseDate) : (
                      <span className="no-response">Not responded</span>
                    )}
                  </td>
                  <td>
                    <div className="receptionist-info">
                      <span className="name">{response.receptionistName}</span>
                      <span className="id">({response.receptionistCode})</span>
                    </div>
                  </td>
                  <td>
                    {response.responseTime ? (
                      <span className="response-time">{response.responseTime}</span>
                    ) : (
                      <span className="no-response">Pending</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge ${response.activityType.toLowerCase()}`}>
                      {response.activityType}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${response.status.toLowerCase().replace('_', '-')}`}>
                      {response.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="no-data">No inquiry activities found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderClinicEvents = () => (
    <div className="activity-section">
      <div className="section-header">
        <h3>Clinic Events Managed by Receptionists</h3>
        <div className="stats">
          <span className="stat-item">
            Total Events: {activities.clinicEvents.length}
          </span>
        </div>
      </div>
      
      <div className="table-container">
        <table className="activities-table">
          <thead>
            <tr>
              <th>Event Code</th>
              <th>Event Title</th>
              <th>Event Date</th>
              <th>Event Type</th>
              <th>Created By</th>
              <th>Updated By</th>
              <th>Activity Type</th>
              <th>Last Updated</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {activities.clinicEvents.length > 0 ? (
              activities.clinicEvents.map(event => (
                <tr key={event.id}>
                  <td>
                    <span className="patient-code">{event.eventCode}</span>
                  </td>
                  <td>{event.eventTitle}</td>
                  <td>{formatDate(event.eventDate)}</td>
                  <td>
                    <span className="event-type">{event.eventType}</span>
                  </td>
                  <td>
                    <div className="receptionist-info">
                      <span className="name">{event.createdBy}</span>
                      <span className="id">({event.createdByCode})</span>
                    </div>
                  </td>
                  <td>
                    <div className="receptionist-info">
                      <span className="name">{event.receptionistName}</span>
                      <span className="id">({event.updatedByCode})</span>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${event.activityType.toLowerCase()}`}>
                      {event.activityType}
                    </span>
                  </td>
                  <td>{formatDateTime(event.lastUpdated)}</td>
                  <td>
                    <span className={`status-badge ${event.status.toLowerCase()}`}>
                      {event.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="no-data">No clinic events found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Show error state
  if (error) {
    return (
      <div className="receptionist-activities">
        <div className="activities-header">
          <h2>Receptionist Activities</h2>
          <p>Track and monitor receptionist activities across the clinic</p>
        </div>
        <div className="error-container">
          <h3>Error Loading Data</h3>
          <p>{error}</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="receptionist-activities">
        <div className="activities-header">
          <h2>Receptionist Activities</h2>
          <p>Track and monitor receptionist activities across the clinic</p>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading receptionist activities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="receptionist-activities">
      <div className="activities-header">
        <h2>Receptionist Activities Dashboard</h2>
        <p>Track and monitor all activities performed by receptionists</p>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Filter by Receptionist:</label>
          <select 
            value={filters.receptionist} 
            onChange={(e) => setFilters({...filters, receptionist: e.target.value})}
            disabled={loading}
          >
            <option value="">All Receptionists</option>
            {receptionists.map(receptionist => (
              <option key={receptionist.id} value={`${receptionist.name} (${receptionist.userCode})`}>
                {receptionist.name} ({receptionist.userCode})
              </option>
            ))}
          </select>
          {receptionists.length === 0 && (
            <small className="loading-text">Loading receptionists...</small>
          )}
        </div>
        
        <div className="filter-group">
          <label>Date Range:</label>
          <select 
            value={filters.dateRange} 
            onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
            disabled={loading}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
        
        <div className="filter-group">
          <button 
            className="btn-primary"
            onClick={fetchReceptionistActivities}
            disabled={loading}
          >
            {loading ? "🔄 Loading..." : "↻ Refresh"}
          </button>
        </div>
        
        {(filters.receptionist || filters.dateRange !== 'all') && (
          <div className="filter-group">
            <button 
              className="clear-filters-btn"
              onClick={() => setFilters({ receptionist: '', dateRange: 'all', status: 'all' })}
              disabled={loading}
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="summary-stats">
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-value">{activities.appointments.length}</div>
          <div className="stat-label">Appointments</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-value">{activities.patientRegistrations.length}</div>
          <div className="stat-label">Patient Registrations</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💬</div>
          <div className="stat-value">{activities.inquiryResponses.length}</div>
          <div className="stat-label">Inquiry Responses</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-value">{activities.clinicEvents.length}</div>
          <div className="stat-label">Clinic Events</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'appointments' ? 'active' : ''}`}
            onClick={() => setActiveTab('appointments')}
          >
            Appointments ({activities.appointments.length})
          </button>
          <button 
            className={`tab ${activeTab === 'registrations' ? 'active' : ''}`}
            onClick={() => setActiveTab('registrations')}
          >
            Patient Registrations ({activities.patientRegistrations.length})
          </button>
          <button 
            className={`tab ${activeTab === 'inquiries' ? 'active' : ''}`}
            onClick={() => setActiveTab('inquiries')}
          >
            Inquiry Responses ({activities.inquiryResponses.length})
          </button>
          <button 
            className={`tab ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            Clinic Events ({activities.clinicEvents.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="tab-content">
        {activeTab === 'appointments' && renderAppointments()}
        {activeTab === 'registrations' && renderPatientRegistrations()}
        {activeTab === 'inquiries' && renderInquiryResponses()}
        {activeTab === 'events' && renderClinicEvents()}
      </div>
    </div>
  );
};

export default ReceptionistActivities;
