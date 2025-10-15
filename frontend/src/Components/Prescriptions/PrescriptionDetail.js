import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Pill,
  Calendar,
  User,
  FileText,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Download,
  Phone,
  Lock,
  Edit,
  Eye,
  Loader,
  Home,
  ChevronRight,
} from "lucide-react";
import "./prescription-detail.css";

function ProfileBreadcrumb({ navigate, prescriptionCode }) {
  return (
    <div className="profile-breadcrumb">
      <button 
        className="breadcrumb-item" 
        onClick={() => navigate("/profile")}
      >
        <Home size={16} />
        Profile
      </button>
      <ChevronRight size={16} className="breadcrumb-separator" />
      <button 
        className="breadcrumb-item" 
        onClick={() => navigate("/profile/prescriptions")}
      >
        Prescriptions
      </button>
      <ChevronRight size={16} className="breadcrumb-separator" />
      <span className="breadcrumb-current">
        {prescriptionCode || 'Prescription Details'}
      </span>
    </div>
  );
}

export default function PrescriptionDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [prescription, setPrescription] = useState(location.state?.prescription || null);
  const [loading, setLoading] = useState(!prescription);
  const [error, setError] = useState("");
  const [isEditable, setIsEditable] = useState(false);

  useEffect(() => {
    if (!prescription && id) {
      fetchPrescription();
    } else if (prescription) {
      checkEditability();
    }
  }, [id]);

  const fetchPrescription = async () => {
    if (!id) {
      setError("No prescription ID provided");
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch(`http://localhost:5000/api/prescriptions/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401) {
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Prescription not found");
      }

      const data = await response.json();
      setPrescription(data.prescription);
      checkEditability(data.prescription);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const checkEditability = async (prescriptionData = prescription) => {
    if (!prescriptionData || !prescriptionData._id) return;
    
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:5000/api/prescriptions/${prescriptionData._id}/editable`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsEditable(data.isEditable);
      }
    } catch (error) {
      console.error("Error checking editability:", error);
    }
  };

  const getStatusInfo = (prescription) => {
    const now = new Date();
    const issuedDate = new Date(prescription.issuedAt);
    const daysSinceIssued = (now - issuedDate) / (1000 * 60 * 60 * 24);
    
    if (!prescription.isActive) {
      return { 
        status: 'Inactive', 
        color: 'status-expired', 
        icon: <AlertTriangle size={16} />,
        description: 'This prescription has been deactivated'
      };
    }
    
    if (prescription.patientSeenAt) {
      return { 
        status: 'Completed', 
        color: 'status-completed', 
        icon: <CheckCircle size={16} />,
        description: 'Patient has been seen and prescription completed'
      };
    }
    
    if (daysSinceIssued <= 1) {
      return { 
        status: 'Active', 
        color: 'status-active', 
        icon: <RefreshCw size={16} />,
        description: 'Prescription is currently active'
      };
    }
    
    return { 
      status: 'Expired', 
      color: 'status-expired', 
      icon: <AlertTriangle size={16} />,
      description: 'Prescription has expired (issued more than 24 hours ago)'
    };
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!prescription?._id) {
      console.error('No prescription ID available');
      return;
    }
    
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch(`http://localhost:5000/api/prescriptions/${prescription._id}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prescription_${prescription.prescriptionCode || 'unknown'}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error('Download failed');
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleMarkSeen = async () => {
    if (!prescription?._id) {
      console.error('No prescription ID available');
      return;
    }
    
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch(`http://localhost:5000/api/prescriptions/${prescription._id}/seen`, {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPrescription(data.prescription);
      } else {
        throw new Error('Failed to mark as seen');
      }
    } catch (error) {
      console.error('Failed to mark as seen:', error);
    }
  };

  if (loading) {
    return (
      <div className="prescription-detail-page">
        <div className="prescription-detail-container">
          <ProfileBreadcrumb navigate={navigate} />
          <div className="prescription-detail-loading">
            <Loader className="animate-spin" size={32} />
            <p>Loading prescription details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !prescription) {
    return (
      <div className="prescription-detail-page">
        <div className="prescription-detail-container">
          <ProfileBreadcrumb navigate={navigate} />
          <div className="prescription-detail-error">
            <AlertTriangle size={48} className="text-red-500" />
            <h2>Prescription Not Found</h2>
            <p>{error || "The prescription you're looking for could not be found."}</p>
            <button onClick={() => navigate("/profile/prescriptions")} className="btn-primary">
              Back to Prescriptions
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(prescription);

  return (
    <div className="prescription-detail-page">
      <div className="prescription-detail-container">
        <ProfileBreadcrumb navigate={navigate} prescriptionCode={prescription.prescriptionCode} />
        
        <header className="prescription-detail-header">
          <button 
            className="back-button" 
            onClick={() => navigate("/profile/prescriptions")}
          >
            <ArrowLeft size={20} />
            Back to Prescriptions
          </button>
          
          <div className="prescription-detail-title">
            <div className="prescription-icon">
              <Pill className="text-blue-600" size={32} />
            </div>
            <div>
              <h1>Prescription {prescription.prescriptionCode}</h1>
              <p>{prescription.medicines?.length || 0} medication{(prescription.medicines?.length || 0) !== 1 ? 's' : ''} prescribed</p>
            </div>
          </div>

          <div className="prescription-actions">
            {!prescription.patientSeenAt && (
              <button className="action-btn primary" onClick={handleMarkSeen}>
                <Eye size={18} />
                Mark as Seen
              </button>
            )}
            <button className="action-btn secondary" onClick={handleDownload}>
              <Download size={18} />
              Download
            </button>
            <button className="action-btn primary" onClick={handlePrint}>
              <FileText size={18} />
              Print
            </button>
          </div>
        </header>

        <div className="prescription-detail-content">
          <div className="prescription-main-card">
            <div className="prescription-status-section">
              <div className={`status-badge ${statusInfo.color}`}>
                {statusInfo.icon}
                {statusInfo.status}
              </div>
              <p className="status-description">{statusInfo.description}</p>
              
              <div className="prescription-dates">
                <div className="date-item">
                  <Calendar size={16} />
                  <span>Issued: {new Date(prescription.issuedAt).toLocaleString()}</span>
                </div>
                {prescription.patientSeenAt && (
                  <div className="date-item">
                    <Eye size={16} />
                    <span>Seen: {new Date(prescription.patientSeenAt).toLocaleString()}</span>
                  </div>
                )}
                {prescription.lockedAt && (
                  <div className="date-item">
                    <Lock size={16} />
                    <span>Locked: {new Date(prescription.lockedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="prescription-medications-section">
              <h3>
                <Pill size={20} />
                Prescribed Medications
              </h3>
              
              <div className="medications-list">
                {prescription.medicines?.length > 0 ? (
                  prescription.medicines.map((medicine, index) => (
                    <div key={index} className="medication-item">
                      <div className="medication-header">
                        <h4>{medicine.name}</h4>
                        <span className="medication-dosage">{medicine.dosage}</span>
                      </div>
                      {medicine.instructions && (
                        <div className="medication-instructions">
                          <strong>Instructions:</strong>
                          <p>{medicine.instructions}</p>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="no-medications">
                    <p>No medications prescribed</p>
                  </div>
                )}
              </div>
            </div>

            <div className="prescription-metadata">
              <div className="metadata-item">
                <strong>Version:</strong>
                <span>{prescription.version}</span>
              </div>
              <div className="metadata-item">
                <strong>Plan Code:</strong>
                <span>{prescription.planCode}</span>
              </div>
              <div className="metadata-item">
                <strong>Patient Code:</strong>
                <span>{prescription.patientCode}</span>
              </div>
            </div>
          </div>

          <div className="prescription-side-cards">
            <div className="info-card">
              <h3>
                <User size={20} />
                Prescribing Doctor
              </h3>
              <div className="doctor-info">
                <div className="doctor-name">Dr. {prescription.dentistCode}</div>
                <div className="doctor-contact">
                  <Phone size={14} />
                  <span>+94 11 2 123 456</span>
                </div>
              </div>
            </div>

            {prescription.plan_id && (
              <div className="info-card">
                <h3>
                  <FileText size={20} />
                  Treatment Plan
                </h3>
                <div className="treatment-plan-info">
                  <div className="plan-code">Plan: {prescription.planCode}</div>
                  <button 
                    className="btn-outline small"
                    onClick={() => navigate(`/profile/treatments/${prescription.plan_id}`)}
                  >
                    View Treatment Plan
                  </button>
                </div>
              </div>
            )}

            <div className="info-card warning-card">
              <h3>
                <AlertTriangle size={20} />
                Important Notes
              </h3>
              <ul>
                <li>Take medications exactly as prescribed</li>
                <li>Complete the full course even if you feel better</li>
                <li>Contact your doctor if you experience side effects</li>
                <li>Do not share medications with others</li>
                <li>Store medications in a cool, dry place</li>
              </ul>
            </div>

            {isEditable && (
              <div className="info-card edit-info">
                <h3>
                  <Edit size={20} />
                  Prescription Status
                </h3>
                <p>This prescription was issued recently and can still be modified by your dentist if needed.</p>
                <div className="contact-doctor">
                  <strong>Need changes?</strong> Contact Dr. {prescription.dentistCode} at +94 11 2 123 456
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="prescription-footer">
          <div className="prescription-id">
            <strong>Prescription ID:</strong> {prescription._id}
          </div>
          <div className="footer-actions">
            <button 
              className="btn-secondary"
              onClick={() => navigate("/profile/prescriptions")}
            >
              Back to All Prescriptions
            </button>
            <button 
              className="btn-outline"
              onClick={() => navigate("/profile")}
            >
              Back to Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}