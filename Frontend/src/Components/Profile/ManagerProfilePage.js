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
      // First, try to get the manager by code
      const mRes = await fetch(`${API_BASE}/managers/code/${encodeURIComponent(managerCode)}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!mRes.ok) {
        // If not found by code, try to find by managerCode in the User model
        if (mRes.status === 404) {
          console.log("Manager not found by code, trying to find by user role...");
          const userRes = await fetch(`${API_BASE}/users/role/Manager`, {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (userRes.ok) {
            const usersData = await userRes.json();
            const managerUser = Array.isArray(usersData) 
              ? usersData.find(u => u.managerCode === managerCode || u.manager?.managerCode === managerCode)
              : null;
              
            if (managerUser) {
              setUser(managerUser);
              setProfile({
                department: managerUser.department || '',
                managerCode: managerUser.managerCode || managerCode
              });
              
              // Set form data
              setForm({
                name: managerUser.name || '',
                email: managerUser.email || '',
                contact_no: managerUser.contact_no || '',
                department: managerUser.department || ''
              });
              
              setLoading(false);
              return;
            }
          }
        }
        
        const errorData = await mRes.json().catch(() => ({}));
        throw new Error(errorData.message || `Error: ${mRes.status}`);
      }
      
      const mData = await mRes.json();
      console.log("Manager data response:", mData);
      
      if (mData && (mData.manager || mData.user)) {
        const managerData = mData.manager || mData.user;
        setProfile(managerData);
        
        // If we have a userId, fetch the user details
        if (mData.user) {
          const userData = mData.user;
          setUser(userData);
          setForm({
            name: userData.name || '',
            email: userData.email || '',
            contact_no: userData.contact_no || '',
            department: managerData.department || ''
          });
        } else if (managerData.userId) {
          const uRes = await fetch(`${API_BASE}/users/${encodeURIComponent(managerData.userId)}`, {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (uRes.ok) {
            const uData = await uRes.json();
            const userData = uData.users || uData.user || uData;
            setUser(userData);
            
            setForm({
              name: userData.name || '',
              email: userData.email || '',
              contact_no: userData.contact_no || '',
              department: managerData.department || ''
            });
          }
        } else {
          setUser(null);
          setForm({
            name: '',
            email: '',
            contact_no: '',
            department: managerData.department || ''
          });
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
  
  // Handle logout
  const handleLogout = () => {
    try { 
      localStorage.removeItem('auth');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
    
    // If department is being updated, also update the profile state
    if (name === 'department') {
      setProfile(prev => ({
        ...prev,
        department: value
      }));
    }
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

    setLoading(true);
    try {
      // Update user data
      const userUpdate = fetch(`${API_BASE}/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          contact_no: form.contact_no
        })
      });

      // Update manager data if we have a manager profile
      let managerUpdate = Promise.resolve();
      if (profile?._id) {
        managerUpdate = fetch(`${API_BASE}/managers/${profile._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            department: form.department
          })
        });
      } else if (profile?.managerCode) {
        // If we don't have a profile ID but have a manager code, try to create or update
        managerUpdate = fetch(`${API_BASE}/managers/code/${profile.managerCode}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            department: form.department,
            userId: user._id
          })
        });
      }

      // Wait for both updates to complete
      const [userRes, managerRes] = await Promise.all([userUpdate, managerUpdate]);

      if (!userRes.ok) {
        const errorData = await userRes.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update user profile');
      }

      const updatedUser = await userRes.json();
      setUser(updatedUser.user || updatedUser);
      
      // Update profile data if manager update was successful
      if (managerRes && managerRes.ok) {
        const managerData = await managerRes.json();
        setProfile(prev => ({
          ...prev,
          ...(managerData.manager || managerData),
          department: form.department
        }));
      }

      setEditing(false);
      alert('Profile updated successfully!');
    } catch (err) {
      console.error('Update error:', err);
      setError(err.message || 'Error updating profile');
    } finally {
      setLoading(false);
    }
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
