import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./profileupdate.css";

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
      // First get the user ID from the profile
      const profileRes = await fetch("http://localhost:5000/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!profileRes.ok) {
        throw new Error("Unable to get user ID");
      }
      
      const profileData = await profileRes.json();
      const userId = profileData.user?._id || profileData.user?.id;
      
      if (!userId) {
        throw new Error("User ID not found");
      }
      
      const updateData = {
        name: form.name,
        email: form.email,
        contact_no: form.phone,
      };
      
      console.log("Sending profile update:", updateData);
      
      const res = await fetch(`http://localhost:5000/users/${userId}`, {
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
        localStorage.removeItem("token");
        window.dispatchEvent(new Event("auth-change"));
        navigate("/login", { replace: true });
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || "Failed to update profile");
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
    return <div className="form-wrap">Loading profile...</div>;
  }

  return (
    <div className="form-wrap">
      <h2>Update Profile</h2>
      {error && <div className="msg" style={{ color: "crimson" }}>{error}</div>}
      {message && <div className="msg" style={{ color: "#065f46" }}>{message}</div>}

      <form onSubmit={handleSubmit}>
        <label>
          Name
          <input name="name" value={form.name} onChange={handleChange} required />
        </label>
        <label>
          Email
          <input type="email" name="email" value={form.email} onChange={handleChange} required />
        </label>
        <label>
          Phone
          <input name="phone" value={form.phone} onChange={handleChange} placeholder="Enter phone number" />
        </label>
        <label>
          Date of Birth
          <input type="date" name="dob" value={form.dob} onChange={handleChange} required />
        </label>
        <label>
          Gender
          <select name="gender" value={form.gender} onChange={handleChange} required>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Address
          <textarea name="address" value={form.address} onChange={handleChange} required rows={3} />
        </label>
        <label>
          Allergies
          <textarea name="allergies" value={form.allergies} onChange={handleChange} rows={3} />
        </label>

        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button
            type="button"
            style={{ background: "#e5e7eb", color: "#111827", padding: "10px 12px", borderRadius: 8, border: "none" }}
            onClick={() => navigate("/profile")}
          >
            Cancel
          </button>
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}