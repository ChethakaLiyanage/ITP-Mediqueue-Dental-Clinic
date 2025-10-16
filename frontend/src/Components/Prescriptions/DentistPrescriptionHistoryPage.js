import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import { API_BASE } from "../api";
import "./dentistallprescriptionpart.css";

export default function PrescriptionHistoryPage() {
  const navigate = useNavigate();
  const { user, token, authLoading } = useAuth();
  
  const dentistCode = user?.dentistCode || "";

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [codeQuery, setCodeQuery] = useState("");
  const [dateQuery, setDateQuery] = useState(""); // yyyy-mm-dd
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | inactive

  // Redirect if not authenticated or not a dentist
  useEffect(() => {
    if (!authLoading) {
      if (!token) {
        navigate("/login");
        return;
      }
      if (user?.role !== "Dentist") {
        navigate("/");
        return;
      }
    }
  }, [user, token, authLoading, navigate]);

  // Create authenticated fetch helper
  const authenticatedFetch = useCallback(async (url, options = {}) => {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    try {
      const response = await fetch(url, { ...options, headers });
      return response;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }, [token]);

  const filteredHistory = React.useMemo(() => {
    const sameDay = (d, ymd) => {
      if (!d || !ymd) return true;
      try {
        const dd = new Date(d);
        const [y, m, da] = ymd.split('-').map(Number);
        return (
          dd.getFullYear() === y &&
          dd.getMonth() + 1 === m &&
          dd.getDate() === da
        );
      } catch {
        return true;
      }
    };
    return history.filter(rx => {
      const codeOk = codeQuery ? String(rx.prescriptionCode || '').toLowerCase().includes(codeQuery.toLowerCase()) : true;
      const dateOk = dateQuery ? sameDay(rx.issuedAt, dateQuery) : true;
      const statusOk = statusFilter === 'all' ? true : (statusFilter === 'active' ? rx.isActive === true : rx.isActive === false);
      return codeOk && dateOk && statusOk;
    });
  }, [history, codeQuery, dateQuery, statusFilter]);

  const fetchHistory = useCallback(async () => {
    if (!dentistCode || !token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await authenticatedFetch(`${API_BASE}/prescriptions/my`);
      const data = await res.json();
      
      if (res.ok) {
        const items = Array.isArray(data.items) ? data.items : [];
        items.sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
        setHistory(items);
        console.debug('Prescription history loaded:', items.length, 'items');
      } else {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
    } catch (err) {
      console.error('Error fetching prescription history:', err);
      setError('Failed to load prescription history');
      setHistory([]);
    }
    
    setLoading(false);
  }, [dentistCode, token, authenticatedFetch]);

  useEffect(() => { 
    if (!authLoading) {
      fetchHistory(); 
    }
  }, [authLoading, fetchHistory]);

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  const handleRetry = () => {
    fetchHistory();
  };

  if (authLoading) {
    return (
      <div className="prescription-page">
        <div className="prescription-container">
          <div className="prescription-empty">
            <div className="loading-spinner"></div>
            <div className="prescription-empty-title">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="prescription-page">
        <div className="prescription-container">
          <div className="prescription-empty">
            <div className="prescription-empty-icon">⚠️</div>
            <div className="prescription-empty-title">Error Loading History</div>
            <div className="prescription-empty-message">{error}</div>
            <button 
              className="prescription-btn prescription-btn--primary"
              onClick={handleRetry}
              style={{ marginTop: '16px' }}
            >
              🔄 Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="prescription-page">
      <div className="prescription-container">
        {/* Header */}
        <div className="prescription-header">
          <h1 className="prescription-title">Prescription History</h1>
          <div className="prescription-actions">
            <button 
              className="prescription-btn prescription-btn--secondary"
              onClick={() => navigate("/dentist/treatmentplans")}
            >
              ← Back to Treatment Plans
            </button>
            <button 
              className="prescription-btn prescription-btn--primary"
              onClick={() => navigate("/dentist/prescriptions")}
            >
              💊 Go to Prescriptions
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="prescription-filters" style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'nowrap', alignItems: 'center', overflowX: 'auto' }}>
          <input
            className="prescription-input"
            placeholder="Search by prescription code (e.g., RX-001)"
            value={codeQuery}
            onChange={(e) => setCodeQuery(e.target.value)}
            style={{ width: 260 }}
          />
          <input
            className="prescription-input"
            type="date"
            value={dateQuery}
            onChange={(e) => setDateQuery(e.target.value)}
            style={{ width: 200 }}
          />
          <select
            className="prescription-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 200 }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* History Table */}
        <div>
          <h2 className="prescription-section-title">All Prescriptions (Active & Inactive)</h2>
          {loading ? (
            <div className="prescription-loading">Loading prescription history...</div>
          ) : history.length === 0 ? (
            <div className="prescription-empty">
              <div className="prescription-empty-icon">📋</div>
              <div className="prescription-empty-title">No Prescriptions Found</div>
              <div className="prescription-empty-message">There are no prescriptions to display.</div>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="prescription-empty">
              <div className="prescription-empty-icon">🔍</div>
              <div className="prescription-empty-title">No Results</div>
              <div className="prescription-empty-message">Try adjusting your filters.</div>
            </div>
          ) : (
            <table className="prescription-table">
              <thead>
                <tr>
                  <th>Prescription Code</th>
                  <th>Version</th>
                  <th>Patient Code</th>
                  <th>Plan Code</th>
                  <th>Medicines</th>
                  <th>Issued At</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((rx) => (
                  <tr key={rx._id}>
                    <td><strong>{rx.prescriptionCode}</strong></td>
                    <td>
                      <span className={`status-badge ${rx.isActive ? 'status-badge--active' : 'status-badge--inactive'}`}>v{rx.version}</span>
                    </td>
                    <td>{rx.patientCode}</td>
                    <td>{rx.planCode}</td>
                    <td>
                      {rx.medicines.map((m, i) => (
                        <div key={i} className="medicine-item">
                          <span className="medicine-name">{m.name}</span>
                          <div className="medicine-dosage">{m.dosage}</div>
                          <div className="medicine-instructions">{m.instructions || "No specific instructions"}</div>
                        </div>
                      ))}
                    </td>
                    <td>{formatDate(rx.issuedAt)}</td>
                    <td>
                      <span className={`status-badge ${rx.isActive ? 'status-badge--active' : 'status-badge--inactive'}`}>
                        {rx.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Summary Stats */}
        {history.length > 0 && (
          <div style={{ marginTop: '32px', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#1e293b', fontSize: '16px', fontWeight: '600' }}>
              📊 History Summary
            </h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              Total prescriptions: <strong>{history.length}</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}