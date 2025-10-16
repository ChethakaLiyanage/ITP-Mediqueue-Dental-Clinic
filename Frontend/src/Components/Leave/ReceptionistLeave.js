// src/Components/Leave/ReceptionistLeave.js
import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../Contexts/AuthContext";
import "./receptionistleave.css";

export default function ReceptionistLeave() {
  const { token, user } = useAuth();
  const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
  
  // Debug: Log user information on component mount
  console.log("🔍 ReceptionistLeave - User object:", user);
  console.log("🔍 ReceptionistLeave - User receptionistCode:", user?.receptionistCode);
  console.log("🔍 ReceptionistLeave - User name:", user?.name);
  console.log("🔍 ReceptionistLeave - User role:", user?.role);
  
  const [dentists, setDentists] = useState([]);
  const [dentistCode, setDentistCode] = useState("");
  const [dentistName, setDentistName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reason, setReason] = useState("");
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  
  // Memoize headers to avoid recreating on every render
  const headers = useMemo(() => ({
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  }), [token]);

  // ✅ Fetch dentists
  useEffect(() => {
    if (!token) return;
    
    const fetchDentists = async () => {
      try {
        const res = await fetch(`${API_BASE}/dentists`, { headers });
        const data = await res.json();
        
        if (res.ok) {
          // Handle different response formats
          const dentistList = data.dentists || data.items || data || [];
          setDentists(dentistList);
          console.log("Dentists fetched:", dentistList);
        } else {
          console.error("Failed to fetch dentists:", data.message);
          setErrorMessage("Failed to load dentists");
        }
      } catch (err) {
        console.error("Error fetching dentists:", err);
        setErrorMessage("Error loading dentists");
      }
    };
    
    fetchDentists();
  }, [token, headers, API_BASE]);

  // ✅ Fetch leaves
  useEffect(() => {
    if (!token) return;
    
    const fetchLeaves = async () => {
      try {
        const res = await fetch(`${API_BASE}/leave`, { headers });
        const data = await res.json();
        
        if (res.ok) {
          const leaveList = data.items || data || [];
          setLeaves(leaveList);
          console.log("Leaves fetched:", leaveList);
        } else {
          console.error("Failed to fetch leaves:", data.message);
          setErrorMessage("Failed to load leaves");
        }
      } catch (err) {
        console.error("Error fetching leaves:", err);
        setErrorMessage("Error loading leaves");
      }
    };
    
    fetchLeaves();
  }, [token, headers, API_BASE]);

  const handleAddLeave = async () => {
    if (!dentistCode || !dateFrom || !dateTo) {
      setErrorMessage("Please fill all required fields");
      return;
    }

    if (new Date(dateFrom) > new Date(dateTo)) {
      setErrorMessage("End date cannot be before start date");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Debug: Log user information
      console.log("Current user:", user);
      console.log("Receptionist code:", user?.receptionistCode);
      console.log("User name:", user?.name);
      
      const createdByValue = user?.receptionistCode || user?.name || "Unknown Receptionist";
      console.log("Created by value:", createdByValue);
      
      const requestBody = {
        dentistCode,
        dentistName: dentistName || "Unknown Dentist",
        dateFrom,
        dateTo,
        reason: reason || "Not specified",
        createdBy: createdByValue,
      };
      
      console.log("🚀 Sending leave request with body:", requestBody);
      
      const res = await fetch(`${API_BASE}/leave`, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      console.log("📥 Leave creation response:", data);

      if (res.ok) {
        const newLeave = data.leave || data;
        console.log("✅ Leave added successfully:", newLeave);
        console.log("🔍 Created by in response:", newLeave.createdBy);
        setLeaves([newLeave, ...leaves]);
        setDentistCode("");
        setDentistName("");
        setDateFrom("");
        setDateTo("");
        setReason("");
        setSuccessMessage("Leave added successfully!");
      } else {
        setErrorMessage(data.message || "Failed to add leave");
        console.error("Failed to add leave:", data);
      }
    } catch (err) {
      console.error("Error adding leave:", err);
      setErrorMessage("Something went wrong while adding leave");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLeave = async (id) => {
    if (!window.confirm("Are you sure you want to delete this leave?")) return;

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Note: DELETE endpoint not available in current backend
      // For now, we'll show a message that this feature is not available
      setErrorMessage("Delete functionality is not available in the current backend implementation");
      
      // If you want to implement this, you would need to add a DELETE route in the backend
      // const res = await fetch(`${API_BASE}/leave/${id}`, {
      //   method: "DELETE",
      //   headers,
      // });
      
      // if (res.ok) {
      //   setLeaves(leaves.filter((l) => l._id !== id));
      //   setSuccessMessage("Leave deleted successfully!");
      // } else {
      //   const data = await res.json();
      //   setErrorMessage(data.message || "Failed to delete leave");
      // }
    } catch (err) {
      console.error("Error deleting leave:", err);
      setErrorMessage("Something went wrong while deleting leave");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="leave-page">
      <h2>Dentist Leaves</h2>

      <div className="leave-form">
        <select
          value={dentistCode}
          onChange={(e) => {
            setDentistCode(e.target.value);
            const selected = dentists.find(
              (d) => d.dentistCode === e.target.value
            );
            if (selected) {
              // Handle different data structures
              const name = selected.userId?.name || selected.name || selected.dentistCode;
              setDentistName(name);
            }
          }}
        >
          <option value="">-- Select Dentist Code --</option>
          {dentists.map((d) => (
            <option key={d._id} value={d.dentistCode}>
              {d.dentistCode}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Dentist Name"
          value={dentistName}
          readOnly
        />

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
        <input
          type="text"
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <button 
          onClick={handleAddLeave} 
          disabled={loading}
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Adding..." : "Add Leave"}
        </button>
      </div>

      {/* Show messages */}
      {errorMessage && <div className="error-message">{errorMessage}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      <table className="leave-table">
        <thead>
          <tr>
            <th>Dentist Code</th>
            <th>Dentist Name</th>
            <th>Date From</th>
            <th>Date To</th>
            <th>Reason</th>
            <th>Created By</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {leaves.length === 0 ? (
            <tr>
              <td colSpan="7" style={{ textAlign: "center" }}>
                No leaves found.
              </td>
            </tr>
          ) : (
            leaves.map((l) => (
              <tr key={l._id}>
                <td>{l.dentistCode}</td>
                <td>{l.dentistName}</td>
                <td>{new Date(l.dateFrom).toLocaleDateString()}</td>
                <td>{new Date(l.dateTo).toLocaleDateString()}</td>
                <td>{l.reason}</td>
                <td>{l.createdBy}</td>
                <td>
                  <button onClick={() => handleDeleteLeave(l._id)}>❌</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
