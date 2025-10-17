import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../Contexts/AuthContext';
import { API_BASE } from "../api";
import "./receptionistnotifications.css";

const REFRESH_MS = 60_000;

function fmtDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString();
}

function minutesLabel(mins) {
  if (mins == null) return "-";
  if (mins <= 0) return "Expired";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h ${rem}m`;
}

export default function ReceptionistNotifications() {
  const navigate = useNavigate();
  const { user, token, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState("appointments");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, setPending] = useState([]);
  const [autoCancelled, setAutoCancelled] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Redirect if not authenticated or not a receptionist
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'Receptionist')) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  // Create authenticated fetch helper
  const authenticatedFetch = useCallback(async (url, options = {}) => {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }, [token]);

  const groupedPending = useMemo(() => {
    console.log('🔄 Grouping pending appointments:', pending);
    const byDentist = new Map();
    for (const item of pending) {
      const key = item.dentist_code || "Unknown";
      if (!byDentist.has(key)) byDentist.set(key, []);
      byDentist.get(key).push(item);
    }
    const result = Array.from(byDentist.entries()).map(([dentist, items]) => ({ dentist, items }));
    console.log('📊 Grouped pending appointments:', result);
    return result;
  }, [pending]);

  const load = useCallback(async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      setError("");
      console.log('🔍 Loading notifications from:', `${API_BASE}/receptionist/notifications/appointments`);
      const response = await authenticatedFetch(`${API_BASE}/receptionist/notifications/appointments`);
      const data = await response.json();
      console.log('📋 Notifications data received:', data);
      console.log('📊 Pending appointments:', data?.pending?.length || 0);
      console.log('📊 Auto-cancelled appointments:', data?.autoCancelled?.length || 0);
      setPending(data?.pending || []);
      setAutoCancelled(data?.autoCancelled || []);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message);
      console.error('❌ Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  }, [token, authenticatedFetch]);

  useEffect(() => {
    if (user && user.role === 'Receptionist' && token) {
      load();
      const t = setInterval(load, REFRESH_MS);
      return () => clearInterval(t);
    }
  }, [user, token, load]);

  // Manual acceptance function removed - appointments now auto-confirm after 4 hours

  async function cancel(code) {
    const reason = window.prompt(`Cancel ${code}? Optional reason:`) || "";
    if (reason === null) return; // User cancelled the prompt
    
    try {
      console.log('🎯 Cancelling appointment:', code, 'reason:', reason);
      const response = await authenticatedFetch(`${API_BASE}/receptionist/appointments/${code}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      const data = await response.json();
      console.log('❌ Cancel response:', data);
      
      const who = data.receptionistCode ? ` by ${data.receptionistCode}` : "";
      setInfo(`❌ Appointment ${code} cancelled${who}`);
      setTimeout(() => setInfo(""), 5000);
      
      // Reload the notifications to update the list
      await load();
    } catch (e) {
      console.error('❌ Cancel error:', e);
      setError(`Failed to cancel ${code}: ${e.message}`);
      setTimeout(() => setError(""), 5000);
    }
  }

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="notif-loading-container">
        <div className="notif-loading-spinner"></div>
        <p>Loading notifications page...</p>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!user || user.role !== 'Receptionist') {
    return null;
  }

  return (
    <div className="notif-main">
      <header className="notif-header">
        <div className="notif-header-content">
          <h1>📋 Notifications Center</h1>
          <p className="notif-subtitle">Manage appointment notifications and alerts</p>
          {lastUpdated && (
            <span className="notif-last-updated">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="notif-header-actions">
          <button 
            className="notif-refresh-header" 
            onClick={load} 
            disabled={loading}
          >
            {loading ? "🔄" : "↻"} {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {/* Alert Messages */}
      {error && (
        <div className="notif-alert error" onClick={() => setError("")}>
          <span className="notif-alert-close">×</span>
          {error}
        </div>
      )}
      {info && (
        <div className="notif-alert ok" onClick={() => setInfo("")}>
          <span className="notif-alert-close">×</span>
          {info}
        </div>
      )}

      {/* Main Content */}
      {activeTab === "appointments" && (
        <section className="notif-section">
          <div className="notif-section-head">
            <div className="notif-section-title">
              <h2>⏰ Pending Online Appointments (Auto-confirm in 4h)</h2>
              <span className="notif-count-badge">
                {groupedPending.reduce((total, group) => total + group.items.length, 0)} pending
              </span>
            </div>
          </div>
          
          {loading && groupedPending.length === 0 ? (
            <div className="notif-loading">
              <div className="notif-loading-spinner"></div>
              <p>Loading pending appointments...</p>
            </div>
          ) : groupedPending.length === 0 ? (
            <div className="notif-empty">
              <div className="notif-empty-content">
                <span className="notif-empty-icon">✅</span>
                <h3>All Clear!</h3>
                <p>No pending online appointments at the moment. New appointments will auto-confirm after 4 hours.</p>
              </div>
            </div>
          ) : (
            <div className="notif-pending-list">
              {groupedPending.map(group => (
                <div className="notif-group" key={group.dentist}>
                  <div className="notif-group-title">
                    <span className="notif-group-icon">👨‍⚕️</span>
                    {group.dentist}
                    <span className="notif-group-count">({group.items.length})</span>
                  </div>
                  <div className="notif-group-cards">
                    {group.items.map(item => (
                      <div className={`notif-card ${item.expiresInMinutes != null && item.expiresInMinutes <= 30 ? "warn" : ""}`} key={item.appointmentCode}>
                        <div className="notif-card-header">
                          <div className="notif-card-title">{item.appointmentCode}</div>
                          <div className="notif-card-status">
                            {item.expiresInMinutes != null && item.expiresInMinutes <= 30 ? (
                              <span className="notif-status-warn">⚠️ Expiring Soon</span>
                            ) : (
                              <span className="notif-status-pending">⏳ Pending</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="notif-card-body">
                          <div className="notif-card-row">
                            <div className="notif-card-label">👤 Patient:</div>
                            <div className="notif-card-value">{item.patient?.name || item.patient_code}</div>
                          </div>
                          <div className="notif-card-row">
                            <div className="notif-card-label">📞 Contact:</div>
                            <div className="notif-card-value">{item.patient?.contact || "-"}</div>
                          </div>
                          <div className="notif-card-row">
                            <div className="notif-card-label">📅 Requested for:</div>
                            <div className="notif-card-value">{fmtDateTime(item.appointment_date)}</div>
                          </div>
                          <div className="notif-card-row">
                            <div className="notif-card-label">🕐 Requested at:</div>
                            <div className="notif-card-value">{fmtDateTime(item.requestedAt)}</div>
                          </div>
                          <div className="notif-card-row">
                            <div className="notif-card-label">📝 Reason:</div>
                            <div className="notif-card-value">{item.appointmentReason || "No reason provided"}</div>
                          </div>
                          <div className="notif-card-row">
                            <div className="notif-card-label">⏰ Time left:</div>
                            <div className={`notif-card-value ${item.expiresInMinutes != null && item.expiresInMinutes <= 30 ? "notif-time-warn" : "notif-time-normal"}`}>
                              {minutesLabel(item.expiresInMinutes)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="notif-actions">
                          <div className="notif-auto-confirm-info">
                            <span className="notif-auto-confirm-text">
                              ⏰ Will auto-confirm after 4 hours
                            </span>
                          </div>
                          <button 
                            className="notif-btn danger" 
                            onClick={() => cancel(item.appointmentCode)}
                            title="Cancel this appointment"
                          >
                            ❌ Cancel
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="notif-section-head">
            <div className="notif-section-title">
              <h2>📋 Auto-cancelled Appointments</h2>
              <span className="notif-count-badge">
                {autoCancelled.length} cancelled
              </span>
            </div>
          </div>
          
          {autoCancelled.length === 0 ? (
            <div className="notif-empty">
              <div className="notif-empty-content">
                <span className="notif-empty-icon">🎉</span>
                <h3>Great Job!</h3>
                <p>No auto-cancelled appointments in recent history.</p>
              </div>
            </div>
          ) : (
            <div className="notif-cancelled-list">
              {autoCancelled.map(item => (
                <div className="notif-card cancelled" key={`${item.appointmentCode}-${item.autoCanceledAt || item.canceledAt}`}>
                  <div className="notif-card-header">
                    <div className="notif-card-title">{item.appointmentCode}</div>
                    <div className="notif-card-status">
                      <span className="notif-status-cancelled">❌ Auto-cancelled</span>
                    </div>
                  </div>
                  
                  <div className="notif-card-body">
                    <div className="notif-card-row">
                      <div className="notif-card-label">👤 Patient:</div>
                      <div className="notif-card-value">{item.patient?.name || item.patient_code}</div>
                    </div>
                    <div className="notif-card-row">
                      <div className="notif-card-label">👨‍⚕️ Dentist:</div>
                      <div className="notif-card-value">{item.dentist?.name || item.dentist_code}</div>
                    </div>
                    <div className="notif-card-row">
                      <div className="notif-card-label">📅 Requested for:</div>
                      <div className="notif-card-value">{fmtDateTime(item.appointment_date)}</div>
                    </div>
                    <div className="notif-card-row">
                      <div className="notif-card-label">❌ Auto cancelled:</div>
                      <div className="notif-card-value">{fmtDateTime(item.autoCanceledAt || item.canceledAt)}</div>
                    </div>
                    <div className="notif-card-row">
                      <div className="notif-card-label">👤 Cancelled by:</div>
                      <div className="notif-card-value">{item.canceledByCode || "AUTO"}</div>
                    </div>
                    <div className="notif-card-row">
                      <div className="notif-card-label">📝 Notes:</div>
                      <div className="notif-card-value">{item.appointmentReason || "No notes"}</div>
                    </div>
                    <div className="notif-card-row">
                      <div className="notif-card-label">💭 Cancel reason:</div>
                      <div className="notif-card-value">{item.cancellationReason || 'Not confirmed in time'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </section>
        )}
      </div>
  );
}


