import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import "./dentistleavepage.css";
import { API_BASE } from "../api";

export default function LeavePage() {
  const navigate = useNavigate();
  const { user, token, authLoading } = useAuth();
  
  const dentistCode = user?.dentistCode || "";
  const dentistName = user?.name || "";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ dateFrom: "", dateTo: "", reason: "" });
  const [showHistory, setShowHistory] = useState(false);

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

  const fetchLeave = useCallback(async () => {
    if (!dentistCode || !token) return;
    
    setLoading(true);
    try {
      const res = await authenticatedFetch(`${API_BASE}/leave?dentistCode=${encodeURIComponent(dentistCode)}`);
      const data = await res.json();
      if (res.ok) {
        setItems(Array.isArray(data.items) ? data.items : []);
        console.debug('Leave data loaded:', data.items?.length || 0, 'items');
      } else {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
    } catch (error) {
      console.error('Error fetching leave data:', error);
      setItems([]);
    }
    setLoading(false);
  }, [dentistCode, token, authenticatedFetch]);

  useEffect(() => {
    if (!authLoading) {
      fetchLeave();
    }
  }, [authLoading, fetchLeave]);

  const onCreate = async () => {
    if (!form.dateFrom || !form.dateTo) { 
      alert("Select date range"); 
      return; 
    }
    
    // validation: To date cannot be before From date
    try {
      const from = new Date(form.dateFrom);
      const to = new Date(form.dateTo);
      if (to < from) {
        alert('To date cannot be before From date');
        return;
      }
    } catch (error) {
      alert('Invalid date format');
      return;
    }

    // Check if required fields are available
    if (!dentistCode || !dentistName) {
      alert('Missing dentist information. Please refresh and try again.');
      return;
    }

    try {
      console.debug('Creating leave with data:', {
        dentistCode,
        dentistName,
        dateFrom: form.dateFrom,
        dateTo: form.dateTo,
        reason: form.reason,
        createdBy: dentistName
      });

      const res = await authenticatedFetch(`${API_BASE}/leave`, {
        method: 'POST',
        body: JSON.stringify({
          dentistCode,
          dentistName,
          dateFrom: form.dateFrom,
          dateTo: form.dateTo,
          reason: form.reason || "",
          createdBy: dentistName,
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to create leave');
      
      alert('Leave request created successfully!');
      setForm({ dateFrom: "", dateTo: "", reason: "" });
      fetchLeave();
    } catch (error) {
      console.error('Error creating leave:', error);
      alert(error.message || 'Failed to create leave request');
    }
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString() : "-";
  const fmtDateTime = (d) => d ? new Date(d).toLocaleString() : "-";

  if (authLoading) {
    return (
      <div className="leave-container">
        <div className="leave-header">
          <h2 className="leave-title">Leave</h2>
        </div>
        <div className="leave-loading">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="leave-container">
      <div className="leave-header">
        <h2 className="leave-title">Leave</h2>
        <button 
          className="leave-history-btn" 
          onClick={() => setShowHistory(v => !v)}
        >
          {showHistory ? 'Hide History' : 'Leave History'}
        </button>
      </div>

      <div className="leave-form">
        <div className="leave-form-grid">
          <div className="leave-form-field">
            <label className="leave-form-label">From</label>
            <input 
              className="leave-date-input" 
              type="date" 
              value={form.dateFrom} 
              onChange={(e) => {
                const v = e.target.value;
                setForm((prev) => {
                  let next = { ...prev, dateFrom: v };
                  // auto-correct dateTo if it is before new dateFrom
                  if (next.dateTo && v && new Date(next.dateTo) < new Date(v)) {
                    next.dateTo = v;
                  }
                  return next;
                });
              }} 
            />
          </div>
          <div className="leave-form-field">
            <label className="leave-form-label">To</label>
            <input 
              className="leave-date-input" 
              type="date" 
              value={form.dateTo} 
              min={form.dateFrom || undefined}
              onChange={(e) => setForm({...form, dateTo: e.target.value})} 
            />
          </div>
          <div className="leave-form-field full-width">
            <label className="leave-form-label">Reason</label>
            <input 
              className="leave-text-input" 
              value={form.reason} 
              onChange={(e) => setForm({...form, reason: e.target.value})} 
              placeholder="Optional reason" 
            />
          </div>
          <div className="leave-form-field button-field">
            <button className="leave-submit-btn" onClick={onCreate}>
              Request Leave
            </button>
          </div>
        </div>
      </div>

      {showHistory && (
        <div className="leave-history">
          {loading ? (
            <div className="leave-history-loading">Loading...</div>
          ) : (
            <div className="leave-history-table-wrapper">
              <table className="leave-history-table">
                <thead>
                  <tr>
                    <th>Dentist Code</th>
                    <th>Dentist Name</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Reason</th>
                    <th>Created By</th>
                    <th>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it._id}>
                      <td>
                        <span className="dentist-code-cell">{it.dentistCode}</span>
                      </td>
                      <td>
                        <span className="dentist-name-cell">{it.dentistName}</span>
                      </td>
                      <td>
                        <span className="date-cell">{fmt(it.dateFrom)}</span>
                      </td>
                      <td>
                        <span className="date-cell">{fmt(it.dateTo)}</span>
                      </td>
                      <td>
                        <span className="reason-cell">{it.reason || '-'}</span>
                      </td>
                      <td>{it.createdBy || '-'}</td>
                      <td>
                        <span className="datetime-cell">{fmtDateTime(it.createdAt)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}