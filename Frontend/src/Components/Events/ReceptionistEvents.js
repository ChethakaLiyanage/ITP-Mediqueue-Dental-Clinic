import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../api";
import { useAuth } from "../../Contexts/AuthContext";
import "./receptionistevents.css";

const EVENT_TYPES = ["Holiday", "Closure", "Maintenance", "Meeting", "Other"];
const PAGE_SIZES = [5, 10, 20, 50];

const EMPTY_EVENT = {
  _id: null,
  title: "",
  description: "",
  allDay: true,
  startDate: "",
  endDate: "",
  image: null,
  isPublished: false,
};

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function isoFromDateInput(value, isEnd = false) {
  if (!value) return "";
  const [yyyy, mm, dd] = value.split("-").map(Number);
  return new Date(
    yyyy,
    (mm || 1) - 1,
    dd || 1,
    isEnd ? 23 : 0,
    isEnd ? 59 : 0,
    isEnd ? 59 : 0,
  ).toISOString();
}

function isoFromDateTimeInput(value) {
  if (!value) return "";
  const [datePart, timePart = "00:00"] = value.split("T");
  const [yyyy, mm, dd] = datePart.split("-").map(Number);
  const [hh, min] = timePart.split(":").map(Number);
  return new Date(yyyy, (mm || 1) - 1, dd || 1, hh || 0, min || 0, 0).toISOString();
}

function formatRange(event) {
  if (!event?.startDate || !event?.endDate) return "-";
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "-";
  const arrow = " -> ";
  if (event.allDay !== false) {
    const sameDay = start.toDateString() === end.toDateString();
    return sameDay
      ? start.toLocaleDateString()
      : `${start.toLocaleDateString()}${arrow}${end.toLocaleDateString()}`;
  }
  return `${start.toLocaleString()}${arrow}${end.toLocaleString()}`;
}

function shortId(value) {
  const text = String(value || "");
  if (!text) return "-";
  return text.length > 6 ? `#${text.slice(-6)}` : text;
}

function formatByInfo(event) {
  if (!event) return "-";
  
  const hasUpdate = event.updatedAt && event.updatedAt !== event.createdAt;
  const userCode = hasUpdate ? event.updatedByCode : event.createdByCode;
  const timestamp = hasUpdate ? event.updatedAt : event.createdAt;
  const action = hasUpdate ? "U" : "C";
  
  if (!userCode || !timestamp) return "-";
  
  const date = new Date(timestamp);
  const formattedDate = date.toLocaleDateString();
  const formattedTime = date.toLocaleTimeString();
  
  return (
    <div className="ev-by-info">
      <div className="ev-by-action">{action}</div>
      <div className="ev-by-details">
        <div className="ev-by-user">{userCode}</div>
        <div className="ev-by-time">{formattedDate}, {formattedTime}</div>
      </div>
    </div>
  );
}

function EventImageWithFallback({ src, alt, className }) {
  const [imageError, setImageError] = useState(false);
  
  if (imageError) {
    return <span className="ev-no-image">No image</span>;
  }
  
  // Handle different image URL formats
  const getImageUrl = (imageSrc) => {
    if (!imageSrc) return '';
    
    console.log('Processing image URL:', imageSrc);
    
    // If it's already a full URL, use it as is
    if (imageSrc.startsWith('http')) {
      console.log('Using full URL:', imageSrc);
      return imageSrc;
    }
    
    // If it starts with /uploads, add the API base URL
    if (imageSrc.startsWith('/uploads')) {
      const fullUrl = `${API_BASE}${imageSrc}`;
      console.log('Adding API base to /uploads path:', fullUrl);
      return fullUrl;
    }
    
    // If it doesn't start with /, assume it's a relative path and add /uploads/events/
    if (!imageSrc.startsWith('/')) {
      const fullUrl = `${API_BASE}/uploads/events/${imageSrc}`;
      console.log('Adding /uploads/events/ to relative path:', fullUrl);
      return fullUrl;
    }
    
    // Default: add API base URL
    const fullUrl = `${API_BASE}${imageSrc}`;
    console.log('Default: adding API base URL:', fullUrl);
    return fullUrl;
  };
  
  return (
    <img 
      src={getImageUrl(src)} 
      alt={alt} 
      className={className}
      onError={() => setImageError(true)}
    />
  );
}

