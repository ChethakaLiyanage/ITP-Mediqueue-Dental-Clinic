import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import { ArrowLeft, Activity, Calendar, User, FileText, Eye } from "lucide-react";
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
      <span className="breadcrumb-current">My Treatment Plans</span>
    </div>
  );
}

export default function ProfileTreatments() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchTreatments = async () => {
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

        console.log("Fetching treatments for patient code:", patientCode);

        const response = await fetch("http://localhost:5000/api/treatmentplans/my-treatments", {
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
          console.error("Failed to fetch treatments:", response.status, errorText);
          throw new Error("Failed to fetch treatment plans");
        }

        const data = await response.json();
        console.log("Treatments data received:", data);
        setTreatments(data.treatments || data || []);
      } catch (error) {
        console.error('Error fetching treatments:', error);
        setError("Unable to load treatment plans. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchTreatments();
  }, []);

  const handleTreatmentClick = (treatment) => {
    navigate(`/profile/treatments/${treatment._id}`, { state: { treatment } });
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <ProfileBreadcrumb navigate={navigate} />
          <div className="profile-loading-container">
            <div className="profile-loading-card">
              <div className="profile-loading-spinner" />
              <p className="profile-loading-text">Loading your treatment plans...</p>
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

  return (
    <div className="profile-page">
      <div className="profile-container">
        <ProfileBreadcrumb navigate={navigate} />
        
        <div className="profile-info-card">
          <div className="profile-info-header">
            <h3 className="profile-info-title">
              <Activity className="text-green-600" size={20} />
              Active Treatment Plans
            </h3>
            <p className="profile-info-subtitle">
              View your active treatment plans. Archived treatments can be found in your <button 
                onClick={() => navigate('/profile/medical-history')}
                style={{ 
                  display: 'inline',
                  padding: '0',
                  background: 'none',
                  border: 'none',
                  color: '#10b981',
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

          {treatments.length === 0 ? (
            <div className="profile-empty-state">
              <Activity className="text-gray-400" size={48} />
              <h4>No Active Treatment Plans</h4>
              <p>You don't have any active treatment plans. Your treatment plans will appear here once they are created by your dentist. Archived treatments can be viewed in your medical history.</p>
            </div>
          ) : (
            <div className="treatments-grid">
              {treatments.map((treatment) => (
                <div 
                  key={treatment._id}
                  className="treatment-card"
                  onClick={() => handleTreatmentClick(treatment)}
                >
                  <div className="treatment-header">
                    <div className="treatment-icon">
                      <Activity className="text-green-600" size={20} />
                    </div>
                    <div className="treatment-info">
                      <h4 className="treatment-title">
                        {treatment.planName || `Treatment Plan #${treatment.planCode || treatment._id.slice(-8)}`}
                      </h4>
                      <p className="treatment-date">
                        <Calendar size={14} />
                        {new Date(treatment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Eye className="text-gray-400" size={20} />
                  </div>
                  
                  <div className="treatment-details">
                    <div className="treatment-detail">
                      <User size={14} />
                      <span>Dr. {treatment.dentistName || 'Unknown'}</span>
                    </div>
                    <div className="treatment-detail">
                      <FileText size={14} />
                      <span>{treatment.procedures?.length || 0} procedures</span>
                    </div>
                  </div>
                  
                  <div className="treatment-status">
                    <span className={`status-badge ${treatment.status || 'active'}`}>
                      {treatment.status || 'Active'}
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
