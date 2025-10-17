import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import { API_BASE } from "../api";
import "./dentistallprescriptionpart.css";

export default function PrescriptionsPage() {
  const navigate = useNavigate();
  const { user, token, authLoading } = useAuth();
  
  const dentistCode = user?.dentistCode || "";

  const [modalOpen, setModalOpen] = useState(false);
  const [patientOptions, setPatientOptions] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [form, setForm] = useState({ 
    patientCode: "", 
    planCode: "", 
    medicines: [{ name: "", dosage: "", instructions: "" }]
  });

  // prescriptions list
  const [prescriptions, setPrescriptions] = useState([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);
  const [queueStatusMap, setQueueStatusMap] = useState({});

  // update modal state
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState({ id: "", medicines: [] });

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

  async function getPatientName(patientCode) {
    try {
      const pres = await authenticatedFetch(`${API_BASE}/patients/code/${encodeURIComponent(patientCode)}`);
      const pdata = await pres.json();
      if (!pres.ok) throw new Error(pdata?.message || `HTTP ${pres.status}`);
      
      const patientObj = pdata?.patient || pdata?.patients || {};
      let userId = patientObj.userId;
      
      // Handle case where userId might be populated as an object
      if (userId && typeof userId === 'object' && userId.name) {
        return userId.name;
      }
      
      // Extract userId string from object if it's populated
      if (userId && typeof userId === 'object' && userId._id) {
        userId = userId._id;
      }
      
      if (!userId || typeof userId !== 'string') return patientCode;
      
      const ures = await authenticatedFetch(`${API_BASE}/users/${encodeURIComponent(userId)}`);
      const udata = await ures.json();
      if (!ures.ok) return patientCode;
      
      return udata?.user?.name || udata?.users?.name || patientCode;
    } catch (error) {
      console.error('Error in getPatientName:', error);
      return patientCode; 
    }
  }

  const openModal = async () => {
    setModalOpen(true);
    setForm({ patientCode: "", planCode: "", medicines: [{ name: "", dosage: "", instructions: "" }] });
    
    if (!dentistCode || !token) {
      setLoadingPatients(false);
      return;
    }
    
    setLoadingPatients(true);
    try {
      console.log('🔍 Loading patients for dentist:', dentistCode);
      // Only include today's queue patients for this dentist
      const qRes = await authenticatedFetch(`${API_BASE}/api/dentist-queue/today?dentistCode=${encodeURIComponent(dentistCode)}`);
      const qData = await qRes.json().catch(() => []);
      console.log('📊 Queue data received:', qData);
      const rows = Array.isArray(qData) ? qData : [];

      const opts = [];
      for (const row of rows) {
        const code = row?.patientCode;
        if (!code) continue;
        const name = row?.patientName || "Unknown"; // Use patient name from queue data
        const status = row?.status || row?.queueStatus || "";
        const timeRaw = row?.appointment_date || row?.date;
        const time = timeRaw ? new Date(timeRaw) : null;
        const queueNo = row?.queueCode || row?.queueNo || "";
        opts.push({ code, name, status, time, queueNo });
      }
      opts.sort((a, b) => a.name.localeCompare(b.name));
      console.log('✅ Patient options created:', opts);
      setPatientOptions(opts);
    } catch (error) {
      console.error('❌ Error loading patients:', error);
    } finally {
      console.log('🏁 Setting loading to false');
      setLoadingPatients(false);
    }
  };


  useEffect(() => {
    async function inferPlan() {
      if (!form.patientCode || !dentistCode || !token) { 
        setForm(f => ({ ...f, planCode: "" })); 
        return; 
      }
      
      try {
        const tRes = await authenticatedFetch(`${API_BASE}/treatmentplans`);
        const tData = await tRes.json().catch(() => ({}));
        if (!tRes.ok) return;
        
        const list = (tData.treatmentplans || [])
          .filter(tp => 
            tp.patientCode === form.patientCode && 
            tp.dentistCode === dentistCode && 
            tp.isDeleted !== true
          );
        
        list.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        const latest = list[0];
        setForm(f => ({ ...f, planCode: latest?.planCode || "" }));
      } catch {}
    }
    inferPlan();
  }, [form.patientCode, dentistCode, token, authenticatedFetch]);

  // CREATE prescription
  const onCreate = async () => {
    const meds = Array.isArray(form.medicines) ? form.medicines.filter(m => m.name && m.name.trim() && m.dosage && m.dosage.trim()) : [];
    
    // Debug logging
    console.log('Form data:', form);
    console.log('Filtered medicines:', meds);
    console.log('Patient code:', form.patientCode);
    console.log('Plan code:', form.planCode);
    
    if (!form.patientCode || meds.length === 0) {
      let errorMsg = "Please ";
      if (!form.patientCode) errorMsg += "select a patient, ";
      if (meds.length === 0) errorMsg += "add at least one medicine with name and dosage";
      errorMsg = errorMsg.replace(/,\s*$/, ""); // Remove trailing comma
      alert(errorMsg);
      return;
    }
    
    try {
      const res = await authenticatedFetch(`${API_BASE}/prescriptions`, {
        method: "POST",
        body: JSON.stringify({
          patientCode: form.patientCode,
          ...(form.planCode && { planCode: form.planCode }), // Only include planCode if it exists
          dentistCode,
          medicines: meds.map(m => ({ name: m.name, dosage: m.dosage, instructions: m.instructions || "" })),
        }),
      });
      
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      
      setModalOpen(false);
      alert("Prescription added successfully!");
      fetchPrescriptions();
    } catch (e) {
      alert(e.message || "Failed to add prescription");
    }
  };

  // FETCH prescriptions
  const fetchPrescriptions = useCallback(async () => {
    if (!dentistCode || !token) return;
    
    setLoadingPrescriptions(true);
    try {
      const res = await authenticatedFetch(`${API_BASE}/prescriptions/my?active=1`);
      const data = await res.json();
      if (res.ok) {
        const items = data.items || [];
        // Filter to only current date
        const today = new Date();
        const sameDay = (a, b) => {
          const ay = a.getFullYear(), am = a.getMonth(), ad = a.getDate();
          const by = b.getFullYear(), bm = b.getMonth(), bd = b.getDate();
          return ay === by && am === bm && ad === bd;
        };
        const todayItems = items.filter(rx => {
          const d = rx.issuedAt ? new Date(rx.issuedAt) : null;
          return d ? sameDay(d, today) : false;
        });
        setPrescriptions(todayItems);
      }
    } catch (error) {
      console.error("Error fetching prescriptions:", error);
    }
    setLoadingPrescriptions(false);
  }, [dentistCode, token, authenticatedFetch]);

  useEffect(() => {
    fetchPrescriptions();
  }, [fetchPrescriptions]);

  // Determine if Update is enabled: active and queue status is NOT Completed
  const canUpdate = (rx) => {
    if (!rx?.isActive) return false;
    const st = (queueStatusMap[rx.patientCode] || '').toLowerCase();
    return st !== 'completed';
  };

  // Build queue status map for current prescriptions
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!token) return;
      
      const uniq = Array.from(new Set(prescriptions.map(r => r.patientCode).filter(Boolean)));
      const entries = await Promise.all(uniq.map(async code => {
        try {
          const qres = await authenticatedFetch(`${API_BASE}/api/queue/status/${encodeURIComponent(code)}`);
          const qdata = await qres.json().catch(() => ({}));
          const s = qdata?.status || '';
          return [code, s];
        } catch {
          return [code, ''];
        }
      }));
      if (alive) {
        const map = {};
        for (const [k, v] of entries) map[k] = v;
        setQueueStatusMap(map);
      }
    })();
    return () => { alive = false; };
  }, [prescriptions, token, authenticatedFetch]);

  // Open update modal
  const handleUpdate = (rx) => {
    setUpdateForm({ 
      id: rx._id, 
      medicines: rx.medicines.map(m => ({ ...m })) 
    });
    setUpdateModalOpen(true);
  };

  // Submit update
  const onUpdate = async () => {
    if (!updateForm.id) return;
    
    try {
      const res = await authenticatedFetch(`${API_BASE}/prescriptions/${updateForm.id}`, {
        method: "PUT",
        body: JSON.stringify({ medicines: updateForm.medicines }),
      });
      
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      
      alert("Prescription updated successfully!");
      setUpdateModalOpen(false);
      fetchPrescriptions();
    } catch (e) {
      alert(e.message || "Failed to update prescription");
    }
  };

  const updateMedicine = (index, field, value) => {
    const meds = [...updateForm.medicines];
    meds[index][field] = value;
    setUpdateForm({ ...updateForm, medicines: meds });
  };

  // Show loading state while authentication is being checked
  if (authLoading) {
    return (
      <div className="prescription-page">
        <div className="prescription-container">
          <div className="prescription-loading">
            <div className="loading-spinner"></div>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="prescription-page">
      <div className="prescription-container">
        {/* Header */}
        <div className="prescription-header">
          <h1 className="prescription-title">Prescriptions</h1>
          <div className="prescription-actions">
            <button 
              className="prescription-btn prescription-btn--secondary"
              onClick={() => navigate('/dentist/prescriptions/history')}
            >
              📋 Prescription History
            </button>
            <button 
              className="prescription-btn prescription-btn--primary"
              onClick={openModal}
            >
              ➕ Add Prescription
            </button>
          </div>
        </div>

        {/* Add Prescription Modal */}
        {modalOpen && (
          <div className="prescription-modal" role="dialog" aria-modal="true">
            <div className="prescription-modal-backdrop" onClick={() => setModalOpen(false)} />
            <div className="prescription-modal-content">
              <div className="prescription-modal-header">
                <h3 className="prescription-modal-title">Add New Prescription</h3>
                <button 
                  className="prescription-modal-close" 
                  onClick={() => setModalOpen(false)} 
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              
              <div className="prescription-modal-body">
                <div className="prescription-field">
                  <label className="prescription-label">Patient Name</label>
                  <div className="prescription-select-row">
                    <select
                      className="prescription-select"
                      value={form.patientCode}
                      onChange={(e) => setForm({ ...form, patientCode: e.target.value })}
                    >
                      <option value="">
                        {loadingPatients ? 'Loading today\'s queue...' : 
                         (patientOptions.length ? 'Select patient from today\'s queue...' : 'No patients in today\'s queue')}
                      </option>
                      {patientOptions.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.name} ({o.code})
                          {o.status ? ` - ${o.status}` : ''}
                          {o.time ? ` - ${new Date(o.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Treatment Plan Information */}
                <div className="prescription-field">
                  <div className="treatment-plan-info">
                    <p className="info-text">
                      <strong>Treatment Plan:</strong> If the selected patient has an active treatment plan, it will be automatically linked to this prescription. 
                      You can create prescriptions with or without treatment plans.
                    </p>
                    
                    {form.planCode && (
                      <div className="linked-plan-details">
                        <div className="linked-plan-header">
                          <span className="linked-plan-icon">✅</span>
                          <span className="linked-plan-text">
                            <strong>Linked to Treatment Plan:</strong> {form.planCode}
                          </span>
                        </div>
                        <div className="treatment-plan-card">
                          <div className="plan-info-grid">
                            <div className="plan-info-item">
                              <label>Plan Code:</label>
                              <span>{form.planCode}</span>
                            </div>
                            <div className="plan-info-item">
                              <label>Patient:</label>
                              <span>{form.patientCode}</span>
                            </div>
                            <div className="plan-info-item full-width">
                              <label>Status:</label>
                              <span className="plan-status active">Active Treatment Plan</span>
                            </div>
                          </div>
                          <p className="plan-note">
                            This prescription will be automatically linked to the treatment plan for proper tracking and documentation.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {!form.planCode && form.patientCode && (
                      <div className="no-plan-details">
                        <div className="no-plan-header">
                          <span className="no-plan-icon">ℹ️</span>
                          <span className="no-plan-text">
                            <strong>No Active Treatment Plan</strong>
                          </span>
                        </div>
                        <div className="no-plan-card">
                          <p>No active treatment plan found for this patient. Prescription will be created without a treatment plan link.</p>
                          <p className="plan-note">
                            You can still create the prescription. A treatment plan can be linked later if needed.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected Patient Queue Information */}
                {form.patientCode && (() => {
                  const selectedPatient = patientOptions.find(p => p.code === form.patientCode);
                  return selectedPatient ? (
                    <div className="selected-patient-info">
                      <div className="patient-info-card">
                        <h4 className="patient-info-title">Selected Patient Information</h4>
                        <div className="patient-info-grid">
                          <div className="info-item">
                            <span className="info-label">Queue Number:</span>
                            <span className="info-value queue-number">{selectedPatient.queueNo || 'N/A'}</span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Appointment Time:</span>
                            <span className="info-value appointment-time">
                              {selectedPatient.time ? 
                                new Date(selectedPatient.time).toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit',
                                  hour12: true 
                                }) : 'N/A'
                              }
                            </span>
                          </div>
                          <div className="info-item">
                            <span className="info-label">Status:</span>
                            <span className={`info-value status-badge ${selectedPatient.status?.toLowerCase().replace(/\s+/g, '-') || 'unknown'}`}>
                              {selectedPatient.status || 'Unknown'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}
                
                {(form.medicines || []).map((m, idx) => (
                <div key={idx} className="medicine-form-group">
                  <label className="medicine-form-label">Medicine {idx + 1}</label>
                  <div className="medicine-form-row">
                    <input
                      className="prescription-input"
                      type="text"
                      placeholder="Medicine name"
                      value={m.name}
                      onChange={(e) => {
                        const meds = [...(form.medicines || [])];
                        meds[idx] = { ...meds[idx], name: e.target.value };
                        setForm({ ...form, medicines: meds });
                      }}
                    />
                    <input
                      className="prescription-input"
                      type="text"
                      placeholder="Dosage"
                      value={m.dosage}
                      onChange={(e) => {
                        const meds = [...(form.medicines || [])];
                        meds[idx] = { ...meds[idx], dosage: e.target.value };
                        setForm({ ...form, medicines: meds });
                      }}
                    />
                  </div>
                  <textarea
                    className="prescription-textarea"
                    placeholder="Instructions"
                    value={m.instructions || ""}
                    onChange={(e) => {
                      const meds = [...(form.medicines || [])];
                      meds[idx] = { ...meds[idx], instructions: e.target.value };
                      setForm({ ...form, medicines: meds });
                    }}
                  />
                  <div className="medicine-actions-row">
                    {idx > 0 && (
                      <button
                        className="prescription-btn prescription-btn--secondary"
                        type="button"
                        onClick={() => {
                          const meds = [...(form.medicines || [])];
                          meds.splice(idx, 1);
                          setForm({ ...form, medicines: meds });
                        }}
                      >
                        Remove
                      </button>
                    )}
                    {idx === (form.medicines?.length || 1) - 1 && (
                      <button
                        className="prescription-btn prescription-btn--primary"
                        type="button"
                        onClick={() => setForm({ ...form, medicines: [...(form.medicines || []), { name: "", dosage: "", instructions: "" }] })}
                      >
                        + Add Medicine
                      </button>
                    )}
                  </div>
                </div>
              ))}
              </div>
              
              <div className="prescription-modal-footer">
                <button 
                  className="prescription-btn prescription-btn--success" 
                  onClick={onCreate}
                >
                  💊 Add Prescription
                </button>
                <button 
                  className="prescription-btn prescription-btn--secondary" 
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Update Prescription Modal */}
        {updateModalOpen && (
          <div className="prescription-modal" role="dialog" aria-modal="true">
            <div className="prescription-modal-backdrop" onClick={() => setUpdateModalOpen(false)} />
            <div className="prescription-modal-content">
              <div className="prescription-modal-header">
                <h3 className="prescription-modal-title">Update Prescription</h3>
                <button 
                  className="prescription-modal-close" 
                  onClick={() => setUpdateModalOpen(false)} 
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              
              <div className="prescription-modal-body">
                {updateForm.medicines.map((m, i) => (
                  <div key={i} className="medicine-form-group">
                    <label className="medicine-form-label">Medicine {i + 1}</label>
                    <div className="medicine-form-row">
                      <input
                        className="prescription-input"
                        type="text"
                        placeholder="Medicine name"
                        value={m.name}
                        onChange={(e) => updateMedicine(i, 'name', e.target.value)}
                      />
                      <input
                        className="prescription-input"
                        type="text"
                        placeholder="Dosage"
                        value={m.dosage}
                        onChange={(e) => updateMedicine(i, 'dosage', e.target.value)}
                      />
                    </div>
                    <textarea
                      className="prescription-textarea"
                      placeholder="Instructions"
                      value={m.instructions || ""}
                      onChange={(e) => updateMedicine(i, 'instructions', e.target.value)}
                    />
                  </div>
                ))}
              </div>
              
              <div className="prescription-modal-footer">
                <button 
                  className="prescription-btn prescription-btn--primary" 
                  onClick={onUpdate}
                >
                  🔄 Update Prescription
                </button>
                <button 
                  className="prescription-btn prescription-btn--secondary" 
                  onClick={() => setUpdateModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Prescriptions Table */}
        <div>
          <h2 className="prescription-section-title">Today's Prescriptions (My Patients)</h2>
          
          {loadingPrescriptions ? (
            <div className="prescription-loading">
              Loading prescriptions...
            </div>
          ) : prescriptions.length === 0 ? (
            <div className="prescription-empty">
              <div className="prescription-empty-icon">💊</div>
              <div className="prescription-empty-title">No Prescriptions Found</div>
              <div className="prescription-empty-message">
                No prescriptions found for your dentist code. Click "Add Prescription" to create your first one.
              </div>
            </div>
          ) : (
            <table className="prescription-table">
              <thead>
                <tr>
                  <th>Prescription Code</th>
                  <th>Patient Code</th>
                  <th>Plan Code</th>
                  <th>Medicines</th>
                  <th>Issued At</th>
                  <th>Status</th>
                  <th>Update</th>
                </tr>
              </thead>
              <tbody>
                {prescriptions.map((rx) => (
                  <tr key={rx._id}>
                    <td>
                      <strong>{rx.prescriptionCode}</strong>
                    </td>
                    <td>{rx.patientCode}</td>
                    <td>{rx.planCode}</td>
                    <td>
                      {rx.medicines.map((m, i) => (
                        <div key={i} className="medicine-item">
                          <span className="medicine-name">{m.name}</span>
                          <div className="medicine-dosage">{m.dosage}</div>
                          <div className="medicine-instructions">
                            {m.instructions || "No specific instructions"}
                          </div>
                        </div>
                      ))}
                    </td>
                    <td>{new Date(rx.issuedAt).toLocaleString()}</td>
                    <td>
                      <span className={`status-badge ${rx.isActive ? 'status-badge--active' : 'status-badge--inactive'}`}>
                        {rx.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      {canUpdate(rx) ? (
                        <button 
                          className="prescription-btn prescription-btn--update"
                          onClick={() => handleUpdate(rx)}
                        >
                          Update
                        </button>
                      ) : (
                        <span className="prescription-btn prescription-btn--locked">
                          Locked
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}