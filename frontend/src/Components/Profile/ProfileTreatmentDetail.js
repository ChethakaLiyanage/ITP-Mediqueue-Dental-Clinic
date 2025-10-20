import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import { ArrowLeft, Activity, Calendar, User, FileText, Clock, CheckCircle, AlertCircle } from "lucide-react";
import "./profile.css";

function ProfileBreadcrumb({ navigate }) {
  return (
    <div className="profile-breadcrumb">
      <button 
        className="breadcrumb-back-btn"
        onClick={() => navigate("/profile/treatments")}
      >
        <ArrowLeft size={16} />
        Back to Treatment Plans
      </button>
      <span className="breadcrumb-separator">/</span>
      <span className="breadcrumb-current">Treatment Details</span>
    </div>
  );
}

export default function ProfileTreatmentDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [treatment, setTreatment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Get treatment from location state or fetch from API
    if (location.state?.treatment) {
      console.log("Using treatment from location state");
      setTreatment(location.state.treatment);
      setLoading(false);
      setAuthChecked(true);
    } else {
      console.log("Fetching treatment from API");
      // If no state, fetch from API
      fetchTreatment();
    }
  }, [id, location.state]);

  const fetchTreatment = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("No token found");
        return;
      }

      const response = await fetch(`http://localhost:5000/api/treatmentplans/${id}`, {
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
        throw new Error("Failed to fetch treatment plan");
      }

      const data = await response.json();
      setTreatment(data.treatment || data);
    } catch (error) {
      console.error('Error fetching treatment:', error);
      setError("Unable to load treatment plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'active':
        return <Activity className="text-blue-600" size={20} />;
      case 'pending':
        return <Clock className="text-yellow-600" size={20} />;
      default:
        return <AlertCircle className="text-gray-600" size={20} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!authChecked || loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <ProfileBreadcrumb navigate={navigate} />
          <div className="profile-loading-container">
            <div className="profile-loading-card">
              <div className="profile-loading-spinner" />
              <p className="profile-loading-text">
                {!authChecked ? "Checking authentication..." : "Loading treatment plan..."}
              </p>
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
              <Activity className="text-red-600" size={32} />
              <p className="profile-error-text">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!treatment) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <ProfileBreadcrumb navigate={navigate} />
          <div className="profile-error-container">
            <div className="profile-error-card">
              <Activity className="text-red-600" size={32} />
              <p className="profile-error-text">Treatment plan not found</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <ProfileBreadcrumb navigate={navigate} />
        
        <div className="profile-info-card">
          <div className="profile-info-header">
            <h3 className="profile-info-title">
              <Activity className="text-green-600" size={20} />
              Treatment Plan Details
            </h3>
            <p className="profile-info-subtitle">
              {treatment.diagnosis || `Treatment Plan #${treatment.planCode || treatment._id.slice(-8)}`}
            </p>
          </div>

          <div className="treatment-detail-content">
            {/* Treatment Header */}
            <div className="treatment-detail-header">
              <div className="treatment-detail-title">
                <h4>{treatment.diagnosis || `Treatment Plan #${treatment.planCode || treatment._id.slice(-8)}`}</h4>
                <div className={`status-badge ${getStatusColor(treatment.status)}`}>
                  {getStatusIcon(treatment.status)}
                  <span>{treatment.status || 'Active'}</span>
                </div>
              </div>
              <div className="treatment-detail-meta">
                <div className="treatment-meta-item">
                  <Calendar size={16} />
                  <span>Created: {new Date(treatment.created_date || treatment.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="treatment-meta-item">
                  <User size={16} />
                  <span>Dr. {treatment.dentistName || 'Unknown'}</span>
                </div>
              </div>
            </div>

            {/* Diagnosis */}
            {treatment.diagnosis && (
              <div className="treatment-section">
                <h5 className="treatment-section-title">
                  <FileText size={18} />
                  Diagnosis
                </h5>
                <p className="treatment-section-content">{treatment.diagnosis}</p>
              </div>
            )}

            {/* Treatment Notes */}
            {treatment.treatment_notes && (
              <div className="treatment-section">
                <h5 className="treatment-section-title">
                  <FileText size={18} />
                  Treatment Notes
                </h5>
                <p className="treatment-section-content">{treatment.treatment_notes}</p>
              </div>
            )}


            {/* Additional Information */}
            <div className="treatment-section">
              <h5 className="treatment-section-title">
                <FileText size={18} />
                Additional Information
              </h5>
              <div className="treatment-info-grid">
                <div className="treatment-info-item">
                  <strong>Plan Code:</strong>
                  <span>{treatment.planCode || 'N/A'}</span>
                </div>
                <div className="treatment-info-item">
                  <strong>Patient Code:</strong>
                  <span>{treatment.patientCode || 'N/A'}</span>
                </div>
                <div className="treatment-info-item">
                  <strong>Dentist Code:</strong>
                  <span>{treatment.dentistCode || 'N/A'}</span>
                </div>
                {treatment.updated_date && (
                  <div className="treatment-info-item">
                    <strong>Last Updated:</strong>
                    <span>{new Date(treatment.updated_date).toLocaleDateString()}</span>
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
