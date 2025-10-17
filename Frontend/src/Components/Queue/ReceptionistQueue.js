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
  const [dentists, setDentists] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelAvailableSlots, setCancelAvailableSlots] = useState([]);
  const [loadingCancelSlots, setLoadingCancelSlots] = useState(false);
  const [selectedCancelTime, setSelectedCancelTime] = useState("");
  
  // Helper function to get today's date string
  const todayStr = "2025-10-17"; // Hardcoded to show 2025-10-17
  
  // ✅ State for selected date - always today's date only
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
      console.log('Queue API Response for date', selectedDate, ':', data);
      console.log('Items found:', data.items?.length || 0);
      console.log('Items data:', data.items);
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
      loadDentists();
      // Auto-refresh every 30 seconds
      const interval = setInterval(load, 30000);
      return () => clearInterval(interval);
    }
  }, [load, token]);

  // Load dentists list
  const loadDentists = useCallback(async () => {
    try {
      const data = await authenticatedFetch(`${API_BASE}/receptionist/dentists`);
      setDentists(data.items || []);
    } catch (e) {
      console.error("Failed to load dentists:", e);
    }
  }, [authenticatedFetch]);

  // Load available slots for selected dentist and date
  const loadAvailableSlots = useCallback(async (dentistCode, date) => {
    if (!dentistCode || !date) {
      setAvailableSlots([]);
      return;
    }
    
    setLoadingSlots(true);
    try {
      const data = await authenticatedFetch(`${API_BASE}/receptionist/schedule/dentists/${dentistCode}/slots?date=${date}&slot=30`);
      setAvailableSlots(data.slots || []);
    } catch (e) {
      console.error("Failed to load available slots:", e);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [authenticatedFetch]);

  // Load available slots for cancel modal (same day, same dentist)
  const loadCancelAvailableSlots = useCallback(async (dentistCode, date) => {
    if (!dentistCode || !date) {
      setCancelAvailableSlots([]);
      return;
    }
    
    setLoadingCancelSlots(true);
    try {
      console.log('Loading cancel slots for:', dentistCode, date);
      const data = await authenticatedFetch(`${API_BASE}/receptionist/schedule/dentists/${dentistCode}/slots?date=${date}&slot=30`);
      console.log('Cancel slots response:', data);
      setCancelAvailableSlots(data.slots || []);
    } catch (e) {
      console.error("Failed to load cancel available slots:", e);
      setCancelAvailableSlots([]);
    } finally {
      setLoadingCancelSlots(false);
    }
  }, [authenticatedFetch]);

  // Helper function to convert slot time to local time format
  const getSlotTimeString = (slotStart) => {
    const slotDate = new Date(slotStart);
    const hours = slotDate.getHours().toString().padStart(2, '0');
    const minutes = slotDate.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Load slots when date or dentist changes
  useEffect(() => {
    if (newDentistCode && newDate) {
      loadAvailableSlots(newDentistCode, newDate);
    }
  }, [newDate, newDentistCode, loadAvailableSlots]);

  // Group items by dentist
  const groupedByDentist = useMemo(() => {
    console.log('Grouping items:', items);
    const groups = {};
    items.forEach((item) => {
      if (!groups[item.dentistCode]) {
        groups[item.dentistCode] = [];
      }
      groups[item.dentistCode].push(item);
    });
    console.log('Grouped by dentist:', groups);
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

  // Handle Cancel button (simple confirmation)
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

  // Handle Update and Reschedule to new time slot
  async function handleUpdateAndReschedule(queueCode, newTimeSlot) {
    try {
      setError("");
      
      console.log("=== RESCHEDULE DEBUG ===");
      console.log("Received queueCode:", queueCode);
      console.log("Received newTimeSlot:", newTimeSlot);
      console.log("Current items:", items);
      console.log("Available queueCodes:", items.map(item => item.queueCode));
      
      // Get the current appointment details
      const currentItem = items.find(item => item.queueCode === queueCode);
      if (!currentItem) {
        console.error("Queue item not found for queueCode:", queueCode);
        console.error("Available queueCodes:", items.map(item => item.queueCode));
        throw new Error("Queue item not found");
      }

      console.log("Found current item:", currentItem);
      
      // Use the existing handleUpdate function which was working
      await handleUpdate(currentItem, newTimeSlot);
      
      setSuccess("Appointment rescheduled successfully");
      setShowCancelModal(false);
      setSelectedCancelTime("");
      load();
    } catch (e) {
      console.error("Update and reschedule failed", e);
      setError(`Failed to reschedule appointment: ${e.message}`);
    }
  }

  // Handle Update button (same day, same dentist, different time)
  async function handleUpdate(item, timeSlot = null) {
    try {
      setError("");
      
      // Use provided timeSlot or the newTime state
      const timeToUse = timeSlot || newTime;
      const newDateTimeISO = `${selectedDate}T${timeToUse}:00`;
      
      console.log("=== RESCHEDULE DEBUG ===");
      console.log("Original item:", item);
      console.log("Original item time:", item.date);
      console.log("New time slot:", timeToUse);
      console.log("Selected date:", selectedDate);
      console.log("Constructed datetime:", newDateTimeISO);
      console.log("QueueCode:", item.queueCode);
      console.log("========================");
      
      const response = await authenticatedFetch(`${API_BASE}/receptionist/queue/${item.queueCode}/switch-time`, {
        method: "PATCH",
        body: JSON.stringify({ newTime: newDateTimeISO }),
      });
      
      console.log("API response:", response);
      setSuccess("Appointment time updated successfully");
      
      // Force reload the queue data multiple times to ensure it updates
      setTimeout(() => {
        console.log("Reloading queue data...");
        load();
      }, 100);
      
      setTimeout(() => {
        console.log("Second reload of queue data...");
        load();
      }, 1000);
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
      
      {/* Today's Queue Info */}
      <div className="date-picker-container" style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f8f9fa", borderRadius: "8px", border: "1px solid #e9ecef" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontWeight: "bold", color: "#495057", fontSize: "16px" }}>
              📅 Today's Queue: {selectedDate}
            </span>
            <span style={{ marginLeft: "10px", color: "#6c757d", fontSize: "14px" }}>
              ({items.length} appointments loaded)
            </span>
          </div>
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
            {loading ? "Loading..." : "Refresh Queue"}
          </button>
        </div>
        <div style={{ marginTop: "10px", padding: "8px", backgroundColor: "#e3f2fd", borderRadius: "4px", fontSize: "12px" }}>
          <strong>Note:</strong> Queue shows only today's appointments. Yesterday's appointments are automatically removed.
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
                <p><b>Patient Name:</b> {q.patientName || 'Unknown Patient'}</p>
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
                <p><b>Patient Name:</b> {q.patientName || 'Unknown Patient'}</p>
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
                        <th>Patient Name</th>
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
                            <td>{item.patientName || 'Unknown Patient'}</td>
                            <td>{new Date(item.date).toLocaleString()}</td>
                            <td><span className={`status-badge status-${item.status}`}>{item.status}</span></td>
                            <td>
                              <select
                                value={item.status}
                                onChange={(e) => handleStatusChange(item.queueCode, e.target.value)}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid #ced4da",
                                  background: "#fff",
                                  minWidth: "140px"
                                }}
                              >
                                <option value="waiting">Waiting</option>
                                <option value="called">Called</option>
                                <option value="in_treatment">In Treatment</option>
                                <option value="completed">Completed</option>
                                <option value="no_show">No Show</option>
                              </select>
                            </td>
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
                                onClick={() => {
                                  console.log('=== UPDATE BUTTON CLICKED ===');
                                  console.log('Opening update modal for item:', item);
                                  console.log('Item queueCode:', item.queueCode);
                                  console.log('Item keys:', Object.keys(item));
                                  console.log('Selected date:', selectedDate);
                                  console.log('=============================');
                                  setSelectedItem(item);
                                  setSelectedCancelTime("");
                                  loadCancelAvailableSlots(item.dentistCode, selectedDate);
                                  setShowCancelModal(true);
                                }}
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
            readOnly={true}
            style={{ backgroundColor: '#f8f9fa', cursor: 'not-allowed' }}
          />
          <small style={{ color: '#6c757d', fontSize: '12px', marginTop: '4px', display: 'block' }}>
            Select time from available slots below
          </small>
        </div>
        
        <div className="rc-form-group">
          <label className="rc-form-label">
            <i className="rc-icon">👨‍⚕️</i>
            Select Doctor
          </label>
          <select
            className="rc-form-input"
            value={newDentistCode}
            onChange={(e) => {
              setNewDentistCode(e.target.value);
              if (newDate) {
                loadAvailableSlots(e.target.value, newDate);
              }
            }}
          >
            <option value="">Select a dentist</option>
            {dentists.map((dentist) => (
              <option key={dentist.dentistCode} value={dentist.dentistCode}>
                {dentist.name} - {dentist.dentistCode} ({dentist.specialization})
              </option>
            ))}
          </select>
        </div>

        {newDentistCode && newDate && (
          <div className="rc-form-group">
            <label className="rc-form-label">
              <i className="rc-icon">🕐</i>
              Available Time Slots
            </label>
            {loadingSlots ? (
              <div className="rc-loading">Loading available slots...</div>
            ) : (
              <div className="rc-slots-grid">
                {availableSlots
                  .filter(slot => slot.status === 'bookable')
                  .map((slot, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`rc-slot-btn ${newTime === getSlotTimeString(slot.start) ? 'selected' : ''}`}
                      onClick={() => {
                        const timeString = getSlotTimeString(slot.start);
                        setNewTime(timeString);
                        console.log('Selected time:', timeString);
                        console.log('Original slot:', slot.start);
                      }}
                    >
                      {new Date(slot.start).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </button>
                  ))
                }
                {availableSlots.filter(slot => slot.status === 'bookable').length === 0 && (
                  <div className="rc-no-slots">No available slots for this date</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="rc-modal-footer">
        <button 
          className="rc-btn rc-btn-secondary" 
          onClick={() => {
            setShowDeleteUpdateModal(false);
            setAvailableSlots([]);
            setNewTime("");
          }}
        >
          Cancel
        </button>
        <button 
          className="rc-btn rc-btn-primary"
          disabled={!newDate || !newTime || !newDentistCode}
          onClick={async () => {
            if (!newDate || !newTime || !newDentistCode) {
              alert('Please select date, time, and dentist');
              return;
            }
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

{/* Cancel Modal */}
{showCancelModal && selectedItem && (
  <div className="rc-modal-overlay">
    <div className="rc-modal">
      <div className="rc-modal-header">
        <h3 className="rc-modal-title">Reschedule Appointment</h3>
        <button 
          className="rc-modal-close" 
          onClick={() => {
            setShowCancelModal(false);
            setCancelAvailableSlots([]);
            setSelectedCancelTime("");
          }}
          aria-label="Close modal"
        >
          ×
        </button>
      </div>
      
      <div className="rc-modal-body">
        <div className="rc-form-group">
          <label className="rc-form-label">
            <i className="rc-icon">👤</i>
            Patient Information
          </label>
          <div style={{ 
            marginBottom: '16px', 
            padding: '16px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px',
            border: '2px solid #e9ecef'
          }}>
            {console.log('Modal selectedItem:', selectedItem)}
            {console.log('Modal dentists:', dentists)}
            <p style={{ margin: '0 0 12px 0', fontWeight: 'bold', color: '#495057', fontSize: '16px' }}>
              <span style={{ color: '#007bff', fontSize: '18px' }}>{selectedItem?.patientCode || 'N/A'}</span>
            </p>
            <p style={{ margin: '0 0 12px 0', fontWeight: 'bold', color: '#495057' }}>
              Current Time: <span style={{ color: '#6c757d' }}>{new Date(selectedItem.date).toLocaleString()}</span>
            </p>
            <p style={{ margin: '0 0 12px 0', fontWeight: 'bold', color: '#495057' }}>
              Dentist: <span style={{ color: '#28a745', fontSize: '16px' }}>{selectedItem.dentistCode}</span>
            </p>
            <p style={{ margin: '0', fontWeight: 'bold', color: '#495057' }}>
              Date: <span style={{ color: '#6c757d' }}>{selectedDate}</span>
            </p>
          </div>
        </div>

        <div className="rc-form-group">
          <label className="rc-form-label">
            <i className="rc-icon">🕐</i>
            Available Time Slots for Today
          </label>
          {loadingCancelSlots ? (
            <div className="rc-loading">Loading available slots...</div>
          ) : (
            <div className="rc-slots-grid">
              {console.log('Cancel slots in modal:', cancelAvailableSlots)}
              {cancelAvailableSlots
                .filter(slot => slot.status === 'bookable')
                .map((slot, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`rc-slot-btn ${selectedCancelTime === getSlotTimeString(slot.start) ? 'selected' : ''}`}
                    onClick={() => {
                      const timeString = getSlotTimeString(slot.start);
                      setSelectedCancelTime(timeString);
                      console.log('Selected cancel time:', timeString);
                    }}
                  >
                    {new Date(slot.start).toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true 
                    })}
                  </button>
                ))
              }
              {cancelAvailableSlots.filter(slot => slot.status === 'bookable').length === 0 && (
                <div className="rc-no-slots">
                  {cancelAvailableSlots.length === 0 ? 'No slots found for this dentist and date' : 'No available slots for this date'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="rc-modal-footer">
        <button 
          className="rc-btn rc-btn-secondary" 
          onClick={() => {
            setShowCancelModal(false);
            setCancelAvailableSlots([]);
            setSelectedCancelTime("");
          }}
        >
          Cancel
        </button>
        <button 
          className="rc-btn rc-btn-primary"
          disabled={!selectedCancelTime}
          onClick={async () => {
            if (!selectedCancelTime) {
              alert('Please select a time slot');
              return;
            }
            console.log('=== CONFIRM BUTTON CLICKED ===');
            console.log('selectedItem:', selectedItem);
            console.log('selectedItem.queueCode:', selectedItem?.queueCode);
            console.log('selectedCancelTime:', selectedCancelTime);
            console.log('===============================');
            
            // Safety check for queueCode
            if (!selectedItem || !selectedItem.queueCode) {
              console.error('Invalid selectedItem or missing queueCode:', selectedItem);
              setError('Invalid appointment data. Please try again.');
              return;
            }
            
            await handleUpdateAndReschedule(selectedItem.queueCode, selectedCancelTime);
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