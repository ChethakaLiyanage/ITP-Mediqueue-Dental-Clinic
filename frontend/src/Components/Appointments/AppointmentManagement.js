import React, { useState, useEffect } from 'react';
import './appointment-management.css';
import { getJSON, postJSON, putJSON, patchJSON, delJSON } from '../api';

const AppointmentManagement = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    patient_code: '',
    dentist_code: '',
    appointment_date: '',
    reason: '',
    status: 'pending',
    queue_no: ''
  });

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const response = await getJSON('/appointments');
      setAppointments(response.items || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const response = await getJSON(`/appointments?${params.toString()}`);
      setAppointments(response.items || []);
    } catch (error) {
      console.error('Error searching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAppointment = () => {
    setFormData({
      patient_code: '',
      dentist_code: '',
      appointment_date: '',
      reason: '',
      status: 'pending',
      queue_no: ''
    });
    setSelectedAppointment(null);
    setShowModal(true);
  };

  const handleEditAppointment = (appointment) => {
    setFormData({
      patient_code: appointment.patient_code || '',
      dentist_code: appointment.dentist_code || '',
      appointment_date: appointment.appointment_date ? new Date(appointment.appointment_date).toISOString().slice(0, 16) : '',
      reason: appointment.reason || '',
      status: appointment.status || 'pending',
      queue_no: appointment.queue_no || ''
    });
    setSelectedAppointment(appointment);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (selectedAppointment) {
        // Update existing appointment
        await putJSON(`/appointments/${selectedAppointment._id}`, formData);
      } else {
        // Create new appointment
        await postJSON('/appointments', formData);
      }
      setShowModal(false);
      fetchAppointments();
    } catch (error) {
      console.error('Error saving appointment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleStatusChange = async (appointmentId, newStatus) => {
    setLoading(true);
    try {
      await patchJSON(`/appointments/${appointmentId}`, { status: newStatus });
      fetchAppointments();
    } catch (error) {
      console.error('Error updating appointment status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAppointment = async (appointmentId) => {
    if (window.confirm('Are you sure you want to delete this appointment?')) {
      setLoading(true);
      try {
        await delJSON(`/appointments/${appointmentId}`);
        fetchAppointments();
      } catch (error) {
        console.error('Error deleting appointment:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#ffc107';
      case 'confirmed': return '#28a745';
      case 'completed': return '#17a2b8';
      case 'cancelled': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const filteredAppointments = appointments.filter(appointment => {
    const matchesSearch = !searchTerm || 
      appointment.appointmentCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.patient_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.dentist_code?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="appointment-management">
      <div className="header">
        <h2>Appointment Management</h2>
        <button className="btn-primary" onClick={handleCreateAppointment}>
          Create Appointment
        </button>
      </div>

      <div className="filters-section">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search appointments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} className="btn-search">Search</button>
        </div>
        
        <div className="status-filter">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="appointments-table">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Patient Code</th>
                <th>Dentist Code</th>
                <th>Date & Time</th>
                <th>Status</th>
                <th>Queue No</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map((appointment) => (
                <tr key={appointment._id}>
                  <td>{appointment.appointmentCode}</td>
                  <td>{appointment.patient_code}</td>
                  <td>{appointment.dentist_code}</td>
                  <td>{formatDateTime(appointment.appointment_date)}</td>
                  <td>
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(appointment.status) }}
                    >
                      {appointment.status}
                    </span>
                  </td>
                  <td>{appointment.queue_no || '-'}</td>
                  <td>{appointment.reason || '-'}</td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="btn-edit" 
                        onClick={() => handleEditAppointment(appointment)}
                      >
                        Edit
                      </button>
                      {appointment.status === 'pending' && (
                        <button 
                          className="btn-confirm"
                          onClick={() => handleStatusChange(appointment._id, 'confirmed')}
                        >
                          Confirm
                        </button>
                      )}
                      {appointment.status === 'confirmed' && (
                        <button 
                          className="btn-complete"
                          onClick={() => handleStatusChange(appointment._id, 'completed')}
                        >
                          Complete
                        </button>
                      )}
                      <button 
                        className="btn-delete"
                        onClick={() => handleDeleteAppointment(appointment._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{selectedAppointment ? 'Edit Appointment' : 'Create Appointment'}</h3>
              <button 
                className="btn-close" 
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Patient Code *</label>
                <input
                  type="text"
                  name="patient_code"
                  value={formData.patient_code}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Dentist Code *</label>
                <input
                  type="text"
                  name="dentist_code"
                  value={formData.dentist_code}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Date & Time *</label>
                <input
                  type="datetime-local"
                  name="appointment_date"
                  value={formData.appointment_date}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="form-group">
                <label>Queue Number</label>
                <input
                  type="number"
                  name="queue_no"
                  value={formData.queue_no}
                  onChange={handleInputChange}
                  min="1"
                />
              </div>
              <div className="form-group">
                <label>Reason</label>
                <textarea
                  name="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  rows="3"
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : (selectedAppointment ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentManagement;
