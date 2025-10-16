import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from '../../Contexts/AuthContext';
import "./Dentistdashboard.css";

const API = "http://localhost:5000";

function formatDateOnly(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DashboardMetrics() {
  const { user, token } = useAuth();
  const dentistCode = user?.dentistCode;
  const [todayCount, setTodayCount] = useState(0);
  const [plansCount, setPlansCount] = useState(0);
  const [rxCount, setRxCount] = useState(0);
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Appointment details modal state
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const sameDay = (a, b) => {
    if (!a || !b) return false;
    const ad = new Date(a), bd = new Date(b);
    return ad.getFullYear() === bd.getFullYear() && ad.getMonth() === bd.getMonth() && ad.getDate() === bd.getDate();
  };

  // Load today's queue + other metrics
  const loadData = useCallback(async () => {
    // Get current values directly from state/context to avoid dependency issues
    const currentDentistCode = user?.dentistCode;
    const currentToken = token;
    
    if (!currentDentistCode || !currentToken) return;
    
    setLoading(true);
    setError(null);
    const today = formatDateOnly(new Date());

    // Create authenticated axios instance inline
    const authenticatedFetch = async (url, options = {}) => {
      const headers = {
        'Authorization': `Bearer ${currentToken}`,
        'Content-Type': 'application/json',
        ...options.headers
      };
      
      try {
        const response = await axios({ ...options, url, headers });
        return response;
      } catch (error) {
        console.error('API Error:', error);
        throw error;
      }
    };

    try {
      // Get today's queue from dentist-queue API
      const todayDate = new Date();
      const todayStart = new Date(todayDate.setHours(0, 0, 0, 0));
      const todayEnd = new Date(todayDate.setHours(23, 59, 59, 999));
      
      const queueRes = await authenticatedFetch(`${API}/api/dentist-queue/today`, {
        method: 'GET',
        params: { dentistCode: currentDentistCode, date: today }
      });
      
      const list = Array.isArray(queueRes.data) ? queueRes.data : [];
      
      // Debug: Check if we're receiving booking for someone else data
      console.log('📊 Queue data received:', list.length, 'items');
      list.forEach((item, idx) => {
        if (item.isBookingForSomeoneElse) {
          console.log(`✅ Item ${idx} is booking for someone else:`, {
            patientName: item.patientName,
            bookerPatientCode: item.bookerPatientCode,
            otherPersonDetails: {
              name: item.patientName,
              contact: item.patientContact,
              age: item.patientAge,
              gender: item.patientGender,
              relation: item.patientRelation
            }
          });
        }
      });
      
      // Strictly filter for TODAY's date only
      const todayOnly = list.filter(row => {
        const dateStr = row.appointment_date || row.date;
        if (!dateStr) return false;
        
        const rowDate = new Date(dateStr);
        return rowDate >= todayStart && rowDate <= todayEnd;
      });
      
      // Remove duplicates based on multiple criteria
      const uniqueQueue = todayOnly.filter((item, index, self) => {
        return index === self.findIndex((t) => {
          // Match by _id (most reliable)
          if (item._id && t._id && item._id === t._id) return true;
          
          // Match by queueCode
          if (item.queueCode && t.queueCode && item.queueCode === t.queueCode) return true;
          
          // Match by patient + time combination (to catch entries without queueCode)
          const itemPatient = item.patientCode || item.patient_code;
          const tPatient = t.patientCode || t.patient_code;
          const itemTime = item.appointment_date || item.date;
          const tTime = t.appointment_date || t.date;
          
          if (itemPatient && tPatient && itemTime && tTime) {
            return itemPatient === tPatient && 
                   new Date(itemTime).getTime() === new Date(tTime).getTime();
          }
          
          return false;
        });
      });
      
      setTodayCount(uniqueQueue.length);
      setQueue(uniqueQueue);

      // Treatment plans - temporarily disabled to fix infinite loop
      setPlansCount(0);

      // Prescriptions - temporarily disabled to fix infinite loop  
      setRxCount(0);

      setLastUpdated(new Date());

    } catch (err) {
      console.error("Error loading dashboard data:", err);
      setError("Failed to load dashboard data. Please try again.");
      setQueue([]);
      setTodayCount(0);
    } finally {
      setLoading(false);
    }
  }, [user?.dentistCode, token]); // Use user?.dentistCode instead of dentistCode

  useEffect(() => {
    if (user?.dentistCode && token) {
      loadData();
    }
  }, [user?.dentistCode, token, loadData]); // Include loadData in dependencies

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (user?.dentistCode && token) {
        loadData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user?.dentistCode, token, loadData]); // Include loadData in dependencies

  // Manual refresh function
  const handleRefresh = () => {
    loadData();
  };

  return (
    <div className="dashboard-container">
      {/* Error Alert */}
      {error && (
        <div className="error-alert">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="error-close">×</button>
        </div>
      )}

      {/* Top metrics cards */}
      <div className="metrics-grid">
        <MetricCard 
          title="Today's Patients" 
          value={todayCount} 
          type="patients" 
          loading={loading}
        />
        <MetricCard 
          title="Treatment Plans" 
          value={plansCount} 
          type="treatment-plans" 
          loading={loading}
        />
        <MetricCard 
          title="Prescriptions" 
          value={rxCount} 
          type="prescriptions" 
          loading={loading}
        />
      </div>

      {/* Queue table */}
      <div className="table-container">
        <div className="table-header">
          <div className="table-title-section">
            <h3 className="table-title">
              Patient Queue - {formatDateOnly(new Date())}
            </h3>
            {lastUpdated && (
              <span className="last-updated">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="table-actions">
            <button 
              onClick={handleRefresh}
              className="refresh-btn"
              disabled={loading}
            >
              {loading ? "🔄" : "↻"} Refresh
            </button>
          </div>
        </div>
        
        <div className="table-wrapper">
          {loading && queue.length === 0 ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading patient queue...</p>
            </div>
          ) : (
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Queue No</th>
                  <th>Patient Code</th>
                  <th>Patient Name</th>
                  <th>Time</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((a) => (
                  <tr 
                    key={a._id}
                    onClick={() => {
                      setSelectedAppointment(a);
                      setShowDetailsModal(true);
                    }}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td>{a.queueNo || a.queue_number || "-"}</td>
                    <td>
                      {/* Patient Code Column: Shows BOOKER'S ID for identification */}
                      {a.isBookingForSomeoneElse ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                          <span style={{ fontWeight: '600', color: '#3b82f6' }}>
                            {a.patientCode || a.bookerPatientCode || "N/A"}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                            (Booker)
                          </span>
                        </div>
                      ) : (
                        a.patientCode || a.patient_code || "-"
                      )}
                    </td>
                    <td>
                      {/* Patient Name Column: Shows OTHER PERSON'S NAME */}
                      {a.isBookingForSomeoneElse ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div style={{ fontWeight: '700', color: '#111827', fontSize: '0.95rem' }}>
                            ✓ {a.patientName || "-"}
                            {a.patientRelation && (
                              <span style={{ 
                                marginLeft: '0.5rem', 
                                fontSize: '0.7rem', 
                                fontWeight: '600',
                                color: '#059669',
                                padding: '0.125rem 0.5rem',
                                background: '#d1fae5',
                                borderRadius: '0.25rem',
                                border: '1px solid #10b981'
                              }}>
                                {a.patientRelation}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#6b7280', fontStyle: 'italic' }}>
                            ⚕️ Patient for treatment
                          </div>
                          {a.patientContact && (
                            <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                              📞 {a.patientContact}
                            </div>
                          )}
                          {(a.patientAge || a.patientGender) && (
                            <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                              {a.patientAge && `${a.patientAge} yrs`}
                              {a.patientAge && a.patientGender && ' • '}
                              {a.patientGender && a.patientGender.charAt(0).toUpperCase() + a.patientGender.slice(1)}
                            </div>
                          )}
                        </div>
                      ) : (
                        a.patientName || a.patient_name || "-"
                      )}
                    </td>
                    <td>
                      {a.appointment_date || a.date ? 
                        new Date(a.appointment_date || a.date).toLocaleTimeString(
                          [], { hour: "2-digit", minute: "2-digit" }
                        ) : "-"
                      }
                    </td>
                    <td>{a.reason || "-"}</td>
                  </tr>
                ))}
                {queue.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      <div className="empty-state-content">
                        <span className="empty-icon">📋</span>
                        <p>No patients in queue today</p>
                        <small>{formatDateOnly(new Date())}</small>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Appointment Details Modal */}
      {showDetailsModal && selectedAppointment && (
        <AppointmentDetailsModal 
          appointment={selectedAppointment} 
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedAppointment(null);
          }}
        />
      )}
    </div>
  );
}

