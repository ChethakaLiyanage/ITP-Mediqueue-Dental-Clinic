import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Pill,
  Calendar,
  User,
  Clock,
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  AlertCircle,
  Loader,
  Home,
  ChevronRight,
} from "lucide-react";
import "./prescriptions.css";

function PrescriptionCard({ prescription, onClick }) {
  const getStatusColor = (prescription) => {
    const now = new Date();
    const issuedDate = new Date(prescription.issuedAt);
    const daysSinceIssued = (now - issuedDate) / (1000 * 60 * 60 * 24);
    
    if (!prescription.isActive) return 'status-expired';
    if (prescription.patientSeenAt) return 'status-completed';
    if (daysSinceIssued <= 1) return 'status-active';
    return 'status-expired';
  };

  const getStatusText = (prescription) => {
    const now = new Date();
    const issuedDate = new Date(prescription.issuedAt);
    const daysSinceIssued = (now - issuedDate) / (1000 * 60 * 60 * 24);
    
    if (!prescription.isActive) return 'Inactive';
    if (prescription.patientSeenAt) return 'Completed';
    if (daysSinceIssued <= 1) return 'Active';
    return 'Expired';
  };

  // Get primary medicine for display
  const primaryMedicine = prescription.medicines?.[0] || {};
  const medicineCount = prescription.medicines?.length || 0;

  return (
    <div className="prescription-card" onClick={onClick}>
      <div className="prescription-card-header">
        <div className="prescription-main-info">
          <h3>{primaryMedicine.name || 'Multiple Medications'}</h3>
          <p className="prescription-dosage">
            {medicineCount > 1 
              ? `${medicineCount} medications prescribed`
              : primaryMedicine.dosage || 'See details'
            }
          </p>
        </div>
        <span className={`prescription-status ${getStatusColor(prescription)}`}>
          {getStatusText(prescription)}
        </span>
      </div>
      
      <div className="prescription-card-body">
        <div className="prescription-detail">
          <Calendar size={16} />
          <span>Issued: {new Date(prescription.issuedAt).toLocaleDateString()}</span>
        </div>
        <div className="prescription-detail">
          <User size={16} />
          <span>Dr. {prescription.dentistName || prescription.dentistCode || 'Unknown'}</span>
        </div>
        <div className="prescription-detail">
          <FileText size={16} />
          <span>Code: {prescription.prescriptionCode}</span>
        </div>
        {prescription.patientSeenAt && (
          <div className="prescription-detail">
            <Clock size={16} />
            <span>Seen: {new Date(prescription.patientSeenAt).toLocaleDateString()}</span>
          </div>
        )}
      </div>
      
      <div className="prescription-card-footer">
        <span className="prescription-duration">
          Version: {prescription.version}
        </span>
        <Eye size={16} className="prescription-view-icon" />
      </div>
    </div>
  );
}

function ProfileBreadcrumb({ navigate }) {
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
      <span className="breadcrumb-current">Prescriptions</span>
    </div>
  );
}

