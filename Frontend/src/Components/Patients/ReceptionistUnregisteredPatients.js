import React, { useEffect, useState } from "react";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) ||
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_URL ||
  "http://localhost:5000";

function useDebounced(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);

  return debouncedValue;
}

export default function ReceptionistUnregisteredPatients() {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCode, setSelectedCode] = useState(null);

  const debouncedSearch = useDebounced(search, 300);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadUnregisteredPatients() {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem('token');
        const headers = {
          'Content-Type': 'application/json',
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(
          `${API_BASE}/receptionist/unregistered-patients?search=${encodeURIComponent(debouncedSearch)}&limit=50`,
          { 
            headers,
            credentials: "include", 
            signal: controller.signal 
          }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        if (cancelled) return;

        const items = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload)
          ? payload
          : [];
        setRows(items);
      } catch (err) {
        if (cancelled || err?.name === "AbortError") return;
        setRows([]);
        setError("Failed to load unregistered patients.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadUnregisteredPatients();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debouncedSearch]);

  return (
    <div className="rp-wrap">
      <div className="rp-header">
        <h2>Unregistered Patients</h2>
        <div className="rp-search">
          <input
            placeholder="Search by name, phone, email, or code..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button className="rp-btn" onClick={() => setSearch((value) => value)}>
            Search
          </button>
        </div>
      </div>

      <div className="rp-card">
        {error && <div className="rp-error">{error}</div>}
        {loading ? (
          <div className="rp-empty">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="rp-empty">No unregistered patients</div>
        ) : (
          <table className="rp-table">
            <thead>
              <tr>
                <th>UP Code</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Age</th>
                <th>Added By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.unregisteredPatientCode}>
                  <td className="rp-mono">{row.unregisteredPatientCode || "-"}</td>
                  <td>{row.name || "-"}</td>
                  <td>{row.phone || "-"}</td>
                  <td className="rp-ellipsis" title={row.email || ""}>
                    {row.email || "-"}
                  </td>
                  <td>{row.age ?? "-"}</td>
                  <td className="rp-mono">{row.addedByCode || "-"}</td>
                  <td>
                    <button
                      className="rp-pill rp-view"
                      onClick={() => setSelectedCode(row.unregisteredPatientCode)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedCode ? (
        <UnregisteredPatientDrawer
          apiBase={API_BASE}
          code={selectedCode}
          onClose={() => setSelectedCode(null)}
        />
      ) : null}
    </div>
  );
}

function UnregisteredPatientDrawer({ apiBase, code, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadDetails() {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem('token');
        const headers = {
          'Content-Type': 'application/json',
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${apiBase}/receptionist/unregistered-patients/${code}`, {
          headers,
          credentials: "include",
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        if (cancelled) return;

        console.log('Unregistered patient API response:', payload);
        // Backend returns { patient, appointments }, so we need to merge them
        const patientData = payload.patient || {};
        const appointments = payload.appointments || [];
        setData({ ...patientData, appointments });
      } catch (err) {
        if (cancelled || err?.name === "AbortError") return;
        setError("Failed to load details.");
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDetails();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [apiBase, code]);

  return (
    <div className="rp-drawer">
      <div className="rp-drawer-panel">
        <div className="rp-drawer-head">
          <h3>Unregistered: {code}</h3>
          <button className="rp-close" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>

        {loading ? (
          <div className="rp-empty">Loading...</div>
        ) : error ? (
          <div className="rp-error">{error}</div>
        ) : (
          <>
            <div className="rp-grid">
              <div>
                <div className="rp-label">Name</div>
                <div className="rp-value">{data?.name || "-"}</div>
              </div>
              <div>
                <div className="rp-label">Phone</div>
                <div className="rp-value">{data?.phone || "-"}</div>
              </div>
              <div>
                <div className="rp-label">Email</div>
                <div className="rp-value">{data?.email || "-"}</div>
              </div>
              <div>
                <div className="rp-label">Age</div>
                <div className="rp-value">{data?.age ?? "-"}</div>
              </div>
              <div>
                <div className="rp-label">ID Number</div>
                <div className="rp-value">{data?.identityNumber || "-"}</div>
              </div>
              <div>
                <div className="rp-label">Added By</div>
                <div className="rp-value rp-mono">{data?.addedByCode || "-"}</div>
              </div>
              <div className="rp-col-span-2">
                <div className="rp-label">Notes</div>
                <div className="rp-value">{data?.notes || "-"}</div>
              </div>
            </div>

            <div className="rp-subhead">Appointments</div>
            {Array.isArray(data?.appointments) && data.appointments.length > 0 ? (
              <table className="rp-table rp-table-compact">
                <thead>
                  <tr>
                    <th>Appointment</th>
                    <th>Dentist</th>
                    <th>Date &amp; Time</th>
                    <th>Status</th>
                    <th>Booked By</th>
                    <th>Accepted By</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {data.appointments.map((appointment) => (
                    <tr key={appointment.appointmentCode}>
                      <td className="rp-mono">{appointment.appointmentCode}</td>
                      <td className="rp-mono">{appointment.dentist_code}</td>
                      <td>{formatDate(appointment.date)}</td>
                      <td>
                        <span className="rp-pill rp-badge-blue">{appointment.status}</span>
                      </td>
                      <td className="rp-mono">{appointment.createdByCode || "-"}</td>
                      <td className="rp-mono">{appointment.acceptedByCode || "-"}</td>
                      <td className="rp-ellipsis" title={appointment.reason || ""}>
                        {appointment.reason || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="rp-empty">No appointments</div>
            )}
          </>
        )}
      </div>
      <div className="rp-drawer-backdrop" onClick={onClose} />
    </div>
  );
}

function formatDate(value) {
  try {
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? "-" : dt.toLocaleString();
  } catch (err) {
    return "-";
  }
}