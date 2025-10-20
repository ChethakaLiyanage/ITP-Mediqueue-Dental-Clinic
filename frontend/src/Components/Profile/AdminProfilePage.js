import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api";
import "./adminprofile.css";

export default function AdminProfilePage() {
  const auth = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("auth") || "{}"); } catch { return {}; }
  }, []);
  
  // Debug: Log auth structure
  useEffect(() => {
    console.log("=== ADMIN DEBUG: Auth object ===");
    console.log(JSON.stringify(auth, null, 2));
    console.log("================================");
  }, [auth]);
  
  // Check multiple possible locations for admin code
  const adminCode = 
    auth?.adminCode || 
    auth?.user?.adminCode || 
    auth?.admin?.adminCode ||
    "";
    
  const token = auth?.token || "";
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ 
    name: "", 
    email: "", 
    contact_no: "", 
    permission: [],
    isActive: true 
  });

  const fetchProfile = async () => {
    if (!adminCode) {
      console.error("=== ADMIN ERROR: No admin code found ===");
      console.error("Auth object:", auth);
      console.error("========================================");
      return;
    }
    
    setLoading(true);
    try {
      // Fetch admin profile by adminCode
      const url = `${API_BASE}/admin/code/${encodeURIComponent(adminCode)}`;
      console.log("=== ADMIN DEBUG: Fetching URL ===");
      console.log("URL:", url);
      console.log("Admin Code:", adminCode);
      console.log("================================");
      
      const adminRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      console.log("=== ADMIN DEBUG: Response ===");
      console.log("Status:", adminRes.status);
      console.log("OK:", adminRes.ok);
      console.log("================================");
      
      const adminData = await adminRes.json();
      console.log("=== ADMIN DEBUG: Full Response ===");
      console.log("Admin Data:", JSON.stringify(adminData, null, 2));
      console.log("Admin Object:", adminData.admin);
      console.log("User ID Object:", adminData.admin?.userId);
      console.log("===================================");
      
      if (adminRes.ok && adminData.admin) {
        setProfile(adminData.admin);
        
        // The admin data already includes populated userId with user details
        if (adminData.admin.userId) {
          console.log("Setting user data:", adminData.admin.userId);
          setUser(adminData.admin.userId);
        } else {
          console.log("No userId found in admin data");
        }
      } else {
        console.error("=== ADMIN ERROR: API Response ===");
        console.error("Status:", adminRes.status);
        console.error("Data:", adminData);
        console.error("==================================");
      }
    } catch (error) {
      console.error("=== ADMIN ERROR: Fetch Error ===");
      console.error("Error:", error);
      console.error("Message:", error.message);
      console.error("=================================");
    }
    setLoading(false);
  };

  useEffect(() => { 
    fetchProfile(); 
  }, [adminCode, token]);

  useEffect(() => {
    console.log("=== ADMIN DEBUG: Form Initialization ===");
    console.log("Profile:", profile);
    console.log("User:", user);
    console.log("Profile.userId:", profile?.userId);
    console.log("========================================");
    
    if (profile) {
      // Use user state if available, otherwise fall back to populated userId
      const userData = user || profile.userId;
      console.log("UserData for form:", userData);
      
      if (userData) {
        const formData = {
          name: userData?.name || "",
          email: userData?.email || userData?.gmail || "",
          contact_no: userData?.contact_no || userData?.phone || "",
          permission: profile?.permission || [],
          isActive: userData?.isActive !== false
        };
        console.log("Setting form data:", formData);
        setForm(formData);
      }
    }
  }, [profile, user]);

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

    if (!form.name.trim()) {
      alert('Name is required');
      return;
    }

    try {
      // Update user information
      if (user?._id) {
        await fetch(`${API_BASE}/users/${encodeURIComponent(user._id)}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json', 
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({ 
            name: form.name,
            email: form.email,
            contact_no: form.contact_no,
            isActive: form.isActive
          }),
        });
      }

      // Update admin permissions if needed
      if (profile?._id) {
        await fetch(`${API_BASE}/admin/${encodeURIComponent(profile._id)}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json', 
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({ 
            permission: form.permission 
          }),
        });
      }

      setEditing(false);
      fetchProfile();
      alert('Profile updated successfully');
    } catch (error) {
      console.error("Error updating profile:", error);
      alert('Failed to update profile. Please try again.');
    }
  };

  const handleLogout = () => {
    try { 
      localStorage.removeItem('auth'); 
    localStorage.removeItem('token');
    window.dispatchEvent(new Event("auth-change"));
    window.dispatchEvent(new Event("storage"));
    } catch (error) {
      console.error("Error during logout:", error);
    }
    navigate('/login', { replace: true });
  };

  const handlePermissionChange = (permission) => {
    setForm(prev => ({
      ...prev,
      permission: prev.permission.includes(permission)
        ? prev.permission.filter(p => p !== permission)
        : [...prev.permission, permission]
    }));
  };

  const availablePermissions = [
    'manage_users',
    'manage_staff', 
    'manage_appointments',
    'manage_patients',
    'view_reports',
    'system_settings',
    'audit_logs',
    'full_access'
  ];

  // Show debug info if no admin code
  if (!adminCode) {
    return (
      <div className="admin-profile-container">
        <div className="admin-profile-empty">
          <h3>No admin code found. Please log in again.</h3>
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            background: '#f3f4f6', 
            borderRadius: '8px', 
            fontSize: '12px', 
            fontFamily: 'monospace', 
            textAlign: 'left',
            maxWidth: '600px',
            margin: '20px auto'
          }}>
            <strong>Debug Info - Auth Object:</strong>
            <pre style={{ marginTop: '10px', overflow: 'auto' }}>
              {JSON.stringify(auth, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-profile-container">
      <div className="admin-profile-header">
        <div className="admin-profile-title-section">
          <h2 className="admin-profile-title">Admin Profile</h2>
          {!loading && profile && (
            <div className="admin-profile-info-card">
              <div className="admin-profile-avatar">
                <span className="admin-profile-avatar-icon">👤</span>
              </div>
              <div className="admin-profile-basic-info">
                <h3 className="admin-profile-name">
                  Admin {user?.name || profile?.userId?.name || 'Unknown'}
                </h3>
                <p className="admin-profile-code">Code: {adminCode}</p>
              </div>
            </div>
          )}
        </div>
        
        <div className="admin-profile-actions">
          <button
            className="admin-profile-btn admin-profile-btn-logout"
            onClick={handleLogout}
          >
            Log out
          </button>
          {!editing ? (
            <button 
              className="admin-profile-btn admin-profile-btn-primary" 
              onClick={() => setEditing(true)}
              disabled={loading || !profile}
            >
              Update
            </button>
          ) : (
            <>
              <button 
                className="admin-profile-btn admin-profile-btn-outline" 
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button 
                className="admin-profile-btn admin-profile-btn-success" 
                onClick={onSave}
              >
                Save
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="admin-profile-loading">Loading profile...</div>
      ) : !profile ? (
        <div className="admin-profile-empty">No profile found for admin code: {adminCode}</div>
      ) : (
        <div className="admin-profile-content">
          {/* Personal Information Section */}
          <div className="admin-profile-grid">
            <div className="admin-profile-field">
              <label className="admin-profile-label">Full Name *</label>
              {editing ? (
                <input 
                  className="admin-profile-input" 
                  value={form.name} 
                  onChange={(e) => setForm({...form, name: e.target.value})}
                  placeholder="Enter full name"
                  required
                />
              ) : (
                <div className="admin-profile-static">{user?.name || profile?.userId?.name || '-'}</div>
              )}
            </div>
            
            <div className="admin-profile-field">
              <label className="admin-profile-label">Email Address *</label>
              {editing ? (
                <input 
                  className="admin-profile-input" 
                  type="email"
                  value={form.email} 
                  onChange={(e) => setForm({...form, email: e.target.value})}
                  placeholder="Enter email address"
                />
              ) : (
                <div className="admin-profile-static">{user?.email || user?.gmail || profile?.userId?.email || '-'}</div>
              )}
            </div>
            
            <div className="admin-profile-field">
              <label className="admin-profile-label">Contact Number</label>
              {editing ? (
                <input 
                  className="admin-profile-input" 
                  value={form.contact_no} 
                  onChange={(e) => setForm({...form, contact_no: e.target.value})}
                  placeholder="Enter contact number"
                  maxLength="10"
                />
              ) : (
                <div className="admin-profile-static">{user?.contact_no || user?.phone || profile?.userId?.contact_no || '-'}</div>
              )}
            </div>

            <div className="admin-profile-field">
              <label className="admin-profile-label">Role</label>
              <div className="admin-profile-static">
                <span className="admin-role-badge">Admin</span>
              </div>
              <small className="admin-profile-note">Role cannot be changed after creation</small>
            </div>
          </div>

          {/* Permissions Section */}
          <div className="admin-profile-section">
            <h3 className="admin-profile-section-title">Permissions</h3>
            {editing ? (
              <div className="admin-permission-grid">
                {availablePermissions.map(permission => (
                  <div key={permission} className="admin-permission-item">
                    <input
                      type="checkbox"
                      id={permission}
                      checked={form.permission.includes(permission)}
                      onChange={() => handlePermissionChange(permission)}
                    />
                    <label htmlFor={permission} className="admin-permission-label">
                      {permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-permission-display">
                {profile?.permission && profile.permission.length > 0 ? (
                  <div className="admin-permission-tags">
                    {profile.permission.map(perm => (
                      <span key={perm} className="admin-permission-tag">
                        {perm.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="admin-profile-static">No specific permissions assigned</div>
                )}
              </div>
            )}
          </div>

          {/* Status Section */}
          <div className="admin-profile-section">
            <h3 className="admin-profile-section-title">Account Status</h3>
            {editing ? (
              <div className="admin-status-toggle">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm({...form, isActive: e.target.checked})}
                />
                <label htmlFor="isActive" className="admin-status-label">
                  Account is active
                </label>
              </div>
            ) : (
              <div className="admin-status-display">
                <span className={`admin-status-badge ${user?.isActive !== false ? 'active' : 'inactive'}`}>
                  {user?.isActive !== false ? 'Active' : 'Inactive'}
                </span>
                <small className="admin-profile-note" style={{display: 'block', marginTop: '0.5rem'}}>
                  {user?.isActive !== false 
                    ? 'This account is currently active and can access the system' 
                    : 'This account is inactive and cannot access the system'}
                </small>
              </div>
            )}
          </div>

          {/* Role Information Section */}
          <div className="admin-profile-section">
            <h3 className="admin-profile-section-title">Admin Role Information</h3>
            <div className="admin-role-info">
              <div className="admin-role-item">
                <div className="admin-role-label">Admin Code</div>
                <div className="admin-role-value">
                  <span className="admin-code-badge">{profile?.adminCode || adminCode || 'N/A'}</span>
                </div>
              </div>
              <div className="admin-role-item">
                <div className="admin-role-label">Role Type</div>
                <div className="admin-role-value">
                  <span className="admin-role-badge-large">Administrator</span>
                </div>
              </div>
              <div className="admin-role-item">
                <div className="admin-role-label">Created At</div>
                <div className="admin-role-value">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleString() : 'N/A'}
                </div>
              </div>
              <div className="admin-role-item">
                <div className="admin-role-label">Last Updated</div>
                <div className="admin-role-value">
                  {profile?.updatedAt ? new Date(profile.updatedAt).toLocaleString() : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
