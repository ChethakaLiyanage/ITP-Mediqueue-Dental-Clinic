import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import { ArrowLeft, Pill, Calendar, User, FileText, Eye } from "lucide-react";
import "./profile.css";

function ProfileBreadcrumb({ navigate }) {
  return (
    <div className="profile-breadcrumb">
      <button 
        className="breadcrumb-back-btn"
        onClick={() => navigate("/profile")}
      >
        <ArrowLeft size={16} />
        Back to Profile
      </button>
      <span className="breadcrumb-separator">/</span>
      <span className="breadcrumb-current">My Prescriptions</span>
    </div>
  );
}

export default function ProfilePrescriptions() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPrescriptions = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          console.log("No token found");
          return;
        }

        // Get patient code from user data first
        const userResponse = await fetch("http://localhost:5000/auth/me", {
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

        console.log("Fetching prescriptions for patient code:", patientCode);

        const response = await fetch("http://localhost:5000/api/prescriptions/my-prescriptions", {
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
          const errorText = await response.text();
          console.error("Failed to fetch prescriptions:", response.status, errorText);
          throw new Error("Failed to fetch prescriptions");
        }

        const data = await response.json();
        console.log("Prescriptions data received:", data);
        setPrescriptions(data.prescriptions || []);
      } catch (error) {
        console.error('Error fetching prescriptions:', error);
        setError("Unable to load prescriptions. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchPrescriptions();
  }, []);

  const handlePrescriptionClick = (prescription) => {
    navigate(`/profile/prescriptions/${prescription._id}`, { state: { prescription } });
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <ProfileBreadcrumb navigate={navigate} />
          <div className="profile-loading-container">
            <div className="profile-loading-card">
              <div className="profile-loading-spinner" />
              <p className="profile-loading-text">Loading your prescriptions...</p>
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

  return (
    <div className="profile-page">
      <div className="profile-container">
        <ProfileBreadcrumb navigate={navigate} />
        
        <div className="profile-info-card">
          <div className="profile-info-header">
            <h3 className="profile-info-title">
              <Pill className="text-blue-600" size={20} />
              Active Prescriptions
            </h3>
            <p className="profile-info-subtitle">
              View your active prescriptions and current medications. Past prescriptions can be found in your <button 
                onClick={() => navigate('/profile/medical-history')}
                style={{ 
                  display: 'inline',
                  padding: '0',
                  background: 'none',
                  border: 'none',
                  color: '#3b82f6',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: 'inherit',
                  fontFamily: 'inherit'
                }}
              >
                medical history
              </button>.
            </p>
          </div>

          {prescriptions.length === 0 ? (
            <div className="profile-empty-state">
              <Pill className="text-gray-400" size={48} />
              <h4>No Active Prescriptions</h4>
              <p>You don't have any active prescriptions. Your prescriptions will appear here once they are issued by your dentist. Past prescriptions can be viewed in your medical history.</p>
            </div>
          ) : (
            <div className="prescriptions-grid">
              {prescriptions.map((prescription) => (
                <div 
                  key={prescription._id}
                  className="prescription-card"
                  onClick={() => handlePrescriptionClick(prescription)}
                >
                  <div className="prescription-header">
                    <div className="prescription-icon">
                      <Pill className="text-blue-600" size={20} />
                    </div>
                    <div className="prescription-info">
                      <h4 className="prescription-title">
                        Prescription #{prescription.prescriptionCode || prescription._id.slice(-8)}
                      </h4>
                      <p className="prescription-date">
                        <Calendar size={14} />
                        {new Date(prescription.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Eye className="text-gray-400" size={20} />
                  </div>
                  
                  <div className="prescription-details">
                    <div className="prescription-detail">
                      <User size={14} />
                      <span>Dr. {prescription.dentistName || 'Unknown'}</span>
                    </div>
                    <div className="prescription-detail">
                      <FileText size={14} />
                      <span>{prescription.medicines?.length || 0} medications</span>
                    </div>
                  </div>
                  
                  <div className="prescription-status">
                    <span className={`status-badge ${prescription.status || 'active'}`}>
                      {prescription.status || 'Active'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
