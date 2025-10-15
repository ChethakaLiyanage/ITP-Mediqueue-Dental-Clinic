import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AppointmentManagement from "./AppointmentManagement";
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
      <span className="breadcrumb-current">My Appointments</span>
    </div>
  );
}

export default function ProfileAppointments() {
  const navigate = useNavigate();

  return (
    <div className="profile-page">
      <div className="profile-container">
        <ProfileBreadcrumb navigate={navigate} />
        <AppointmentManagement />
      </div>
    </div>
  );
}
