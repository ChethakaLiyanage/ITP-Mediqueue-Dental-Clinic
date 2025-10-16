import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../api";
import { useAuth } from "../../Contexts/AuthContext";
import "./receptionistprofile.css";

const MASKED_PASSWORD = "********";

const DEFAULT_FORM = {
  name: "",
  email: "",
  contact_no: "",
  role: "Receptionist",
  receptionistCode: "",
  deskNo: "",
  passwordMask: MASKED_PASSWORD,
};

function readStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem("auth") || "{}") || {};
  } catch (err) {
    console.warn("Failed to parse stored auth", err);
    return {};
  }
}

export default function ReceptionistProfile() {
  const { token, user, updateUser } = useAuth();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: string }
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const storedAuth = useMemo(() => readStoredAuth(), []);
  const authToken = token || storedAuth.token || null;
  const storedReceptionistCode = user?.receptionistCode || storedAuth?.user?.receptionistCode || null;

  const showMessage = useCallback((type, text) => {
    if (!text) {
      setMessage(null);
      return;
    }
    setMessage({ type, text });
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!authToken) {
      setLoading(false);
      showMessage("error", "You must be signed in as a receptionist to view this page.");
      return;
    }

    setLoading(true);
    showMessage(null, null);

    try {
      const headers = {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      };

      const profileRes = await fetch(`${API_BASE}/auth/receptionist/me`, { headers });
      const profileJson = await profileRes.json().catch(() => ({}));

      if (!profileRes.ok) {
        throw new Error(profileJson?.message || `Request failed with status ${profileRes.status}`);
      }

      const profileUser = profileJson?.user || {};
      const receptionistDetails = profileJson?.receptionist || {};

      let receptionistCode = receptionistDetails?.receptionistCode || profileUser?.receptionistCode || storedReceptionistCode || "";

      if (!receptionistCode && profileUser?._id) {
        try {
          const codeRes = await fetch(`${API_BASE}/api/receptionist/by-user/${profileUser._id}`, { headers });
          if (codeRes.ok) {
            const codeJson = await codeRes.json();
            receptionistCode = codeJson?.receptionist?.receptionistCode || receptionistCode;
          }
        } catch (err) {
          console.warn("Failed to fetch receptionist code", err);
        }
      }

      setForm({
        name: profileUser.name || "",
        email: profileUser.email || "",
        contact_no: profileUser.contact_no || "",
        role: profileUser.role || "Receptionist",
        receptionistCode: receptionistCode || "",
        deskNo: receptionistDetails?.deskNo || "",
        passwordMask: MASKED_PASSWORD,
      });
      setIsEditing(false);
      setHasChanges(false);


      if (typeof updateUser === "function") {
        updateUser({
          name: profileUser.name,
          email: profileUser.email,
          contact_no: profileUser.contact_no,
          receptionistCode: receptionistCode || null,
        });
      }
    } catch (err) {
      console.error("Failed to load receptionist profile", err);
      showMessage("error", err?.message || "Unable to load profile details.");
    } finally {
      setLoading(false);
    }
  }, [authToken, showMessage, storedReceptionistCode, updateUser]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (isEditing) {
      setHasChanges(true);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isEditing) {
      return;
    }

    if (!hasChanges) {
      showMessage("error", "Please update a field before saving.");
      return;
    }

    if (!authToken) {
      showMessage("error", "Authentication token missing. Please log in again.");
      return;
    }

    if (form.contact_no && !/^\d{10}$/.test(form.contact_no)) {
      showMessage("error", "Contact number must be exactly 10 digits.");
      return;
    }

    setSaving(true);
    showMessage(null, null);

    try {
      const res = await fetch(`${API_BASE}/auth/receptionist/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          contact_no: form.contact_no || "",
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || `Request failed with status ${res.status}`);
      }

      const updatedUser = json?.user || {};
      const receptionistDetails = json?.receptionist || {};
      const receptionistCode = receptionistDetails?.receptionistCode || updatedUser?.receptionistCode || form.receptionistCode;

      setForm((prev) => ({
        ...prev,
        name: updatedUser.name ?? prev.name,
        email: updatedUser.email ?? prev.email,
        contact_no: updatedUser.contact_no ?? prev.contact_no,
        receptionistCode: receptionistCode || "",
        deskNo: receptionistDetails?.deskNo ?? prev.deskNo,
        passwordMask: MASKED_PASSWORD,
      }));

      if (typeof updateUser === "function") {
        updateUser({
          name: updatedUser.name,
          email: updatedUser.email,
          contact_no: updatedUser.contact_no,
          receptionistCode: receptionistCode || null,
        });
      }

      setHasChanges(false);
      setIsEditing(false);
      showMessage("success", "Profile updated successfully.");
    } catch (err) {
      console.error("Failed to update receptionist profile", err);
      showMessage("error", err?.message || "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setHasChanges(false);
    showMessage(null, null);
  };

  if (loading) {
    return (
      <div className="rc-prof-wrap">
        <div className="rc-prof-card loading">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="rc-prof-wrap">
      <form className="rc-prof-card" onSubmit={handleSubmit}>
        <h2>My Profile</h2>

        {form.receptionistCode && (
          <div className="rc-prof-row">
            <label>Receptionist Code</label>
            <input type="text" value={form.receptionistCode} disabled />
          </div>
        )}

        {form.deskNo && (
          <div className="rc-prof-row">
            <label>Desk No</label>
            <input type="text" value={form.deskNo} disabled />
          </div>
        )}

        <div className="rc-prof-row">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" value={form.name} onChange={handleChange} required disabled={!isEditing} />
        </div>

        <div className="rc-prof-row">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" value={form.email} onChange={handleChange} required disabled={!isEditing} />
        </div>

        <div className="rc-prof-row">
          <label htmlFor="contact_no">Contact No</label>
          <input
            id="contact_no"
            name="contact_no"
            value={form.contact_no}
            onChange={handleChange}
            placeholder="Enter 10 digit number"
            disabled={!isEditing}
          />
        </div>

        <div className="rc-prof-row">
          <label>Role</label>
          <input value={form.role || "Receptionist"} disabled />
        </div>

        <div className="rc-prof-row">
          <label>Password</label>
          <input type="password" value={form.passwordMask} disabled />
        </div>

        {message && (
          <div className={`rc-prof-msg ${message.type ? `rc-prof-msg--${message.type}` : ""}`}>
            {message.text}
          </div>
        )}

        <div className="rc-prof-actions">
          {isEditing ? (
            <button type="submit" disabled={saving || !hasChanges}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          ) : (
            <button type="button" onClick={handleStartEdit}>
              Update Profile
            </button>
          )}
        </div>
      </form>
    </div>
  );
}


