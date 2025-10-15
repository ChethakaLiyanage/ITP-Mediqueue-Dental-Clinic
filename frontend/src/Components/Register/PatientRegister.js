import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './register.css';

export default function PatientRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    contact_no: '',
    nic: '',
    dob: '',
    gender: '',
    address: '',
    allergies: '',
  });

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.gender) return alert('Please select gender');
    const res = await axios.post('http://localhost:5000/register-patient', form);
    if (res.data?.status === 'ok') {
      alert('Registered successfully');
      navigate(res.data.redirectTo || '/login');
    } else {
      alert(res.data?.message || 'Register failed');
    }
  };

  return (
    <div className="register-page">
      <div className="register-nav">
        <div className="register-brand">🦷 MediQueue Dental</div>
        <button className="register-nav-btn" onClick={() => navigate('/')}>
          <i className="fas fa-home"></i> Home
        </button>
      </div>

      <div className="register-container">
        <div className="register-card">
          <div className="register-header">
            <h2>Patient Registration</h2>
            <p>Create your account to access our dental services</p>
          </div>

          <form onSubmit={submit} className="register-form">
            <div className="form-grid">
              <div className="form-group">
                <label>Full Name <span className="required">*</span></label>
                <input 
                  name="name" 
                  value={form.name} 
                  onChange={onChange} 
                  className="form-input"
                  placeholder="Enter your full name"
                  required 
                />
              </div>

              <div className="form-group">
                <label>Email Address <span className="required">*</span></label>
                <input 
                  name="email" 
                  type="email" 
                  value={form.email} 
                  onChange={onChange} 
                  className="form-input"
                  placeholder="your.email@example.com"
                  required 
                />
              </div>

              <div className="form-group">
                <label>Password <span className="required">*</span></label>
                <input 
                  name="password" 
                  type="password" 
                  value={form.password} 
                  onChange={onChange} 
                  className="form-input"
                  placeholder="Create a strong password"
                  required 
                />
              </div>

              <div className="form-group">
                <label>Contact Number</label>
                <input 
                  name="contact_no" 
                  value={form.contact_no} 
                  onChange={onChange} 
                  className="form-input"
                  placeholder="0771234567"
                />
              </div>

              <div className="form-group">
                <label>NIC Number <span className="required">*</span></label>
                <input 
                  name="nic" 
                  value={form.nic} 
                  onChange={onChange} 
                  className="form-input"
                  placeholder="123456789V or 199912345678"
                  required 
                />
              </div>

              <div className="form-group">
                <label>Date of Birth <span className="required">*</span></label>
                <input 
                  name="dob" 
                  type="date" 
                  value={form.dob} 
                  onChange={onChange} 
                  className="form-input"
                  required 
                />
              </div>

              <div className="form-group">
                <label>Gender <span className="required">*</span></label>
                <select 
                  name="gender" 
                  value={form.gender} 
                  onChange={onChange} 
                  className="form-input form-select"
                  required
                >
                  <option value="">-- Select Gender --</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Allergies</label>
                <input 
                  name="allergies" 
                  value={form.allergies} 
                  onChange={onChange} 
                  className="form-input"
                  placeholder="Any known allergies"
                />
              </div>
            </div>

            <div className="form-group-full">
              <label>Address</label>
              <textarea 
                name="address" 
                rows={3} 
                value={form.address} 
                onChange={onChange} 
                className="form-input form-textarea"
                placeholder="Your residential address"
              />
            </div>

            <button type="submit" className="register-btn">
              <i className="fas fa-user-plus"></i> Create Account
            </button>
          </form>

          <div className="register-footer">
            <p>
              Already have an account? 
              <button className="login-link" onClick={() => navigate('/login')}>
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

