import React, { useState, useEffect } from 'react';
import { useAuth } from '../../Contexts/AuthContext';
import axios from 'axios';

const EditStaffModal = ({ staff, onClose, onSuccess }) => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    contact_no: '',
    isActive: true,
    // Role-specific fields
    license_no: '',
    specialization: '',
    department: '',
    deskNo: '',
    permission: 'full'
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Initialize form data with staff information
  useEffect(() => {
    if (staff) {
      setFormData({
        name: staff.name || '',
        email: staff.email || '',
        contact_no: staff.contact_no || '',
        isActive: staff.isActive !== undefined ? staff.isActive : true,
        // Role-specific fields from roleData
        license_no: staff.roleData?.license_no || '',
        specialization: staff.roleData?.specialization || '',
        department: staff.roleData?.department || '',
        deskNo: staff.roleData?.deskNo || '',
        permission: staff.roleData?.permission || 'full'
      });
    }
  }, [staff]);


  // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';

    // Role-specific validation
    if (staff.role === 'Dentist' && !formData.license_no.trim()) {
      newErrors.license_no = 'License number is required for dentists';
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await axios.put(
        `http://localhost:5000/admin/staff/${staff._id}`,
        formData,
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      alert('Staff member updated successfully!');
      onSuccess();
    } catch (error) {
      console.error('Error updating staff:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update staff member';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Get role-specific fields
  const renderRoleSpecificFields = () => {
    switch (staff.role) {
      case 'Dentist':
        return (
          <>
            <div className="form-group">
              <label>License Number *</label>
              <input
                type="text"
                name="license_no"
                value={formData.license_no}
                onChange={handleChange}
                className={errors.license_no ? 'error' : ''}
                placeholder="Enter license number"
              />
              {errors.license_no && <span className="error-text">{errors.license_no}</span>}
            </div>
            <div className="form-group">
              <label>Specialization</label>
              <input
                type="text"
                name="specialization"
                value={formData.specialization}
                onChange={handleChange}
                placeholder="e.g., Orthodontics, Oral Surgery"
              />
            </div>
          </>
        );
      
      case 'Admin':
        return (
          <div className="form-group">
            <label>Permission Level</label>
            <select
              name="permission"
              value={formData.permission}
              onChange={handleChange}
            >
              <option value="full">Full Access</option>
              <option value="limited">Limited Access</option>
              <option value="read-only">Read Only</option>
            </select>
          </div>
        );
      
      case 'Manager':
        return (
          <div className="form-group">
            <label>Department</label>
            <input
              type="text"
              name="department"
              value={formData.department}
              onChange={handleChange}
              placeholder="e.g., Operations, HR, Finance"
            />
          </div>
        );
      
      case 'Receptionist':
        return (
          <div className="form-group">
            <label>Desk Number</label>
            <input
              type="text"
              name="deskNo"
              value={formData.deskNo}
              onChange={handleChange}
              placeholder="e.g., Desk 1, Front Desk"
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  if (!staff) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content edit-staff-modal">
        <div className="modal-header">
          <h2>Edit {staff.role}: {staff.name}</h2>
          <button className="close-btn" onClick={onClose}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="staff-form">
          <div className="form-row">
            <div className="form-group">
              <label>Full Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={errors.name ? 'error' : ''}
                placeholder="Enter full name"
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label>Email Address *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? 'error' : ''}
                placeholder="Enter email address"
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Contact Number</label>
              <input
                type="tel"
                name="contact_no"
                value={formData.contact_no}
                onChange={handleChange}
                placeholder="Enter contact number"
              />
            </div>

            <div className="form-group">
              <label>Role</label>
              <input
                type="text"
                value={staff.role}
                disabled
                className="disabled-input"
              />
              <small className="help-text">Role cannot be changed after creation</small>
            </div>
          </div>

          {/* Role-specific fields */}
          {renderRoleSpecificFields()}

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
              />
              <span className="checkmark"></span>
              Active Status
            </label>
            <small className="help-text">Inactive users cannot log in to the system</small>
          </div>

          <div className="staff-info">
            <h4>Current Role Information</h4>
            <div className="info-grid">
              <div className="info-item">
                <label>Role:</label>
                <span className={`role-badge ${staff.role.toLowerCase()}`}>{staff.role}</span>
              </div>
              {staff.roleData?.dentistCode && (
                <div className="info-item">
                  <label>Dentist Code:</label>
                  <span>{staff.roleData.dentistCode}</span>
                </div>
              )}
              {staff.roleData?.adminCode && (
                <div className="info-item">
                  <label>Admin Code:</label>
                  <span>{staff.roleData.adminCode}</span>
                </div>
              )}
              {staff.roleData?.managerCode && (
                <div className="info-item">
                  <label>Manager Code:</label>
                  <span>{staff.roleData.managerCode}</span>
                </div>
              )}
              {staff.roleData?.receptionistCode && (
                <div className="info-item">
                  <label>Receptionist Code:</label>
                  <span>{staff.roleData.receptionistCode}</span>
                </div>
              )}
              <div className="info-item">
                <label>Created:</label>
                <span>{new Date(staff.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="info-item">
                <label>Last Updated:</label>
                <span>{new Date(staff.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Updating...' : 'Update Staff Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditStaffModal;
