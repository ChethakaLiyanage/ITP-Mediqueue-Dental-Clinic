import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import { API_BASE } from "../api";
import "./dentistprofile.css";

export default function DentistProfilePage() {
  const navigate = useNavigate();
  const { user, token, loading: authLoading } = useAuth();
  
  const dentistCode = user?.dentistCode || "";

  const [profile, setProfile] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ contact_no: "", email: "", availability: {} });

  // Redirect if not authenticated or not a dentist
  useEffect(() => {
    if (!authLoading) {
      if (!token) {
        navigate("/login");
        return;
      }
      if (user?.role !== "Dentist") {
        navigate("/");
        return;
      }
    }
  }, [user, token, authLoading, navigate]);

  // Create authenticated fetch helper
  const authenticatedFetch = useCallback(async (url, options = {}) => {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    try {
      const response = await fetch(url, { ...options, headers });
      return response;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }, [token]);

  const fetchProfile = useCallback(async () => {
    if (!dentistCode || !token) {
      console.error("No dentist code or token found");
      setLoading(false);
      return;
    }
    
    // console.log("Fetching profile for dentist code:", dentistCode);
    // console.log("Setting loading to true");
    setLoading(true);
    setError(null);
    
    try {
      const dRes = await authenticatedFetch(`${API_BASE}/dentists/code/${encodeURIComponent(dentistCode)}`);
      const dData = await dRes.json();
      
      // console.log("Dentist data response:", dData);
      // console.log("🔍 DEBUG: About to set profile data");
      
      if (dRes.ok) {
        // console.log("Setting profile data:", dData);
        setProfile(dData || null);
        // The dentist data already has populated userId with user details
        if (dData?.userId) {
          // console.log("Setting user profile data:", dData.userId);
          setUserProfile(dData.userId);
        }
      } else {
        console.error("Failed to fetch dentist:", dData);
        setError(dData.message || "Failed to fetch dentist profile");
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError("Network error while fetching profile");
    }
    // console.log("Setting loading to false");
    setLoading(false);
  }, [dentistCode, token, authenticatedFetch]);

  useEffect(() => {
    if (!authLoading && dentistCode && token) {
      // console.log("🔄 useEffect triggered - calling fetchProfile");
      fetchProfile();
    }
  }, [authLoading, dentistCode, token]);

  useEffect(() => {
    if (profile || userProfile) {
      setForm({
        contact_no: userProfile?.contact_no || user?.contact_no || "",
        email: userProfile?.email || user?.email || "",
        availability: profile?.availability_schedule || {},
      });
    }
  }, [profile, userProfile, user]);

  const onSave = async () => {
    // basic client-side validations
    // 1) email format
    const email = String(form.email || '').trim();
    const emailOk = email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      alert('Please enter a valid email address');
      return;
    }
    // 2) contact number max 10 digits
    const contact = String(form.contact_no || '').replace(/\D/g, '');
    if (contact.length > 10) {
      alert('Mobile number cannot exceed 10 digits');
      return;
    }
    // 3) availability time ranges validation (when editing)
    // Each entry like "09:00-12:00" must have end >= start
    const avail = form.availability || {};
    const invalidRange = Object.values(avail).some((arr) =>
      (Array.isArray(arr) ? arr : []).some((slot) => {
        const m = /^\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*$/.exec(String(slot));
        if (!m) return false; // ignore unparsable; backend may reject later
        const [_, from, to] = m;
        return to < from; // lexical works for HH:MM 24h
      })
    );
    if (invalidRange) {
      alert('In Availability, each time range must have the end time not before the start time');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // update availability
      const dRes = await authenticatedFetch(`${API_BASE}/dentists/code/${encodeURIComponent(dentistCode)}`, {
        method: 'PUT',
        body: JSON.stringify({ availability_schedule: form.availability }),
      });

      if (!dRes.ok) {
        const dData = await dRes.json();
        throw new Error(dData.message || 'Failed to update availability');
      }

      // update user fields
      if (userProfile?._id) {
        const uRes = await authenticatedFetch(`${API_BASE}/users/${encodeURIComponent(userProfile._id)}`, {
          method: 'PUT',
          body: JSON.stringify({ email: form.email, contact_no: form.contact_no }),
        });

        if (!uRes.ok) {
          const uData = await uRes.json();
          throw new Error(uData.message || 'Failed to update user profile');
        }
      }

      setEditing(false);
      await fetchProfile();
      alert('Profile updated successfully!');
    } catch (e) {
      console.error('Error updating profile:', e);
      setError(e.message || 'Failed to update profile');
      alert(e.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    // The logout functionality should be handled by the AuthContext
    // For now, just redirect to login
    navigate('/login', { replace: true });
  };

  // console.log("🚀 RENDER: DentistProfilePage - authLoading:", authLoading, "loading:", loading, "profile:", !!profile, "dentistCode:", dentistCode);

  if (authLoading) {
    return (
      <div className="profile-container">
        <div className="profile-header">
          <h2 className="profile-title">Dentist Profile</h2>
        </div>
        <div className="profile-loading">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h2 className="profile-title">Dentist Profile</h2>
        <div className="profile-actions">
          <button
            className="profile-btn profile-btn-logout"
            onClick={handleLogout}
          >
            Log out
          </button>
          {!editing ? (
            <button 
              className="profile-btn profile-btn-primary" 
              onClick={() => setEditing(true)}
              disabled={loading}
            >
              Update
            </button>
          ) : (
            <>
              <button 
                className="profile-btn profile-btn-outline" 
                onClick={() => setEditing(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                className="profile-btn profile-btn-success" 
                onClick={onSave}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="profile-error">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
            <button 
              className="error-close"
              onClick={() => setError(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {(() => {
        // console.log("Render debug - loading:", loading, "profile:", profile, "dentistCode:", dentistCode);
        return null;
      })()}
      
      {loading && !profile ? (
        <div className="profile-loading">
          <div className="loading-spinner"></div>
          <p>Loading profile...</p>
        </div>
      ) : !dentistCode ? (
        <div className="profile-empty">
          <div className="empty-content">
            <div className="empty-icon">👤</div>
            <h3>No dentist code found</h3>
            <p>Please log in again to access your profile.</p>
          </div>
        </div>
      ) : !profile ? (
        <div className="profile-empty">
          <div className="empty-content">
            <div className="empty-icon">🔍</div>
            <h3>No profile found</h3>
            <p>No profile found for dentist code: {dentistCode}</p>
          </div>
        </div>
      ) : (
        <div className="profile-content">
          <div className="profile-header-info">
            <h3 className="profile-name">
              {userProfile?.name || user?.name || 'Unnamed'}
              <span className="profile-code">({dentistCode})</span>
            </h3>
          </div>
          
          <div className="profile-grid">
            <div className="profile-field">
              <label className="profile-label">Email</label>
              {editing ? (
                <input 
                  className="profile-input" 
                  value={form.email} 
                  onChange={(e) => setForm({...form, email: e.target.value})} 
                />
              ) : (
                <div className="profile-static">{userProfile?.email || user?.email || '-'}</div>
              )}
            </div>
            
            <div className="profile-field">
              <label className="profile-label">Contact No</label>
              {editing ? (
                <input 
                  className="profile-input" 
                  value={form.contact_no} 
                  onChange={(e) => setForm({...form, contact_no: e.target.value})} 
                />
              ) : (
                <div className="profile-static">{userProfile?.contact_no || user?.contact_no || '-'}</div>
              )}
            </div>
            
            <div className="profile-field">
              <label className="profile-label">License No</label>
              <div className="profile-static">{profile.license_no || '-'}</div>
            </div>
            
            <div className="profile-field">
              <label className="profile-label">Specialization</label>
              <div className="profile-static">{profile.specialization || '-'}</div>
            </div>
          </div>
          
          {profile.photo?.url && (
            <div className="profile-photo">
              <img src={profile.photo.url} alt="Dentist" />
            </div>
          )}
          
          <div className="availability-section">
            <div className="availability-title">Availability</div>
            {editing ? (
              (() => {
                const order = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]; 
                const avail = form.availability || {}; 
                const rows = order.map((d) => {
                  const timeValue = avail[d];
                  let times = [];
                  if (Array.isArray(timeValue)) {
                    times = timeValue;
                  } else if (typeof timeValue === 'string' && timeValue.trim()) {
                    // Split comma-separated time slots
                    times = timeValue.split(',').map(t => t.trim()).filter(Boolean);
                  }
                  return { day: d, times };
                });
                const onChangeDay = (day, value) => {
                  const parts = String(value || "").split(",").map(s => s.trim()).filter(Boolean);
                  setForm(prev => ({ ...prev, availability: { ...(prev.availability || {}), [day]: parts } }));
                };
                return (
                  <div className="availability-table-wrapper">
                    <table className="availability-table">
                      <thead>
                        <tr>
                          <th>Day</th>
                          <th>Time (comma-separated, e.g., 09:00-12:00, 13:00-17:00)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i}>
                            <td className="availability-day">{r.day}</td>
                            <td>
                              <input
                                className="availability-time-input"
                                value={r.times.join(", ")}
                                onChange={(e) => onChangeDay(r.day, e.target.value)}
                                placeholder="e.g., 09:00-12:00, 13:00-17:00"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            ) : (
              (() => {
                const order = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]; 
                const avail = profile?.availability_schedule || {}; 
                
                // Map database day names to display day names
                const dayMapping = {
                  'monday': 'Mon',
                  'tuesday': 'Tue', 
                  'wednesday': 'Wed',
                  'thursday': 'Thu',
                  'friday': 'Fri',
                  'saturday': 'Sat',
                  'sunday': 'Sun'
                };
                
                const rows = order
                  .filter((d) => {
                    // Check both abbreviated and full day names
                    const dbDayName = Object.keys(dayMapping).find(key => dayMapping[key] === d);
                    const timeValue = avail[d] || (dbDayName ? avail[dbDayName] : null);
                    return typeof timeValue !== 'undefined' && timeValue && String(timeValue).trim();
                  })
                  .map((d) => {
                    // Check both abbreviated and full day names
                    const dbDayName = Object.keys(dayMapping).find(key => dayMapping[key] === d);
                    const timeValue = avail[d] || (dbDayName ? avail[dbDayName] : null);
                    let times = [];
                    
                    if (Array.isArray(timeValue)) {
                      times = timeValue;
                    } else if (typeof timeValue === 'string' && timeValue.trim()) {
                      // Split comma-separated time slots
                      times = timeValue.split(',').map(t => t.trim()).filter(Boolean);
                    } else if (typeof timeValue === 'object' && timeValue.start && timeValue.end && timeValue.available) {
                      // Handle new object format: { start: '09:00', end: '17:00', available: true }
                      times = [`${timeValue.start}-${timeValue.end}`];
                    }
                    return { day: d, times };
                  });
                return (
                  <div className="availability-table-wrapper">
                    <table className="availability-table">
                      <thead>
                        <tr>
                          <th>Day</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="availability-empty">
                              No availability defined.
                            </td>
                          </tr>
                        ) : rows.map((r, i) => (
                          <tr key={i}>
                            <td className="availability-day">{r.day}</td>
                            <td className="availability-time">
                              {r.times.length ? r.times.join(", ") : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
}
