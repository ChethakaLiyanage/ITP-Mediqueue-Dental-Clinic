import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import "./ProfileAppointments.css";
import { 
  Calendar, 
  Clock, 
  User, 
  FileText, 
  ArrowLeft, 
  Search, 
  Filter,
  Eye,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Calendar as CalendarIcon,
  User as UserIcon,
  Edit,
  MessageCircle
} from "lucide-react";
import "./ProfileAppointments.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export default function ProfileAppointments() {
  const navigate = useNavigate();
  const { user, token, authLoading } = useAuth();
  
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [showChangeRequestModal, setShowChangeRequestModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [changeRequestData, setChangeRequestData] = useState({
    requestedChanges: '',
    reason: '',
    preferredDate: '',
    preferredTime: ''
  });
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAppointmentDetails, setSelectedAppointmentDetails] = useState(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading) {
      if (!token) {
        navigate("/login");
        return;
      }
      if (user?.role !== "Patient") {
        navigate("/");
        return;
      }
    }
  }, [user, token, authLoading, navigate]);

  const fetchAppointments = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get patient code from user data
      const patientCode = user?.patientCode;
      if (!patientCode) {
        throw new Error('Patient code not found');
      }
      
      // Fetch from both sources: appointments table and queue table
      const [appointmentsResponse, queueResponse] = await Promise.all([
        // Fetch future appointments from appointments table
        fetch(`${API_BASE}/appointments?patientCode=${encodeURIComponent(patientCode)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        // Fetch today's appointments from queue table
        fetch(`${API_BASE}/receptionist/queue?patientCode=${encodeURIComponent(patientCode)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);
      
      let allAppointments = [];
      
      // Process appointments from appointments table
      if (appointmentsResponse.ok) {
        const appointmentsData = await appointmentsResponse.json();
        const appointmentsList = Array.isArray(appointmentsData.appointments) ? appointmentsData.appointments : [];
        
        // Add source identifier
        const appointmentsWithSource = appointmentsList.map(apt => ({
          ...apt,
          source: 'appointments',
          isTodayAppointment: false
        }));
        
        allAppointments = [...allAppointments, ...appointmentsWithSource];
        console.log('Future appointments loaded:', appointmentsList.length);
      } else {
        console.warn('Failed to fetch appointments:', appointmentsResponse.status);
      }
      
      // Process appointments from queue table
      if (queueResponse.ok) {
        const queueData = await queueResponse.json();
        const queueItems = Array.isArray(queueData.items) ? queueData.items : [];
        
        // Convert queue items to appointment format
        const queueAppointments = queueItems.map(item => ({
          _id: item._id,
          appointmentCode: item.appointmentCode,
          patientCode: item.patientCode,
          dentistCode: item.dentistCode,
          appointmentDate: item.date,
          status: item.status === 'waiting' ? 'confirmed' : item.status,
          reason: item.reason,
          duration: item.duration || 30,
          notes: item.notes || '',
          source: 'queue',
          isTodayAppointment: true,
          // Include "for someone else" details if available
          isBookingForSomeoneElse: item.isBookingForSomeoneElse || false,
          actualPatientName: item.actualPatientName,
          actualPatientEmail: item.actualPatientEmail,
          actualPatientPhone: item.actualPatientPhone,
          actualPatientAge: item.actualPatientAge,
          relationshipToPatient: item.relationshipToPatient,
          patientDetails: item.patientDetails
        }));
        
        allAppointments = [...allAppointments, ...queueAppointments];
        console.log('Today\'s appointments from queue:', queueAppointments.length);
      } else {
        console.warn('Failed to fetch queue appointments:', queueResponse.status);
      }
      
      // Sort by appointment date (newest first)
      allAppointments.sort((a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate));
      
      setAppointments(allAppointments);
      console.log('Total appointments loaded:', allAppointments.length);
      
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError('Failed to load appointments. Please try again.');
      setAppointments([]);
    }
    
    setLoading(false);
  }, [token, user]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAppointments();
    setRefreshing(false);
  }, [fetchAppointments]);

  useEffect(() => {
    if (!authLoading && token) {
      fetchAppointments();
    }
  }, [authLoading, token, fetchAppointments]);

  const filteredAppointments = appointments.filter(appointment => {
    // Filter out cancelled appointments older than 3 hours
    if (appointment.status === 'cancelled') {
      const cancelledTime = new Date(appointment.updatedAt || appointment.createdAt);
      const now = new Date();
      const hoursSinceCancelled = (now - cancelledTime) / (1000 * 60 * 60);
      
      // Remove cancelled appointments older than 3 hours
      if (hoursSinceCancelled > 3) {
        return false;
      }
    }
    
    const matchesSearch = searchQuery === "" || 
      appointment.appointmentCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      appointment.dentistCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      appointment.reason?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || appointment.status === statusFilter;
    
    const matchesDate = (() => {
      if (dateFilter === "all") return true;
      
      const appointmentDate = new Date(appointment.appointmentDate);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      switch (dateFilter) {
        case "today":
          return appointmentDate >= today && appointmentDate < tomorrow;
        case "upcoming":
          return appointmentDate >= today;
        case "past":
          return appointmentDate < today;
        case "this-week":
          return appointmentDate >= today && appointmentDate < nextWeek;
        default:
          return true;
      }
    })();
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case "confirmed":
        return <CheckCircle className="text-green-600" size={16} />;
      case "pending":
        return <Clock className="text-yellow-600" size={16} />;
      case "completed":
        return <CheckCircle className="text-blue-600" size={16} />;
      case "cancelled":
        return <XCircle className="text-red-600" size={16} />;
      case "no-show":
        return <AlertCircle className="text-orange-600" size={16} />;
      default:
        return <Clock className="text-gray-600" size={16} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "confirmed":
        return "status-confirmed";
      case "pending":
        return "status-pending";
      case "completed":
        return "status-completed";
      case "cancelled":
        return "status-cancelled";
      case "no-show":
        return "status-no-show";
      default:
        return "status-default";
    }
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const formatTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Invalid Time';
    }
  };

  const formatDateTime = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const canCancel = (appointment) => {
    // Only pending appointments can be cancelled
    // Today's appointments are auto-confirmed and cannot be cancelled
    if (appointment.status !== 'pending') {
      return false;
    }
    
    // Check if appointment is for today (auto-confirmed appointments)
    const appointmentDate = new Date(appointment.appointmentDate);
    const today = new Date();
    const isToday = appointmentDate.toDateString() === today.toDateString();
    
    // Cannot cancel today's appointments (they are auto-confirmed)
    return !isToday;
  };

  const canReschedule = (appointment) => {
    return appointment.status === 'pending';
  };

  const canDirectEdit = (appointment) => {
    return appointment.status === 'pending';
  };

  const canRequestChange = (appointment) => {
    return appointment.status === 'confirmed';
  };


  const handleRequestChange = (appointment) => {
    setSelectedAppointment(appointment);
    setChangeRequestData({
      requestedChanges: '',
      reason: '',
      preferredDate: '',
      preferredTime: ''
    });
    setShowChangeRequestModal(true);
  };

  const handleSubmitChangeRequest = async () => {
    if (!selectedAppointment) return;
    
    try {
      // Create inquiry for appointment change request
      const inquiryData = {
        patientCode: user.patientCode,
        patientName: user.name,
        subject: `Appointment Change Request - ${selectedAppointment.appointmentCode}`,
        message: `I would like to request changes to my appointment ${selectedAppointment.appointmentCode}.\n\nRequested Changes: ${changeRequestData.requestedChanges}\nReason: ${changeRequestData.reason}\nPreferred Date: ${changeRequestData.preferredDate}\nPreferred Time: ${changeRequestData.preferredTime}`,
        appointmentCode: selectedAppointment.appointmentCode,
        messageType: 'appointment_change_request',
        metadata: {
          appointmentId: selectedAppointment._id,
          originalDate: selectedAppointment.appointmentDate,
          dentistCode: selectedAppointment.dentistCode,
          requestedChanges: changeRequestData.requestedChanges,
          reason: changeRequestData.reason,
          preferredDate: changeRequestData.preferredDate,
          preferredTime: changeRequestData.preferredTime
        }
      };

      const response = await fetch(`${API_BASE}/api/inquiries`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(inquiryData)
      });

      if (response.ok) {
        alert('Change request submitted successfully! You can track the status in your inquiries.');
        setShowChangeRequestModal(false);
        setChangeRequestData({
          requestedChanges: '',
          reason: '',
          preferredDate: '',
          preferredTime: ''
        });
        fetchAppointments(); // Refresh appointments
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to submit change request');
      }
    } catch (err) {
      console.error('Error submitting change request:', err);
      alert('Failed to submit change request. Please try again.');
    }
  };

  const handleCancelAppointment = (appointment) => {
    setSelectedAppointment(appointment);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedAppointment || !cancelReason.trim()) {
      alert('Please provide a reason for cancellation.');
      return;
    }

    setCancelling(true);
    
    try {
      const response = await fetch(`${API_BASE}/appointments/${selectedAppointment._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        alert('Appointment cancelled successfully!');
        setShowCancelModal(false);
        setCancelReason('');
        fetchAppointments(); // Refresh appointments
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to cancel appointment');
      }
    } catch (err) {
      console.error('Error cancelling appointment:', err);
      alert('Failed to cancel appointment. Please try again.');
    }
    
    setCancelling(false);
  };

  const handleViewDetails = async (appointment) => {
    setSelectedAppointmentDetails(appointment);
    setShowDetailsModal(true);
    
    // Fetch dentist name
    try {
      const response = await fetch(`${API_BASE}/dentists/code/${appointment.dentistCode}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const dentistData = await response.json();
        console.log('Dentist data received:', dentistData);
        setSelectedAppointmentDetails(prev => ({
          ...prev,
          dentistName: dentistData.userId?.name || 'Unknown'
        }));
      } else {
        console.error('Failed to fetch dentist data:', response.status, response.statusText);
        setSelectedAppointmentDetails(prev => ({
          ...prev,
          dentistName: 'Failed to load'
        }));
      }
    } catch (error) {
      console.error('Error fetching dentist name:', error);
      setSelectedAppointmentDetails(prev => ({
        ...prev,
        dentistName: 'Error loading name'
      }));
    }
  };

  if (loading && appointments.length === 0) {
    return (
      <div className="profile-appointments">
        <div className="appointments-header">
          <button 
            className="back-btn"
            onClick={() => navigate("/profile")}
          >
            <ArrowLeft size={20} />
            Back to Profile
          </button>
          <h1>My Appointments</h1>
        </div>
        <div className="loading-container">
          <RefreshCw className="animate-spin" size={32} />
          <p>Loading your appointments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-appointments">
      <div className="appointments-header">
        <button 
          className="back-btn"
          onClick={() => navigate("/profile")}
        >
          <ArrowLeft size={20} />
          Back to Profile
        </button>
        <div className="header-content">
          <h1>My Appointments</h1>
          <p>View and manage your dental appointments</p>
        </div>
        <button 
          className="refresh-btn"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="error-alert">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={handleRefresh} className="retry-btn">
            Try Again
          </button>
        </div>
      )}

      <div className="appointments-filters">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search appointments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="filter-group">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no-show">No Show</option>
          </select>
          
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="this-week">This Week</option>
          </select>
        </div>
      </div>

        <div className="appointments-content">
          {/* Appointments Summary */}
          <div className="appointments-summary">
            <div className="summary-stats">
              <div className="stat-item">
                <div className="stat-number">{appointments.filter(a => a.status === 'pending').length}</div>
                <div className="stat-label">Pending</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{appointments.filter(a => a.status === 'confirmed').length}</div>
                <div className="stat-label">Confirmed</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{appointments.filter(a => a.status === 'completed').length}</div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{appointments.length}</div>
                <div className="stat-label">Total</div>
              </div>
            </div>
          </div>

          {filteredAppointments.length === 0 ? (
          <div className="empty-state">
            <Calendar className="text-gray-400" size={48} />
            <h3>No appointments found</h3>
            <p>
              {appointments.length === 0 
                ? "You haven't booked any appointments yet."
                : "No appointments match your current filters."
              }
            </p>
            {appointments.length === 0 && (
              <button 
                className="book-appointment-btn"
                onClick={() => navigate("/book-appointment")}
              >
                <CalendarIcon size={18} />
                Book Your First Appointment
              </button>
            )}
          </div>
        ) : (
          <div className="appointments-grid">
            {filteredAppointments.map((appointment) => (
              <div key={appointment._id} className={`appointment-card ${appointment.status}`}>
                <div className="appointment-header">
                  <div className="appointment-code">
                    <FileText size={16} />
                    <span>{appointment.appointmentCode}</span>
                    {appointment.source === 'queue' && (
                      <span className="source-badge today">Today</span>
                    )}
                    {appointment.isBookingForSomeoneElse && (
                      <span className="source-badge for-someone-else">For Someone Else</span>
                    )}
                  </div>
                  <div className={`status-badge ${getStatusColor(appointment.status)}`}>
                    {getStatusIcon(appointment.status)}
                    <span>{appointment.status}</span>
                  </div>
                </div>
                
                <div className="appointment-details">
                  <div className="detail-row">
                    <Calendar size={16} />
                    <div>
                      <span className="detail-label">Date & Time</span>
                      <span className="detail-value">
                        {formatDateTime(appointment.appointmentDate)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="detail-row">
                    <UserIcon size={16} />
                    <div>
                      <span className="detail-label">Dentist</span>
                      <span className="detail-value">
                        Dr. {appointment.dentistCode}
                      </span>
                    </div>
                  </div>
                  
                  {appointment.reason && (
                    <div className="detail-row">
                      <FileText size={16} />
                      <div>
                        <span className="detail-label">Reason</span>
                        <span className="detail-value">{appointment.reason}</span>
                      </div>
                    </div>
                  )}
                  
                  {appointment.notes && (
                    <div className="detail-row">
                      <FileText size={16} />
                      <div>
                        <span className="detail-label">Notes</span>
                        <span className="detail-value">{appointment.notes}</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="appointment-actions">
                  
                  {/* Direct Edit for Pending Appointments */}
                  {canDirectEdit(appointment) && (
                    <button 
                      className="action-btn secondary"
                      onClick={() => navigate("/book-appointment", { 
                        state: { 
                          editAppointment: appointment,
                          selectedDate: appointment.appointmentDate 
                        } 
                      })}
                    >
                      <Edit size={16} />
                      Edit
                    </button>
                  )}
                  
                  {/* Reschedule for Pending or Confirmed */}
                  {canReschedule(appointment) && (
                    <button 
                      className="action-btn secondary"
                      onClick={() => navigate("/book-appointment", { 
                        state: { 
                          rescheduleAppointment: appointment,
                          selectedDate: appointment.appointmentDate 
                        } 
                      })}
                    >
                      <Calendar size={16} />
                      Reschedule
                    </button>
                  )}
                  
                  {/* Request Change for Confirmed Appointments */}
                  {canRequestChange(appointment) && (
                    <button 
                      className="action-btn warning"
                      onClick={() => handleRequestChange(appointment)}
                    >
                      <MessageCircle size={16} />
                      Request Change
                    </button>
                  )}
                  
                  {/* Cancel for Pending or Confirmed (with time limit) */}
                  {canCancel(appointment) && (
                    <button 
                      className="action-btn danger"
                      onClick={() => handleCancelAppointment(appointment)}
                    >
                      <XCircle size={16} />
                      Cancel
                    </button>
                  )}
                  
                  {/* View Details - Always Available */}
                  <button 
                    className="action-btn primary"
                    onClick={() => handleViewDetails(appointment)}
                  >
                    <Eye size={16} />
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Change Request Modal */}
      {showChangeRequestModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Request Appointment Change</h3>
              <p className="modal-subtitle">This request will be sent as an inquiry to the receptionist</p>
              <button 
                className="modal-close"
                onClick={() => setShowChangeRequestModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>What changes would you like to request?</label>
                <textarea
                  value={changeRequestData.requestedChanges}
                  onChange={(e) => setChangeRequestData({
                    ...changeRequestData,
                    requestedChanges: e.target.value
                  })}
                  placeholder="Describe the changes you need..."
                  rows={3}
                />
              </div>
              
              <div className="form-group">
                <label>Reason for change</label>
                <textarea
                  value={changeRequestData.reason}
                  onChange={(e) => setChangeRequestData({
                    ...changeRequestData,
                    reason: e.target.value
                  })}
                  placeholder="Why do you need this change?"
                  rows={2}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Preferred Date</label>
                  <input
                    type="date"
                    value={changeRequestData.preferredDate}
                    onChange={(e) => setChangeRequestData({
                      ...changeRequestData,
                      preferredDate: e.target.value
                    })}
                  />
                </div>
                
                <div className="form-group">
                  <label>Preferred Time</label>
                  <input
                    type="time"
                    value={changeRequestData.preferredTime}
                    onChange={(e) => setChangeRequestData({
                      ...changeRequestData,
                      preferredTime: e.target.value
                    })}
                  />
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowChangeRequestModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={handleSubmitChangeRequest}
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Cancel Appointment</h3>
              <button 
                className="modal-close"
                onClick={() => setShowCancelModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="cancel-warning">
                <AlertCircle className="text-orange-600" size={24} />
                <p><strong>Are you sure you want to cancel this pending appointment?</strong></p>
                <p>This action cannot be undone. You will need to book a new appointment.</p>
              </div>
              
              {selectedAppointment && (
                <div className="appointment-summary">
                  <h4>Appointment Details:</h4>
                  <p><strong>Date:</strong> {formatDateTime(selectedAppointment.appointmentDate)}</p>
                  <p><strong>Dentist:</strong> Dr. {selectedAppointment.dentistCode}</p>
                  {selectedAppointment.reason && <p><strong>Reason:</strong> {selectedAppointment.reason}</p>}
                </div>
              )}
              
              <div className="form-group">
                <label>Reason for cancellation <span className="required">*</span></label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Please explain why you need to cancel this appointment..."
                  rows={3}
                  required
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
              >
                Keep Appointment
              </button>
              <button 
                className="btn-danger"
                onClick={handleConfirmCancel}
                disabled={cancelling || !cancelReason.trim()}
              >
                {cancelling ? 'Cancelling...' : 'Yes, Cancel Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Details Modal */}
      {showDetailsModal && selectedAppointmentDetails && (
        <div className="modal-overlay">
          <div className="modal-content details-modal">
            <div className="modal-header">
              <h3>Appointment Details</h3>
              <button 
                className="modal-close"
                onClick={() => setShowDetailsModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="appointment-details-grid">
                {/* Basic Information */}
                <div className="detail-section">
                  <h4>Basic Information</h4>
                  <div className="detail-row">
                    <span className="detail-label">Appointment Code:</span>
                    <span className="detail-value">{selectedAppointmentDetails.appointmentCode}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Status:</span>
                    <span className={`detail-value status-${selectedAppointmentDetails.status}`}>
                      {getStatusIcon(selectedAppointmentDetails.status)}
                      {selectedAppointmentDetails.status}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Date & Time:</span>
                    <span className="detail-value">
                      {formatDateTime(selectedAppointmentDetails.appointmentDate)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Duration:</span>
                    <span className="detail-value">{selectedAppointmentDetails.duration} minutes</span>
                  </div>
                </div>

                {/* Dentist Information */}
                <div className="detail-section">
                  <h4>Dentist Information</h4>
                  <div className="detail-row">
                    <span className="detail-label">Dentist Code:</span>
                    <span className="detail-value">{selectedAppointmentDetails.dentistCode}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Dentist Name:</span>
                    <span className="detail-value">
                      {selectedAppointmentDetails.dentistName ? 
                        `Dr. ${selectedAppointmentDetails.dentistName}` : 
                        <span className="loading-text">Loading dentist name...</span>
                      }
                    </span>
                  </div>
                </div>

                {/* For Someone Else Information */}
                {selectedAppointmentDetails.isBookingForSomeoneElse && (
                  <div className="detail-section">
                    <h4>Patient Information (For Someone Else)</h4>
                    <div className="detail-row">
                      <span className="detail-label">Patient Name:</span>
                      <span className="detail-value">{selectedAppointmentDetails.actualPatientName}</span>
                    </div>
                    {selectedAppointmentDetails.actualPatientEmail && (
                      <div className="detail-row">
                        <span className="detail-label">Email:</span>
                        <span className="detail-value">{selectedAppointmentDetails.actualPatientEmail}</span>
                      </div>
                    )}
                    {selectedAppointmentDetails.actualPatientPhone && (
                      <div className="detail-row">
                        <span className="detail-label">Phone:</span>
                        <span className="detail-value">{selectedAppointmentDetails.actualPatientPhone}</span>
                      </div>
                    )}
                    {selectedAppointmentDetails.actualPatientAge && (
                      <div className="detail-row">
                        <span className="detail-label">Age:</span>
                        <span className="detail-value">{selectedAppointmentDetails.actualPatientAge} years</span>
                      </div>
                    )}
                    {selectedAppointmentDetails.relationshipToPatient && (
                      <div className="detail-row">
                        <span className="detail-label">Relationship:</span>
                        <span className="detail-value">{selectedAppointmentDetails.relationshipToPatient}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Patient Information */}
                <div className="detail-section">
                  <h4>Patient Information</h4>
                  <div className="detail-row">
                    <span className="detail-label">Patient Code:</span>
                    <span className="detail-value">{selectedAppointmentDetails.patientCode}</span>
                  </div>
                  {selectedAppointmentDetails.isBookingForSomeoneElse && (
                    <>
                      <div className="detail-row">
                        <span className="detail-label">Booking For:</span>
                        <span className="detail-value">Someone Else</span>
                      </div>
                      {selectedAppointmentDetails.relationshipToPatient && (
                        <div className="detail-row">
                          <span className="detail-label">Relationship:</span>
                          <span className="detail-value">{selectedAppointmentDetails.relationshipToPatient}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Appointment Details */}
                <div className="detail-section">
                  <h4>Appointment Details</h4>
                  {selectedAppointmentDetails.reason && (
                    <div className="detail-row">
                      <span className="detail-label">Reason:</span>
                      <span className="detail-value">{selectedAppointmentDetails.reason}</span>
                    </div>
                  )}
                  {selectedAppointmentDetails.notes && (
                    <div className="detail-row">
                      <span className="detail-label">Notes:</span>
                      <span className="detail-value">{selectedAppointmentDetails.notes}</span>
                    </div>
                  )}
                </div>

                {/* System Information */}
                <div className="detail-section">
                  <h4>System Information</h4>
                  <div className="detail-row">
                    <span className="detail-label">Created:</span>
                    <span className="detail-value">
                      {formatDateTime(selectedAppointmentDetails.createdAt)}
                    </span>
                  </div>
                  {selectedAppointmentDetails.updatedAt && selectedAppointmentDetails.updatedAt !== selectedAppointmentDetails.createdAt && (
                    <div className="detail-row">
                      <span className="detail-label">Last Updated:</span>
                      <span className="detail-value">
                        {formatDateTime(selectedAppointmentDetails.updatedAt)}
                      </span>
                    </div>
                  )}
                  {selectedAppointmentDetails.createdBy && (
                    <div className="detail-row">
                      <span className="detail-label">Created By:</span>
                      <span className="detail-value">{selectedAppointmentDetails.createdBy}</span>
                    </div>
                  )}
                  {selectedAppointmentDetails.updatedBy && (
                    <div className="detail-row">
                      <span className="detail-label">Updated By:</span>
                      <span className="detail-value">{selectedAppointmentDetails.updatedBy}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
