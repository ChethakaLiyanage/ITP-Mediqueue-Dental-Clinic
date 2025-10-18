import React, { useState } from 'react';
import './SimpleSupplierForm.css';

const SimpleSupplierForm = ({ supplier, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    companyName: supplier?.companyName || '',
    contactPerson: supplier?.contactPerson || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    address: {
      street: supplier?.address?.street || '',
      city: supplier?.address?.city || '',
      state: supplier?.address?.state || '',
      zipCode: supplier?.address?.zipCode || '',
      country: supplier?.address?.country || 'Sri Lanka'
    },
    category: supplier?.category || 'Dental Supplies'
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Handle address fields specially
    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
    }

    if (!formData.contactPerson.trim()) {
      newErrors.contactPerson = 'Contact person is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d{10}$/.test(formData.phone.trim())) {
      newErrors.phone = 'Phone number must be exactly 10 digits';
    }

    if (!formData.address.street.trim()) {
      newErrors['address.street'] = 'Street address is required';
    }
    if (!formData.address.city.trim()) {
      newErrors['address.city'] = 'City is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      console.log('Submitting form data:', formData);
      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="simple-supplier-form">
      <div className="form-header">
        <h2>{supplier ? 'Edit Supplier' : 'Add New Supplier'}</h2>
        <button className="close-btn" onClick={onCancel} type="button">
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="supplier-form">
        <div className="form-group">
          <label htmlFor="companyName">
            Company Name <span className="required">*</span>
          </label>
          <input
            type="text"
            id="companyName"
            name="companyName"
            value={formData.companyName}
            onChange={handleChange}
            className={errors.companyName ? 'error' : ''}
            placeholder="Enter company name"
            disabled={isSubmitting}
          />
          {errors.companyName && <span className="error-text">{errors.companyName}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="contactPerson">
            Contact Person <span className="required">*</span>
          </label>
          <input
            type="text"
            id="contactPerson"
            name="contactPerson"
            value={formData.contactPerson}
            onChange={handleChange}
            className={errors.contactPerson ? 'error' : ''}
            placeholder="Enter contact person name"
            disabled={isSubmitting}
          />
          {errors.contactPerson && <span className="error-text">{errors.contactPerson}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="email">
              Email <span className="required">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? 'error' : ''}
              placeholder="Enter email address"
              disabled={isSubmitting}
            />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="phone">
              Phone <span className="required">*</span>
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={errors.phone ? 'error' : ''}
              placeholder="e.g., 0772353636"
              disabled={isSubmitting}
            />
            {errors.phone && <span className="error-text">{errors.phone}</span>}
            <small className="field-hint">Enter exactly 10 digits</small>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="address.street">
            Street Address <span className="required">*</span>
          </label>
          <input
            type="text"
            id="address.street"
            name="address.street"
            value={formData.address.street}
            onChange={handleChange}
            className={errors['address.street'] ? 'error' : ''}
            placeholder="Enter street address"
            disabled={isSubmitting}
          />
          {errors['address.street'] && <span className="error-text">{errors['address.street']}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="address.city">
              City <span className="required">*</span>
            </label>
            <input
              type="text"
              id="address.city"
              name="address.city"
              value={formData.address.city}
              onChange={handleChange}
              className={errors['address.city'] ? 'error' : ''}
              placeholder="Enter city"
              disabled={isSubmitting}
            />
            {errors['address.city'] && <span className="error-text">{errors['address.city']}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="address.state">State</label>
            <input
              type="text"
              id="address.state"
              name="address.state"
              value={formData.address.state}
              onChange={handleChange}
              placeholder="Enter state"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="address.zipCode">ZIP Code</label>
            <input
              type="text"
              id="address.zipCode"
              name="address.zipCode"
              value={formData.address.zipCode}
              onChange={handleChange}
              placeholder="Enter ZIP code"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="address.country">Country</label>
            <input
              type="text"
              id="address.country"
              name="address.country"
              value={formData.address.country}
              onChange={handleChange}
              placeholder="Enter country"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            disabled={isSubmitting}
          >
            <option value="Dental Supplies">Dental Supplies</option>
            <option value="Medical Equipment">Medical Equipment</option>
            <option value="Pharmaceuticals">Pharmaceuticals</option>
            <option value="Office Supplies">Office Supplies</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="form-actions">
          <button 
            type="button" 
            className="btn-cancel" 
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (supplier ? 'Updating...' : 'Adding...') : (supplier ? 'Update Supplier' : 'Add Supplier')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SimpleSupplierForm;