export default function ReceptionistEvents() {
  const { token } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    type: "",
    published: "all",
    from: "",
    to: "",
  });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_EVENT);
  const [saving, setSaving] = useState(false);

  const authHeaders = useMemo(
    () =>
      token
        ? {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          }
        : {
            "Content-Type": "application/json",
          },
    [token],
  );

  const fetchEvents = useCallback(async () => {
    if (!token) {
      setError("You must be signed in to view events.");
      setEvents([]);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${API_BASE}/events`, {
        method: "GET",
        headers: authHeaders,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || `Failed with status ${response.status}`);
      }
      const json = await response.json();
      setEvents(json.items || []);
    } catch (err) {
      console.error("Failed to load events", err);
      setError(err?.message || "Unable to load events");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, token]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filteredEvents = useMemo(() => {
    const { search, type, published, from, to } = filters;
    return events
      .filter((event) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          event.title?.toLowerCase().includes(q) ||
          event.description?.toLowerCase().includes(q)
        );
      })
      .filter((event) => (type ? event.eventType === type : true))
      .filter((event) => {
        if (published === "all") return true;
        const wantPublished = published === "true";
        return !!event.isPublished === wantPublished;
      })
      .filter((event) => {
        if (!from) return true;
        const start = new Date(event.startDate);
        const fromDate = new Date(from);
        fromDate.setHours(0, 0, 0, 0);
        return start >= fromDate;
      })
      .filter((event) => {
        if (!to) return true;
        const end = new Date(event.endDate);
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        return end <= toDate;
      });
  }, [events, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage, pageSize]);

  const openCreateModal = () => {
    setForm({
      ...EMPTY_EVENT,
      startDate: toDateInput(new Date().toISOString()),
      endDate: toDateInput(new Date().toISOString()),
    });
    setModalOpen(true);
  };

  const openEditModal = (event) => {
    if (!event) return;
    const usesAllDay = event.allDay !== false;
    setForm({
      _id: event._id,
      title: event.title || "",
      description: event.description || "",
      allDay: usesAllDay,
      startDate: usesAllDay ? toDateInput(event.startDate) : toDateTimeInput(event.startDate),
      endDate: usesAllDay ? toDateInput(event.endDate) : toDateTimeInput(event.endDate),
      image: event.imageUrl ? { url: event.imageUrl } : null,
      isPublished: !!event.isPublished,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSaving(false);
    setForm(EMPTY_EVENT);
  };

  const handleDelete = async (event) => {
    if (!event?._id) return;
    if (!window.confirm(`Delete ${event.title || "this event"}?`)) return;
    if (!token) {
      setError("Not authenticated");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/events/${event._id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || `Failed with status ${response.status}`);
      }
      await fetchEvents();
    } catch (err) {
      console.error("Failed to delete event", err);
      setError(err?.message || "Unable to delete event");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublish = async (event) => {
    if (!event?._id) return;
    if (!token) {
      setError("Not authenticated");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/events/${event._id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ isPublished: !event.isPublished }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || `Failed with status ${response.status}`);
      }
      await fetchEvents();
    } catch (err) {
      console.error("Failed to update event", err);
      setError(err?.message || "Unable to update event");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!token) {
      setError("Not authenticated");
      return;
    }

    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }

    if (!form.startDate) {
      setError("Start date is required");
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      allDay: !!form.allDay,
      isPublished: !!form.isPublished,
    };

    const startIso = form.allDay
      ? isoFromDateInput(form.startDate, false)
      : isoFromDateTimeInput(form.startDate);
    const endIso = form.allDay
      ? isoFromDateInput(form.endDate || form.startDate, true)
      : isoFromDateTimeInput(form.endDate || form.startDate);

    if (!startIso || !endIso || new Date(startIso) > new Date(endIso)) {
      setError("End date must be after start date");
      return;
    }

    payload.startDate = startIso;
    payload.endDate = endIso;

    // Check for existing appointments on the event date(s)
    try {
      const startDate = new Date(startIso);
      const endDate = new Date(endIso);
      
      // Get all dates between start and end (inclusive)
      const datesToCheck = [];
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        datesToCheck.push(dateStr);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Check each date for existing appointments
      for (const dateToCheck of datesToCheck) {
        const appointmentsUrl = `${API_BASE}/receptionist/appointments?date=${dateToCheck}&includePending=true`;
        const appointmentsResponse = await fetch(appointmentsUrl, {
          headers: authHeaders
        });
        
        if (appointmentsResponse.ok) {
          const appointmentsData = await appointmentsResponse.json();
          if (appointmentsData.items && appointmentsData.items.length > 0) {
            setError(`Cannot create clinic event on ${dateToCheck}. There are ${appointmentsData.items.length} existing appointment(s) on this date. Please choose a different date.`);
            return;
          }
        }
      }
    } catch (appointmentsCheckError) {
      console.warn('Error checking appointments:', appointmentsCheckError);
      // Don't block event creation if appointment check fails, just log the warning
    }

    setSaving(true);
    setError("");

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('title', payload.title);
      formData.append('description', payload.description);
      formData.append('allDay', payload.allDay);
      formData.append('isPublished', payload.isPublished);
      formData.append('startDate', payload.startDate);
      formData.append('endDate', payload.endDate);
      
      if (form.image) {
        // If it's a new file upload, append the file
        if (form.image instanceof File) {
          formData.append('image', form.image);
        } else if (form.image.url) {
          // If it's an existing image URL, append the URL
          formData.append('imageUrl', form.image.url);
        }
      }

      const response = await fetch(
        form._id ? `${API_BASE}/events/${form._id}` : `${API_BASE}/events`,
        {
          method: form._id ? "PUT" : "POST",
          headers: {
            Authorization: authHeaders.Authorization,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || `Failed with status ${response.status}`);
      }

      await fetchEvents();
      closeModal();
    } catch (err) {
      console.error("Failed to save event", err);
      setError(err?.message || "Unable to save event");
    } finally {
      setSaving(false);
    }
  };

  const filteredCount = filteredEvents.length;

  return (
    <div className="ev-shell">
      <div className="ev-main">
      <header className="ev-top">
        <div>
          <h1>Clinic Events</h1>
          <p className="ev-sub">Manage announcements, closures, and other clinic updates.</p>
        </div>
        <div className="ev-top-actions">
          <button onClick={openCreateModal} disabled={loading || !token}>
            New Event
          </button>
          <button className="ghost" onClick={fetchEvents} disabled={loading}>
            Refresh
          </button>
        </div>
      </header>

      <section className="ev-filters">
        <div className="ev-search-group">
          <input
            placeholder="Search title or description"
            value={filters.search}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, search: event.target.value }));
              setPage(1);
            }}
            className="ev-search-input"
          />
          <div className="ev-search-icon">🔍</div>
        </div>
        <div className="ev-filter-group">
          <select
            value={filters.published}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, published: event.target.value }));
              setPage(1);
            }}
            className="ev-status-filter"
          >
            <option value="all">All Status</option>
            <option value="true">Published</option>
            <option value="false">Unpublished</option>
          </select>
        </div>
        
        <div className="ev-date-group">
          <div className="ev-date-field">
            <label className="ev-date-label">From</label>
            <input
              type="date"
              value={filters.from}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, from: event.target.value }));
                setPage(1);
              }}
              className="ev-date-input"
            />
          </div>
          <div className="ev-date-field">
            <label className="ev-date-label">To</label>
            <input
              type="date"
              value={filters.to}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, to: event.target.value }));
                setPage(1);
              }}
              className="ev-date-input"
            />
          </div>
        </div>
        <span className="ev-count">{filteredCount} result{filteredCount === 1 ? "" : "s"}</span>
      </section>

      {error && <div className="ev-error">{error}</div>}

      <div className={`ev-table ${loading ? "ev-loading" : ""}`}>
        <div className="ev-table-head">
          <div>Dates</div>
          <div>Title</div>
          <div>Image</div>
          <div>Status</div>
          <div>Code</div>
          <div>By</div>
          <div>Actions</div>
        </div>
        <div className="ev-table-body">
          {paginatedEvents.map((event) => (
            <div className="ev-row" key={event._id}>
              <div>{formatRange(event)}</div>
              <div className="ev-title">{event.title || "-"}</div>
              <div className="ev-image-cell">
                {event.imageUrl ? (
                  <EventImageWithFallback 
                    src={event.imageUrl} 
                    alt={event.title} 
                    className="ev-event-image"
                  />
                ) : (
                  <span className="ev-no-image">No image</span>
                )}
              </div>
              <div>
                {event.isPublished ? (
                  <span className="pill pill-success">Published</span>
                ) : (
                  <span className="pill">Draft</span>
                )}
              </div>
              <div>{event.eventCode || shortId(event._id)}</div>
              <div className="ev-by-cell">
                {formatByInfo(event)}
              </div>
              <div className="ev-actions-row">
                <button onClick={() => openEditModal(event)}>Edit</button>
                <button onClick={() => handleTogglePublish(event)}>
                  {event.isPublished ? "Unpublish" : "Publish"}
                </button>
                <button className="danger" onClick={() => handleDelete(event)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          {!loading && paginatedEvents.length === 0 && (
            <div className="ev-row ev-empty">No events match your filters.</div>
          )}
        </div>
      </div>

      <footer className="ev-foot">
        <div className="ev-pager">
          <button onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={currentPage <= 1}>
            Prev
          </button>
          <span>
            Page {currentPage} / {totalPages}
          </span>
          <button onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages}>
            Next
          </button>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        </div>
      </footer>

      {modalOpen && (
        <div className="ev-modal">
          <div className="ev-modal-card">
            <div className="ev-modal-head">
              <h2>{form._id ? "Edit Event" : "New Event"}</h2>
              <button className="ev-close" onClick={closeModal} aria-label="Close">
                ×
              </button>
            </div>
            <form className="ev-form" onSubmit={handleSave}>
              <label>
                Title
                <input
                  required
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </label>
              <label>
                Description
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </label>
              <div className="ev-two">
                <label>
                  {form.allDay ? "Start date" : "Start date & time"}
                  <input
                    required
                    type={form.allDay ? "date" : "datetime-local"}
                    value={form.startDate}
                    onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                  />
                </label>
                <label>
                  {form.allDay ? "End date" : "End date & time"}
                  <input
                    type={form.allDay ? "date" : "datetime-local"}
                    value={form.endDate}
                    onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
                  />
                </label>
              </div>
              <div className="ev-image-upload">
                <label>
                  Event Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files[0];
                      if (file) {
                        setForm((prev) => ({ ...prev, image: file }));
                      }
                    }}
                    className="ev-file-input"
                  />
                  <div className="ev-file-upload-area">
                    {form.image ? (
                      <div className="ev-image-preview">
                        <img
                          src={form.image.url || URL.createObjectURL(form.image)}
                          alt="Event preview"
                          className="ev-preview-img"
                        />
                        <button
                          type="button"
                          className="ev-remove-image"
                          onClick={() => setForm((prev) => ({ ...prev, image: null }))}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="ev-upload-placeholder">
                        <div className="ev-upload-icon">📷</div>
                        <div className="ev-upload-text">
                          <strong>Click to upload</strong> an event image
                          <br />
                          <small>Supports JPG, PNG, GIF</small>
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              </div>
              <div className="ev-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={form.allDay}
                    onChange={(event) =>
                      setForm((prev) => {
                        const nextAllDay = event.target.checked;
                        const startIso = prev.allDay
                          ? isoFromDateInput(prev.startDate, false)
                          : isoFromDateTimeInput(prev.startDate);
                        const endIso = prev.allDay
                          ? isoFromDateInput(prev.endDate || prev.startDate, true)
                          : isoFromDateTimeInput(prev.endDate || prev.startDate);
                        return {
                          ...prev,
                          allDay: nextAllDay,
                          startDate: nextAllDay ? toDateInput(startIso) : toDateTimeInput(startIso),
                          endDate: nextAllDay ? toDateInput(endIso) : toDateTimeInput(endIso),
                        };
                      })
                    }
                  />
                  All-day
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.isPublished}
                    onChange={(event) => setForm((prev) => ({ ...prev, isPublished: event.target.checked }))}
                  />
                  Published
                </label>
              </div>
              <div className="ev-modal-actions">
                <button type="button" className="ghost" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}>
                  {saving ? "Saving..." : form._id ? "Save changes" : "Create event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}