export default function Prescriptions() {
  const navigate = useNavigate();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    const fetchPrescriptions = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login");
          return;
        }

        const response = await fetch("http://localhost:5000/api/prescriptions/my-prescriptions", {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch prescriptions");
        }

        const data = await response.json();
        setPrescriptions(data.prescriptions || []);
      } catch (error) {
        console.error('Error fetching prescriptions:', error);
        setError("Unable to load prescriptions. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchPrescriptions();
  }, [navigate]);

  const handlePrescriptionClick = (prescription) => {
    navigate(`/profile/prescriptions/${prescription._id}`, { state: { prescription } });
  };

  const getFilteredPrescriptions = () => {
    return prescriptions.filter(prescription => {
      // Search filter
      const searchMatch = prescription.medicines?.some(med => 
        med.name.toLowerCase().includes(searchTerm.toLowerCase())
      ) || prescription.prescriptionCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prescription.dentistCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (prescription.dentistName && prescription.dentistName.toLowerCase().includes(searchTerm.toLowerCase()));

      // Status filter
      if (filterStatus === "all") return searchMatch;
      
      const now = new Date();
      const issuedDate = new Date(prescription.issuedAt);
      const daysSinceIssued = (now - issuedDate) / (1000 * 60 * 60 * 24);
      
      let statusMatch = false;
      switch (filterStatus) {
        case "active":
          statusMatch = prescription.isActive && !prescription.patientSeenAt && daysSinceIssued <= 1;
          break;
        case "completed":
          statusMatch = prescription.patientSeenAt !== null;
          break;
        case "expired":
          statusMatch = !prescription.isActive || daysSinceIssued > 1;
          break;
        default:
          statusMatch = true;
      }
      
      return searchMatch && statusMatch;
    });
  };

  const filteredPrescriptions = getFilteredPrescriptions();

  const getStatusCounts = () => {
    const now = new Date();
    return prescriptions.reduce((acc, prescription) => {
      const issuedDate = new Date(prescription.issuedAt);
      const daysSinceIssued = (now - issuedDate) / (1000 * 60 * 60 * 24);
      
      if (prescription.patientSeenAt) {
        acc.completed++;
      } else if (prescription.isActive && daysSinceIssued <= 1) {
        acc.active++;
      } else {
        acc.expired++;
      }
      return acc;
    }, { active: 0, completed: 0, expired: 0 });
  };

  const statusCounts = getStatusCounts();

  const handleBack = () => {
    navigate("/profile");
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/prescriptions/export", {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'prescriptions_report.pdf';
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="prescriptions-page">
        <div className="prescriptions-container">
          <ProfileBreadcrumb navigate={navigate} />
          <div className="prescriptions-loading">
            <Loader className="animate-spin" size={32} />
            <p>Loading your prescriptions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="prescriptions-page">
        <div className="prescriptions-container">
          <ProfileBreadcrumb navigate={navigate} />
          <button className="back-button" onClick={handleBack}>
            <ArrowLeft size={20} />
            Back to Profile
          </button>
          <div className="prescription-error">
            <AlertCircle size={48} className="text-red-500" />
            <h2>Error Loading Prescriptions</h2>
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className="btn-primary">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="prescriptions-page">
      <div className="prescriptions-container">
        <ProfileBreadcrumb navigate={navigate} />
        
        <header className="prescriptions-header">
          <button className="back-button" onClick={handleBack}>
            <ArrowLeft size={20} />
            Back to Profile
          </button>
          
          <div className="prescriptions-title-section">
            <div className="prescriptions-title">
              <Pill className="text-blue-600" size={28} />
              <h1>My Prescriptions</h1>
            </div>
            <p className="prescriptions-subtitle">
              View and manage all your prescribed medications
            </p>
          </div>

          <div className="prescriptions-stats">
            <div className="stat-item">
              <span className="stat-number">{prescriptions.length}</span>
              <span className="stat-label">Total Prescriptions</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{statusCounts.active}</span>
              <span className="stat-label">Active</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{statusCounts.completed}</span>
              <span className="stat-label">Completed</span>
            </div>
          </div>
        </header>

        <div className="prescriptions-controls">
          <div className="search-filter-section">
            <div className="search-box">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search medications, codes, or doctors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="filter-box">
              <Filter size={20} />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          <button className="export-button" onClick={handleExport}>
            <Download size={18} />
            Export Report
          </button>
        </div>

        <div className="prescriptions-content">
          {filteredPrescriptions.length === 0 ? (
            <div className="no-prescriptions">
              <Pill size={48} className="text-gray-400" />
              <h3>No prescriptions found</h3>
              <p>
                {searchTerm || filterStatus !== "all" 
                  ? "No prescriptions match your search criteria" 
                  : "You don't have any prescription history yet"
                }
              </p>
            </div>
          ) : (
            <div className="prescriptions-grid">
              {filteredPrescriptions.map((prescription) => (
                <PrescriptionCard
                  key={prescription._id}
                  prescription={prescription}
                  onClick={() => handlePrescriptionClick(prescription)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}