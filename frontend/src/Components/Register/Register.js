import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import "./register.css";
import { AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import { 
  validateEmail, 
  validatePhone, 
  validateNIC, 
  validatePassword, 
  validateName, 
  validateAddress, 
  validateDOB,
  formatPhoneNumber 
} from "../../utils/validation";

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    nic: "",
    dob: "",
    gender: "",
    allergies: "",
  });
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const { register } = useAuth();
  const navigate = useNavigate();


  const validateField = (fieldName, value) => {
    let validation = { isValid: true, message: '' };
    
    switch (fieldName) {
      case 'name':
        validation = validateName(value);
        break;
      case 'email':
        validation = validateEmail(value);
        break;
      case 'phone':
        validation = validatePhone(value);
        break;
      case 'nic':
        validation = validateNIC(value);
        break;
      case 'password':
        validation = validatePassword(value);
        break;
      case 'address':
        validation = validateAddress(value);
        break;
      case 'dob':
        validation = validateDOB(value);
        break;
      default:
        break;
    }
    
    setFieldErrors(prev => ({
      ...prev,
      [fieldName]: validation.isValid ? '' : validation.message
    }));
    
    return validation.isValid;
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setFieldErrors({});

    // Validate all fields
    const nameValid = validateField('name', form.name);
    const emailValid = validateField('email', form.email);
    const phoneValid = validateField('phone', form.phone);
    const nicValid = validateField('nic', form.nic);
    const passwordValid = validateField('password', form.password);
    const addressValid = validateField('address', form.address);
    const dobValid = validateField('dob', form.dob);

    if (!nameValid || !emailValid || !phoneValid || !nicValid || !passwordValid || !addressValid || !dobValid) {
      return setErr("Please fix the validation errors above");
    }

    if (form.password !== confirm) {
      setFieldErrors(prev => ({ ...prev, confirm: "Passwords do not match" }));
      return setErr("Passwords do not match");
    }

    if (!form.gender) return setErr("Select your gender");

    try {
      setLoading(true);
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        address: form.address.trim(),
        nic: form.nic.trim().toUpperCase(),
        dob: form.dob,
        gender: form.gender,
        allergies: form.allergies.trim() || undefined,
      };

      const result = await register(payload);
      if (result.success) {
        alert("Account created successfully! Please log in.");
        navigate("/login", { replace: true });
      } else {
        setErr(result.error);
      }
    } catch (e) {
      setErr(e.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-wrapper">
        <div className="register-header">
          <h2 className="register-title">Create Your Account</h2>
          <p className="register-subtitle">Join us to book appointments and manage your dental care</p>
        </div>

        <div className="register-form-container">
          {err && (
            <div className="error-message">
              <AlertCircle className="text-red-500 mr-3 flex-shrink-0" size={20} />
              <span className="error-text">{err}</span>
            </div>
          )}

          <form onSubmit={submit}>
            <div className="form-field">
              <label className="input-label">Full Name *</label>
              <input
                type="text"
                className={`input-field ${fieldErrors.name ? 'error' : ''}`}
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  if (fieldErrors.name) validateField('name', e.target.value);
                }}
                onBlur={() => validateField('name', form.name)}
                required
              />
              {fieldErrors.name && <div className="field-error">{fieldErrors.name}</div>}
            </div>

            <div className="form-field">
              <label className="input-label">Email *</label>
              <input
                type="email"
                className={`input-field ${fieldErrors.email ? 'error' : ''}`}
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  if (fieldErrors.email) validateField('email', e.target.value);
                }}
                onBlur={() => validateField('email', form.email)}
                required
              />
              {fieldErrors.email && <div className="field-error">{fieldErrors.email}</div>}
            </div>

            <div className="form-field">
              <label className="input-label">NIC *</label>
              <input
                type="text"
                className={`input-field ${fieldErrors.nic ? 'error' : ''}`}
                value={form.nic}
                onChange={(e) => {
                  setForm({ ...form, nic: e.target.value.toUpperCase() });
                  if (fieldErrors.nic) validateField('nic', e.target.value.toUpperCase());
                }}
                onBlur={() => validateField('nic', form.nic)}
                required
              />
              {fieldErrors.nic && <div className="field-error">{fieldErrors.nic}</div>}
            </div>

            <div className="form-field">
              <label className="input-label">Address *</label>
              <input
                type="text"
                className={`input-field ${fieldErrors.address ? 'error' : ''}`}
                value={form.address}
                onChange={(e) => {
                  setForm({ ...form, address: e.target.value });
                  if (fieldErrors.address) validateField('address', e.target.value);
                }}
                onBlur={() => validateField('address', form.address)}
                required
              />
              {fieldErrors.address && <div className="field-error">{fieldErrors.address}</div>}
            </div>

            <div className="form-field">
              <label className="input-label">Date of Birth *</label>
              <input
                type="date"
                className={`input-field ${fieldErrors.dob ? 'error' : ''}`}
                value={form.dob}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => {
                  setForm({ ...form, dob: e.target.value });
                  if (fieldErrors.dob) validateField('dob', e.target.value);
                }}
                onBlur={() => validateField('dob', form.dob)}
                required
              />
              {fieldErrors.dob && <div className="field-error">{fieldErrors.dob}</div>}
            </div>

            <div className="form-field">
              <label className="input-label">Gender *</label>
              <select
                className="input-field"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                required
              >
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-field">
              <label className="input-label">Phone</label>
              <input
                type="tel"
                className={`input-field ${fieldErrors.phone ? 'error' : ''}`}
                value={form.phone}
                onChange={(e) => {
                  setForm({ ...form, phone: e.target.value });
                  if (fieldErrors.phone) validateField('phone', e.target.value);
                }}
                onBlur={() => validateField('phone', form.phone)}
                placeholder="0XXXXXXXXX or +94XXXXXXXXX"
              />
              {fieldErrors.phone && <div className="field-error">{fieldErrors.phone}</div>}
            </div>

            <div className="form-field">
              <label className="input-label">Allergies (optional)</label>
              <input
                type="text"
                className="input-field"
                value={form.allergies}
                onChange={(e) => setForm({ ...form, allergies: e.target.value })}
              />
            </div>

            <div className="form-field">
              <label className="input-label">Password *</label>
              <div className="input-with-toggle">
                <input
                  type={showPassword ? "text" : "password"}
                  className={`input-field ${fieldErrors.password ? 'error' : ''}`}
                  value={form.password}
                  onChange={(e) => {
                    setForm({ ...form, password: e.target.value });
                    if (fieldErrors.password) validateField('password', e.target.value);
                  }}
                  onBlur={() => validateField('password', form.password)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {fieldErrors.password && <div className="field-error">{fieldErrors.password}</div>}
            </div>

            <div className="form-field">
              <label className="input-label">Confirm Password *</label>
              <div className="input-with-toggle">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className={`input-field ${fieldErrors.confirm ? 'error' : ''}`}
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    if (fieldErrors.confirm) {
                      setFieldErrors(prev => ({ ...prev, confirm: '' }));
                    }
                  }}
                  onBlur={() => {
                    if (form.password !== confirm) {
                      setFieldErrors(prev => ({ ...prev, confirm: "Passwords do not match" }));
                    }
                  }}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {fieldErrors.confirm && <div className="field-error">{fieldErrors.confirm}</div>}
            </div>

            <button type="submit" disabled={loading} className="submit-button">
              {loading ? "Creating Account..." : "Create Account"}
              <ArrowRight className="button-icon" size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
