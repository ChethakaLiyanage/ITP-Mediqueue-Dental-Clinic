import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import { ArrowLeft, Calendar, Clock, User, MapPin, Phone, Mail, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import "./profile.css";

function ProfileBreadcrumb({ navigate }) {
  return (
    <div className="profile-breadcrumb">
      <button 
        className="breadcrumb-back-btn"
        onClick={() => navigate("/history")}
      >
        <ArrowLeft size={16} />
        Back to Appointments
      </button>
      <span className="breadcrumb-separator">/</span>
      <span className="breadcrumb-current">Appointment Details</span>
    </div>
  );
}

export default function ProfileAppointmentDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Get appointment from location state or fetch from API
    if (location.state?.appointment) {
      console.log("Using appointment from location state");
      setAppointment(location.state.appointment);
      setLoading(false);
    } else {
      console.log("Fetching appointment from API");
      // If no state, fetch from API
      fetchAppointment();
    }
  }, [id, location.state]);

  const fetchAppointment = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("No token found");
        return;
      }

      const response = await fetch(`http://localhost:5000/appointments/${id}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        console.log("Token expired, will be handled by ProtectedRoute");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch appointment");
      }

      const data = await response.json();
      setAppointment(data.appointment || data);
    } catch (error) {
      console.error('Error fetching appointment:', error);
      setError("Unable to load appointment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'pending':
        return <Clock className="text-yellow-600" size={20} />;
      case 'cancelled':
        return <XCircle className="text-red-600" size={20} />;
      case 'completed':
        return <CheckCircle className="text-blue-600" size={20} />;
      default:
        return <AlertCircle className="text-gray-600" size={20} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })
    };
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <ProfileBreadcrumb navigate={navigate} />
          <div className="profile-loading-container">
            <div className="profile-loading-card">
              <div className="profile-loading-spinner" />
              <p className="profile-loading-text">Loading appointment...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <ProfileBreadcrumb navigate={navigate} />
          <div className="profile-error-container">
            <div className="profile-error-card">
              <Calendar className="text-red-600" size={32} />
              <p className="profile-error-text">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <ProfileBreadcrumb navigate={navigate} />
          <div className="profile-error-container">
            <div className="profile-error-card">
              <Calendar className="text-red-600" size={32} />
              <p className="profile-error-text">Appointment not found</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const dateTime = formatDateTime(appointment.appointment_date);

  return (
    <div className="profile-page">
      <div className="profile-container">
        <ProfileBreadcrumb navigate={navigate} />
        
        <div className="profile-info-card">
          <div className="profile-info-header">
            <h3 className="profile-info-title">
              <Calendar className="text-purple-600" size={20} />
              Appointment Details
            </h3>
            <p className="profile-info-subtitle">
              {appointment.reason || 'Dental Appointment'}
            </p>
          </div>

          <div className="appointment-detail-content">
            {/* Appointment Header */}
            <div className="appointment-detail-header">
              <div className="appointment-detail-title">
                <h4>{appointment.reason || 'Dental Appointment'}</h4>
                <div className={`status-badge ${getStatusColor(appointment.status)}`}>
                  {getStatusIcon(appointment.status)}
                  <span>{appointment.status || 'Pending'}</span>
                </div>
              </div>
              <div className="appointment-detail-meta">
                <div className="appointment-meta-item">
                  <Calendar size={16} />
                  <span>{dateTime.date}</span>
                </div>
                <div className="appointment-meta-item">
                  <Clock size={16} />
                  <span>{dateTime.time}</span>
                </div>
              </div>
            </div>

            {/* Appointment Information */}
            <div className="appointment-section">
              <h5 className="appointment-section-title">
                <User size={18} />
                Dentist Information
              </h5>
              <div className="appointment-info-grid">
                <div className="appointment-info-item">
                  <strong>Dentist:</strong>
                  <span>Dr. {appointment.dentistName || 'Unknown'}</span>
                </div>
                {appointment.dentistCode && (
                  <div className="appointment-info-item">
                    <strong>Dentist Code:</strong>
                    <span>{appointment.dentistCode}</span>
                  </div>
                )}
                {appointment.dentistPhone && (
                  <div className="appointment-info-item">
                    <strong>Phone:</strong>
                    <span>{appointment.dentistPhone}</span>
                  </div>
                )}
                {appointment.dentistEmail && (
                  <div className="appointment-info-item">
                    <strong>Email:</strong>
                    <span>{appointment.dentistEmail}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Location Information */}
            <div className="appointment-section">
              <h5 className="appointment-section-title">
                <MapPin size={18} />
                Location & Contact
              </h5>
              <div className="appointment-info-grid">
                <div className="appointment-info-item">
                  <strong>Location:</strong>
                  <span>{appointment.location || 'Dental Clinic'}</span>
                </div>
                {appointment.address && (
                  <div className="appointment-info-item">
                    <strong>Address:</strong>
                    <span>{appointment.address}</span>
                  </div>
                )}
                {appointment.clinicPhone && (
                  <div className="appointment-info-item">
                    <strong>Clinic Phone:</strong>
                    <span>{appointment.clinicPhone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Appointment Details */}
            <div className="appointment-section">
              <h5 className="appointment-section-title">
                <Calendar size={18} />
                Appointment Details
              </h5>
              <div className="appointment-info-grid">
                <div className="appointment-info-item">
                  <strong>Reason:</strong>
                  <span>{appointment.reason || 'General Consultation'}</span>
                </div>
                {appointment.notes && (
                  <div className="appointment-info-item">
                    <strong>Notes:</strong>
                    <span>{appointment.notes}</span>
                  </div>
                )}
                {appointment.duration && (
                  <div className="appointment-info-item">
                    <strong>Duration:</strong>
                    <span>{appointment.duration} minutes</span>
                  </div>
                )}
                {appointment.appointmentType && (
                  <div className="appointment-info-item">
                    <strong>Type:</strong>
                    <span>{appointment.appointmentType}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Patient Information (if guest booking) */}
            {appointment.isGuestBooking && appointment.guestInfo && (
              <div className="appointment-section">
                <h5 className="appointment-section-title">
                  <User size={18} />
                  Patient Information
                </h5>
                <div className="appointment-info-grid">
                  <div className="appointment-info-item">
                    <strong>Name:</strong>
                    <span>{appointment.guestInfo.name}</span>
                  </div>
                  {appointment.guestInfo.phone && (
                    <div className="appointment-info-item">
                      <strong>Phone:</strong>
                      <span>{appointment.guestInfo.phone}</span>
                    </div>
                  )}
                  {appointment.guestInfo.email && (
                    <div className="appointment-info-item">
                      <strong>Email:</strong>
                      <span>{appointment.guestInfo.email}</span>
                    </div>
                  )}
                  {appointment.guestInfo.age && (
                    <div className="appointment-info-item">
                      <strong>Age:</strong>
                      <span>{appointment.guestInfo.age}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Additional Information */}
            <div className="appointment-section">
              <h5 className="appointment-section-title">
                <Calendar size={18} />
                Additional Information
              </h5>
              <div className="appointment-info-grid">
                <div className="appointment-info-item">
                  <strong>Appointment ID:</strong>
                  <span>{appointment._id}</span>
                </div>
                {appointment.patient_code && (
                  <div className="appointment-info-item">
                    <strong>Patient Code:</strong>
                    <span>{appointment.patient_code}</span>
                  </div>
                )}
                <div className="appointment-info-item">
                  <strong>Created:</strong>
                  <span>{new Date(appointment.createdAt).toLocaleDateString()}</span>
                </div>
                {appointment.updatedAt && (
                  <div className="appointment-info-item">
                    <strong>Last Updated:</strong>
                    <span>{new Date(appointment.updatedAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
