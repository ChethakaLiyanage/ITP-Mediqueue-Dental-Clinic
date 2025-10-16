import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../Contexts/AuthContext';
import './Login.css';

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [user, setUser] = useState({ email: '', password: '' });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Login attempt with:', { email: user.email });

    // Simple validation
    if (!user.email || !user.password) {
      alert('Please enter both email and password');
      return;
    }

    try {
      // Use the login function from AuthContext
      const result = await login(user.email, user.password);
      console.log('Login result:', result);

      if (result?.success) {
        console.log('Login successful:', result.user);

        // Store patient data in localStorage if available
        if (result.patient && result.user.role === 'Patient') {
          localStorage.setItem('patientData', JSON.stringify(result.patient));
        }

        // Handle role-based redirection
        let dest = '/';
        const role = result.user.role;

        switch(role) {
          case 'Admin':
            dest = '/admin/dashboard';
            break;
          case 'Manager':
            dest = '/manager/inventory';
            break;
          case 'Dentist':
            dest = '/dentist/dashboard';
            break;
          case 'Receptionist':
            dest = '/receptionist/dashboard';
            break;
          case 'Patient':
            dest = '/';
            // Store patient data in localStorage for easy access
            if (result.patient) {
              localStorage.setItem('patientData', JSON.stringify(result.patient));
            }
            break;
          default:
            dest = '/';
        }

        console.log(`Redirecting ${role} to ${dest}`);
        navigate(dest, { replace: true });
      } else {
        const errorMessage = result?.error || 'Login failed. Please check your credentials.';
        console.error('Login failed:', errorMessage);
        alert(errorMessage);
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('An error occurred during login. Please try again.');
    }
  };

  const onForgotPassword = () => navigate('/forgot-password');
  const onSignUp = () => {
    if (window.confirm('Are you a patient?')) {
      navigate('/register-patient');
    }
  };

  return (
    <div className="login-page">
      <div className="top-nav">
        <div className="brand">MediQueue Dental</div>
        <div className="spacer" />
        <button className="nav-btn" onClick={() => navigate('/')}>
          <i className="fas fa-home"></i> Home
        </button>
      </div>

      <div className="login-wrap">
        <div className='login-container'>
          <h1>User Login</h1>
          <form onSubmit={handleSubmit}>
            <label htmlFor="email">Email Address</label><br />
            <input type="email" id="email" name="email" value={user.email} onChange={handleInputChange} required /><br />

            <label htmlFor="password">Password</label><br />
            <input type="password" id="password" name="password" value={user.password} onChange={handleInputChange} required /><br />

            <button type="submit">Login</button>
          </form>

          <div className="login-meta">
            <a onClick={onForgotPassword}>Forgot password?</a>
            <span>
              Do not have an account? <a onClick={onSignUp}>Sign up</a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
