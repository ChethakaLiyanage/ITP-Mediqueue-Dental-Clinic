import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import { ArrowLeft, Pill, Calendar, User, FileText, Clock, CheckCircle, AlertCircle } from "lucide-react";
import "./profile.css";

function ProfileBreadcrumb({ navigate }) {
  return (
    <div className="profile-breadcrumb">
      <button 
        className="breadcrumb-back-btn"
        onClick={() => navigate("/profile/prescriptions")}
      >
        <ArrowLeft size={16} />
        Back to Prescriptions
      </button>
      <span className="breadcrumb-separator">/</span>
      <span className="breadcrumb-current">Prescription Details</span>
    </div>
  );
}

export default function ProfilePrescriptionDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [prescription, setPrescription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Get prescription from location state or fetch from API
    if (location.state?.prescription) {
      console.log("Using prescription from location state");
      setPrescription(location.state.prescription);
      setLoading(false);
    } else {
      console.log("Fetching prescription from API");
      // If no state, fetch from API
      fetchPrescription();
    }
  }, [id, location.state]);

  const fetchPrescription = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.log("No token found");
        return;
      }

      const response = await fetch(`http://localhost:5000/api/prescriptions/${id}`, {
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
        throw new Error("Failed to fetch prescription");
      }

      const data = await response.json();
      setPrescription(data.prescription || data);
    } catch (error) {
      console.error('Error fetching prescription:', error);
      setError("Unable to load prescription. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'active':
        return <Pill className="text-blue-600" size={20} />;
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

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <ProfileBreadcrumb navigate={navigate} />
          <div className="profile-loading-container">
            <div className="profile-loading-card">
              <div className="profile-loading-spinner" />
              <p className="profile-loading-text">Loading prescription...</p>
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
              <Pill className="text-red-600" size={32} />
              <p className="profile-error-text">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!prescription) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <ProfileBreadcrumb navigate={navigate} />
          <div className="profile-error-container">
            <div className="profile-error-card">
              <Pill className="text-red-600" size={32} />
              <p className="profile-error-text">Prescription not found</p>
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
              <Pill className="text-blue-600" size={20} />
              Prescription Details
            </h3>
            <p className="profile-info-subtitle">
              Prescription #{prescription.prescriptionCode || prescription._id.slice(-8)}
            </p>
          </div>

          <div className="prescription-detail-content">
            {/* Prescription Header */}
            <div className="prescription-detail-header">
              <div className="prescription-detail-title">
                <h4>Prescription #{prescription.prescriptionCode || prescription._id.slice(-8)}</h4>
                <div className={`status-badge ${getStatusColor(prescription.status)}`}>
                  {getStatusIcon(prescription.status)}
                  <span>{prescription.status || 'Active'}</span>
                </div>
              </div>
              <div className="prescription-detail-meta">
                <div className="prescription-meta-item">
                  <Calendar size={16} />
                  <span>Issued: {new Date(prescription.createdAt || prescription.issuedAt).toLocaleDateString()}</span>
                </div>
                <div className="prescription-meta-item">
                  <User size={16} />
                  <span>Dr. {prescription.dentistName || 'Unknown'}</span>
                </div>
              </div>
            </div>

            {/* Diagnosis */}
            {prescription.diagnosis && (
              <div className="prescription-section">
                <h5 className="prescription-section-title">
                  <FileText size={18} />
                  Diagnosis
                </h5>
                <p className="prescription-section-content">{prescription.diagnosis}</p>
              </div>
            )}

            {/* Instructions */}
            {prescription.instructions && (
              <div className="prescription-section">
                <h5 className="prescription-section-title">
                  <FileText size={18} />
                  Instructions
                </h5>
                <p className="prescription-section-content">{prescription.instructions}</p>
              </div>
            )}

            {/* Medications */}
            {prescription.medications && prescription.medications.length > 0 && (
              <div className="prescription-section">
                <h5 className="prescription-section-title">
                  <Pill size={18} />
                  Medications ({prescription.medications.length})
                </h5>
                <div className="medications-list">
                  {prescription.medications.map((medication, index) => (
                    <div key={index} className="medication-item">
                      <div className="medication-header">
                        <span className="medication-number">{index + 1}</span>
                        <span className="medication-name">{medication.name || medication.medication}</span>
                        {medication.dosage && (
                          <span className="medication-dosage">{medication.dosage}</span>
                        )}
                      </div>
                      {medication.instructions && (
                        <p className="medication-instructions">{medication.instructions}</p>
                      )}
                      {medication.frequency && (
                        <p className="medication-frequency">Frequency: {medication.frequency}</p>
                      )}
                      {medication.duration && (
                        <p className="medication-duration">Duration: {medication.duration}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Information */}
            <div className="prescription-section">
              <h5 className="prescription-section-title">
                <FileText size={18} />
                Additional Information
              </h5>
              <div className="prescription-info-grid">
                <div className="prescription-info-item">
                  <strong>Prescription Code:</strong>
                  <span>{prescription.prescriptionCode || 'N/A'}</span>
                </div>
                <div className="prescription-info-item">
                  <strong>Patient Code:</strong>
                  <span>{prescription.patientCode || 'N/A'}</span>
                </div>
                <div className="prescription-info-item">
                  <strong>Dentist Code:</strong>
                  <span>{prescription.dentistCode || 'N/A'}</span>
                </div>
                {prescription.planCode && (
                  <div className="prescription-info-item">
                    <strong>Treatment Plan:</strong>
                    <span>{prescription.planCode}</span>
                  </div>
                )}
                {prescription.updatedAt && (
                  <div className="prescription-info-item">
                    <strong>Last Updated:</strong>
                    <span>{new Date(prescription.updatedAt).toLocaleDateString()}</span>
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
