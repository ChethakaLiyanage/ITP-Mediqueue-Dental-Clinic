import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../Contexts/AuthContext";
import "./receptionistpatients.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

function useDebounced(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);

  return debouncedValue;
}

function PatientRegistrationForm({ apiBase, authHeaders, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    nic: "",
    dob: "",
    gender: "",
    address: "",
    allergies: "",
    password: "",
    confirmPassword: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${apiBase}/receptionist/patients/register`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to register patient");
      }

      onSuccess(`Patient ${formData.name} registered successfully with code: ${data.patient?.patientCode}`);
    } catch (err) {
      console.error("Registration error:", err);
      setError(err.message || "Failed to register patient");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="rp-modal">
      <div className="rp-modal-panel">
        <div className="rp-modal-header">
          <h3>Register New Patient</h3>
          <button className="rp-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {error && <div className="rp-error">{error}</div>}

        <form onSubmit={handleSubmit} className="rp-form">
          <div className="rp-form-grid">
            <div className="rp-form-group">
              <label>Full Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="rp-form-group">
              <label>Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="rp-form-group">
              <label>Phone *</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>

            <div className="rp-form-group">
              <label>NIC *</label>
              <input
                type="text"
                name="nic"
                value={formData.nic}
                onChange={handleChange}
                required
              />
            </div>

            <div className="rp-form-group">
              <label>Date of Birth *</label>
              <input
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
                required
              />
            </div>

            <div className="rp-form-group">
              <label>Gender *</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                required
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="rp-form-group">
            <label>Address</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows="3"
            />
          </div>

          <div className="rp-form-group">
            <label>Allergies</label>
            <textarea
              name="allergies"
              value={formData.allergies}
              onChange={handleChange}
              rows="2"
              placeholder="List any known allergies..."
            />
          </div>

          <div className="rp-form-group">
            <label>Password *</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="8"
            />
          </div>

          <div className="rp-form-group">
            <label>Confirm Password *</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              minLength="8"
            />
          </div>

          <div className="rp-form-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className="rp-btn-primary">
              {loading ? "Registering..." : "Register Patient"}
            </button>
          </div>
        </form>
      </div>
      <div className="rp-modal-backdrop" onClick={onClose} />
    </div>
  );
}

export default function ReceptionistPatients() {
  const { token, user } = useAuth();
  
  // Create auth headers for API calls
  const authHeaders = useMemo(() => ({
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  }), [token]);
  
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCode, setSelectedCode] = useState(null);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const debouncedSearch = useDebounced(search, 300);

  useEffect(() => {
    if (!token) return;
    
    const controller = new AbortController();
    let cancelled = false;

    async function loadPatients() {
      try {
        setLoading(true);
        setError("");

        const url = `${API_BASE}/receptionist/patients?search=${encodeURIComponent(debouncedSearch)}&limit=50`;
        console.log('Fetching patients from:', url);

        const res = await fetch(url, {
          headers: authHeaders,
          signal: controller.signal
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${res.status}`);
        }
        
        const payload = await res.json();
        console.log('Received patients data:', payload);
        
        if (cancelled) return;

        setRows(Array.isArray(payload?.items) ? payload.items : []);
      } catch (err) {
        if (cancelled || err?.name === "AbortError") return;
        console.error('Patients loading error:', err);
        setRows([]);
        setError("Failed to load patients. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPatients();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debouncedSearch, token, authHeaders]);

  return (
    <div className="rp-wrap">
      <div className="rp-header">
        <h2>Patients</h2>
        <div className="rp-header-actions">
          <button 
            className="rp-btn rp-btn-primary" 
            onClick={() => setShowRegisterForm(true)}
          >
            + Register New Patient
          </button>
          <div className="rp-search">
            <input
              type="text"
              placeholder="Search by name, email, phone, or patient code..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="rp-card">
        {error && <div className="rp-error">{error}</div>}
        {successMessage && (
          <div className="rp-success">
            {successMessage}
            <button onClick={() => setSuccessMessage("")} className="rp-close-btn">×</button>
          </div>
        )}
        {loading ? (
          <div className="rp-empty">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="rp-empty">No patients found</div>
        ) : (
          <table className="rp-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Gender</th>
                <th>Age</th>
                <th>NIC</th>
                <th>Registered By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.patientCode}>
                  <td className="rp-mono">{row.patientCode || "-"}</td>
                  <td>{row.name || "-"}</td>
                  <td>{row.phone || "-"}</td>
                  <td className="rp-ellipsis" title={row.email || ""}>
                    {row.email || "-"}
                  </td>
                  <td>{row.gender || "-"}</td>
                  <td>{row.age ?? "-"}</td>
                  <td className="rp-mono" title="Full NIC">
                    {row.nic || "-"}
                  </td>
                  <td className="rp-mono">
                    {row.registeredByCode || row.createdByCode || row.createdBy || "-"}
                  </td>
                  <td>
                    <button
                      className="rp-pill rp-view"
                      onClick={() => setSelectedCode(row.patientCode)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedCode ? (
        <PatientDrawer
          apiBase={API_BASE}
          patientCode={selectedCode}
          onClose={() => setSelectedCode(null)}
        />
      ) : null}
      
      {showRegisterForm && (
        <PatientRegistrationForm
          apiBase={API_BASE}
          authHeaders={authHeaders}
          onClose={() => setShowRegisterForm(false)}
          onSuccess={(message) => {
            setShowRegisterForm(false);
            setSuccessMessage(message);
            // Refresh the patient list
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

function PatientDrawer({ apiBase, patientCode, onClose }) {
  const { token } = useAuth();
  
  // Create auth headers for API calls
  const authHeaders = useMemo(() => ({
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  }), [token]);
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    
    const controller = new AbortController();
    let cancelled = false;

    async function loadDetails() {
      try {
        setLoading(true);
        setError("");

        const url = `${apiBase}/receptionist/patients/${patientCode}`;
        console.log('Fetching patient details from:', url);

        const res = await fetch(url, {
          headers: authHeaders,
          signal: controller.signal,
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${res.status}`);
        }
        
        const payload = await res.json();
        console.log('Received patient details:', payload);
        
        if (cancelled) return;

        setData(payload || {});
      } catch (err) {
        if (cancelled || err?.name === "AbortError") return;
        console.error('Patient details loading error:', err);
        setError("Failed to load patient details.");
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDetails();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [apiBase, patientCode, token, authHeaders]);

  const registeredBy =
    data?.registeredByCode ||
    data?.patient?.registeredByCode ||
    data?.createdByCode ||
    data?.createdBy ||
    null;

  return (
    <div className="rp-drawer">
      <div className="rp-drawer-panel">
        <div className="rp-drawer-head">
          <h3>Patient: {patientCode}</h3>
          <button className="rp-close" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>

        {loading ? (
          <div className="rp-empty">Loading...</div>
        ) : error ? (
          <div className="rp-error">{error}</div>
        ) : (
          <>
            <div className="rp-grid">
              <div>
                <div className="rp-label">Registered By</div>
                <div className="rp-value rp-mono">{registeredBy || "-"}</div>
              </div>
              <div>
                <div className="rp-label">Name</div>
                <div className="rp-value">{data?.patient?.name || data?.name || "-"}</div>
              </div>
              <div>
                <div className="rp-label">Phone</div>
                <div className="rp-value">{data?.patient?.phone || data?.phone || "-"}</div>
              </div>
              <div>
                <div className="rp-label">Email</div>
                <div className="rp-value">{data?.patient?.email || data?.email || "-"}</div>
              </div>
              <div>
                <div className="rp-label">Gender</div>
                <div className="rp-value">{data?.patient?.gender || data?.gender || "-"}</div>
              </div>
              <div>
                <div className="rp-label">Age</div>
                <div className="rp-value">{data?.patient?.age ?? data?.age ?? "-"}</div>
              </div>
              <div>
                <div className="rp-label">NIC</div>
                <div className="rp-value rp-mono">{data?.patient?.nic || data?.nic || "-"}</div>
              </div>
            </div>

            <div className="rp-subhead">Recent Appointments</div>
            {Array.isArray(data?.appointments) && data.appointments.length > 0 ? (
              <table className="rp-table rp-table-compact">
                <thead>
                  <tr>
                    <th>Appointment</th>
                    <th>Dentist</th>
                    <th>Date &amp; Time</th>
                    <th>Status</th>
                    <th>Booked By</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {data.appointments.map((appointment) => (
                    <tr key={appointment.appointmentCode}>
                      <td className="rp-mono">{appointment.appointmentCode}</td>
                      <td className="rp-mono">{appointment.dentist_code}</td>
                      <td>{formatDate(appointment.date)}</td>
                      <td>
                        <span className={`rp-pill ${statusClass(appointment.status)}`}>
                          {appointment.status}
                        </span>
                      </td>
                      <td className="rp-mono">
                        {appointment.createdByCode || appointment.createdBy || "-"}
                      </td>
                      <td className="rp-ellipsis" title={appointment.reason || ""}>
                        {appointment.reason || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="rp-empty">No recent appointments</div>
            )}
          </>
        )}
      </div>
      <div className="rp-drawer-backdrop" onClick={onClose} />
    </div>
  );
}

function formatDate(value) {
  try {
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? "-" : dt.toLocaleString();
  } catch (err) {
    return "-";
  }
}

function statusClass(status) {
  switch ((status || "").toLowerCase()) {
    case "pending":
      return "rp-badge-purple";
    case "confirmed":
      return "rp-badge-blue";
    case "completed":
      return "rp-badge-green";
    case "cancelled":
      return "rp-badge-gray";
    default:
      return "rp-badge-gray";
  }
}