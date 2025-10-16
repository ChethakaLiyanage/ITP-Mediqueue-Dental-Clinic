import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api";
import "./managerprofile.css";

export default function ManagerProfilePage() {
  // Get auth data from localStorage
  const auth = useMemo(() => {
    try { 
      return JSON.parse(localStorage.getItem("auth") || "{}");
    } catch (error) { 
      console.error('Error parsing auth data:', error);
      return {}; 
    }
  }, []);
  
  // Debug: Log the entire auth object to see its structure
  useEffect(() => {
    console.log("=== DEBUG: Full auth object ===");
    console.log(JSON.stringify(auth, null, 2));
    console.log("================================");
  }, [auth]);
  
  // Try multiple possible locations for manager code
  const managerCode = 
    auth?.user?.managerCode || 
    auth?.managerCode || 
    auth?.manager?.managerCode ||
    auth?.code ||
    "";
    
  const token = auth?.token || "";
  const navigate = useNavigate();

  // State management
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  
  // Form state
  const [form, setForm] = useState({ 
    name: "",
    email: "", 
    contact_no: "", 
    department: ""
  });

  // Fetch manager profile data using manager code
  const fetchProfile = async () => {
    if (!managerCode) {
      console.error("=== ERROR: No manager code found ===");
      console.error("Auth object:", auth);
      console.error("====================================");
      
      setError("Manager code not found. Please log in again.");
      setLoading(false);
      return;
    }
    
    console.log("Fetching profile for manager code:", managerCode);
    setLoading(true);
    setError(null);
    
    try {
      // Fetch manager data by manager code
      const mRes = await fetch(`${API_BASE}/managers/code/${encodeURIComponent(managerCode)}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!mRes.ok) {
        const errorData = await mRes.json().catch(() => ({}));
        throw new Error(errorData.message || `Error: ${mRes.status}`);
      }
      
      const mData = await mRes.json();
      console.log("Manager data response:", mData);
      
      if (mData && mData.manager) {
        setProfile(mData.manager);
        
        // Fetch user data if userId exists
        const userId = mData.manager.userId;
        if (userId) {
          const uRes = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}`, {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (uRes.ok) {
            const uData = await uRes.json();
            setUser(uData.users || uData.user || null);
          }
        }
      } else {
        throw new Error("No manager data received");
      }
      
    } catch (error) {
      console.error("Error fetching profile:", error);
      setError(`Failed to load profile: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch profile on component mount
  useEffect(() => {
    fetchProfile();
  }, [managerCode, token]);
  
  // Update form when profile or user data changes
  useEffect(() => {
    if (profile || user) {
      setForm({
        name: user?.name || "",
        email: user?.email || "",
        contact_no: user?.contact_no || "",
        department: profile?.department || ""
      });
    }
  }, [profile, user]);
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Save profile changes
  const onSave = async () => {
    // Basic client-side validations
    const email = String(form.email || '').trim();
    const emailOk = email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      alert('Please enter a valid email address');
      return;
    }
    
    const contact = String(form.contact_no || '').replace(/\D/g, '');
    if (contact.length > 10) {
      alert('Mobile number cannot exceed 10 digits');
      return;
    }

    try {
      // Update manager fields
      await fetch(`${API_BASE}/managers/code/${encodeURIComponent(managerCode)}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ department: form.department }),
      });
      
      // Update user fields
      if (user?._id) {
        await fetch(`${API_BASE}/users/${encodeURIComponent(user._id)}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ 
            email: form.email, 
            contact_no: form.contact_no 
          }),
        });
      }
      
      setEditing(false);
      fetchProfile();
      alert('Profile updated successfully');
    } catch (e) {
      console.error('Update error:', e);
      alert(e.message || 'Failed to update');
    }
  };

  const handleLogout = () => {
    try { localStorage.removeItem('auth'); } catch {}
    navigate('/login', { replace: true });
  };

  // Render loading state
  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="profile-container">
        <div className="error-message">
          <h2>Profile Error</h2>
          <p>{error}</p>
          <button 
            className="retry-button"
            onClick={fetchProfile}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render no manager code state
  if (!managerCode) {
    return (
      <div className="profile-container">
        <div className="profile-empty">
          <h3 style={{ marginBottom: '20px' }}>No manager code found. Please log in again.</h3>
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            background: '#f3f4f6', 
            borderRadius: '8px', 
            fontSize: '12px', 
            fontFamily: 'monospace', 
            textAlign: 'left',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            <strong>Debug Info - Auth Object Structure:</strong>
            <pre style={{ marginTop: '10px', overflow: 'auto' }}>
              {JSON.stringify(auth, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // Render profile
  return (
    <div className="profile-container">
      <div className="profile-header">
        <h2 className="profile-title">Manager Profile</h2>
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
            >
              Update
            </button>
          ) : (
            <>
              <button 
                className="profile-btn profile-btn-outline" 
                onClick={() => setEditing(false)}
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

      <div className="profile-content">
        <div className="profile-header-info">
          <h3 className="profile-name">
            {user?.name || 'Unnamed Manager'}
            <span className="profile-code">({managerCode})</span>
          </h3>
        </div>

        <div className="profile-info-grid">
          <div className="profile-field">
            <label className="profile-label">Full Name</label>
            <div className="profile-static">{user?.name || '-'}</div>
          </div>
          
          <div className="profile-field">
            <label className="profile-label">Email</label>
            {editing ? (
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleInputChange}
                className="profile-input"
                required
              />
            ) : (
              <div className="profile-static">{user?.email || '-'}</div>
            )}
          </div>
          
          <div className="profile-field">
            <label className="profile-label">Contact Number</label>
            {editing ? (
              <input
                type="tel"
                name="contact_no"
                value={form.contact_no}
                onChange={handleInputChange}
                className="profile-input"
              />
            ) : (
              <div className="profile-static">{user?.contact_no || '-'}</div>
            )}
          </div>
          
          <div className="profile-field">
            <label className="profile-label">Department</label>
            {editing ? (
              <input
                type="text"
                name="department"
                value={form.department}
                onChange={handleInputChange}
                className="profile-input"
              />
            ) : (
              <div className="profile-static">{profile?.department || '-'}</div>
            )}
          </div>

          <div className="profile-field">
            <label className="profile-label">Manager Code</label>
            <div className="profile-static profile-code">{managerCode}</div>
          </div>

          <div className="profile-field">
            <label className="profile-label">Role</label>
            <div className="profile-static">{user?.role || 'Manager'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}