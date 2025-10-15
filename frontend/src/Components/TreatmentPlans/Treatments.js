import React, { useEffect, useState } from "react";
import "./treatments.css";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Calendar,
  User,
  Stethoscope,
  AlertCircle,
  Eye,
  Loader,
  Activity,
  Clock,
  CheckCircle
} from "lucide-react";

function TreatmentCard({ treatment, onClick }) {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50';
      case 'archived': return 'text-gray-600 bg-gray-50';
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  return (
    <div className="treatment-card" onClick={() => onClick(treatment)}>
      <div className="treatment-card-header">
        <div className="treatment-info">
          <h3 className="treatment-title">{treatment.diagnosis}</h3>
          <p className="treatment-code">Plan Code: {treatment.planCode}</p>
        </div>
        <span className={`treatment-status ${getStatusColor(treatment.status)}`}>
          {treatment.status || 'active'}
        </span>
      </div>

      <div className="treatment-details">
        <div className="treatment-detail-item">
          <User size={16} className="text-gray-500" />
          <span>Dr. {treatment.dentistName || treatment.dentistCode || 'Unknown'}</span>
        </div>
        <div className="treatment-detail-item">
          <Calendar size={16} className="text-gray-500" />
          <span>Created: {formatDate(treatment.created_date)}</span>
        </div>
        {treatment.updated_date !== treatment.created_date && (
          <div className="treatment-detail-item">
            <Clock size={16} className="text-gray-500" />
            <span>Updated: {formatDate(treatment.updated_date)}</span>
          </div>
        )}
      </div>

      {treatment.treatment_notes && (
        <div className="treatment-notes">
          <p>{treatment.treatment_notes.substring(0, 100)}
            {treatment.treatment_notes.length > 100 ? '...' : ''}
          </p>
        </div>
      )}

      <div className="treatment-card-footer">
        <span className="treatment-version">Version {treatment.version}</span>
        <button className="view-treatment-btn">
          <Eye size={16} />
          View Details
        </button>
      </div>
    </div>
  );
}

export default function Treatments() {
  const navigate = useNavigate();
  const [treatments, setTreatments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);

  useEffect(() => {
    fetchTreatments();
  }, [includeArchived]);

  const fetchTreatments = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      // FIXED: Updated to use the correct API endpoint
      const url = `http://localhost:5000/api/treatmentplans/my-treatments${includeArchived ? '?includeArchived=1' : ''}`;
      
      console.log("Fetching treatments from:", url);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      console.log("Response status:", response.status);

      if (response.status === 401) {
        localStorage.removeItem("token");
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Treatments data:", data);

      setTreatments(data.treatments || []);
    } catch (err) {
      console.error("Failed to fetch treatments:", err);
      setError(err.message || "Failed to load treatments");
    } finally {
      setLoading(false);
    }
  };

  const handleTreatmentClick = (treatment) => {
    navigate(`/profile/treatments/${treatment._id}`, { state: { treatment } });
  };

  const handleBackToProfile = () => {
    navigate("/profile");
  };

  if (loading) {
    return (
      <div className="treatments-page">
        <div className="treatments-container">
          <div className="loading-container">
            <Loader className="animate-spin text-blue-600" size={32} />
            <p className="loading-text">Loading your treatment plans...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="treatments-page">
        <div className="treatments-container">
          <header className="treatments-header">
            <button onClick={handleBackToProfile} className="back-button">
              <ArrowLeft size={20} />
              Back to Profile
            </button>
            <h1 className="treatments-title">My Treatment Plans</h1>
          </header>

          <div className="error-container">
            <AlertCircle className="text-red-600" size={48} />
            <h2 className="error-title">Error Loading Treatments</h2>
            <p className="error-message">{error}</p>
            <button 
              onClick={fetchTreatments} 
              className="retry-button"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="treatments-page">
      <div className="treatments-container">
        <header className="treatments-header">
          <button onClick={handleBackToProfile} className="back-button">
            <ArrowLeft size={20} />
            Back to Profile
          </button>
          <div className="treatments-header-content">
            <h1 className="treatments-title">
              <Activity className="text-green-600" size={28} />
              My Treatment Plans
            </h1>
            <p className="treatments-subtitle">
              View and manage your dental treatment plans
            </p>
          </div>
        </header>

        <div className="treatments-controls">
          <div className="treatments-stats">
            <span className="treatments-count">
              {treatments.length} treatment plan{treatments.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="treatments-filters">
            <label className="archive-toggle">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
              />
              <span className="toggle-text">Include archived plans</span>
            </label>
          </div>
        </div>

        {treatments.length === 0 ? (
          <div className="empty-state">
            <FileText className="text-gray-400" size={64} />
            <h2 className="empty-title">No Treatment Plans Found</h2>
            <p className="empty-message">
              {includeArchived 
                ? "You don't have any treatment plans yet."
                : "You don't have any active treatment plans. Try including archived plans."
              }
            </p>
          </div>
        ) : (
          <div className="treatments-grid">
            {treatments.map((treatment) => (
              <TreatmentCard
                key={treatment._id}
                treatment={treatment}
                onClick={handleTreatmentClick}
              />
            ))}
          </div>
        )}
      </div>
</div>
  );
}