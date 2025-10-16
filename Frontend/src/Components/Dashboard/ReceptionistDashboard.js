import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../Contexts/AuthContext";
import "./Receptionistdashboard.css";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const tzOffsetMin = -new Date().getTimezoneOffset();

function getLocalYYYYMMDD(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function formatTimeForAppointment(appointment) {
  if (!appointment) return "-";
  if (appointment.timeLocal) return appointment.timeLocal;
  if (appointment.time_local) return appointment.time_local;
  const source =
    appointment.appointmentDateISO ||
    appointment.appointment_date ||
    appointment.appointmentDate;
  if (!source) return "-";
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function safeCode(primary, secondary) {
  return primary || secondary || "-";
}

export default function ReceptionistDashboard() {
  const { token: authToken } = useAuth();
  const [date, setDate] = useState(getLocalYYYYMMDD());
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [refreshedAt, setRefreshedAt] = useState(null);

  const qs = useMemo(() => {
    const params = new URLSearchParams({ date, tzOffsetMin: String(tzOffsetMin) });
    return params.toString();
  }, [date]);

  const load = useCallback(async () => {
    try {
      setBusy(true);
      setErr("");

      let storedAuth = null;
      try {
        storedAuth = JSON.parse(localStorage.getItem("auth") || "{}");
      } catch (storageErr) {
        console.warn("Failed to parse stored auth", storageErr);
      }

      const activeToken = authToken || storedAuth?.token || null;
      if (!activeToken) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`${API_BASE}/api/receptionist/dashboard?${qs}`, {
        headers: {
          Authorization: `Bearer ${activeToken}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const maybeText = await response.text();
        throw new Error(maybeText || `Request failed with status ${response.status}`);
      }

      const json = await response.json();
      setData(json);
      setRefreshedAt(new Date());
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setErr(error?.message || "Unable to load dashboard");
    } finally {
      setBusy(false);
    }
  }, [qs, authToken]);

  useEffect(() => {
    load();
  }, [load]);

  const appoint = data?.cards?.appointmentsToday || {};
  const queue = data?.cards?.queueToday || {};
  const inquiries = data?.cards?.inquiries || {};
  const events = data?.cards?.events || {};
  const nextAppointments = data?.nextAppointments || [];
  const dentistAvailability = data?.dentistAvailabilityToday || [];
  const notificationsCount = data?.unreadNotificationCount || 0;

  const lastRefreshLabel = refreshedAt
    ? refreshedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "";

  return (
    <div className={`rc-dashboard ${busy ? "rc-skel" : ""}`}>
      <main className="rc-main">
        <header className="rc-topbar">
          <div className="rc-top-title">Dashboard</div>
          <div className="rc-top-actions">
            <input
              className="rc-date"
              type="date"
              value={date}
              onChange={event => setDate(event.target.value)}
            />
            <button className="rc-btn" onClick={load} disabled={busy}>
              Refresh
            </button>
            <button
              className="rc-ghost"
              title="Notifications"
              onClick={() => {
                window.location.href = "/receptionist/notifications";
              }}
            >
              Notifications
              {notificationsCount > 0 && (
                <span className="rc-badge">{notificationsCount}</span>
              )}
            </button>
          </div>
        </header>

        <div className="rc-hero">
          <h2>Welcome to DentalCare Pro</h2>
          <p>Your receptionist console for appointments, queues, schedules, events, inquiries, and notifications.</p>
        </div>

        {err && <div className="rc-error">Error: {err}</div>}

        <div className="rc-grid">
          <div className="rc-card">
            <div className="rc-card-head">Appointments Today</div>
            <div className="rc-stat">{appoint.total ?? 0}</div>
            <div className="rc-sub">
              <span className="rc-pill info">{appoint.pendingOrConfirmed ?? 0} pending/confirmed</span>
              <span className="rc-pill ok">{appoint.completed ?? 0} completed</span>
              <span className="rc-pill bad">{appoint.cancelled ?? 0} cancelled</span>
            </div>
          </div>

          <div className="rc-card">
            <div className="rc-card-head">Queue (All Dentists)</div>
            <div className="rc-stat">{queue.totalWaiting ?? 0}</div>
            <div className="rc-sub">
              <span className="rc-pill warn">{queue.totalCalled ?? 0} called</span>
              <span className="rc-pill info">{queue.totalInTreatment ?? 0} in treatment</span>
              <span className="rc-pill muted">{queue.totalNoShow ?? 0} no-show</span>
              <span className="rc-pill ok">{queue.totalCompleted ?? 0} done</span>
            </div>
          </div>

          <div className="rc-card">
            <div className="rc-card-head">Open Inquiries</div>
            <div className="rc-stat">{inquiries.openCount ?? 0}</div>
            <div className="rc-sub">
              {inquiries.latest?.length
                ? `${inquiries.latest.length} recent updates`
                : "No recent updates"}
            </div>
          </div>

          <div className="rc-card">
            <div className="rc-card-head">Published Events</div>
            <div className="rc-stat">{events.totalPublished ?? 0}</div>
            <div className="rc-sub">{events.publishedTodayCount ?? 0} today</div>
          </div>
        </div>

        <section className="rc-section">
          <div className="rc-sec-head">
            <h3>Next Appointments (Today)</h3>
            <div className="rc-hint">{lastRefreshLabel ? `Last refresh: ${lastRefreshLabel}` : ""}</div>
          </div>

          <div className="rc-table">
            <div className="rc-thead">
              <div>Time</div>
              <div>Patient</div>
              <div>Dentist</div>
              <div>Status</div>
              <div>Reason</div>
            </div>
            <div className="rc-tbody">
              {nextAppointments.map(appt => {
                const patientCode = safeCode(appt.patient_code, appt.patientCode);
                const dentistCode = safeCode(appt.dentist_code, appt.dentistCode);
                const timeLabel = formatTimeForAppointment(appt);
                return (
                  <div className="rc-row" key={appt.appointmentCode || `${patientCode}-${dentistCode}-${timeLabel}`}>
                    <div>{timeLabel}</div>
                    <div>{patientCode}</div>
                    <div>{dentistCode}</div>
                    <div>
                      {appt.status === "confirmed" && <span className="rc-pill ok">confirmed</span>}
                      {appt.status === "pending" && <span className="rc-pill info">pending</span>}
                      {appt.status === "cancelled" && <span className="rc-pill bad">cancelled</span>}
                      {!["confirmed", "pending", "cancelled"].includes(appt.status || "") && (
                        <span className="rc-pill">{appt.status || "-"}</span>
                      )}
                    </div>
                    <div>{appt.reason || "-"}</div>
                  </div>
                );
              })}
              {nextAppointments.length === 0 && (
                <div className="rc-row rc-empty">No appointments scheduled for today.</div>
              )}
            </div>
          </div>
        </section>

        <section className="rc-section">
          <div className="rc-sec-head">
            <h3>Dentist Availability</h3>
            <div className="rc-hint">Today's schedule overview</div>
          </div>

          <div className="rc-table">
            <div className="rc-thead">
              <div>Dentist</div>
              <div>Schedule</div>
              <div>Total Slots</div>
              <div>Booked</div>
              <div>Available</div>
              <div>Next Free</div>
            </div>
            <div className="rc-tbody">
              {dentistAvailability.map(dentist => (
                <div className="rc-row" key={dentist.dentist_code || dentist.dentistCode}>
                  <div title={dentist.dentist_code || dentist.dentistCode}>
                    {dentist.dentist_name || dentist.dentist_code || dentist.dentistCode || "-"}
                  </div>
                  <div>{dentist.schedule_window || "-"}</div>
                  <div>{dentist.slots_total}</div>
                  <div>{dentist.slots_booked}</div>
                  <div>{dentist.slots_available}</div>
                  <div>{dentist.next_free_slot || "-"}</div>
                </div>
              ))}
              {dentistAvailability.length === 0 && (
                <div className="rc-row rc-empty">No schedules configured.</div>
              )}
            </div>
          </div>
        </section>

        <section className="rc-two">
          <div className="rc-card">
            <div className="rc-card-head">Published Events</div>
            <div className="rc-list">
              {(events.items || []).map(event => {
                const start = event.start ?? event.startDate;
                const end = event.end ?? event.endDate;
                return (
                  <div className="rc-list-item" key={event.eventCode || start || event.title}>
                    {event.imageUrl && (
                      <img
                        src={event.imageUrl}
                        alt={event.title}
                        style={{
                          width: "60px",
                          height: "60px",
                          objectFit: "cover",
                          borderRadius: "8px",
                          marginRight: "12px"
                        }}
                      />
                    )}
                    <div>
                      <div className="rc-list-title">{event.title}</div>
                      <div className="rc-list-sub">
                        {`${formatDateTime(start)} -> ${formatDateTime(end)}`}
                      </div>
                    </div>
                  </div>
                );
              })}
              {(!events.items || events.items.length === 0) && (
                <div className="rc-empty">No published events.</div>
              )}
            </div>
          </div>

          <div className="rc-card">
            <div className="rc-card-head">Latest Inquiries</div>
            <div className="rc-list">
              {(inquiries.latest || []).map(inquiry => (
                <div className="rc-list-item" key={inquiry.inquiryCode || inquiry.updatedAt}>
                  <div>
                    <div className="rc-list-title">{inquiry.subject}</div>
                    <div className="rc-list-sub">
                      <span className="rc-dot" /> Updated {formatDateTime(inquiry.updatedAt)}
                    </div>
                  </div>
                </div>
              ))}
              {(!inquiries.latest || inquiries.latest.length === 0) && (
                <div className="rc-empty">No recent inquiries.</div>
              )}
            </div>
          </div>
        </section>

        <footer className="rc-footer">MediQueue Dental - Reception</footer>
      </main>
    </div>
  );
}

