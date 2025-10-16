import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../Contexts/AuthContext';
import axios from 'axios';
import AddStaffModal from './AddStaffModal';
import EditStaffModal from './EditStaffModal';
import './StaffManagement.css';

const StaffManagement = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, token, loading: authLoading } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [filterRole, setFilterRole] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [defaultRole, setDefaultRole] = useState('Dentist');

  // Create authenticated fetch function
  const authenticatedFetch = useCallback(async (url, options = {}) => {
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };
    return axios(url, config);
  }, [token]);

  // Handle URL parameters for auto-opening add modal
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const addParam = urlParams.get('add');
    
    if (addParam) {
      // Capitalize first letter for role
      const role = addParam.charAt(0).toUpperCase() + addParam.slice(1);
      setDefaultRole(role);
      setShowAddModal(true);
      
      // Clean up URL by removing the parameter
      const newUrl = location.pathname;
      navigate(newUrl, { replace: true });
    }
  }, [location.search, navigate, location.pathname]);

  // Fetch all staff
  const fetchStaff = useCallback(async () => {
    if (!token || authLoading) return;
    
    try {
      setLoading(true);
      const response = await authenticatedFetch(
        `http://localhost:5000/admin/reports/staff${filterRole ? `?role=${filterRole}` : ''}`,
        { method: 'GET' }
      );
      setStaff(response.data.data?.staff || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch staff members';
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [token, authLoading, authenticatedFetch, filterRole]);

  // Role-based access control
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role?.toLowerCase() !== 'admin') {
        navigate('/');
        return;
      }
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!authLoading && token && user?.role?.toLowerCase() === 'admin') {
      fetchStaff();
    }
  }, [authLoading, token, user, fetchStaff]);

  // Refetch staff when filter changes (for server-side filtering)
  useEffect(() => {
    if (!authLoading && token && user?.role?.toLowerCase() === 'admin') {
      fetchStaff();
    }
  }, [filterRole]);

  // Handle delete staff
  const handleDelete = async (staffId, staffName) => {
    if (!window.confirm(`Are you sure you want to delete ${staffName}? This action cannot be undone.`)) {
      return;
    }

    try {
      await authenticatedFetch(`http://localhost:5000/admin/staff/${staffId}`, {
        method: 'DELETE'
      });
      
      alert('Staff member deleted successfully');
      fetchStaff(); // Refresh the list
    } catch (error) {
      console.error('Error deleting staff:', error);
      alert('Failed to delete staff member');
    }
  };

  // Handle edit staff
  const handleEdit = (staffMember) => {
    setSelectedStaff(staffMember);
    setShowEditModal(true);
  };

  // Filter staff based on search term and role filter
  const filteredStaff = staff.filter(member => {
    const matchesSearch = !searchTerm || (
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const matchesRole = !filterRole || member.role?.toLowerCase() === filterRole.toLowerCase();
    
    return matchesSearch && matchesRole;
  });

  // Get role-specific info
  const getRoleInfo = (member) => {
    if (!member.roleData) return 'N/A';
    
    switch (member.role?.toLowerCase()) {
      case 'dentist':
        return `License: ${member.roleData.license_no || 'N/A'}, Specialization: ${member.roleData.specialization || 'General'}`;
      case 'admin':
        return `Permission: ${member.roleData.permission || 'N/A'}, Code: ${member.roleData.adminCode || 'N/A'}`;
      case 'manager':
        return `Department: ${member.roleData.department || 'N/A'}, Code: ${member.roleData.managerCode || 'N/A'}`;
      case 'receptionist':
        return `Desk: ${member.roleData.deskNo || 'N/A'}, Code: ${member.roleData.receptionistCode || 'N/A'}`;
      default:
        return 'N/A';
    }
  };

  // Show loading spinner while authenticating
  if (authLoading) {
    return (
      <div className="staff-management">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show access denied if not admin
  if (!authLoading && user && user.role?.toLowerCase() !== 'admin') {
    return (
      <div className="staff-management">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  // Show loading spinner while fetching staff
  if (loading) {
    return (
      <div className="staff-management">
        <div className="staff-header">
          <h1>Staff Management</h1>
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading staff members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-management">
      <div className="staff-header">
        <h1>Staff Management</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Staff Member
        </button>
      </div>

      {/* Staff Statistics */}
      <div className="staff-stats-grid">
        <div className="stat-card total-staff">
          <div className="stat-label">TOTAL STAFF</div>
          <div className="stat-number">{staff.length}</div>
        </div>
        <div className="stat-card dentists">
          <div className="stat-label">DENTISTS</div>
          <div className="stat-number">{staff.filter(s => s.role?.toLowerCase() === 'dentist').length}</div>
        </div>
        <div className="stat-card admins">
          <div className="stat-label">ADMINS</div>
          <div className="stat-number">{staff.filter(s => s.role?.toLowerCase() === 'admin').length}</div>
        </div>
        <div className="stat-card managers">
          <div className="stat-label">MANAGERS</div>
          <div className="stat-number">{staff.filter(s => s.role?.toLowerCase() === 'manager').length}</div>
        </div>
        <div className="stat-card receptionists">
          <div className="stat-label">RECEPTIONISTS</div>
          <div className="stat-number">{staff.filter(s => s.role?.toLowerCase() === 'receptionist').length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="staff-filters">
        <div className="filter-group">
          <label>Filter by Role:</label>
          <select 
            value={filterRole} 
            onChange={(e) => setFilterRole(e.target.value)}
            className="filter-select"
          >
            <option value="">All Roles</option>
            <option value="dentist">Dentist</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="receptionist">Receptionist</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>Search:</label>
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Filter Status */}
      {(filterRole || searchTerm) && (
        <div className="filter-status">
          <span>Filters active: </span>
          {filterRole && <span className="filter-tag">Role: {filterRole}</span>}
          {searchTerm && <span className="filter-tag">Search: "{searchTerm}"</span>}
          <button 
            className="btn btn-sm btn-clear-filters"
            onClick={() => {
              setFilterRole('');
              setSearchTerm('');
            }}
          >
            Clear All
          </button>
        </div>
      )}

      {/* Staff Table */}
      <div className="staff-table-container">
        {loading ? (
          <div className="loading-state">
            <p>Loading staff members...</p>
          </div>
        ) : (
          <table className="staff-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Contact</th>
                <th>Role Details</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.length > 0 ? (
                filteredStaff.map((member) => (
                  <tr key={member._id}>
                    <td>
                      {member.role?.toLowerCase() === 'dentist' && member.photo ? (
                        <img 
                          src={`http://localhost:5000${member.photo}`} 
                          alt={`${member.name}`}
                          className="staff-photo"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className="staff-photo-placeholder" 
                        style={{ display: member.role?.toLowerCase() === 'dentist' && member.photo ? 'none' : 'flex' }}
                      >
                        {member.role?.toLowerCase() === 'dentist' ? '👨‍⚕️' : '👤'}
                      </div>
                    </td>
                    <td className="staff-name">{member.name}</td>
                    <td>{member.email}</td>
                    <td>
                      <span className={`role-badge ${member.role.toLowerCase()}`}>
                        {member.role?.charAt(0).toUpperCase() + member.role?.slice(1)}
                      </span>
                    </td>
                    <td>{member.contact_no || 'N/A'}</td>
                    <td className="role-details">{getRoleInfo(member)}</td>
                    <td>
                      <span className={`status-badge ${member.isActive ? 'active' : 'inactive'}`}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-sm btn-edit"
                          onClick={() => handleEdit(member)}
                          title="Edit Staff Member"
                        >
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          className="btn btn-sm btn-delete"
                          onClick={() => handleDelete(member._id, member.name)}
                          title="Delete Staff Member"
                        >
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="no-data">
                    {searchTerm || filterRole ? 'No staff members match your criteria' : 'No staff members found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>


      {/* Modals */}
      {showAddModal && (
        <AddStaffModal
          defaultRole={defaultRole}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            // Add a small delay to ensure database is updated
            setTimeout(() => {
              fetchStaff();
            }, 500);
          }}
        />
      )}

      {showEditModal && selectedStaff && (
        <EditStaffModal
          staff={selectedStaff}
          onClose={() => {
            setShowEditModal(false);
            setSelectedStaff(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedStaff(null);
            fetchStaff();
          }}
        />
      )}
    </div>
  );
};

export default StaffManagement;
