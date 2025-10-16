// src/Components/Queue/ReceptionistQueue.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "../../Contexts/AuthContext";
import "./ReceptionistQueue.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export default function ReceptionistQueue() {
  const { token, user } = useAuth();
  
  // State variables
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("waiting");
  
  // Modal states
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showDeleteUpdateModal, setShowDeleteUpdateModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newTime, setNewTime] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newDentistCode, setNewDentistCode] = useState("");
  
  // Helper function to get today's date string
  const todayStr = new Date().toISOString().split('T')[0];
  
  // State for selected date (default to today, but allow changing)
  const [selectedDate, setSelectedDate] = useState(todayStr);
  

  // Helper function for authenticated requests
  const authenticatedFetch = useCallback(async (url, options = {}) => {
    const headers = {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };
    
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }
    
    return response.json();
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    setError("");
    
    try {
      // Silently backfill queue
      try {
        await authenticatedFetch(`${API_BASE}/receptionist/queue/migrate-today?date=${selectedDate}`, {
          method: "POST",
        });
      } catch (e) {
        console.warn("migrate failed", e);
      }

      // Load queue items
      const data = await authenticatedFetch(`${API_BASE}/receptionist/queue?date=${selectedDate}`);
      setItems(data.items || []);
    } catch (e) {
      console.error("queue fetch failed", e);
      setError(e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, token, authenticatedFetch]);

  useEffect(() => {
    if (token) {
      load();
      // Auto-refresh every 30 seconds
      const interval = setInterval(load, 30000);
      return () => clearInterval(interval);
    }
  }, [load, token]);

  // Group items by dentist
  const groupedByDentist = useMemo(() => {
    const groups = {};
    items.forEach((item) => {
      if (!groups[item.dentistCode]) {
        groups[item.dentistCode] = [];
      }
      groups[item.dentistCode].push(item);
    });
    return groups;
  }, [items]);

// Get next patient for each dentist (for Next tab)
const nextPatients = useMemo(() => {
  const next = {};
  Object.keys(groupedByDentist).forEach((dentistCode) => {
    const dentistItems = groupedByDentist[dentistCode];
    
    // First, check if there's a 'called' patient
    const called = dentistItems.find(q => q.status === 'called');
    if (called) {
      next[dentistCode] = called;
    } else {
      // If no called patient, check if there's an 'in_treatment' patient
      const inTreatment = dentistItems.find(q => q.status === 'in_treatment');
      if (inTreatment) {
        // If someone is in treatment, show the next waiting patient
        const waiting = dentistItems
          .filter(q => q.status === 'waiting')
          .sort((a, b) => a.position - b.position)[0];
        if (waiting) next[dentistCode] = waiting;
      }
    }
  });
  return next;
}, [groupedByDentist]);

  // Get ongoing (in_treatment) patients (for Ongoing tab)
  const ongoingPatients = useMemo(() => {
    return items.filter(q => q.status === 'in_treatment');
  }, [items]);

  // Handle status change (for dentist)
  async function handleStatusChange(queueCode, newStatus) {
    try {
      setError("");
      await authenticatedFetch(`${API_BASE}/receptionist/queue/${queueCode}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setSuccess(`Status updated to ${newStatus}`);
      load();
    } catch (e) {
      console.error("Status update failed", e);
      setError(`Failed to update status: ${e.message}`);
    }
  }

  // Handle Cancel button
  async function handleCancel(queueCode) {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      setError("");
      await authenticatedFetch(`${API_BASE}/receptionist/queue/${queueCode}/cancel`, {
        method: "DELETE",
        body: JSON.stringify({ reason: "Cancelled by receptionist" }),
      });
      setSuccess("Appointment cancelled successfully");
      load();
    } catch (e) {
      console.error("Cancel failed", e);
      setError(`Failed to cancel appointment: ${e.message}`);
    }
  }

  // Handle Update button (same day, same dentist, different time)
  async function handleUpdate(item) {
    // eslint-disable-next-line no-restricted-globals
    

    const newDateTimeISO = `${todayStr}T${newTime}:00`;
    try {
      setError("");
      await authenticatedFetch(`${API_BASE}/receptionist/queue/${item.queueCode}/switch-time`, {
        method: "PATCH",
        body: JSON.stringify({ newTime: newDateTimeISO }),
      });
      setSuccess("Appointment time updated successfully");
      load();
    } catch (e) {
      console.error("Update failed", e);
      setError(`Failed to update appointment: ${e.message}`);
    }
  }

  // Handle Delete & Update button (different day/dentist)
  async function handleDeleteAndUpdate(item) {
    // eslint-disable-next-line no-restricted-globals
   
    try {
      setError("");
      await authenticatedFetch(`${API_BASE}/receptionist/queue/${item.queueCode}/delete-update`, {
        method: "POST",
        body: JSON.stringify({
          newDate,
          newTime,
          newDentistCode,
          reason: "Rescheduled",
        }),
      });
      setSuccess("Appointment rescheduled successfully");
      load();
    } catch (e) {
      console.error("Delete & Update failed", e);
      setError(`Failed to reschedule appointment: ${e.message}`);
    }
  }

  // Check button availability based on status
  function getButtonAvailability(status) {
    switch (status) {
      case 'waiting':
      case 'called':
        return { cancel: true, update: true, deleteUpdate: true };
      case 'in_treatment':
        return { cancel: false, update: true, deleteUpdate: true };
      case 'completed':
        return { cancel: false, update: false, deleteUpdate: false };
      case 'no_show':
        return { cancel: false, update: true, deleteUpdate: true };
      default:
        return { cancel: true, update: true, deleteUpdate: true };
    }
  }

  // Calculate action display
  function getAction(item) {
    if (item.previousTime) return "Time switched";
    return "-";
  }

  return (
    <div className="queue-container">
      {/* Page Header */}
      <div style={{ 
        marginBottom: "20px", 
        padding: "15px", 
        backgroundColor: "#007bff", 
        color: "white", 
        borderRadius: "8px",
        textAlign: "center"
      }}>
        <h1 style={{ margin: "0", fontSize: "24px", fontWeight: "bold" }}>
          📋 Receptionist Queue Management
        </h1>
        <p style={{ margin: "5px 0 0 0", fontSize: "14px", opacity: "0.9" }}>
          Manage patient queue and appointments
        </p>
      </div>
      
      {/* Error and Success Messages */}
      {error && (
        <div className="alert error">
          {error}
          <button onClick={() => setError("")} className="close-btn">×</button>
        </div>
      )}
      {success && (
        <div className="alert success">
          {success}
          <button onClick={() => setSuccess("")} className="close-btn">×</button>
        </div>
      )}
      
      {/* Date Picker */}
      <div className="date-picker-container" style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "8px", border: "1px solid #e9ecef" }}>
        <label htmlFor="date-selector" style={{ marginRight: "10px", fontWeight: "bold", color: "#495057" }}>
          Select Date:
        </label>
        <input
          id="date-selector"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{ 
            padding: "8px 12px", 
            border: "1px solid #ced4da", 
            borderRadius: "4px", 
            fontSize: "14px",
            marginRight: "10px"
          }}
        />
        <button 
          onClick={load}
          disabled={loading}
          style={{
            padding: "8px 16px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? "Loading..." : "Load Queue"}
        </button>
        <span style={{ marginLeft: "10px", color: "#6c757d", fontSize: "14px" }}>
          Showing queue for: {selectedDate} ({items.length} items loaded)
        </span>
        <div style={{ marginTop: "10px", padding: "8px", backgroundColor: "#e3f2fd", borderRadius: "4px", fontSize: "12px" }}>
          <strong>Note:</strong> This is the Queue page. If you're seeing 404 errors for schedule endpoints, 
          make sure you're on the correct page: <strong>/receptionist/queue</strong> (not /receptionist/schedule)
        </div>
      </div>
      
      <div className="tabs">
        <button
          className={tab === "ongoing" ? "active" : ""}
          onClick={() => setTab("ongoing")}
        >
          Ongoing
        </button>
        <button
          className={tab === "next" ? "active" : ""}
          onClick={() => setTab("next")}
        >
          Next
        </button>
        <button
          className={tab === "details" ? "active" : ""}
          onClick={() => setTab("details")}
        >
          Queue Details
        </button>
        <button 
          style={{ marginLeft: "auto" }} 
          onClick={load}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="tab-content">
        {/* ONGOING TAB */}
        {tab === "ongoing" && (
          <>
            {ongoingPatients.length === 0 && <p>No patients in treatment.</p>}
            {ongoingPatients.map((q) => (
              <div key={q.queueCode} className="queue-card" data-status={q.status}>
                <p><b>Patient Code:</b> {q.patientCode}</p>
                <p><b>Dentist:</b> {q.dentistCode}</p>
                <p><b>Date & Time:</b> {new Date(q.date).toLocaleString()}</p>
                <p><b>Status:</b> {q.status}</p>
                <div className="actions">
                  <button onClick={() => handleStatusChange(q.queueCode, 'completed')}>
                    Mark Completed
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* NEXT TAB */}
        {tab === "next" && (
          <>
            {Object.keys(nextPatients).length === 0 && <p>No next patients.</p>}
            {Object.entries(nextPatients).map(([dentistCode, q]) => (
              <div key={q.queueCode} className="queue-card" data-status={q.status}>
                <h3>Dentist: {dentistCode}</h3>
                <p><b>Patient Code:</b> {q.patientCode}</p>
                <p><b>Date & Time:</b> {new Date(q.date).toLocaleString()}</p>
                <p><b>Status:</b> {q.status}</p>
                <div className="actions">
                  {q.status === 'waiting' && (
                    <button onClick={() => handleStatusChange(q.queueCode, 'called')}>
                      Call Patient
                    </button>
                  )}
                  {q.status === 'called' && (
                    <>
                      <button onClick={() => handleStatusChange(q.queueCode, 'in_treatment')}>
                        Start Treatment
                      </button>
                      <button onClick={() => handleStatusChange(q.queueCode, 'no_show')}>
                        Mark No Show
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {/* QUEUE DETAILS TAB */}
        {tab === "details" && (
          <>
            {Object.keys(groupedByDentist).length === 0 && <p>No appointments today.</p>}
            {Object.entries(groupedByDentist).map(([dentistCode, dentistItems]) => (
              <div key={dentistCode} className="dentist-group">
                <h2 className="dentist-header">Dentist: {dentistCode}</h2>
                <div className="table-container">
                  <table className="queue-table">
                    <thead>
                      <tr>
                        <th>Patient Code</th>
                        <th>Date & Time</th>
                        <th>Status</th>
                        <th>Action</th>
                        <th>Options</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dentistItems.map((item) => {
                        const buttons = getButtonAvailability(item.status);
                        return (
                          <tr key={item.queueCode}>
                            <td>{item.patientCode}</td>
                            <td>{new Date(item.date).toLocaleString()}</td>
                            <td><span className={`status-badge status-${item.status}`}>{item.status}</span></td>
                            <td>{getAction(item)}</td>
                            <td className="options-cell">
                              <button
                                disabled={!buttons.cancel}
                                onClick={() => handleCancel(item.queueCode)}
                                className="btn-cancel"
                              >
                                Cancel
                              </button>
                              <button
  disabled={!buttons.update}
  onClick={() => { setSelectedItem(item); setNewTime(""); setShowUpdateModal(true); }}
  className="btn-update"
>
  Update
</button>
<button
  disabled={!buttons.deleteUpdate}
  onClick={() => { setSelectedItem(item); setNewDate(""); setNewTime(""); setNewDentistCode(item.dentistCode); setShowDeleteUpdateModal(true); }}
  className="btn-delete-update"
>
  Delete & Update
</button>

                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      {showUpdateModal && selectedItem && (
  <div className="rc-modal">
    <div className="rc-modal-content">
      <h3>Update Appointment</h3>
      <input
        type="time"
        value={newTime}
        onChange={(e) => setNewTime(e.target.value)}
      />
      <div className="rc-modal-actions">
        <button onClick={() => setShowUpdateModal(false)}>Cancel</button>
        <button onClick={async () => {
          await handleUpdate(selectedItem, newTime);
          setShowUpdateModal(false);
        }}>Confirm</button>
      </div>
    </div>
  </div>
)}

{showDeleteUpdateModal && selectedItem && (
  <div className="rc-modal-overlay">
    <div className="rc-modal">
      <div className="rc-modal-header">
        <h3 className="rc-modal-title">Delete & Update Appointment</h3>
        <button 
          className="rc-modal-close" 
          onClick={() => setShowDeleteUpdateModal(false)}
          aria-label="Close modal"
        >
          ×
        </button>
      </div>
      
      <div className="rc-modal-body">
        <div className="rc-form-group">
          <label className="rc-form-label">
            <i className="rc-icon">📅</i>
            New Date
          </label>
          <input
            type="date"
            className="rc-form-input"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            placeholder="Select new date"
          />
        </div>
        
        <div className="rc-form-group">
          <label className="rc-form-label">
            <i className="rc-icon">🕐</i>
            New Time
          </label>
          <input
            type="time"
            className="rc-form-input"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            placeholder="Select new time"
          />
        </div>
        
        <div className="rc-form-group">
          <label className="rc-form-label">
            <i className="rc-icon">👨‍⚕️</i>
            Doctor Code
          </label>
          <input
            type="text"
            className="rc-form-input"
            value={newDentistCode}
            onChange={(e) => setNewDentistCode(e.target.value)}
            placeholder="Enter doctor code (e.g., Dr-0001)"
          />
        </div>
      </div>
      
      <div className="rc-modal-footer">
        <button 
          className="rc-btn rc-btn-secondary" 
          onClick={() => setShowDeleteUpdateModal(false)}
        >
          Cancel
        </button>
        <button 
          className="rc-btn rc-btn-primary"
          onClick={async () => {
            await handleDeleteAndUpdate(selectedItem, newDate, newTime, newDentistCode);
            setShowDeleteUpdateModal(false);
          }}
        >
          <i className="rc-icon">✓</i>
          Confirm Reschedule
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
}