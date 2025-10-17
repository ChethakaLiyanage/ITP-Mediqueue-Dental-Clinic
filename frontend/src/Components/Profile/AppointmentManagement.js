import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import { 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  AlertCircle,
  CheckCircle,
  Search,
  Filter
} from "lucide-react";
import "./profile.css";

const API_BASE = "http://localhost:5000";

export default function AppointmentManagement() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // History view toggle
  const [showHistory, setShowHistory] = useState(false);
  
  // Update form states
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    dentistCode: "",
    date: "",
    time: "",
    reason: "",
    notes: ""
  });
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Available dentists and slots
  const [dentists, setDentists] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState(null);

  useEffect(() => {
    fetchAppointments();
    fetchDentists();
  }, []);

  // Auto-fetch slots when dentist or date changes
  useEffect(() => {
    if (updateForm.dentistCode && updateForm.date) {
      console.log('Auto-fetching slots for dentist:', updateForm.dentistCode, 'date:', updateForm.date);
      fetchAvailableSlots(updateForm.dentistCode, updateForm.date);
    }
  }, [updateForm.dentistCode, updateForm.date]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError("");
      
      const userResponse = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!userResponse.ok) {
        throw new Error("Failed to get user data");
      }
      
      const userData = await userResponse.json();
      const patientCode = userData.user?.patientCode;
      
      if (!patientCode) {
        throw new Error("Patient code not found");
      }

      const response = await fetch(`${API_BASE}/appointments?patient_code=${encodeURIComponent(patientCode)}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error("Failed to fetch appointments");
      }

      const data = await response.json();
      const appointments = data.items || data || [];
      
      console.log('Appointments with dentist info:', appointments);
      console.log('First appointment dentist name:', appointments[0]?.dentistName);
      
      // Backend now provides dentist information, so we can use it directly
      setAppointments(appointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setError("Unable to load appointments. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDentists = async () => {
    try {
      const response = await fetch(`${API_BASE}/dentists`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Dentists API response:', data);
        const dentistsList = data.dentists || data || [];
        console.log('Dentists list:', dentistsList);
        setDentists(dentistsList);
      } else {
        console.warn('Failed to fetch dentists, status:', response.status);
      }
    } catch (error) {
      console.error('Error fetching dentists:', error);
    }
  };

  const fetchAvailableSlots = async (dentistCode, date) => {
    try {
      setLoadingSlots(true);
      setAvailableSlots([]); // Clear previous slots
      console.log('Fetching slots for dentist:', dentistCode, 'date:', date);
      
      const url = `${API_BASE}/receptionist/schedule/dentists/${dentistCode}/slots?date=${date}&slot=30`;
      console.log('Fetching from URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Slots API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Available slots data:', data);
        const slots = data.slots || [];
        console.log('Setting slots:', slots);
        setAvailableSlots(slots);
      } else {
        const errorText = await response.text();
        console.warn('Failed to fetch slots, status:', response.status, 'error:', errorText);
        setAvailableSlots([]);
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleEditAppointment = (appointment) => {
    setEditingAppointment(appointment);
    setUpdateForm({
      dentistCode: appointment.dentist_code || "",
      date: new Date(appointment.appointment_date).toISOString().slice(0, 10),
      time: new Date(appointment.appointment_date).toTimeString().slice(0, 5),
      reason: appointment.reason || "",
      notes: appointment.notes || ""
    });
    setShowUpdateForm(true);
    
    // Fetch available slots for the current dentist and date
    if (appointment.dentist_code) {
      fetchAvailableSlots(appointment.dentist_code, new Date(appointment.appointment_date).toISOString().slice(0, 10));
    }
    
    console.log('Editing appointment:', appointment);
    console.log('Current dentist code:', appointment.dentist_code);
    console.log('Available dentists:', dentists);
  };

  const handleDentistChange = (dentistCode) => {
    setUpdateForm(prev => ({ ...prev, dentistCode }));
    if (dentistCode && updateForm.date) {
      fetchAvailableSlots(dentistCode, updateForm.date);
    }
  };

  const handleDateChange = (date) => {
    setUpdateForm(prev => {
      const newForm = { ...prev, date };
      // Fetch slots after state update
      if (newForm.dentistCode && date) {
        console.log('Date changed, fetching slots for:', newForm.dentistCode, date);
        setTimeout(() => fetchAvailableSlots(newForm.dentistCode, date), 0);
      } else {
        console.log('Cannot fetch slots - dentistCode:', newForm.dentistCode, 'date:', date);
      }
      return newForm;
    });
  };

  const handleUpdateAppointment = async (e) => {
    e.preventDefault();
    try {
      setIsUpdating(true);
      setError("");
      setSuccess("");
      
      if (!updateForm.dentistCode || !updateForm.date || !updateForm.time) {
        setError("Please fill in all required fields");
        return;
      }

      const appointmentDateTime = new Date(`${updateForm.date}T${updateForm.time}:00.000Z`);
      
      console.log('Updating appointment with data:', {
        dentist_code: updateForm.dentistCode,
        appointment_date: appointmentDateTime.toISOString(),
        reason: updateForm.reason,
        notes: updateForm.notes
      });
      
      const response = await fetch(`${API_BASE}/appointments/${editingAppointment._id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dentist_code: updateForm.dentistCode,
          appointment_date: appointmentDateTime.toISOString(),
          reason: updateForm.reason,
          notes: updateForm.notes
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update appointment");
      }

      setSuccess("Appointment updated successfully!");
      setShowUpdateForm(false);
      setEditingAppointment(null);
      await fetchAppointments();
      
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error('Error updating appointment:', error);
      setError(error.message || "Failed to update appointment");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAppointment = async () => {
    try {
      setError("");
      setSuccess("");
      
      const response = await fetch(`${API_BASE}/appointments/${appointmentToDelete._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete appointment");
      }

      setSuccess("Appointment deleted successfully!");
      setShowDeleteConfirm(false);
      setAppointmentToDelete(null);
      await fetchAppointments();
      
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error('Error deleting appointment:', error);
      setError(error.message || "Failed to delete appointment");
    }
  };

  const confirmDelete = (appointment) => {
    setAppointmentToDelete(appointment);
    setShowDeleteConfirm(true);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return 'green';
      case 'pending': return 'orange';
      case 'cancelled': return 'red';
      case 'completed': return 'blue';
      default: return 'gray';
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    };
  };

  // Filter appointments based on history view
  const now = new Date();
  const filteredAppointments = showHistory 
    ? appointments.filter(apt => new Date(apt.appointment_date) < now) // Past appointments
    : appointments.filter(apt => new Date(apt.appointment_date) >= now || apt.status === 'pending'); // Upcoming/pending

  if (loading) {
    return (
      <div className="profile-loading-container">
        <div className="profile-loading-card">
          <div className="profile-loading-spinner" />
          <p className="profile-loading-text">Loading appointments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="appointment-management">
      {/* Header */}
      <div className="appointment-management-header">
        <div>
          <h3 className="appointment-management-title">
            <Calendar className="text-purple-600" size={24} />
            {showHistory ? 'Appointment History' : 'Manage Appointments'}
          </h3>
          <p className="appointment-management-subtitle">
            {showHistory ? 'View your past appointments' : 'Update or cancel your appointments'}
          </p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            background: showHistory ? '#f3f4f6' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: showHistory ? '#374151' : 'white',
            border: showHistory ? '2px solid #e5e7eb' : 'none',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '0.95rem'
          }}
        >
          <Clock size={18} />
          {showHistory ? 'View Upcoming' : 'View History'}
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="appointment-success-message">
          <CheckCircle size={20} />
          {success}
        </div>
      )}
      
      {error && (
        <div className="appointment-error-message">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Appointments List */}
      {filteredAppointments.length === 0 ? (
        <div className="appointment-empty-state">
          <Calendar className="text-gray-400" size={48} />
          <h4>{showHistory ? 'No Past Appointments' : 'No Upcoming Appointments'}</h4>
          <p>{showHistory ? 'You don\'t have any past appointments.' : 'You don\'t have any upcoming appointments.'}</p>
          {!showHistory && (
            <button 
              className="profile-action-btn primary"
              onClick={() => navigate("/book")}
            >
              <Calendar size={18} />
              Book Appointment
            </button>
          )}
        </div>
      ) : (
        <div className="appointments-management-grid">
          {filteredAppointments.map((appointment) => {
            const dateTime = formatDateTime(appointment.appointment_date);
            const isBookedForOther = appointment.isBookingForSomeoneElse;
            
            return (
              <div key={appointment._id} className="appointment-management-card">
                <div className="appointment-card-header">
                  <div className="appointment-card-info">
                    <h4 className="appointment-card-title">
                      {appointment.reason || 'Dental Appointment'}
                      {isBookedForOther && (
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          background: '#eff6ff',
                          color: '#2563eb',
                          borderRadius: '4px',
                          border: '1px solid #3b82f6',
                          fontWeight: '600'
                        }}>
                          📅 For Someone Else
                        </span>
                      )}
                    </h4>
                    <div className="appointment-card-meta">
                      {isBookedForOther && (
                        <div className="appointment-meta-item" style={{ 
                          background: '#eff6ff', 
                          padding: '4px 8px', 
                          borderRadius: '4px',
                          marginBottom: '4px',
                          border: '1px solid #93c5fd'
                        }}>
                          <User size={14} style={{ color: '#2563eb' }} />
                          <span style={{ color: '#1e40af', fontWeight: '600' }}>
                            {appointment.otherPersonDetails?.name || 'Someone'}
                            {appointment.otherPersonDetails?.relation && 
                              ` (${appointment.otherPersonDetails.relation})`}
                          </span>
                        </div>
                      )}
                      <div className="appointment-meta-item">
                        <Calendar size={14} />
                        <span>{dateTime.date}</span>
                      </div>
                      <div className="appointment-meta-item">
                        <Clock size={14} />
                        <span>{dateTime.time}</span>
                      </div>
                    <div className="appointment-meta-item">
                      <User size={14} />
                      <span>Dr. {appointment.dentistName || 'Unknown'}</span>
                      {appointment.dentistSpecialization && (
                        <span className="dentist-specialization">({appointment.dentistSpecialization})</span>
                      )}
                    </div>
                    </div>
                  </div>
                  <div className="appointment-card-status">
                    <span className={`status-badge ${getStatusColor(appointment.status)}`}>
                      {appointment.status || 'Pending'}
                    </span>
                  </div>
                </div>
                
                <div className="appointment-card-actions">
                  <button
                    className="appointment-action-btn edit"
                    onClick={() => handleEditAppointment(appointment)}
                    disabled={showHistory || appointment.status === 'completed' || appointment.status === 'cancelled'}
                    style={{
                      opacity: (showHistory || appointment.status === 'completed' || appointment.status === 'cancelled') ? 0.5 : 1,
                      cursor: (showHistory || appointment.status === 'completed' || appointment.status === 'cancelled') ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Edit size={16} />
                    {showHistory ? 'Past' : 'Update'}
                  </button>
                  <button
                    className="appointment-action-btn delete"
                    onClick={() => confirmDelete(appointment)}
                    disabled={showHistory || appointment.status === 'completed'}
                    style={{
                      opacity: (showHistory || appointment.status === 'completed') ? 0.5 : 1,
                      cursor: (showHistory || appointment.status === 'completed') ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Trash2 size={16} />
                    {showHistory ? 'Done' : 'Cancel'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Update Appointment Modal */}
      {showUpdateForm && (
        <div className="appointment-modal-overlay">
          <div className="appointment-modal">
            <div className="appointment-modal-header">
              <h3 className="appointment-modal-title">
                <Edit size={20} />
                Update Appointment
              </h3>
              <button
                className="appointment-modal-close"
                onClick={() => setShowUpdateForm(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateAppointment} className="appointment-update-form">
              <div className="form-group">
                <label className="form-label">
                  <User size={16} />
                  Dentist
                </label>
                <select
                  value={updateForm.dentistCode}
                  onChange={(e) => handleDentistChange(e.target.value)}
                  className="form-select"
                  required
                >
                  <option value="">Select a dentist</option>
                  {dentists.map((dentist) => {
                    const dentistName = dentist.userId?.name || dentist.name || 'Unknown';
                    const specialization = dentist.specialization || 'General';
                    return (
                      <option key={dentist._id} value={dentist.dentistCode}>
                        Dr. {dentistName} ({specialization})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Calendar size={16} />
                  Date
                </label>
                <input
                  type="date"
                  value={updateForm.date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="form-input"
                  min={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Clock size={16} />
                  Time
                </label>
                <select
                  value={updateForm.time}
                  onChange={(e) => setUpdateForm(prev => ({ ...prev, time: e.target.value }))}
                  className="form-select"
                  required
                  disabled={loadingSlots}
                >
                  <option value="">Select a time</option>
                  {availableSlots.length === 0 && !loadingSlots ? (
                    <option value="" disabled>No available slots for this date</option>
                  ) : (
                    availableSlots.map((slot, index) => {
                      // Extract time from start ISO string
                      const slotTime = slot.displayTime || (slot.start ? new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) :
                                      slot.time || slot.startTime || slot.slotTime || 'Unknown Time');
                      
                      const isCurrentTime = slotTime === updateForm.time;
                      const isBooked = slot.status === 'booked';
                      const isAvailable = slot.status === 'available' || slot.status === 'bookable';
                      
                      // Debug the slot data
                      console.log('Slot data:', slot, 'Extracted time:', slotTime);
                      
                      return (
                        <option 
                          key={index} 
                          value={slotTime} 
                          disabled={isBooked}
                          style={{ color: isBooked ? '#999' : '#000' }}
                        >
                          {slotTime} {isBooked ? '(Booked)' : isAvailable ? '(Available)' : ''} {isCurrentTime ? '(Current)' : ''}
                        </option>
                      );
                    })
                  )}
                </select>
                {loadingSlots && <p className="form-help">Loading available slots...</p>}
                {!loadingSlots && availableSlots.length === 0 && updateForm.dentistCode && updateForm.date && (
                  <p className="form-help" style={{ color: '#ef4444' }}>
                    No available slots for this dentist on the selected date. Please try a different date.
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Calendar size={16} />
                  Reason
                </label>
                <input
                  type="text"
                  value={updateForm.reason}
                  onChange={(e) => setUpdateForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="form-input"
                  placeholder="Appointment reason"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <MapPin size={16} />
                  Notes (Optional)
                </label>
                <textarea
                  value={updateForm.notes}
                  onChange={(e) => setUpdateForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="form-textarea"
                  placeholder="Additional notes"
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowUpdateForm(false)}
                  disabled={isUpdating}
                >
                  <X size={16} />
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary save-button"
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <>
                      <div className="btn-spinner" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="appointment-modal-overlay">
          <div className="appointment-modal delete-modal">
            <div className="appointment-modal-header">
              <h3 className="appointment-modal-title">
                <Trash2 size={20} />
                Cancel Appointment
              </h3>
              <button
                className="appointment-modal-close"
                onClick={() => setShowDeleteConfirm(false)}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="delete-confirmation-content">
              <AlertCircle size={48} className="delete-warning-icon" />
              <h4>Are you sure you want to cancel this appointment?</h4>
              <p>This action cannot be undone. The appointment will be permanently cancelled.</p>
              
              <div className="appointment-to-delete-info">
                <h5>{appointmentToDelete?.reason || 'Dental Appointment'}</h5>
                <p>
                  {formatDateTime(appointmentToDelete?.appointment_date).date} at{' '}
                  {formatDateTime(appointmentToDelete?.appointment_date).time}
                </p>
                <p>
                  Dr. {appointmentToDelete?.dentistName || 'Unknown'}
                  {appointmentToDelete?.dentistSpecialization && (
                    <span className="dentist-specialization"> ({appointmentToDelete.dentistSpecialization})</span>
                  )}
                </p>
              </div>
            </div>
            
            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                <X size={16} />
                Keep Appointment
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDeleteAppointment}
              >
                <Trash2 size={16} />
                Cancel Appointment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
