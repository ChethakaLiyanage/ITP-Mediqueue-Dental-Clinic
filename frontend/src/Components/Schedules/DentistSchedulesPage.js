import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import { API_BASE } from "../api";
import "./dentistschedulepage.css";

export default function DentistSchedulesPage() {
  const navigate = useNavigate();
  const { user, token, authLoading } = useAuth();
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading) {
      if (!token) {
        navigate("/login");
        return;
      }
      // Allow access for Dentist, Manager, Receptionist roles
      if (!["Dentist", "Manager", "Receptionist"].includes(user?.role)) {
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

  // fetch schedules
  const fetchToday = useCallback(async () => {
    if (!token || !["Dentist", "Manager", "Receptionist"].includes(user?.role)) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await authenticatedFetch(`${API_BASE}/schedules/today`);
      const data = await res.json();
      
      if (res.ok) {
        setItems(Array.isArray(data.items) ? data.items : []);
        setLastUpdated(new Date());
      } else {
        throw new Error(data.message || 'Failed to fetch schedules');
      }
    } catch (err) {
      console.error("Error fetching schedules:", err);
      setError("Failed to load schedules. Please try again.");
      setItems([]);
    }
    setLoading(false);
  }, [token, user?.role, authenticatedFetch]);

  // fetch clinic events
  const fetchEvents = useCallback(async () => {
    if (!token || !["Dentist", "Manager", "Receptionist"].includes(user?.role)) return;
    
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await authenticatedFetch(`${API_BASE}/events?from=${today}&to=${today}`);
      const data = await res.json();
      
      if (res.ok) {
        setEvents(Array.isArray(data.items) ? data.items : []);
      } else {
        console.warn("Failed to fetch events:", data.message);
        setEvents([]);
      }
    } catch (err) {
      console.error("Error fetching events:", err);
      setEvents([]);
    }
  }, [token, user?.role, authenticatedFetch]);

  // Load data when component mounts and user is authenticated
  useEffect(() => {
    if (["Dentist", "Manager", "Receptionist"].includes(user?.role) && token) {
      fetchToday();
      fetchEvents();
    }
  }, [user?.role, token, fetchToday, fetchEvents]);

  // Manual refresh function
  const handleRefresh = () => {
    fetchToday();
    fetchEvents();
  };

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-GB") : "-";

  const fmtTime = (d) =>
    d
      ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "-";

  // check if schedule is blocked by an event
  const getBlockedEvent = (date) => {
    const slotTime = new Date(date);
    return events.find((ev) => {
      const start = new Date(ev.startDate);
      const end = new Date(ev.endDate);
      return slotTime >= start && slotTime <= end;
    });
  };

  const hasSlots = (item) => {
    if (!item) return false;
    // treat non-empty string or positive number as available slots
    if (typeof item.slots === 'number') return item.slots > 0;
    if (typeof item.slots === 'string') {
      const trimmedSlots = item.slots.trim();
      return trimmedSlots !== '' && 
             trimmedSlots !== '-' && 
             !trimmedSlots.toLowerCase().includes('not available') &&
             !trimmedSlots.toLowerCase().includes('notavailable');
    }
    if (Array.isArray(item.slots)) return item.slots.length > 0;
    return false;
  };

  const getStatusClass = (item, blockedEvent) => {
    if (item.onLeave) return "status-on-leave";
    if (blockedEvent) return "status-event-blocked";
    if (!hasSlots(item)) return "status-non-available";
    return "status-available";
  };

  const getStatusText = (item, blockedEvent) => {
    if (item.onLeave) return "On leave";
    if (blockedEvent) return "Blocked";
    if (!hasSlots(item)) return "Non-available";
    return "Available";
  };

  // Show loading state while authentication is being checked
  if (authLoading) {
    return (
      <div className="schedules-container">
        <div className="schedules-loading">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Filter items based on search query
  const filteredItems = items.filter((it) =>
    !query ||
    String(it.dentistName || "")
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <div className="schedules-container">
      <div className="schedules-header">
        <div className="schedules-header-content">
          <h2 className="schedules-title">All Dentists' Schedules - Today</h2>
          <p className="schedules-subtitle">
            Showing schedules for all dentists in the system
          </p>
          {lastUpdated && (
            <p className="schedules-subtitle">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="schedules-actions">
          <input
            className="schedules-search-input"
            placeholder="Search by dentist name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button 
            className="schedules-refresh-btn" 
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="schedules-error">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
            <button 
              className="error-close" 
              onClick={() => setError(null)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && !error ? (
        <div className="schedules-loading">
          <div className="loading-spinner"></div>
          <p>Loading schedules...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="schedules-empty">
          <div className="empty-content">
            <span className="empty-icon">📅</span>
            <h3>No Schedules Found</h3>
            <p>
              {query 
                ? `No dentists found matching "${query}"`
                : "No schedules available for today"
              }
            </p>
          </div>
        </div>
      ) : (
        <div className="schedules-table-wrapper">
          <table className="schedules-table">
            <thead>
              <tr>
                <th>Dentist Code</th>
                <th>Dentist Name</th>
                <th>Available Slot</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it, i) => {
                const ev = getBlockedEvent(it.date);
                return (
                  <tr key={`${it.dentistCode}-${i}`}>
                    <td>
                      <span className="dentist-code">{it.dentistCode}</span>
                    </td>
                    <td>
                      <span className="dentist-name">{it.dentistName || "-"}</span>
                    </td>
                    <td>
                      {ev ? (
                        <span className="blocked-slot">
                          Blocked ({fmtTime(ev.startDate)}–{fmtTime(ev.endDate)})
                        </span>
                      ) : (
                        <span className="available-slot">{hasSlots(it) ? it.slots : "-"}</span>
                      )}
                    </td>
                    <td>
                      <span className="schedule-date">{fmtDate(it.date)}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusClass(it, ev)}`}>
                        {getStatusText(it, ev)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}