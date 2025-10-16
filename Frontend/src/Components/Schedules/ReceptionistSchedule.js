// src/Components/Schedule/ReceptionistSchedule.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../Contexts/AuthContext";
import "./receptionistschedule.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

function getYYYYMMDD(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function timeLocal(iso) {
  try {
    const dt = new Date(iso);
    return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}
// Helper functions
function getDayName(dateStr) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const date = new Date(dateStr);
  return dayNames[date.getDay()];
}

export default function ReceptionistSchedule() {
  const { token, user } = useAuth();
  
  // Debug authentication info
  console.log('ReceptionistSchedule - Auth Debug:', {
    hasToken: !!token,
    user: user,
    userRole: user?.role,
    receptionistCode: user?.receptionistCode,
    userKeys: user ? Object.keys(user) : 'No user object'
  });
  
  // Create auth headers for API calls
  const authHeaders = useMemo(() => ({
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  }), [token]);
  
  const [date, setDate] = useState(getYYYYMMDD());
  const [dentistCode, setDentistCode] = useState("Dr-0001");
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [dentists, setDentists] = useState([]);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const [refreshedAt, setRefreshedAt] = useState(null);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [patientCode, setPatientCode] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const canQuery = useMemo(
    () => Boolean(date && dentistCode && slotMinutes),
    [date, dentistCode, slotMinutes]
  );

  // Fetch dentists list
  const fetchDentists = useCallback(async () => {
    try {
      console.log('Fetching dentists from:', `${API_BASE}/dentists`);
      const response = await fetch(`${API_BASE}/dentists`, {
        headers: authHeaders
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Dentists API response:', data);
        console.log('Dentists array:', data.dentists);
        setDentists(data.dentists || []);
      } else {
        console.error('Failed to fetch dentists, status:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch dentists:', error);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchDentists();
  }, [fetchDentists]);

  const load = useCallback(async () => {
    if (!canQuery) return;
    try {
      setBusy(true);
      setErr("");
      
      // Use the proper receptionist schedule endpoint
      const url = `${API_BASE}/receptionist/schedule/dentists/${dentistCode}/slots?date=${date}&slot=${slotMinutes}`;
      console.log('Fetching schedule data from:', url);
      console.log('Auth headers:', authHeaders);
      console.log('Can query:', canQuery);
      console.log('Date:', date, 'Dentist:', dentistCode, 'Slot:', slotMinutes);
      console.log('Available dentists:', dentists);
      console.log('Current dentistCode value:', dentistCode);
      
      const r = await fetch(url, {
        headers: authHeaders
      });
      
      console.log('Response status:', r.status);
      console.log('Response headers:', r.headers);
      
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}));
        console.error('API Error:', errorData);
        throw new Error(errorData.message || `HTTP ${r.status}`);
      }
      
      const scheduleData = await r.json();
      console.log('Received schedule data:', scheduleData);
      console.log('Working window:', scheduleData.workingWindow);
      console.log('Day of week:', getDayName(date));
      console.log('Slots count:', scheduleData.slots?.length || 0);
      
      // Check if we have any existing appointments for this date
      try {
        const appointmentsUrl = `${API_BASE}/receptionist/appointments?date=${date}&includePending=true`;
        console.log('Checking existing appointments at:', appointmentsUrl);
        
        const appointmentsResponse = await fetch(appointmentsUrl, {
          headers: authHeaders
        });
        
        if (appointmentsResponse.ok) {
          const appointmentsData = await appointmentsResponse.json();
          console.log('Existing appointments found:', appointmentsData);
          console.log('Appointments count:', appointmentsData.items?.length || 0);
          
          // If we have appointments but no slots are showing as booked, there might be a data sync issue
          if (appointmentsData.items?.length > 0 && scheduleData.slots?.length > 0) {
            const bookedSlots = scheduleData.slots.filter(slot => slot.status === 'booked');
            console.log('Booked slots in schedule:', bookedSlots.length);
            console.log('Expected booked slots:', appointmentsData.items.length);
            
            if (bookedSlots.length !== appointmentsData.items.length) {
              console.warn('Data sync issue detected: appointments exist but slots not marked as booked');
              setErr(`Data sync issue: Found ${appointmentsData.items.length} appointments but only ${bookedSlots.length} slots marked as booked. Please refresh or contact admin.`);
            }
          }
        } else {
          console.warn('Failed to fetch appointments:', appointmentsResponse.status);
        }
      } catch (appointmentsError) {
        console.warn('Error checking appointments:', appointmentsError);
      }
      
      setData(scheduleData);
      setRefreshedAt(new Date());
    } catch (e) {
      console.error('Schedule loading error:', e);
      setErr(String(e.message || e));
      setData(null);
    } finally {
      setBusy(false);
    }
  }, [canQuery, date, dentistCode, authHeaders, slotMinutes]);

  useEffect(() => {
    load();
  }, [load]);

  function statusPill(s) {
    const base = "rc-pill";
    if (s === "bookable") return `${base} ok`;
    if (s === "booked") return `${base} bad`;
    if (s === "blocked_event") return `${base} warn`;
    if (s === "blocked_leave") return `${base} warn`; // dentist leave
    if (s === "date_passed") return `${base} muted`;
    if (s === "time_passed") return `${base} muted`;
    return base;
  }

  async function createAppointment() {
    if (!selected) return;

    // prevent booking blocked slots
    if (selected.status !== "bookable") {
      setToast({ type: "bad", msg: "This slot cannot be booked" });
      setTimeout(() => setToast(null), 2200);
      return;
    }

    if (!patientCode.trim()) {
      setToast({ type: "bad", msg: "Enter a Patient Code (e.g., P-0001)" });
      setTimeout(() => setToast(null), 2200);
      return;
    }
    
    try {
      setSaving(true);

      // Format date and time according to backend expectations

      const payload = {
        patient_code: patientCode.trim(),
        dentist_code: dentistCode,
        appointment_date: selected.start,
        reason: reason.trim() || "",
      };

      console.log("Creating appointment with payload:", payload);

      const r = await fetch(`${API_BASE}/appointments`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.message || `Booking failed (HTTP ${r.status})`);
      }

      const result = await r.json();
      console.log("Appointment created successfully:", result);

      setOpen(false);
      setSelected(null);
      setPatientCode("");
      setReason("");
      setToast({ type: "ok", msg: "Appointment created successfully!" });
      setTimeout(() => setToast(null), 3000);
      await load();
    } catch (e) {
      console.error("Appointment creation error:", e);
      setToast({ type: "bad", msg: String(e.message || e) });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`schedule-container ${busy ? "rc-skel" : ""}`}>
        <header className="rc-topbar">
          <div className="rc-top-title">Schedules</div>
          <div className="rc-top-actions">
            <input
              className="rc-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <select
              className="rc-date rc-dentist-input"
              value={dentistCode}
              onChange={(e) => {
                console.log('Dentist selection changed to:', e.target.value);
                setDentistCode(e.target.value);
              }}
            >
              <option value="">Select Dentist</option>
              {dentists.map((dentist) => {
                console.log('Rendering dentist option:', dentist);
                return (
                  <option key={dentist.dentistCode} value={dentist.dentistCode}>
                    {dentist.name} ({dentist.dentistCode})
                  </option>
                );
              })}
            </select>
            <select
              className="rc-date"
              value={slotMinutes}
              onChange={(e) => setSlotMinutes(Number(e.target.value))}
            >
              {[10, 15, 20, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
            <button className="rc-btn" onClick={load} disabled={busy}>
              ⟳ Refresh
            </button>
            <button 
              className="rc-btn" 
              onClick={async () => {
                try {
                  setBusy(true);
                  const migrateUrl = `${API_BASE}/receptionist/queue/migrate-today?date=${date}`;
                  console.log('Triggering migration at:', migrateUrl);
                  
                  const migrateResponse = await fetch(migrateUrl, {
                    method: 'POST',
                    headers: authHeaders
                  });
                  
                  if (migrateResponse.ok) {
                    const migrateData = await migrateResponse.json();
                    console.log('Migration result:', migrateData);
                    setToast({ type: "ok", msg: `Migration completed: ${migrateData.moved || 0} appointments moved to queue` });
                    setTimeout(() => setToast(null), 3000);
                    await load(); // Refresh the schedule
                  } else {
                    const errorData = await migrateResponse.json().catch(() => ({}));
                    console.error('Migration failed:', errorData);
                    setToast({ type: "bad", msg: `Migration failed: ${errorData.message || 'Unknown error'}` });
                    setTimeout(() => setToast(null), 4000);
                  }
                } catch (e) {
                  console.error('Migration error:', e);
                  setToast({ type: "bad", msg: `Migration error: ${e.message}` });
                  setTimeout(() => setToast(null), 4000);
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              title="Migrate appointments to queue system"
            >
              🔄 Migrate
            </button>
            {toast && (
              <div
                className={`rc-pill ${
                  toast.type === "ok"
                    ? "ok"
                    : toast.type === "bad"
                    ? "bad"
                    : ""
                }`}
              >
                {toast.msg}
              </div>
            )}
          </div>
        </header>

        {err && <div className="rc-error">⚠️ {err}</div>}

        <div className="rc-grid">
          <div className="rc-card">
            <div className="rc-card-head">Dentist</div>
            <div className="rc-stat">
              {data?.dentist?.name || "–"} (
              {data?.dentist?.dentistCode || dentistCode})
            </div>
            <div className="rc-sub">
              {data?.dentist?.specialization ? (
                <span className="rc-pill info">
                  {data.dentist.specialization}
                </span>
              ) : (
                <span className="rc-pill muted">No specialization set</span>
              )}
            </div>
          </div>

          <div className="rc-card">
            <div className="rc-card-head">Working Window</div>
            <div className="rc-stat smaller">
              {data?.workingWindow
                ? `${data.workingWindow.dayName || getDayName(date)} • ${data.workingWindow.from}–${data.workingWindow.to}`
                : data?.dentist 
                  ? `No schedule set for ${getDayName(date)}`
                  : "Select a dentist first"}
            </div>
            <div className="rc-sub">
              <span className="rc-pill muted">{slotMinutes} min slots</span>
              {!data?.workingWindow && data?.dentist && (
                <span className="rc-pill warn">Schedule not configured</span>
              )}
            </div>
          </div>

          <div className="rc-card">
            <div className="rc-card-head">Slots</div>
            <div className="rc-stat">{data?.slots?.length ?? 0}</div>
            <div className="rc-sub">
              <span className="rc-pill ok">
                {(data?.slots || []).filter((s) => s.status === "bookable")
                  .length}{" "}
                free
              </span>
              <span className="rc-pill bad">
                {(data?.slots || []).filter((s) => s.status === "booked").length}{" "}
                booked
              </span>
              <span className="rc-pill warn">
                {(data?.slots || []).filter(
                  (s) => s.status === "blocked_event"
                ).length}{" "}
                event blocked
              </span>
              <span className="rc-pill warn">
                {(data?.slots || []).filter(
                  (s) => s.status === "blocked_leave"
                ).length}{" "}
                leave blocked
              </span>
              <span className="rc-pill muted">
                {(data?.slots || []).filter(
                  (s) => s.status === "date_passed"
                ).length}{" "}
                date passed
              </span>
              <span className="rc-pill muted">
                {(data?.slots || []).filter(
                  (s) => s.status === "time_passed"
                ).length}{" "}
                time passed
              </span>
            </div>
          </div>
        </div>

        <section className="rc-section">
          <div className="rc-sec-head">
            <h3>Time Slots</h3>
            <div className="rc-hint">
              {refreshedAt
                ? `Last refresh: ${refreshedAt.toLocaleTimeString()}`
                : ""}
            </div>
          </div>

          <div className="rc-table">
            <div className="rc-thead">
              <div>Start</div>
              <div>End</div>
              <div>Status</div>
              <div>Action</div>
              <div>Note</div>
            </div>
            <div className="rc-tbody">
              {(data?.slots || []).map((s, i) => (
                <div className="rc-row" key={`${s.start}-${i}`}>
                  <div>⏱ {timeLocal(s.start)}</div>
                  <div>{timeLocal(s.end)}</div>
                  <div>
                    <span className={statusPill(s.status)}>
                      {s.status.replace("_", " ")}
                    </span>
                  </div>
                  <div>
                    {s.status === "bookable" ? (
                      <button
                        className="rc-btn"
                        onClick={() => {
                          setSelected(s);
                          setOpen(true);
                        }}
                      >
                        Book
                      </button>
                    ) : (
                      <span className="rc-pill muted">–</span>
                    )}
                  </div>
                  <div className="rc-dim">
                    {s.status === "blocked_event"
                      ? "Blocked by clinic event"
                      : s.status === "blocked_leave"
                      ? "Blocked by dentist leave"
                      : s.status === "date_passed"
                      ? "Date already passed"
                      : s.status === "time_passed"
                      ? "Time already passed"
                      : ""}
                  </div>
                </div>
              ))}
              {(!data?.slots || data.slots.length === 0) && (
                <div className="rc-row rc-empty">No slots for this day.</div>
              )}
            </div>
          </div>
        </section>

        {open && selected && (
          <div className="schedule-modal-overlay">
            <div className="schedule-modal">
              <div className="schedule-modal-header">
                <h3>Create Appointment</h3>
                <button className="rc-pill" onClick={() => setOpen(false)}>
                  × Close
                </button>
              </div>

              <div className="schedule-modal-content">
                <div className="schedule-appointment-info">
                  <div>
                    <b>Dentist:</b> {data?.dentist?.name || "–"} ({dentistCode})
                  </div>
                  <div>
                    <b>Date:</b> {date} &nbsp; <b>Time:</b>{" "}
                    {timeLocal(selected.start)}–{timeLocal(selected.end)}
                  </div>
                </div>

                <div className="schedule-form-group">
                  <label>Patient Code</label>
                  <input
                    className="rc-date"
                    placeholder="P-0001"
                    value={patientCode}
                    onChange={(e) => setPatientCode(e.target.value)}
                  />
                </div>

                <div className="schedule-form-group">
                  <label>Reason (optional)</label>
                  <input
                    className="rc-date"
                    placeholder="Cleaning / Toothache / Whitening…"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <div className="schedule-modal-actions">
                  <button className="rc-pill" onClick={() => setOpen(false)}>
                    Cancel
                  </button>
                  <button
                    className="rc-btn"
                    disabled={saving}
                    onClick={createAppointment}
                  >
                    {saving ? "Booking…" : "Create"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <footer className="rc-footer">© MediQueue Dental – Reception</footer>
      </div>
  );
}

