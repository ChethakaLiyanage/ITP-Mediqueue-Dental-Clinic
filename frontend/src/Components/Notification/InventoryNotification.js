import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api";
import "./inventorynotification.css";

export default function InventoryNotification() {
  const navigate = useNavigate();
  const auth = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("auth") || "{}"); } catch { return {}; }
  }, []);
  const dentistCode = auth?.dentistCode || "";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/inventory/requests?dentistCode=${encodeURIComponent(dentistCode)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
        if (alive) setItems(Array.isArray(data.items) ? data.items : (Array.isArray(data.requests) ? data.requests : []));
      } catch (e) {
        if (alive) setError(e.message || "Failed to load notifications");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [dentistCode]);

  const filtered = useMemo(() => {
    const s = String(status).toLowerCase();
    return items.filter(r => {
      const codeOk = !q || String(r.requestCode || r._id || "").toLowerCase().includes(q.toLowerCase());
      const st = String(r.status || 'pending').toLowerCase();
      const stOk = s === 'all' ? true : st === s;
      return codeOk && stOk;
    });
  }, [items, q, status]);

  const fmt = (d) => { try { return new Date(d).toLocaleString(); } catch { return "-"; } };
  const statusText = (s) => {
    const v = String(s || 'pending').toLowerCase();
    if (v === 'approved' || v === 'confirm' || v === 'confirmed') return 'Confirmed';
    if (v === 'declined' || v === 'rejected') return 'Declined';
    return 'Pending';
  };

  return (
    <div className="inventory-notif-page">
      <div className="inventory-notif-card">
        <div className="inventory-notif-header">
          <h2>Inventory Notifications</h2>
          <div className="header-actions">
            <input
              className="inventory-input"
              placeholder="Search by request code"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className="inventory-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="declined">Declined</option>
            </select>
            <button className="inventory-submit-btn" onClick={() => navigate('/dentist/inventory/request')}>← Back</button>
          </div>
        </div>

        {loading && <div className="inventory-info">Loading...</div>}
        {error && <div className="inventory-error">{error}</div>}

        {!loading && !error && (
          <div className="inventory-table-wrapper">
            <table className="prescription-table">
              <thead>
                <tr>
                  <th>Request Code</th>
                  <th>Dentist Code</th>
                  <th>Items</th>
                  <th>Requested At</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r._id}>
                    <td><strong>{r.requestCode || r._id}</strong></td>
                    <td>{r.dentistCode}</td>
                    <td>
                      {(r.items || []).map((it, i) => (
                        <div key={i} className="medicine-item">
                          <span className="medicine-name">{it.itemCode}</span>
                          <div className="medicine-dosage">Qty: {it.quantity}</div>
                        </div>
                      ))}
                    </td>
                    <td>{fmt(r.createdAt || r.requestedAt)}</td>
                    <td>
                      <span className={`status-badge ${(() => {
                        const v = String(r.status || 'pending').toLowerCase();
                        if (v === 'approved' || v === 'confirm' || v === 'confirmed') return 'status-badge--active';
                        if (v === 'declined' || v === 'rejected') return 'status-badge--inactive';
                        return 'status-badge--pending';
                      })()}`}>
                        {statusText(r.status)}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="inventory-empty">No notifications to show.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
