import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import { API_BASE } from "../api";
import "./dentisttreatmentplans.css";

export default function DentistTreatmentPlanHistoryPage() {
  const navigate = useNavigate();
  const { user, token, authLoading } = useAuth();
  
  const dentistCode = user?.dentistCode || "";

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [nameMap, setNameMap] = useState(new Map());
  const [selected, setSelected] = useState(null);

  // Redirect if not authenticated or not a dentist
  useEffect(() => {
    if (!authLoading) {
      if (!token) {
        navigate("/login");
        return;
      }
      if (user?.role !== "Dentist") {
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

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!token || !user?.role) return;
      
      setLoading(true);
      setError("");
      try {
        // Pass dentist code as query parameter for server-side filtering
        const url = dentistCode 
          ? `${API_BASE}/treatmentplans/history/list?dentistCode=${encodeURIComponent(dentistCode)}`
          : `${API_BASE}/treatmentplans/history/list`;
          
        const res = await authenticatedFetch(url);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
        
        const allItems = Array.isArray(data.items) ? data.items : [];
        
        if (alive) setItems(allItems);
      } catch (e) {
        if (alive) setError(e.message || "Failed to load history");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token, user?.role, dentistCode, authenticatedFetch]);

  // name resolver similar to list page
  async function getPatientName(patientCode) {
    if (!patientCode) return "Unknown";
    try {
      // patient by code -> userId
      const pres = await authenticatedFetch(`${API_BASE}/patients/code/${encodeURIComponent(patientCode)}`);
      const pdata = await pres.json();
      if (!pres.ok) throw new Error(pdata?.message || `HTTP ${pres.status}`);
      const userId = pdata?.patient?.userId || pdata?.patients?.userId;
      if (!userId) return patientCode;
      // user -> name
      const ures = await authenticatedFetch(`${API_BASE}/users/${encodeURIComponent(userId)}`);
      const udata = await ures.json();
      if (!ures.ok) throw new Error(udata?.message || `HTTP ${ures.status}`);
      return udata?.user?.name || udata?.users?.name || patientCode;
    } catch {
      return patientCode;
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      const uniq = Array.from(new Set(items.map(it => it.patientCode).filter(Boolean)));
      const entries = await Promise.all(uniq.map(async code => [code, await getPatientName(code)]));
      if (alive) setNameMap(new Map(entries));
    })();
    return () => { alive = false; };
  }, [items]);

  const filtered = !q ? items : items.filter(it => {
    const name = nameMap.get(it.patientCode) || '';
    return name.toLowerCase().includes(q.toLowerCase());
  });

  const formatChanges = (it) => {
    const fields = ["diagnosis", "treatment_notes"];
    const prevSnap = it.__prev?.snapshot || null;
    const curSnap = it.snapshot || {};
    if (it.event === 'archive' || it.action === 'archive') return 'Deleted';
    if (it.event === 'restore' || it.action === 'restore') return 'Restored';
    if (!prevSnap) return 'Created';
    const changes = [];
    for (const f of fields) {
      const a = prevSnap?.[f];
      const b = curSnap?.[f];
      if (a !== b) changes.push(`${f}: ${a ?? '-'} → ${b ?? '-'}`);
    }
    return changes.length ? changes.join('; ') : 'No content changes';
  };

  // stitch prev for change comparison
  const keyed = new Map();
  const sorted = [...items].sort((a, b) => {
    const ca = new Date(a.changedAt || a.createdAt || a.updatedAt || 0).getTime();
    const cb = new Date(b.changedAt || b.createdAt || b.updatedAt || 0).getTime();
    return ca - cb;
  });
  for (const it of sorted) {
    const key = `${it.patientCode}|${it.planCode}`;
    const prev = keyed.get(key);
    it.__prev = prev || null;
    keyed.set(key, it);
  }

  // Show loading state while authentication is being checked
  if (authLoading) {
    return (
      <div className="treatment-plans-page">
        <div className="tp-loading">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="treatment-plans-page">
      <div className="tp-card">
        <div className="tp-header">
          <div className="tp-header-content">
            <h2>Treatment Plan History</h2>
            <div className="header-actions">
              <input
                className="tp-search-input"
                placeholder="Search by patient name"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button className="tp-btn tp-btn--secondary" onClick={() => navigate('/dentist/treatmentplans')}>
                ← Back
              </button>
            </div>
          </div>
        </div>

        {loading && <div className="tp-loading">Loading history...</div>}
        {error && <div className="tp-error">{error}</div>}

        {!loading && !error && (
          <table className="tp-table">
            <thead>
              <tr>
                <th>Patient Name</th>
                <th>Patient Code</th>
                <th>Plan Code</th>
                <th>Version</th>
                <th>Status</th>
                <th>At</th>
                <th>View More</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => {
                const snap = it.snapshot || {};
                const inactive = snap.isDeleted === true || (snap.status && String(snap.status).toLowerCase() !== 'active');
                return (
                  <tr key={`${it._id}`}>
                    <td>{nameMap.get(it.patientCode) || it.patientCode}</td>
                    <td>{it.patientCode}</td>
                    <td>{it.planCode}</td>
                    <td>{it.version}</td>
                    <td>{inactive ? 'Inactive' : 'Available'}</td>
                    <td>{(() => {
                      const d = it.changedAt || it.createdAt || it.updatedAt;
                      try { return d ? new Date(d).toLocaleString() : '-' } catch { return '-' }
                    })()}</td>
                    <td>
                      <button className="tp-btn tp-btn--secondary" onClick={() => setSelected(it)}>
                        View More
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Details Modal */}
      {selected && (
        <div className="tp-modal" role="dialog" aria-modal="true">
          <div className="tp-modal-backdrop" onClick={() => setSelected(null)} />
          <div className="tp-modal-content">
            <div className="tp-modal-header">
              <h3>Treatment Plan Details</h3>
              <button className="tp-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
            </div>
            <div className="tp-modal-body">
              <div className="report-section">
                <h4>Summary</h4>
                <div className="report-info">
                  <p><strong>Patient:</strong> {nameMap.get(selected.patientCode) || selected.patientCode} ({selected.patientCode})</p>
                  <p><strong>Plan Code:</strong> {selected.planCode}</p>
                  <p><strong>Version:</strong> {selected.version}</p>
                  <p><strong>Status:</strong> {(() => {
                    const snap = selected.snapshot || {};
                    const inactive = snap.isDeleted === true || (snap.status && String(snap.status).toLowerCase() !== 'active');
                    return inactive ? 'Inactive' : 'Available';
                  })()}</p>
                  <p><strong>At:</strong> {(() => { const d = selected.changedAt || selected.createdAt || selected.updatedAt; try { return d ? new Date(d).toLocaleString() : '-'; } catch { return '-'; } })()}</p>
                </div>
              </div>

              <div className="report-section">
                <h4>Diagnosis Details</h4>
                <div className="report-info">
                  <p><strong>Diagnosis:</strong> {selected?.snapshot?.diagnosis || '-'}</p>
                  <p><strong>Treatment Notes:</strong> {selected?.snapshot?.treatment_notes || '-'}</p>
                </div>
              </div>

              <div className="report-section">
                <h4>Changes</h4>
                <div className="report-info">
                  <p>{formatChanges(selected)}</p>
                </div>
              </div>
            </div>
            <div className="tp-modal-footer">
              <button className="tp-btn tp-btn--secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
