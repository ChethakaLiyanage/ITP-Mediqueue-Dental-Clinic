// src/Components/Treatments/TreatmentDetail.js
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Activity,
  Calendar,
  User,
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle,
  Archive,
  Download,
  Printer,
  Phone,
  Trash2,
  Loader,
  Pill,
  Home,
  ChevronRight,
} from "lucide-react";
import "./treatment-detail.css";

function ProfileBreadcrumb({ navigate, planCode }) {
  return (
    <div className="profile-breadcrumb">
      <button className="breadcrumb-item" onClick={() => navigate("/profile")}>
        <Home size={16} /> Profile
      </button>
      <ChevronRight size={16} className="breadcrumb-separator" />
      <button
        className="breadcrumb-item"
        onClick={() => navigate("/profile/treatments")}
      >
        Treatments
      </button>
      <ChevronRight size={16} className="breadcrumb-separator" />
      <span className="breadcrumb-current">
        {planCode || "Treatment Details"}
      </span>
    </div>
  );
}

export default function TreatmentDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [treatment, setTreatment] = useState(location.state?.treatment || null);
  const [loading, setLoading] = useState(!treatment);
  const [error, setError] = useState("");
  const [prescriptions, setPrescriptions] = useState([]);

  useEffect(() => {
    if (!treatment) {
      fetchTreatment();
    } else {
      fetchRelatedPrescriptions(treatment);
    }
  }, [id]);

  const fetchTreatment = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await fetch(
        `http://localhost:5000/api/treatmentplans/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.status === 401) {
        navigate("/login");
        return;
      }

      if (!response.ok) throw new Error("Treatment plan not found");

      const data = await response.json();
      setTreatment(data.treatment);
      fetchRelatedPrescriptions(data.treatment);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedPrescriptions = async (treatmentData) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:5000/api/treatmentplans/${treatmentData._id}/prescriptions`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setPrescriptions(data.prescriptions || []);
      }
    } catch (err) {
      console.error("Error fetching related prescriptions:", err);
    }
  };

  const handlePrint = () => window.print();

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:5000/api/treatmentplans/${treatment._id}/download`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `treatment_plan_${treatment.planCode}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const formatDate = (date) =>
    new Date(date).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="treatment-detail-page">
        <ProfileBreadcrumb navigate={navigate} />
        <div className="treatment-detail-loading">
          <Loader className="animate-spin" size={32} />
          <p>Loading treatment plan details...</p>
        </div>
      </div>
    );
  }

  if (error || !treatment) {
    return (
      <div className="treatment-detail-page">
        <ProfileBreadcrumb navigate={navigate} />
        <div className="treatment-detail-error">
          <AlertTriangle size={48} className="text-red-500" />
          <h2>Error</h2>
          <p>{error || "Treatment plan not found"}</p>
          <button
            onClick={() => navigate("/profile/treatments")}
            className="btn-primary"
          >
            Back to Treatments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="treatment-detail-page">
      <ProfileBreadcrumb navigate={navigate} planCode={treatment.planCode} />
      <header className="treatment-detail-header">
        <button
          className="back-button"
          onClick={() => navigate("/profile/treatments")}
        >
          <ArrowLeft size={20} /> Back to Treatments
        </button>
        <div className="treatment-detail-title">
          <Activity className="text-green-600" size={32} />
          <div>
            <h1>{treatment.diagnosis}</h1>
            <p>Plan {treatment.planCode}</p>
          </div>
        </div>
        <div className="treatment-actions">
          <button className="action-btn secondary" onClick={handleDownload}>
            <Download size={18} /> Download
          </button>
          <button className="action-btn primary" onClick={handlePrint}>
            <Printer size={18} /> Print
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="treatment-detail-content">
        <div className="treatment-main-card">
          <h3>
            <FileText size={20} /> Diagnosis
          </h3>
          <p>{treatment.diagnosis}</p>
          {treatment.treatment_notes && (
            <>
              <h3>
                <FileText size={20} /> Notes
              </h3>
              <p>{treatment.treatment_notes}</p>
            </>
          )}
          <p>
            <Calendar size={16} /> Created: {formatDate(treatment.created_date)}
          </p>
          <p>
            <Clock size={16} /> Updated: {formatDate(treatment.updated_date)}
          </p>
        </div>

        {prescriptions.length > 0 && (
          <div className="info-card">
            <h3>
              <Pill size={20} /> Related Prescriptions
            </h3>
            {prescriptions.map((p) => (
              <div key={p._id} className="prescription-item">
                <strong>{p.prescriptionCode}</strong>
                <button
                  className="btn-outline small"
                  onClick={() =>
                    navigate(`/profile/prescriptions/${p._id}`, {
                      state: { prescription: p },
                    })
                  }
                >
                  View
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
