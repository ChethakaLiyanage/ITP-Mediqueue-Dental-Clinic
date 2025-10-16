import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import { API_BASE } from "../api";
import "./dentisttreatmentplans.css";

export default function TreatmentPlansList() {
  const navigate = useNavigate();
  const { user, token, authLoading } = useAuth();
  
  const dentistCode = user?.dentistCode || "";
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState("");
  const [dropdownPatients, setDropdownPatients] = useState([]);
  const [loadingDropdown, setLoadingDropdown] = useState(false);

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

  // cache for patientCode -> display name
  const [nameCache] = useState(() => new Map());

  // Fetch queue patients for dropdown
  const fetchQueuePatients = useCallback(async () => {
    if (!dentistCode || !token) return;
    
    setLoadingDropdown(true);
    try {
      const qRes = await authenticatedFetch(
        `${API_BASE}/api/dentist-queue/today?dentistCode=${encodeURIComponent(dentistCode)}`
      );
      const qData = await qRes.json().catch(() => []);
      const rows = Array.isArray(qData) ? qData : [];

      // Build dropdown options - only include patients with "in_treatment" status
      const opts = [];
      for (const row of rows) {
        const code = row?.patientCode;
        const status = row?.status || row?.queueStatus || "";
        
        // Only include patients with "in_treatment" status
        if (code && status.toLowerCase() === "in_treatment") {
          const name = await getPatientName(code);
          opts.push({ 
            code, 
            name, 
            status,
            disabled: false // All in_treatment patients are selectable
          });
        } else if (code) {
          // Include other patients but mark them as disabled
          const name = await getPatientName(code);
          opts.push({ 
            code, 
            name, 
            status,
            disabled: true // Other status patients are not selectable
          });
        }
      }

      // Sort by name, with enabled patients first
      opts.sort((a, b) => {
        if (a.disabled !== b.disabled) {
          return a.disabled ? 1 : -1; // Enabled first
        }
        return a.name.localeCompare(b.name);
      });
      
      setDropdownPatients(opts);
    } catch (e) {
      console.error("Error loading queue patients:", e);
      setDropdownPatients([]);
    } finally {
      setLoadingDropdown(false);
    }
  }, [dentistCode, token, authenticatedFetch, getPatientName]);

  // edit modal state
  const [editPlan, setEditPlan] = useState(null);
  const [editPatientName, setEditPatientName] = useState("");
  const [saving, setSaving] = useState(false);

  // create modal state
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ 
    patientCode: "", 
    diagnosis: "", 
    treatment_notes: "" 
  });
  const [patientOptions, setPatientOptions] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);

  // prescription modal state
  const [rxOpen, setRxOpen] = useState(false);
  const [rxPlan, setRxPlan] = useState(null);
  const [rxPatientName, setRxPatientName] = useState("");
  const [rxForm, setRxForm] = useState({ medicines: [{ name: "", dosage: "", instructions: "" }] });
  
  // history modal state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // report modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    let alive = true;
    const sameDay = (a, b) => {
      if (!a || !b) return false;
      const ay = a.getFullYear(), am = a.getMonth(), ad = a.getDate();
      const by = b.getFullYear(), bm = b.getMonth(), bd = b.getDate();
      return ay === by && am === bm && ad === bd;
    };
    async function load() {
      if (!token || !user?.role) return;
      
      setLoading(true);
      setError("");
      try {
        const res = await authenticatedFetch(`${API_BASE}/treatmentplans`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
        
        let items = Array.isArray(data.treatmentplans) ? data.treatmentplans : [];
        if (dentistCode) {
          const today = new Date();
          items = items.filter((p) => {
            if (p.dentistCode !== dentistCode) return false;
            if (p.isDeleted === true) return false;
            const cd = p.created_date ? new Date(p.created_date) : null;
            return cd ? sameDay(cd, today) : false;
          });
        }
        items.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        
        if (alive) setPlans(items);
      } catch (e) {
        if (alive) setError(e.message || "Failed to load treatment plans");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [dentistCode, token, user?.role, authenticatedFetch]);

  // Fetch queue patients for dropdown when component mounts
  useEffect(() => {
    if (user?.role === "Dentist" && token) {
      fetchQueuePatients();
    }
  }, [user?.role, token, fetchQueuePatients]);

  async function getPatientName(patientCode) {
    if (!patientCode) return "Unknown";
    if (nameCache.has(patientCode)) return nameCache.get(patientCode);
    
    try {
      // 1) patient -> userId
      const pres = await fetch(`${API_BASE}/patients/${encodeURIComponent(patientCode)}`);
      const pdata = await pres.json();
      if (!pres.ok) throw new Error(pdata?.message || `HTTP ${pres.status}`);
      
      const userId = pdata?.patient?.userId || pdata?.patients?.userId;
      if (!userId) throw new Error("userId missing for patient");
      
      // 2) userId -> name
      const ures = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}`);
      const udata = await ures.json();
      if (!ures.ok) throw new Error(udata?.message || `HTTP ${ures.status}`);
      
      const name = udata?.user?.name || udata?.users?.name || "Unknown";
      nameCache.set(patientCode, name);
      return name;
    } catch {
      const fallback = patientCode;
      nameCache.set(patientCode, fallback);
      return fallback;
    }
  }

  const onNewPlan = async () => {
    setCreating(true);
    setCreateForm({ patientCode: "", diagnosis: "", treatment_notes: "" });
    
    if (!dentistCode || !token) return;
    
    setLoadingPatients(true);

    try {
      // Only include patients from today's queue for this dentist
      const qRes = await authenticatedFetch(
        `${API_BASE}/api/dentist-queue/today?dentistCode=${encodeURIComponent(dentistCode)}`
      );
      const qData = await qRes.json().catch(() => []);
      const rows = Array.isArray(qData) ? qData : [];

      // Build dropdown options with status suffix
      const opts = [];
      for (const row of rows) {
        const code = row?.patientCode;
        if (!code) continue;
        const name = await getPatientName(code);
        const status = row?.status || row?.queueStatus || "";
        opts.push({ code, name, status });
      }

      // Sort by name
      opts.sort((a, b) => a.name.localeCompare(b.name));
      setPatientOptions(opts);
    } catch (e) {
      console.error("Error loading patient options:", e);
      setPatientOptions([]);
    } finally {
      setLoadingPatients(false);
    }
  };

  const handleHistoryOpen = async () => {
    setHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const res = await authenticatedFetch(`${API_BASE}/treatmentplans/history/list`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setHistoryItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setHistoryItems([]);
      alert(e.message || 'Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredPlans = plans.filter(p => {
    if (!selectedPatient) return true;
    return p.patientCode === selectedPatient;
  });

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
            <h2>Treatment Plans</h2>
            <div className="header-actions">
              <select
                className="tp-search-input"
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
              >
                <option value="">
                  {loadingDropdown ? 'Loading patients...' : 'Select patient from queue'}
                </option>
                {dropdownPatients.map((patient) => (
                  <option 
                    key={patient.code} 
                    value={patient.code}
                    disabled={patient.disabled}
                    style={{ 
                      color: patient.disabled ? '#9ca3af' : '#374151',
                      backgroundColor: patient.disabled ? '#f9fafb' : 'white'
                    }}
                  >
                    {patient.name} ({patient.code}) - {patient.status}
                    {patient.disabled ? ' (Not in treatment)' : ''}
                  </option>
                ))}
              </select>
              <button className="tp-btn tp-btn--secondary" onClick={() => navigate('/dentist/treatmentplans/history')}>
                Treatment Plan History
              </button>
              <button className="tp-btn tp-btn--primary" onClick={onNewPlan}>
                + New Plan
              </button>
            </div>
          </div>
        </div>

        {loading && <div className="tp-loading">Loading treatment plans...</div>}
        {error && <div className="tp-error">{error}</div>}

        {!loading && !error && plans.length === 0 && (
          <div className="tp-empty">No treatment plans found for today.</div>
        )}

        {!loading && !error && plans.length > 0 && filteredPlans.length === 0 && selectedPatient && (
          <div className="tp-empty">No treatment plans found for the selected patient.</div>
        )}

        <div className="tp-list">
          {filteredPlans.map((p) => (
            <PlanCard
              key={`${p.patientCode}-${p.planCode}`}
              plan={p}
              getPatientName={getPatientName}
              onEdit={async (plan) => {
                try {
                  // Block edits if queue status is Completed
                  const qRes = await fetch(`${API_BASE}/api/queue/status/${encodeURIComponent(plan.patientCode)}`);
                  const qData = await qRes.json().catch(() => ({}));
                  const status = (qData?.status || '').toLowerCase();
                  if (status === 'completed') {
                    alert("This patient's visit is Completed. Editing the treatment plan is locked.");
                    return;
                  }
                } catch (_) {}

                setEditPlan({ ...plan });
                const n = await getPatientName(plan.patientCode);
                setEditPatientName(n);
              }}
              onArchive={async (plan) => {
                try {
                  // Block archive if queue status is Completed
                  try {
                    const qRes = await authenticatedFetch(`${API_BASE}/api/queue/status/${encodeURIComponent(plan.patientCode)}`);
                    const qData = await qRes.json().catch(() => ({}));
                    const status = (qData?.status || '').toLowerCase();
                    if (status === 'completed') {
                      alert("This patient's visit is Completed. Archiving the treatment plan is locked.");
                      return;
                    }
                  } catch (_) {}

                  if (!window.confirm('Archive this treatment plan? It will be marked inactive.')) return;
                  const url = `${API_BASE}/treatmentplans/code/${encodeURIComponent(plan.patientCode)}/${encodeURIComponent(plan.planCode)}`;
                  const res = await authenticatedFetch(url, { method: 'DELETE' });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
                  // Optimistically remove from current list (since we hide deleted)
                  setPlans(prev => prev.filter(pl => !(pl.patientCode === plan.patientCode && pl.planCode === plan.planCode)));
                  alert('Treatment plan archived (inactive).');
                } catch (e) {
                  alert(e.message || 'Failed to archive plan');
                }
              }}
              onPrescription={async (plan) => {
                // Check if prescription already exists for this treatment plan
                try {
                  const existingRxRes = await authenticatedFetch(
                    `${API_BASE}/prescriptions?planCode=${encodeURIComponent(plan.planCode)}`
                  );
                  const existingRxData = await existingRxRes.json();
                  
                  if (existingRxRes.ok && existingRxData.prescriptions && existingRxData.prescriptions.length > 0) {
                    alert("This treatment plan already has a prescription. You can only have one prescription per treatment plan.");
                    return;
                  }
                } catch (e) {
                  console.error("Error checking existing prescriptions:", e);
                }

                setRxPlan({ ...plan });
                setRxForm({ medicines: [{ name: "", dosage: "", instructions: "" }] });
                const n = await getPatientName(plan.patientCode);
                setRxPatientName(n);
                setRxOpen(true);
              }}
              onReport={async (plan) => {
                try {
                  // Get patient details
                  // Fetch Patient by patientCode directly from Patient model
                  const pres = await authenticatedFetch(`${API_BASE}/patients/code/${encodeURIComponent(plan.patientCode)}`);
                  const pdata = await pres.json();
                  
                  if (!pres.ok) throw new Error(pdata?.message || `HTTP ${pres.status}`);
                  
                  const patientObj = pdata?.patient || pdata?.patients || {};
                  // Debug: verify structure in case dob shows as N/A
                  console.debug('Patient data for report', { 
                    planCode: plan?.planCode, 
                    patientCode: plan?.patientCode, 
                    patientObj,
                    dob: patientObj?.dob 
                  });
                  const patientUserId = patientObj.userId;

                  let patientName = "";
                  let patientAge = "";
                  // Prefer DOB from Patient model first (based on patientCode)
                  let patientDOB = (
                    patientObj?.dob ||
                    patientObj?.dateOfBirth ||
                    patientObj?.birthDate ||
                    patientObj?.DOB ||
                    patientObj?.date_of_birth ||
                    ""
                  );
                  let patientAllergies = patientObj?.allergies || "";

                  if (patientUserId) {
                    const ures = await authenticatedFetch(`${API_BASE}/users/${encodeURIComponent(patientUserId)}`);
                    const udata = await ures.json();
                    
                    if (ures.ok) {
                      const userObj = udata?.user || udata?.users || {};
                      patientName = userObj?.name || "";
                      // Only take DOB from user if Patient model didn't have it
                      if (!patientDOB) {
                        patientDOB = userObj?.dob || userObj?.dateOfBirth || userObj?.birthDate || "";
                      }
                      patientAge = userObj?.age || "";
                    }
                  }

                  // Get dentist name using dentistCode
                  let dentistName = "";
                  try {
                    const dentistRes = await authenticatedFetch(`${API_BASE}/dentists`);
                    const dentistData = await dentistRes.json();
                    
                    if (dentistRes.ok) {
                      const dentists = dentistData?.dentists || dentistData?.data || dentistData || [];
                      const dentist = dentists.find(d => d.dentistCode === plan.dentistCode);
                      
                      console.debug('Dentist lookup for report', { 
                        dentistCode: plan.dentistCode,
                        dentists: dentists.length,
                        foundDentist: dentist,
                        userId: dentist?.userId 
                      });
                      
                      if (dentist) {
                        // Check if userId is already populated as an object (from backend populate)
                        if (dentist.userId && typeof dentist.userId === 'object' && dentist.userId.name) {
                          dentistName = dentist.userId.name;
                          console.debug('Found dentist name from populated userId:', dentistName);
                        } else if (dentist.userId) {
                          // If userId is just an ID string, fetch the user details
                          const dentistUserRes = await authenticatedFetch(`${API_BASE}/users/${encodeURIComponent(dentist.userId)}`);
                          const dentistUserData = await dentistUserRes.json();
                          
                          if (dentistUserRes.ok && (dentistUserData?.user || dentistUserData?.users)) {
                            const userObj = dentistUserData?.user || dentistUserData?.users;
                            dentistName = userObj?.name || "";
                            console.debug('Found dentist name from user fetch:', dentistName);
                          }
                        }
                      }
                    }
                  } catch (e) {
                    console.error("Error fetching dentist details:", e);
                  }

                  // Get ACTIVE prescription for this patientCode + planCode
                  let prescriptions = [];
                  let prescriptionCode = "";
                  try {
                    const rxRes = await authenticatedFetch(`${API_BASE}/prescriptions/code/${encodeURIComponent(plan.patientCode)}/${encodeURIComponent(plan.planCode)}`);
                    const rxData = await rxRes.json();
                    if (rxRes.ok && (rxData?.prescription || rxData?.data)) {
                      const activeRx = rxData.prescription || rxData.data;
                      prescriptionCode = activeRx?.prescriptionCode || "";
                      if (Array.isArray(activeRx?.medicines)) {
                        prescriptions = activeRx.medicines.map(medicine => ({
                          name: medicine?.name,
                          dosage: medicine?.dosage,
                          instructions: medicine?.instructions || ""
                        }));
                      }
                    }
                  } catch (e) {
                    console.warn('Active prescription fetch failed:', e?.message);
                  }

                  // Store everything into modal state
                  setReportData({
                    plan,
                    prescriptions,
                    patientName,
                    patientAge, // fallback if DOB missing
                    patientDOB,
                    dentistName,
                    prescriptionCode,
                    patientAllergies
                  });

                  setReportOpen(true);
                } catch (e) {
                  console.error("Report fetch error:", e);
                  alert("Failed to load report data: " + (e.message || "Unknown error"));
                }
              }}
            />
          ))}
        </div>

        {/* Create Plan Modal */}
        {creating && (
          <CreatePlanModal
            dentistCode={dentistCode}
            loadingPatients={loadingPatients}
            patientOptions={patientOptions}
            form={createForm}
            onClose={() => setCreating(false)}
            onChange={(patch) => setCreateForm((prev) => ({ ...prev, ...patch }))}
            onCreate={async () => {
              if (!createForm.patientCode || !createForm.diagnosis) {
                alert("Please select a patient and enter a diagnosis.");
                return;
              }
              try {
                setSaving(true);
                const res = await authenticatedFetch(`${API_BASE}/treatmentplans`, {
                  method: "POST",
                  body: JSON.stringify({
                    patientCode: createForm.patientCode,
                    dentistCode,
                    diagnosis: createForm.diagnosis,
                    treatment_notes: createForm.treatment_notes,
                  }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
                
                const created = data.treatmentplans || data.treatmentplan || null;
                if (created) setPlans((prev) => [created, ...prev]);
                setCreating(false);
                // Refresh dropdown patients after creating a new plan
                fetchQueuePatients();
              } catch (e) {
                alert(e.message || "Failed to create plan");
              } finally {
                setSaving(false);
              }
            }}
            saving={saving}
          />
        )}

        {/* Edit Plan Modal */}
        {editPlan && (
          <EditPlanModal
            plan={editPlan}
            patientName={editPatientName}
            onClose={() => setEditPlan(null)}
            onChange={(patch) => setEditPlan((prev) => ({ ...prev, ...patch }))}
            saving={saving}
            onSave={async () => {
              try {
                setSaving(true);
                const url = `${API_BASE}/treatmentplans/code/${encodeURIComponent(editPlan.patientCode)}/${encodeURIComponent(editPlan.planCode)}`;
                const res = await authenticatedFetch(url, {
                  method: "PUT",
                  body: JSON.stringify({
                    diagnosis: editPlan.diagnosis,
                    treatment_notes: editPlan.treatment_notes,
                  }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
                
                const updated = data.treatmentplan || data.treatmentplans || editPlan;
                setPlans((prev) => prev.map((pl) => {
                  if (pl.patientCode === editPlan.patientCode && pl.planCode === editPlan.planCode) {
                    return { 
                      ...pl, 
                      diagnosis: updated.diagnosis, 
                      treatment_notes: updated.treatment_notes, 
                      version: updated.version, 
                      updated_date: updated.updated_date 
                    };
                  }
                  return pl;
                }));
                setEditPlan(null);
              } catch (e) {
                alert(e.message || "Failed to update plan");
              } finally {
                setSaving(false);
              }
            }}
          />
        )}

        {/* Add Prescription Modal */}
        {rxOpen && rxPlan && (
          <AddPrescriptionModal
            patientName={rxPatientName}
            form={rxForm}
            onChange={(patch) => setRxForm((prev) => ({ ...prev, ...patch }))}
            onClose={() => setRxOpen(false)}
            onCreate={async () => {
              const meds = Array.isArray(rxForm.medicines) ? rxForm.medicines.filter(m => m.name && m.dosage) : [];
              if (meds.length === 0) {
                alert("Please add at least one medicine with name and dosage");
                return;
              }
              
              // Check if patient is "In Treatment" before allowing prescription creation
              try {
                const queueRes = await authenticatedFetch(`${API_BASE}/api/queue/status/${encodeURIComponent(rxPlan.patientCode)}`);
                const queueData = await queueRes.json();
                
                if (!queueRes.ok || queueData.status !== "in_treatment") {
                  alert("Prescriptions can only be created when the patient status is 'In Treatment' in the queue.");
                  return;
                }
              } catch (e) {
                alert("Could not verify patient queue status. Please ensure patient is 'In Treatment'.");
                return;
              }

              try {
                setSaving(true);
                const body = {
                  patientCode: rxPlan.patientCode,
                  planCode: rxPlan.planCode,
                  dentistCode,
                  medicines: meds.map(m => ({ name: m.name, dosage: m.dosage, instructions: m.instructions || "" })),
                };
                const res = await authenticatedFetch(`${API_BASE}/prescriptions`, {
                  method: "POST",
                  body: JSON.stringify(body),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
                setRxOpen(false);
                alert("Prescription added successfully!");
              } catch (e) {
                alert(e.message || "Failed to add prescription");
              } finally {
                setSaving(false);
              }
            }}
            saving={saving}
          />
        )}

        {/* History Modal */}
        {historyOpen && (
          <HistoryModal 
            loading={loadingHistory} 
            items={historyItems} 
            onClose={() => setHistoryOpen(false)} 
            getPatientName={getPatientName}
          />
        )}
        
        {/* Report Modal */}
        {reportOpen && (
          <ReportModal 
            data={reportData} 
            onClose={() => setReportOpen(false)} 
          />
        )}
      </div>
    </div>
  );
}

function PlanCard({ plan, getPatientName, onEdit, onArchive, onPrescription, onReport }) {
  const [patientName, setPatientName] = useState(plan.patientCode);
  
  useEffect(() => {
    let alive = true;
    getPatientName(plan.patientCode).then((name) => {
      if (alive) setPatientName(name);
    });
    return () => { alive = false; };
  }, [plan?.patientCode, getPatientName]);

  const created = plan?.created_date ? new Date(plan.created_date) : null;
  const createdStr = created ? created.toLocaleDateString() : "";
  const version = plan?.version || 1;

  return (
    <div className="tp-item">
      <div className="tp-item-head">
        <div className="tp-patient">{patientName}</div>
        <div className="tp-actions">
          <button className="tp-icon" title="Edit" onClick={() => onEdit?.(plan)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
          <button className="tp-icon" title="Archive" onClick={() => onArchive?.(plan)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="4" width="18" height="4" />
              <path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8" />
              <path d="M10 12h4" />
            </svg>
          </button>
          <button className="tp-icon green" title="Add Prescription" onClick={() => onPrescription?.(plan)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="7" width="14" height="8" rx="4" ry="4" strokeWidth="2" />
              <path d="M7 11h6" strokeWidth="2" />
              <path d="M10 8v6" strokeWidth="2" />
            </svg>
          </button>
          <button className="tp-icon blue" title="Generate Report" onClick={() => onReport?.(plan)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M6 2h12v4H6z" />
              <rect x="6" y="6" width="12" height="14" rx="2" ry="2" />
              <path d="M9 12h6" />
              <path d="M9 16h6" />
            </svg>
          </button>
        </div>
      </div>
      <div className="tp-meta">
        <div>Diagnosis: <strong>{plan?.diagnosis || "-"}</strong></div>
        <div>Created: {createdStr} (v{version})</div>
      </div>
      {plan?.treatment_notes && (
        <div className="tp-notes">{plan.treatment_notes}</div>
      )}
    </div>
  );
}

function EditPlanModal({ plan, patientName, onClose, onChange, onSave, saving }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="tp-modal" role="dialog" aria-modal="true">
      <div className="tp-modal-backdrop" onClick={onClose} />
      <div className="tp-modal-content">
        <div className="tp-modal-header">
          <h3>Update Treatment Plan</h3>
          <button className="tp-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="tp-modal-body">
          <div className="tp-field">
            <label className="tp-label">Patient Name</label>
            <input className="tp-input" type="text" value={patientName || ''} readOnly />
          </div>
          <div className="tp-field">
            <label className="tp-label">Diagnosis</label>
            <input
              className="tp-input"
              type="text"
              value={plan?.diagnosis || ''}
              onChange={(e) => onChange({ diagnosis: e.target.value })}
            />
          </div>
          <div className="tp-field">
            <label className="tp-label">Treatment Notes</label>
            <textarea
              className="tp-textarea"
              rows={5}
              value={plan?.treatment_notes || ''}
              onChange={(e) => onChange({ treatment_notes: e.target.value })}
            />
          </div>
        </div>

        <div className="tp-modal-footer">
          <button className="tp-btn tp-btn--primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Update'}
          </button>
          <button className="tp-btn tp-btn--secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function AddPrescriptionModal({ patientName, form, onChange, onClose, onCreate, saving }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="tp-modal" role="dialog" aria-modal="true">
      <div className="tp-modal-backdrop" onClick={onClose} />
      <div className="tp-modal-content">
        <div className="tp-modal-header">
          <h3>Add Prescription</h3>
          <button className="tp-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="tp-modal-body">
          <div className="tp-field">
            <label className="tp-label">Patient Name</label>
            <input className="tp-input" type="text" value={patientName || ''} readOnly />
          </div>

          {(form.medicines || []).map((m, idx) => (
            <div key={idx} className="tp-field" style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, marginBottom: 10 }}>
              <div className="tp-field" style={{ marginBottom: 8 }}>
                <label className="tp-label">Medicine Name</label>
                <input
                  className="tp-input"
                  type="text"
                  value={m.name}
                  onChange={(e) => {
                    const meds = [...(form.medicines || [])];
                    meds[idx] = { ...meds[idx], name: e.target.value };
                    onChange({ medicines: meds });
                  }}
                  placeholder="e.g., Amoxicillin"
                />
              </div>
              <div className="tp-field" style={{ marginBottom: 8 }}>
                <label className="tp-label">Dosage</label>
                <input
                  className="tp-input"
                  type="text"
                  value={m.dosage}
                  onChange={(e) => {
                    const meds = [...(form.medicines || [])];
                    meds[idx] = { ...meds[idx], dosage: e.target.value };
                    onChange({ medicines: meds });
                  }}
                  placeholder="e.g., 500 mg twice daily"
                />
              </div>
              <div className="tp-field">
                <label className="tp-label">Instructions</label>
                <textarea
                  className="tp-textarea"
                  rows={3}
                  value={m.instructions || ''}
                  onChange={(e) => {
                    const meds = [...(form.medicines || [])];
                    meds[idx] = { ...meds[idx], instructions: e.target.value };
                    onChange({ medicines: meds });
                  }}
                  placeholder="Optional instructions"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                {idx > 0 && (
                  <button
                    className="tp-btn tp-btn--secondary"
                    type="button"
                    onClick={() => {
                      const meds = [...(form.medicines || [])];
                      meds.splice(idx, 1);
                      onChange({ medicines: meds });
                    }}
                  >
                    Remove
                  </button>
                )}
                {idx === (form.medicines?.length || 1) - 1 && (
                  <button
                    className="tp-btn tp-btn--primary"
                    type="button"
                    onClick={() => onChange({ medicines: [...(form.medicines || []), { name: "", dosage: "", instructions: "" }] })}
                  >
                    + Add Medicine
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="tp-modal-footer">
          <button 
            className="tp-btn tp-btn--primary" 
            onClick={onCreate} 
            disabled={saving}
          >
            {saving ? 'Adding...' : 'Add Prescription'}
          </button>
          <button className="tp-btn tp-btn--secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function CreatePlanModal({ 
  dentistCode, 
  loadingPatients, 
  patientOptions, 
  form, 
  onChange, 
  onClose, 
  onCreate, 
  saving 
}) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="tp-modal" role="dialog" aria-modal="true">
      <div className="tp-modal-backdrop" onClick={onClose} />
      <div className="tp-modal-content">
        <div className="tp-modal-header">
          <h3>Create Treatment Plan</h3>
          <button className="tp-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="tp-modal-body">
          <div className="tp-field">
            <label className="tp-label">Patient Name</label>
            <select
              className="tp-select"
              value={form.patientCode}
              onChange={(e) => onChange({ patientCode: e.target.value })}
            >
              <option value="">
                {loadingPatients ? 'Loading patients from today\'s queue...' : 
                 (patientOptions.length ? 'Select patient from today\'s queue...' : 'No patients in today\'s queue')}
              </option>
              {patientOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.name} ({o.code}){o.status ? ` - ${o.status}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="tp-field">
            <label className="tp-label">Diagnosis</label>
            <input
              className="tp-input"
              type="text"
              value={form.diagnosis}
              onChange={(e) => onChange({ diagnosis: e.target.value })}
              placeholder="Enter diagnosis"
            />
          </div>
          <div className="tp-field">
            <label className="tp-label">Treatment Notes</label>
            <textarea
              className="tp-textarea"
              rows={5}
              value={form.treatment_notes}
              onChange={(e) => onChange({ treatment_notes: e.target.value })}
              placeholder="Optional notes"
            />
          </div>

          {/* Selected Patient Queue Information */}
          {form.patientCode && (() => {
            const selectedPatient = patientOptions.find(p => p.code === form.patientCode);
            return selectedPatient ? (
              <div className="selected-patient-info">
                <div className="patient-info-card">
                  <h4 className="patient-info-title">Selected Patient Information</h4>
                  <div className="patient-info-grid">
                    <div className="patient-info-item">
                      <label>QUEUE NUMBER:</label>
                      <span className="queue-number">{selectedPatient.queueNo || 'N/A'}</span>
                    </div>
                    <div className="patient-info-item">
                      <label>APPOINTMENT TIME:</label>
                      <span className="appointment-time">
                        {selectedPatient.time ? 
                          new Date(selectedPatient.time).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: true 
                          }) : 'N/A'
                        }
                      </span>
                    </div>
                    <div className="patient-info-item">
                      <label>STATUS:</label>
                      <span className={`status-badge ${selectedPatient.status?.toLowerCase().replace('_', '-') || 'unknown'}`}>
                        {selectedPatient.status?.toUpperCase() || 'UNKNOWN'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null;
          })()}
        </div>

        <div className="tp-modal-footer">
          <button className="tp-btn tp-btn--primary" onClick={onCreate} disabled={saving}>
            {saving ? 'Creating...' : 'Create'}
          </button>
          <button className="tp-btn tp-btn--secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function HistoryModal({ loading, items, onClose, getPatientName }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Prepare diffs between consecutive versions per (patientCode, planCode)
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

  // Patient name resolution and search
  const [q, setQ] = useState('');
  const [nameMap, setNameMap] = useState(new Map());
  useEffect(() => {
    let alive = true;
    (async () => {
      const uniq = Array.from(new Set(items.map(it => it.patientCode).filter(Boolean)));
      const entries = await Promise.all(uniq.map(async code => {
        try {
          const n = await getPatientName(code);
          return [code, n];
        } catch {
          return [code, code];
        }
      }));
      if (alive) setNameMap(new Map(entries));
    })();
    return () => { alive = false; };
  }, [items, getPatientName]);

  const filtered = !q
    ? items
    : items.filter(it => {
        const name = nameMap.get(it.patientCode) || '';
        return name.toLowerCase().includes(q.toLowerCase());
      });

  return (
    <div className="tp-modal" role="dialog" aria-modal="true">
      <div className="tp-modal-backdrop" onClick={onClose} />
      <div className="tp-modal-content">
        <div className="tp-modal-header">
          <h3>Treatment Plan History</h3>
          <button className="tp-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="tp-modal-body">
          <div className="tp-field" style={{ marginBottom: 12 }}>
            <input
              className="tp-input"
              placeholder="Search by patient name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {loading ? (
            <div className="tp-loading">Loading history...</div>
          ) : items.length === 0 ? (
            <div className="tp-empty">No history found.</div>
          ) : (
            <table className="tp-table">
              <thead>
                <tr>
                  <th>Patient Name</th>
                  <th>Patient Code</th>
                  <th>Plan Code</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>At</th>
                  <th>Changes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={`${it._id}`}>
                    <td>{nameMap.get(it.patientCode) || it.patientCode}</td>
                    <td>{it.patientCode}</td>
                    <td>{it.planCode}</td>
                    <td>{it.version}</td>
                    <td>{(() => {
                      const snap = it.snapshot || {};
                      // Determine status from snapshot
                      const inactive = snap.isDeleted === true || (snap.status && String(snap.status).toLowerCase() !== 'active');
                      return inactive ? 'Inactive' : 'Available';
                    })()}</td>
                    <td>{(() => {
                      const d = it.changedAt || it.createdAt || it.updatedAt;
                      try { 
                        return d ? new Date(d).toLocaleString() : '-'; 
                      } catch { 
                        return '-'; 
                      }
                    })()}</td>
                    <td>{formatChanges(it)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="tp-modal-footer">
          <button className="tp-btn tp-btn--secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function ReportModal({ data, onClose }) {
  if (!data) return null;

  const { plan, prescriptions, patientName, patientAge, patientDOB, dentistName, prescriptionCode, patientAllergies } = data;

  // Compute age from DOB at the moment of report rendering
  const computeAgeFromDOB = (dobInput) => {
    if (!dobInput) return null;

    const parseDOB = (val) => {
      if (!val) return null;
      if (val instanceof Date) return isNaN(val) ? null : val;
      if (typeof val === 'number') {
        const d = new Date(val);
        return isNaN(d) ? null : d;
      }
      if (typeof val === 'string') {
        const s = val.trim();
        if (!s) return null;
        // Try ISO or RFC formats directly
        let d = new Date(s);
        if (!isNaN(d)) return d;
        // Try YYYY-MM-DD explicitly to avoid TZ issues
        const iso = /^\d{4}-\d{2}-\d{2}$/;
        if (iso.test(s)) {
          const [y, m, day] = s.split('-').map(Number);
          d = new Date(Date.UTC(y, m - 1, day));
          if (!isNaN(d)) return d;
        }
        // Try DD/MM/YYYY or MM/DD/YYYY (heuristic: if first token > 12, treat as DD/MM/YYYY)
        const slash = s.split('/');
        if (slash.length === 3) {
          const a = slash.map((t) => parseInt(t, 10));
          const [p1, p2, p3] = a;
          if (p3 >= 1000) {
            const dayFirst = p1 > 12; // if day > 12, assume DD/MM/YYYY
            const y = p3;
            const m = dayFirst ? p2 : p1;
            const day = dayFirst ? p1 : p2;
            d = new Date(Date.UTC(y, m - 1, day));
            if (!isNaN(d)) return d;
          }
        }
        return null;
      }
      return null;
    };

    const dob = parseDOB(dobInput);
    if (!dob) return null;

    const today = new Date();
    
    // Check if DOB is in the future (likely a data entry error)
    if (dob > today) {
      console.warn(`DOB ${dobInput} is in the future, treating as data entry error`);
      return null;
    }
    
    // Use UTC components to avoid timezone edge cases around midnight
    let age = today.getUTCFullYear() - dob.getUTCFullYear();
    const m = today.getUTCMonth() - dob.getUTCMonth();
    if (m < 0 || (m === 0 && today.getUTCDate() < dob.getUTCDate())) {
      age--;
    }
    
    // Return age only if it's reasonable (between 0 and 150)
    return (age >= 0 && age <= 150) ? age : null;
  };

  const ageDisplay = (() => {
    console.debug('Age calculation debug:', {
      patientDOB,
      patientAge,
      dobType: typeof patientDOB
    });
    
    // Always try to calculate from DOB first
    const calculatedAge = computeAgeFromDOB(patientDOB);
    console.debug('Calculated age from DOB:', calculatedAge);
    
    if (calculatedAge !== null && calculatedAge !== undefined) {
      return String(calculatedAge);
    }
    
    // If DOB calculation failed but we have a DOB, it's likely invalid
    if (patientDOB) {
      // Check if DOB is in the future (common data entry error)
      const dobDate = new Date(patientDOB);
      if (dobDate > new Date()) {
        console.debug('DOB is in the future:', dobDate, 'vs today:', new Date());
        return "Future DOB";
      }
      return "Invalid DOB";
    }
    
    // Only use patientAge if no DOB is available
    if (patientAge && patientAge !== "" && patientAge !== "0") {
      return String(patientAge);
    }
    
    return "N/A";
  })();

  const handlePrint = () => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    // Generate the HTML content for printing
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Treatment Report - ${patientName}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              line-height: 1.6;
              color: #333;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              margin: 0;
              color: #2c5aa0;
            }
            .header p {
              margin: 5px 0;
              color: #666;
            }
            .section {
              margin-bottom: 25px;
              padding: 15px;
              border: 1px solid #ddd;
              border-radius: 5px;
            }
            .section h2 {
              margin-top: 0;
              color: #2c5aa0;
              border-bottom: 1px solid #eee;
              padding-bottom: 10px;
            }
            .info-row {
              display: flex;
              margin-bottom: 8px;
            }
            .info-label {
              font-weight: bold;
              min-width: 150px;
              color: #555;
            }
            .info-value {
              flex: 1;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 12px;
              text-align: left;
            }
            th {
              background-color: #f5f5f5;
              font-weight: bold;
              color: #333;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              text-align: center;
              color: #666;
            }
            .signature-section {
              margin-top: 50px;
              display: flex;
              justify-content: space-between;
            }
            .signature-box {
              text-align: center;
              width: 200px;
            }
            .signature-line {
              border-top: 1px solid #333;
              margin-top: 40px;
              padding-top: 5px;
            }
            @media print {
              body { margin: 0; }
              .section { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DENTAL TREATMENT REPORT</h1>
            <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
          </div>

          <div class="section">
            <h2>Patient Information</h2>
            <div class="info-row">
              <div class="info-label">Patient Name:</div>
              <div class="info-value">${patientName || "N/A"}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Patient Code:</div>
              <div class="info-value">${plan?.patientCode || "N/A"}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Age:</div>
              <div class="info-value">${ageDisplay}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Allergies:</div>
              <div class="info-value">${patientAllergies ? String(patientAllergies) : "None reported"}</div>
            </div>
          </div>

          <div class="section">
            <h2>Treatment Plan Details</h2>
            <div class="info-row">
              <div class="info-label">Plan Code:</div>
              <div class="info-value">${plan?.planCode || "N/A"}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Diagnosis:</div>
              <div class="info-value">${plan?.diagnosis || "N/A"}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Treatment Notes:</div>
              <div class="info-value">${plan?.treatment_notes || "N/A"}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Created Date:</div>
              <div class="info-value">${plan?.created_date ? new Date(plan.created_date).toLocaleDateString() : "N/A"}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Version:</div>
              <div class="info-value">${plan?.version || "1"}</div>
            </div>
          </div>

          <div class="section">
            <h2>Prescribed Medications</h2>
            ${prescriptionCode ? `<div class="info-row"><div class="info-label">Prescription Code:</div><div class="info-value">${prescriptionCode}</div></div>` : ''}
            ${prescriptions.length === 0 ? 
              '<p><em>No prescriptions have been added to this treatment plan.</em></p>' : 
              `<table>
                <thead>
                  <tr>
                    <th>Medicine Name</th>
                    <th>Dosage</th>
                    <th>Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  ${prescriptions.map(rx => `
                    <tr>
                      <td>${rx.name || "N/A"}</td>
                      <td>${rx.dosage || "N/A"}</td>
                      <td>${rx.instructions || "No specific instructions"}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>`
            }
          </div>

          <div class="section">
            <h2>Healthcare Provider Information</h2>
            <div class="info-row">
              <div class="info-label">Attending Dentist:</div>
              <div class="info-value">${dentistName || "N/A"}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Dentist Code:</div>
              <div class="info-value">${plan?.dentistCode || "N/A"}</div>
            </div>
          </div>

          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-line">Patient Signature</div>
            </div>
            <div class="signature-box">
              <div class="signature-line">Doctor Signature</div>
            </div>
          </div>

          <div class="footer">
            <p>This is an official medical document. Please keep it for your records.</p>
            <p><small>Report ID: ${plan?.planCode}-${Date.now()}</small></p>
          </div>
        </body>
      </html>
    `;

    // Write content to the new window and print
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load, then print
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  };

  return (
    <div className="tp-modal" role="dialog" aria-modal="true">
      <div className="tp-modal-backdrop" onClick={onClose} />
      <div className="tp-modal-content">
        <div className="tp-modal-header">
          <h3>Treatment Report</h3>
          <button className="tp-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="tp-modal-body">
          <div className="report-section">
            <h4>Patient Information</h4>
            <div className="report-info">
              <p><strong>Name:</strong> {patientName || "N/A"}</p>
              <p><strong>Age:</strong> {ageDisplay}</p>
              <p><strong>Allergies:</strong> {patientAllergies ? String(patientAllergies) : "None reported"}</p>
              <p><strong>Patient Code:</strong> {plan?.patientCode}</p>
            </div>
          </div>

          <div className="report-section">
            <h4>Treatment Plan</h4>
            <div className="report-info">
              <p><strong>Plan Code:</strong> {plan?.planCode}</p>
              <p><strong>Diagnosis:</strong> {plan?.diagnosis || "N/A"}</p>
              <p><strong>Treatment Notes:</strong> {plan?.treatment_notes || "N/A"}</p>
              <p><strong>Created Date:</strong> {plan?.created_date ? new Date(plan.created_date).toLocaleDateString() : "N/A"}</p>
            </div>
          </div>

          <div className="report-section">
            <h4>Prescriptions</h4>
            {prescriptionCode ? (
              <p><strong>Prescription Code:</strong> {prescriptionCode}</p>
            ) : null}
            {prescriptions.length === 0 ? (
              <p>No prescriptions added.</p>
            ) : (
              <table className="tp-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Dosage</th>
                    <th>Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptions.map((rx, idx) => (
                    <tr key={idx}>
                      <td>{rx.name || "N/A"}</td>
                      <td>{rx.dosage || "N/A"}</td>
                      <td>{rx.instructions || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="report-footer">
            <p><strong>Doctor:</strong> {dentistName || "N/A"}</p>
            <p><strong>Report Generated:</strong> {new Date().toLocaleString()}</p>
          </div>
        </div>

        <div className="tp-modal-footer">
          <button className="tp-btn tp-btn--secondary" onClick={onClose}>Close</button>
          <button className="tp-btn tp-btn--primary" onClick={handlePrint}>Print Report</button>
        </div>
      </div>
    </div>
  );
}