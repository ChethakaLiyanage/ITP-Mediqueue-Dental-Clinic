import React, { useState } from 'react';
import SimpleSupplierForm from './SimpleSupplierForm';
import './SupplierFormDemo.css';

const SupplierFormDemo = () => {
  const [showForm, setShowForm] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);

  const handleSubmit = async (formData) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Form submitted:', formData);
    setSubmittedData(formData);
    setShowForm(false);
    
    // Show success message
    alert('Supplier added successfully!');
  };

  const handleCancel = () => {
    setShowForm(false);
  };

  return (
    <div className="supplier-form-demo">
      <div className="demo-header">
        <h1>Supplier Management</h1>
        <p>Simple and professional supplier form</p>
      </div>

      <div className="demo-content">
        <div className="demo-card">
          <h3>Add New Supplier</h3>
          <p>Click the button below to open the supplier form</p>
          <button 
            className="demo-btn"
            onClick={() => setShowForm(true)}
          >
            Add Supplier
          </button>
        </div>

        {submittedData && (
          <div className="submitted-data">
            <h3>Last Submitted Data:</h3>
            <pre>{JSON.stringify(submittedData, null, 2)}</pre>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <SimpleSupplierForm
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierFormDemo;