// Appointment Details Modal Component
function AppointmentDetailsModal({ appointment, onClose }) {
  const a = appointment;
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '2px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>
            📋 Appointment Details
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold'
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {/* Queue Info */}
          <div style={{ marginBottom: '24px', padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: '600', color: '#111827' }}>
              Queue Information
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <DetailItem label="Queue Number" value={a.queueNo || a.queue_number || "-"} />
              <DetailItem label="Status" value={
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  background: a.status === 'completed' ? '#d1fae5' : 
                             a.status === 'in_treatment' ? '#dbeafe' : 
                             a.status === 'called' ? '#fef3c7' : '#f3f4f6',
                  color: a.status === 'completed' ? '#065f46' : 
                         a.status === 'in_treatment' ? '#1e40af' : 
                         a.status === 'called' ? '#92400e' : '#374151'
                }}>
                  {a.status || 'waiting'}
                </span>
              } />
            </div>
          </div>

          {/* Patient Information */}
          {a.isBookingForSomeoneElse ? (
            <>
              {/* Booked for Someone Else - Show Other Person's Details */}
              <div style={{ marginBottom: '24px', padding: '16px', background: '#eff6ff', borderRadius: '8px', border: '2px solid #3b82f6' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: '600', color: '#1e40af' }}>
                  ⚕️ Patient for Treatment (Booked by Someone Else)
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic' }}>
                  This appointment was booked by another patient
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                  <DetailItem 
                    label="Patient Name" 
                    value={
                      <span style={{ fontWeight: '700', fontSize: '1.1rem', color: '#111827' }}>
                        ✓ {a.patientName || "-"}
                        {a.patientRelation && (
                          <span style={{ 
                            marginLeft: '8px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            color: '#059669',
                            padding: '2px 8px',
                            background: '#d1fae5',
                            borderRadius: '4px',
                            border: '1px solid #10b981'
                          }}>
                            {a.patientRelation}
                          </span>
                        )}
                      </span>
                    } 
                  />
                  <DetailItem label="Contact" value={a.patientContact || "-"} icon="📞" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <DetailItem label="Age" value={a.patientAge ? `${a.patientAge} years` : "-"} />
                    <DetailItem label="Gender" value={a.patientGender ? a.patientGender.charAt(0).toUpperCase() + a.patientGender.slice(1) : "-"} />
                  </div>
                  {a.patientNotes && (
                    <DetailItem label="Additional Notes" value={a.patientNotes} />
                  )}
                </div>
              </div>

              {/* Booker Information */}
              <div style={{ marginBottom: '24px', padding: '16px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fbbf24' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: '600', color: '#92400e' }}>
                  📋 Booked By (For Identification)
                </h3>
                <DetailItem 
                  label="Booker Patient Code" 
                  value={
                    <span style={{ fontWeight: '700', color: '#3b82f6', fontSize: '1.1rem' }}>
                      {a.bookerPatientCode || a.patientCode || "N/A"}
                    </span>
                  } 
                />
                {a.appointmentForPatientCode && (
                  <DetailItem 
                    label="Other Person's Patient Code" 
                    value={
                      <span style={{ fontSize: '0.9rem', color: '#059669' }}>
                        {a.appointmentForPatientCode} (Registered patient)
                      </span>
                    } 
                  />
                )}
              </div>
            </>
          ) : (
            /* Regular Appointment - Show Regular Patient */
            <div style={{ marginBottom: '24px', padding: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: '600', color: '#166534' }}>
                👤 Patient Information
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                <DetailItem label="Patient Code" value={a.patientCode || a.patient_code || "-"} />
                <DetailItem label="Patient Name" value={
                  <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>
                    {a.patientName || a.patient_name || "-"}
                  </span>
                } />
              </div>
            </div>
          )}

          {/* Appointment Details */}
          <div style={{ marginBottom: '24px', padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', fontWeight: '600', color: '#111827' }}>
              📅 Appointment Details
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              <DetailItem 
                label="Date & Time" 
                value={a.appointment_date || a.date ? 
                  new Date(a.appointment_date || a.date).toLocaleString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : "-"
                } 
                icon="🕐"
              />
              <DetailItem label="Reason for Visit" value={a.reason || "Not specified"} icon="💬" />
            </div>
          </div>

          {/* Additional Information */}
          {(a.dentistCode || a.appointmentCode) && (
            <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: '600', color: '#6b7280' }}>
                Additional Information
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.875rem' }}>
                {a.dentistCode && <DetailItem label="Dentist Code" value={a.dentistCode} />}
                {a.appointmentCode && <DetailItem label="Appointment Code" value={a.appointmentCode} />}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          background: '#f9fafb',
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.95rem'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper component for detail items
function DetailItem({ label, value, icon }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {icon && <span style={{ marginRight: '4px' }}>{icon}</span>}
        {label}
      </span>
      <span style={{ fontSize: '0.95rem', color: '#111827', fontWeight: '500' }}>
        {value || "-"}
      </span>
    </div>
  );
}

// Metric card component
function MetricCard({ title, value, type, loading = false }) {
  return (
    <div className={`metric-card ${type} ${loading ? 'loading' : ''}`}>
      <div className="metric-indicator" />
      <div className="metric-content">
        <div className="metric-title">{title}</div>
        <div className="metric-value">
          {loading ? (
            <div className="metric-loading">
              <div className="loading-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          ) : (
            value
          )}
        </div>
      </div>
    </div>
  );
}