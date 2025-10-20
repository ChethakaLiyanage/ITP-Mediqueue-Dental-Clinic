import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Mail, Phone, Calendar, MapPin, AlertTriangle, Save } from "lucide-react";
import "./profile.css";

const initialForm = {
  name: "",
  email: "",
  phone: "",
  dob: "",
  gender: "male",
  address: "",
  allergies: "",
};

export default function ProfileUpdate() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    const loadProfile = async () => {
      try {
        const res = await fetch("http://localhost:5000/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          localStorage.removeItem("token");
          window.dispatchEvent(new Event("auth-change"));
          navigate("/login", { replace: true });
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "Unable to load profile");
        }

        const data = await res.json();
        const user = data.user || {};
        const patient = data.patient || {};

        setForm({
          name: user.name || "",
          email: user.email || "",
          phone: user.contact_no || "",
          dob: patient.dob ? new Date(patient.dob).toISOString().slice(0, 10) : "",
          gender: patient.gender || "male",
          address: patient.address || "",
          allergies: patient.allergies || "",
        });
      } catch (err) {
        setError(err.message || "Unable to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        dob: form.dob,
        gender: form.gender,
        address: form.address,
        allergies: form.allergies || "",
      };
      
      console.log("Sending profile update:", updateData);
      console.log("Token exists:", !!token);
      
      const res = await fetch("http://localhost:5000/auth/update-profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (res.status === 401) {
        console.error("Unauthorized - token may be invalid or expired");
        localStorage.removeItem("token");
        window.dispatchEvent(new Event("auth-change"));
        navigate("/login", { replace: true });
        return;
      }

      if (!res.ok) {
        console.error("Update failed with status:", res.status, "Data:", data);
        throw new Error(data.message || data.errors?.[0] || "Failed to update profile");
      }

      setMessage(data.message || "Profile updated successfully");
      setTimeout(() => navigate("/profile"), 800);
    } catch (err) {
      setError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="profile-loading-container">
            <div className="profile-loading-card">
              <div className="profile-loading-spinner" />
              <p className="profile-loading-text">Loading your profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        {/* Breadcrumb */}
        <div className="profile-breadcrumb">
          <button 
            className="breadcrumb-back-btn"
            onClick={() => navigate("/profile")}
          >
            <ArrowLeft size={16} />
            Back to Profile
          </button>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Update Profile</span>
        </div>

        <div className="profile-info-card">
          <div className="profile-info-header">
            <h3 className="profile-info-title">
              <User className="text-blue-600" size={20} />
              Update Your Information
            </h3>
            <p className="profile-info-subtitle">
              Keep your personal information up to date
            </p>
          </div>

          {error && (
            <div className="profile-alert profile-alert-error">
              <AlertTriangle size={20} />
              <span>{error}</span>
            </div>
          )}
          
          {message && (
            <div className="profile-alert profile-alert-success">
              <Save size={20} />
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="profile-update-form">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">
                  <User size={16} />
                  Full Name
                </label>
                <input 
                  type="text"
                  name="name" 
                  value={form.name} 
                  onChange={handleChange} 
                  className="form-input"
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Mail size={16} />
                  Email Address
                </label>
                <input 
                  type="email" 
                  name="email" 
                  value={form.email} 
                  onChange={handleChange} 
                  className="form-input"
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Phone size={16} />
                  Phone Number
                </label>
                <input 
                  type="text"
                  name="phone" 
                  value={form.phone} 
                  onChange={handleChange} 
                  className="form-input"
                  placeholder="Enter phone number" 
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <Calendar size={16} />
                  Date of Birth
                </label>
                <input 
                  type="date" 
                  name="dob" 
                  value={form.dob} 
                  onChange={handleChange} 
                  className="form-input"
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <User size={16} />
                  Gender
                </label>
                <select 
                  name="gender" 
                  value={form.gender} 
                  onChange={handleChange} 
                  className="form-input"
                  required
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group form-group-full">
                <label className="form-label">
                  <MapPin size={16} />
                  Address
                </label>
                <textarea 
                  name="address" 
                  value={form.address} 
                  onChange={handleChange} 
                  className="form-textarea"
                  rows={3}
                  required 
                />
              </div>

              <div className="form-group form-group-full">
                <label className="form-label">
                  <AlertTriangle size={16} />
                  Allergies (Optional)
                </label>
                <textarea 
                  name="allergies" 
                  value={form.allergies} 
                  onChange={handleChange} 
                  className="form-textarea"
                  rows={3}
                  placeholder="List any known allergies or medications you're allergic to"
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate("/profile")}
                disabled={saving}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn-primary"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <div className="btn-spinner" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}