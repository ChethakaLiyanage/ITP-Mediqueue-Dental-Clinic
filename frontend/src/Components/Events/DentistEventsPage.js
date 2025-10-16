import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import { API_BASE } from "../api";
import { useAuth } from '../../Contexts/AuthContext';
import "./dentisteventpage.css";

export default function EventsPage() {
  const navigate = useNavigate();
  const { user, token, loading: authLoading } = useAuth();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Removed debugging useEffect that was causing extra renders
  const [lastUpdated, setLastUpdated] = useState(null);

  // Redirect if not authenticated or not a dentist
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'Dentist')) {
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

  const fetchEvents = useCallback(async () => {
    if (!token) {
      console.log("No token available for fetching events");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const url = `${API_BASE}/events?from=${today}`;

      console.log("Fetching events from:", url);

      const res = await authenticatedFetch(url);
      const data = await res.json();
      
      if (res.ok) {
        const eventsList = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
        console.log("Fetched events:", eventsList.length);
        setEvents(eventsList);
        setLastUpdated(new Date());
      } else {
        throw new Error(data.message || 'Failed to fetch events');
      }
    } catch (err) {
      console.error("Error fetching events:", err);
      setError(err.message || "Failed to load events. Please try again.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [token, authenticatedFetch]);

  // Initial load - only run once when component mounts
  useEffect(() => {
    if (user && user.role === 'Dentist' && token) {
      console.log("Initial load - fetching all events");
      fetchEvents(); // Load all events initially
    }
  }, [user?.role, !!token, fetchEvents]); // Include fetchEvents in dependencies

  // Format date/time helper
  const fmt = (d) => d ? new Date(d).toLocaleString() : "-";
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString() : "-";
  const fmtTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-";

  const getEventTypeClass = (eventType) => {
    const type = eventType?.toLowerCase() || 'other';
    return `event-type ${type}`;
  };

  // Manual refresh function
  const handleRefresh = () => {
    fetchEvents();
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchTerm("");
  };

  // Handle Enter key in search input
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      // Search is now handled by filtering, no need for API call
      e.preventDefault();
    }
  };

  // Filter events based on search term
  const filteredEvents = events.filter(event => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      event.title?.toLowerCase().includes(searchLower) ||
      event.eventCode?.toLowerCase().includes(searchLower) ||
      event.description?.toLowerCase().includes(searchLower)
    );
  });

  // Show loading while checking authentication
  if (authLoading) {
    console.log("Auth loading...");
    return (
      <div className="events-loading-container">
        <div className="loading-spinner"></div>
        <p>Loading events page...</p>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!user || user.role !== 'Dentist') {
    console.log("Not authenticated or not dentist:", { user: user?.role });
    return null;
  }

  console.log("Rendering events page with user:", user.role, "searchTerm:", searchTerm);

  return (
    <div className="events-container">
      {/* Error Alert */}
      {error && (
        <div className="error-alert">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="error-close">×</button>
        </div>
      )}

      <div className="events-header">
        <div className="events-title-section">
          <h2 className="events-title">Clinic Events</h2>
          <p className="events-subtitle">Today & Upcoming Events</p>
          {lastUpdated && (
            <span className="last-updated">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        
        <div className="events-controls">
          <div className="events-search-container">
            <input
              type="text"
              className="events-search-input"
              placeholder="Search events by title, code, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoComplete="off"
              spellCheck="false"
              style={{
                padding: '12px 16px',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '10px',
                fontSize: '14px',
                color: '#374151',
                background: 'rgba(255, 255, 255, 0.95)',
                minWidth: '300px',
                outline: 'none',
                cursor: 'text'
              }}
            />
            {searchTerm && (
              <button 
                className="events-clear-btn" 
                onClick={handleClearSearch}
                disabled={loading}
                title="Clear search"
                style={{
                  padding: '8px 12px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  marginLeft: '8px'
                }}
              >
                ✕ Clear
              </button>
            )}
          </div>
          
          {searchTerm && (
            <div className="active-filters">
              <span className="filter-label">Searching for:</span>
              <span className="filter-tag">"{searchTerm}"</span>
            </div>
          )}
          
          <button 
            onClick={handleRefresh}
            className="refresh-btn"
            disabled={loading}
          >
            {loading ? "🔄" : "↻"} Refresh
          </button>
        </div>
      </div>

      {loading && events.length === 0 ? (
        <div className="events-loading">
          <div className="loading-spinner"></div>
          <p>Loading events...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="events-empty">
          <div className="empty-state-content">
            <span className="empty-icon">📅</span>
            <h3>No Events Found</h3>
            <p>
              {searchTerm 
                ? `No events found matching "${searchTerm}".` 
                : "No upcoming events found."
              }
            </p>
            {searchTerm && (
              <button onClick={handleClearSearch} className="clear-filters-btn">
                Clear Search
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="events-table-wrapper">
          <div className="events-count">
            Showing {filteredEvents.length} of {events.length} event{events.length !== 1 ? 's' : ''}
            {searchTerm && (
              <span className="search-indicator">
                {' '}(filtered by "{searchTerm}")
              </span>
            )}
          </div>
           <table className="events-table">
             <thead>
               <tr>
                 <th>Code</th>
                 <th>Title</th>
                 <th>Start Date</th>
                 <th>Start Time</th>
                 <th>End Date</th>
                 <th>End Time</th>
                 <th>Status</th>
               </tr>
             </thead>
            <tbody>
              {filteredEvents.map(ev => {
                const startDate = new Date(ev.startDate);
                const endDate = new Date(ev.endDate);
                const now = new Date();
                const isOngoing = now >= startDate && now <= endDate;
                const isUpcoming = now < startDate;
                const isPast = now > endDate;
                
                let status = "Upcoming";
                if (isOngoing) status = "Ongoing";
                else if (isPast) status = "Past";
                
                 return (
                   <tr key={ev._id || ev.eventCode} className={`event-row ${status.toLowerCase()}`}>
                     <td>
                       <span className="event-code">{ev.eventCode || 'N/A'}</span>
                     </td>
                     <td>
                       <span className="event-title">{ev.title}</span>
                     </td>
                     <td>
                       <span className="event-date">{fmtDate(ev.startDate)}</span>
                     </td>
                     <td>
                       <span className="event-time">{fmtTime(ev.startDate)}</span>
                     </td>
                     <td>
                       <span className="event-date">{fmtDate(ev.endDate)}</span>
                     </td>
                     <td>
                       <span className="event-time">{fmtTime(ev.endDate)}</span>
                     </td>
                     <td>
                       <span className={`event-status ${status.toLowerCase()}`}>
                         {status}
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