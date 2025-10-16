import React, { useEffect, useMemo, useState } from "react";
import "./receptionistappointments.css";
import { useAuth } from "../../Contexts/AuthContext";

const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

function yyyymmdd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function jsonFetch(url, token, opts = {}) {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...opts,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMessage = errorData.message || errorData.error || `HTTP ${res.status}`;
    throw new Error(`HTTP ${res.status}: ${errorMessage}`);
  }
  return res.json();
}
function groupByDoctor(items = []) {
  const map = new Map();
  items.forEach((item) => {
    const key = item.dentist_code || "Unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return Array.from(map.entries()).map(([dentist, list]) => ({
    dentist,
    list,
  }));
}

function formatTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const ACCOUNT_FORM_INIT = {
  name: "",
  email: "",
  phone: "",
  nic: "",
  dob: "",
  gender: "Male",
  address: "",
  allergies: "",
  password: "",
  confirmPassword: "",
};

const WALKIN_FORM_INIT = {
  name: "",
  phone: "",
  email: "",
  age: "",
  identityNumber: "",
  notes: "",
};

const APPOINTMENT_INIT = {
  dentistCode: "",
  appointmentNumber: "",
  time: "",
  reason: "",
};

const isSlotSelectable = (s) => {
  const st = String(s?.status || "").toLowerCase();
  return (
    st === "" ||
    st === "bookable" ||
    st === "available" ||
    st === "free" ||
    st === "open"
    );
};

export default function ReceptionistAppointments() {
  const { token,user } = useAuth();
  const [date, setDate] = useState(yyyymmdd());
  const [dentistCodeFilter, setDentistCodeFilter] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [dentists, setDentists] = useState([]);
  const [loadingDentists, setLoadingDentists] = useState(false);
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);

  const [patientType, setPatientType] = useState("registered");
  const [unregisteredMode, setUnregisteredMode] = useState("account");

  const [registeredPatientCode, setRegisteredPatientCode] = useState("");
  const [accountForm, setAccountForm] = useState(() => ({ ...ACCOUNT_FORM_INIT }));
  const [walkInForm, setWalkInForm] = useState(() => ({ ...WALKIN_FORM_INIT }));
  const [appointmentFields, setAppointmentFields] = useState(() => ({ ...APPOINTMENT_INIT }));

  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsMeta, setSlotsMeta] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");

  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateTarget, setUpdateTarget] = useState(null);
  const [updateDate, setUpdateDate] = useState(yyyymmdd());
  const [updateDentistCode, setUpdateDentistCode] = useState("");
  const [updateSlots, setUpdateSlots] = useState([]);
  const [updateSlotLoading, setUpdateSlotLoading] = useState(false);
  const [updateSlotError, setUpdateSlotError] = useState("");
  const [updateSelectedSlot, setUpdateSelectedSlot] = useState("");

  const dayLabel = useMemo(() => new Date(date + "T00:00:00").toDateString(), [date]);
  const groupedAppointments = useMemo(() => groupByDoctor(items), [items]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const url = new URL(`${API_BASE}/receptionist/appointments`);
      url.searchParams.set("date", date);
      if (dentistCodeFilter) url.searchParams.set("dentistCode", dentistCodeFilter);
      url.searchParams.set("includePending", "true");
      const data = await jsonFetch(url.toString(), token);
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [date, dentistCodeFilter]);

  // Fetch dentists list
  const fetchDentists = async () => {
    try {
      setLoadingDentists(true);
      const response = await fetch(`${API_BASE}/dentists`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const dentistsList = data.dentists || data || [];
        setDentists(dentistsList);
      } else {
        console.warn('Failed to fetch dentists, status:', response.status);
      }
    } catch (error) {
      console.error('Error fetching dentists:', error);
    } finally {
      setLoadingDentists(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDentists();
      fetchPatients();
    }
  }, [token]);

  // Fetch patients list
  const fetchPatients = async () => {
    try {
      setLoadingPatients(true);
      const response = await fetch(`${API_BASE}/receptionist/patients?limit=200`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const patientsList = data.items || data || [];
        setPatients(patientsList);
      } else {
        console.warn('Failed to fetch patients, status:', response.status);
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoadingPatients(false);
    }
  };

  function resetForms() {
    setRegisteredPatientCode("");
    setAccountForm({ ...ACCOUNT_FORM_INIT });
    setWalkInForm({ ...WALKIN_FORM_INIT });
    setAppointmentFields({ ...APPOINTMENT_INIT });
    setAvailableSlots([]);
    setSlotsMeta(null);
    setSlotsError("");
    setSelectedSlot("");
    setSlotsLoading(false);
  }

   // --- Fetch slots for booking form ---
  useEffect(() => {
    const dentistCode = appointmentFields.dentistCode.trim();
    if (!dentistCode) {
      setAvailableSlots([]);
      setSlotsMeta(null);
      setSlotsError("");
      setSelectedSlot("");
      setSlotsLoading(false);
      if (appointmentFields.time) {
        setAppointmentFields((prev) => ({ ...prev, time: "" }));
      }
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError("");

    (async () => {
      try {
        const data = await jsonFetch(
          `${API_BASE}/receptionist/schedule/dentists/${encodeURIComponent(
            dentistCode
          )}/slots?date=${date}`,
          token
          );
        if (cancelled) return;

        const normalized = (data.slots || []).map((slot) => {
          const startIso =
            slot.start || slot.startIso || slot.start_time || slot.startISO;
          const value = String(startIso).slice(11, 16);
          const label = new Date(startIso).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          let status = (
            slot.status ||
            slot.state ||
            slot.availability ||
            ""
          ).toString().toLowerCase();
          if (!status) status = slot.isBooked ? "booked" : "free";
          return { value, label, status };
        });

        setAvailableSlots(normalized);
        setSlotsMeta({
          workingWindow: data.workingWindow,
          slotMinutes: data.slotMinutes,
        });

        const stillOk = normalized.find(
          (s) =>
            s.value === appointmentFields.time && isSlotSelectable(s)
          );
        if (stillOk) {
          setSelectedSlot(stillOk.value);
        } else {
          setSelectedSlot("");
          if (appointmentFields.time) {
            setAppointmentFields((prev) => ({ ...prev, time: "" }));
          }
        }
      } catch (err) {
        if (cancelled) return;
        setSlotsError(err?.message || "Failed to load slots");
        setAvailableSlots([]);
        setSlotsMeta(null);
        setSelectedSlot("");
        if (appointmentFields.time) {
          setAppointmentFields((prev) => ({ ...prev, time: "" }));
        }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appointmentFields.dentistCode, date]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Fetch slots for UPDATE modal ---
  useEffect(() => {
    if (!updateDentistCode) {
      setUpdateSlots([]);
      setUpdateSelectedSlot("");
      return;
    }
    let cancelled = false;
    setUpdateSlotLoading(true);
    setUpdateSlotError("");

    (async () => {
      try {
        const data = await jsonFetch(
          `${API_BASE}/receptionist/schedule/dentists/${encodeURIComponent(
            updateDentistCode
          )}/slots?date=${updateDate}`,
          token
          );
        if (cancelled) return;

        const normalized = (data.slots || []).map((slot) => {
          const startIso =
            slot.start || slot.startIso || slot.start_time || slot.startISO;
          const value = String(startIso).slice(11, 16);
          const label = new Date(startIso).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          let status = (slot.status || "").toLowerCase();
          if (!status) status = slot.isBooked ? "booked" : "free";
          return { value, label, status };
        });

        setUpdateSlots(normalized);

        const stillOk = normalized.find(
          (s) => s.value === updateSelectedSlot && isSlotSelectable(s)
          );
        if (!stillOk) setUpdateSelectedSlot("");
      } catch (err) {
        if (cancelled) return;
        setUpdateSlotError(err?.message || "Failed to load slots");
        setUpdateSlots([]);
        setUpdateSelectedSlot("");
      } finally {
        if (!cancelled) setUpdateSlotLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [updateDentistCode, updateDate, updateSelectedSlot]);

   // submit/confirm/cancel/update functions 

  async function submitRegistered(e) {
    e.preventDefault();
    try {
      setError("");
      setInfo("");
      const patientCode = registeredPatientCode.trim();
      const dentistCode = appointmentFields.dentistCode.trim();
      if (!patientCode) throw new Error("Patient code is required");
      if (!dentistCode) throw new Error("Dentist code is required");
      if (!appointmentFields.time)
        throw new Error("Please select an available slot");

      await jsonFetch(`${API_BASE}/receptionist/appointments`, token, {
        method: "POST",
        body: JSON.stringify({
          patientCode,
          dentistCode,
          date,
          time: appointmentFields.time,
          reason: appointmentFields.reason,
          confirmNow: true,
        }),
      });
      setInfo(`Appointment booked for ${patientCode}`);
      resetForms();
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

 async function submitAccountFlow(e) {
    e.preventDefault();
    try {
      setError("");
      setInfo("");
      
      // add phone validation 
      const phoneValue = accountForm.phone.trim();
      if (phoneValue && !/^\d{10}$/.test(phoneValue)) {
        setError("Phone number must be exactly 10 digits");
        return;
      }
      
      const dentistCode = appointmentFields.dentistCode.trim();
      if (!dentistCode) throw new Error("Dentist code is required");
      if (!appointmentFields.time)
        throw new Error("Please select an available slot");

      const passwordValue = accountForm.password.trim();
      const confirmValue = accountForm.confirmPassword.trim();
      if (passwordValue.length < 8)
        throw new Error("Password must be at least 8 characters");
      if (passwordValue !== confirmValue)
        throw new Error("Password confirmation does not match");

      const payload = {
        name: accountForm.name.trim(),
        email: accountForm.email.trim(),
        phone: accountForm.phone.trim(),
        nic: accountForm.nic.trim(),
        dob: accountForm.dob,
        gender: accountForm.gender,
        address: accountForm.address.trim(),
        allergies: accountForm.allergies.trim(),
        password: passwordValue,
        confirmPassword: confirmValue,
      };
      const patientRes = await jsonFetch(
        `${API_BASE}/receptionist/patients/register`,
        token,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
        );
      const newCode = patientRes?.patient?.patientCode;
      if (!newCode)
        throw new Error("Failed to get patient code after registration");

      await jsonFetch(`${API_BASE}/receptionist/appointments`, token, {
        method: "POST",
        body: JSON.stringify({
          patientCode: newCode,
          dentistCode,
          date,
          time: appointmentFields.time,
          reason: appointmentFields.reason,
          confirmNow: true,
        }),
      });

      setInfo(`Patient account created and appointment booked (${newCode})`);
      resetForms();
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function submitWalkIn(e) {
    e.preventDefault();
    try {
      setError("");
      setInfo("");
      
      // add phone validation for walk in form 
      const phoneValue = walkInForm.phone.trim();
      if (phoneValue && !/^\d{10}$/.test(phoneValue)) {
        setError("Phone number must be exactly 10 digits");
        return;
      }
      
      const dentistCode = appointmentFields.dentistCode.trim();
      if (!dentistCode) throw new Error("Dentist code is required");
      if (!appointmentFields.time)
        throw new Error("Please select an available slot");

      const unregisteredData = {
        name: walkInForm.name.trim(),
        phone: walkInForm.phone.trim(),
        email: walkInForm.email.trim(),
        age: walkInForm.age,
        identityNumber: walkInForm.identityNumber.trim(),
        notes: walkInForm.notes.trim(),
        receptionistCode: user?.receptionistCode,
      };
      
      console.log('Creating unregistered patient with data:', unregisteredData);
      console.log('Name:', unregisteredData.name, 'Phone:', unregisteredData.phone);
      console.log('Form validation - Name empty?', !unregisteredData.name);
      console.log('Form validation - Phone empty?', !unregisteredData.phone);
      console.log('Form validation - Email:', unregisteredData.email);
      console.log('Form validation - Age:', unregisteredData.age);
      console.log('Authentication token:', token ? 'Present' : 'Missing');
      console.log('Token length:', token ? token.length : 0);
      
      // Test authentication first
      try {
        const authTest = await jsonFetch(`${API_BASE}/auth/me`, token, { method: 'GET' });
        console.log('Auth test successful:', authTest);
        console.log('User role:', authTest.user?.role);
        console.log('User ID:', authTest.user?._id);
        console.log('Is receptionist?', authTest.user?.role === 'Receptionist');
        
        if (authTest.user?.role !== 'Receptionist') {
          throw new Error('You must be logged in as a receptionist to create unregistered patients.');
        }
      } catch (authError) {
        console.error('Auth test failed:', authError);
        throw new Error('Authentication failed. Please log in again.');
      }
      
      const unregisteredRes = await jsonFetch(
        `${API_BASE}/receptionist/unregistered-patients`,
        token,
        {
          method: "POST",
          body: JSON.stringify(unregisteredData),
        }
        );
      console.log('Unregistered patient response:', unregisteredRes);
      const patient = unregisteredRes?.unregisteredPatient;
      if (!patient?.unregisteredPatientCode)
        throw new Error("Failed to save unregistered patient");

      await jsonFetch(`${API_BASE}/receptionist/appointments`, token, {
        method: "POST",
        body: JSON.stringify({
          patientCode: patient.unregisteredPatientCode,
          patientType: "unregistered",
          patientSnapshot: {
            name: walkInForm.name.trim(),
            phone: walkInForm.phone.trim(),
            email: walkInForm.email.trim(),
            age: walkInForm.age,
            identityNumber: walkInForm.identityNumber.trim(),
          },
          dentistCode,
          date,
          time: appointmentFields.time,
          reason: appointmentFields.reason,
          confirmNow: true,
          receptionistCode: user?.receptionistCode,
        }),
      });

      setInfo(
        `Appointment booked for walk-in (${patient.unregisteredPatientCode})`
        );
      resetForms();
      await load();
    } catch (e) {
      console.error('Walk-in appointment error:', e);
      if (e.message.includes('400')) {
        setError(`Bad Request: ${e.message}. Please check that name and phone are filled in.`);
      } else {
        setError(e.message);
      }
    }
  }

  async function confirmAppointment(code) {
    try {
      await jsonFetch(
        `${API_BASE}/receptionist/appointments/${code}/confirm`,
        token,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
        );
      setInfo(`Confirmed ${code}`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function cancelAppointment(code) {
    const reason = window.prompt(`Cancel ${code}? Optional reason:`) || "";
    try {
      await jsonFetch(
        `${API_BASE}/receptionist/appointments/${code}/cancel`,
        token,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        }
        );
      setInfo(`Canceled ${code}`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  function handleSlotSelect(slot) {
    if (!isSlotSelectable(slot)) return;
    setSelectedSlot(slot.value);
    setAppointmentFields((prev) => ({ ...prev, time: slot.value }));
  }

 // --- UI part ---
  const appointmentForm = (
    <>
      <div className="field">
        <label>Dentist Code</label>
        <select
          value={appointmentFields.dentistCode}
          onChange={(e) =>
            setAppointmentFields((prev) => ({
              ...prev,
              dentistCode: e.target.value,
            }))
          }
          disabled={loadingDentists}
          required
        >
          <option value="">Select a dentist</option>
          {loadingDentists && <option disabled>Loading dentists...</option>}
          {!loadingDentists && dentists.map((dentist) => {
            const dentistName = dentist.userId?.name || dentist.name || 'Unknown';
            const dentistCode = dentist.dentistCode || dentist.code || dentist._id;
            const specialization = dentist.specialization || 'General';
            return (
              <option key={dentistCode} value={dentistCode}>
                {dentistName} - {dentistCode} ({specialization})
              </option>
            );
          })}
        </select>
      </div>

      {/* Appointment number now auto-generated and read-only */}
      <div className="field">
        <label>Appointment Number (Auto)</label>
        <input value="Auto-generated after booking" readOnly />
      </div>

      {/* --- Available Slots --- */}
      <div className="field">
        <label>Available Slots</label>
        <div className="slot-picker">
          {slotsLoading ? (
            <div className="slot-message">Loading…</div>
          ) : slotsError ? (
            <div className="slot-message error">{slotsError}</div>
          ) : !appointmentFields.dentistCode.trim() ? (
            <div className="slot-message">
              Enter a dentist code to view slots.
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="slot-message">
              No slots available for the selected date.
            </div>
          ) : (
            <>
              <div className="slot-grid">
                {availableSlots.map((slot) => {
                  const selectable = isSlotSelectable(slot);
                  return (
                    <button
                      key={slot.value}
                      type="button"
                      className={`slot-btn slot-${slot.status}${
                        selectedSlot === slot.value ? " slot-btn-selected" : ""
                      }`}
                      onClick={() => handleSlotSelect(slot)}
                      disabled={!selectable}
                      title={selectable ? "Click to select" : "Not available"}
                    >
                      {slot.label}
                    </button>
                    );
                })}
              </div>
              {!availableSlots.some((s) => isSlotSelectable(s)) && (
                <div className="slot-message">
                  All slots are booked for this date.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* --- Reason --- */}
      <div className="field">
        <label>Reason</label>
        <textarea
          value={appointmentFields.reason}
          onChange={(e) =>
            setAppointmentFields((prev) => ({
              ...prev,
              reason: e.target.value,
            }))
          }
        />
      </div>
    </>
    );

  // --- Update Appointment Modal UI ---
  const updateModal = updateModalOpen && updateTarget ? (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Update Appointment {updateTarget.appointmentCode}</h2>

        <div className="field">
          <label>Dentist Code</label>
          <input
            value={updateDentistCode}
            onChange={(e) => setUpdateDentistCode(e.target.value)}
            placeholder="Dr-0001"
            required
          />
        </div>

        <div className="field">
          <label>Date</label>
          <input
            type="date"
            value={updateDate}
            onChange={(e) => setUpdateDate(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label>Available Slots</label>
          <div className="slot-picker">
            {updateSlotLoading ? (
              <div className="slot-message">Loading…</div>
            ) : updateSlotError ? (
              <div className="slot-message error">{updateSlotError}</div>
            ) : !updateDentistCode.trim() ? (
              <div className="slot-message">
                Enter a dentist code to view slots.
              </div>
            ) : updateSlots.length === 0 ? (
              <div className="slot-message">
                No slots available for the selected date.
              </div>
            ) : (
              <div className="slot-grid">
                {updateSlots.map((slot) => {
                  const selectable = isSlotSelectable(slot);
                  return (
                    <button
                      key={slot.value}
                      type="button"
                      className={`slot-btn slot-${slot.status}${
                        updateSelectedSlot === slot.value
                          ? " slot-btn-selected"
                          : ""
                      }`}
                      onClick={() => setUpdateSelectedSlot(slot.value)}
                      disabled={!selectable}
                      title={selectable ? "Click to select" : "Not available"}
                    >
                      {slot.label}
                    </button>
                    );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="actions right">
          <button
            className="btn secondary"
            onClick={() => {
              setUpdateModalOpen(false);
              setUpdateTarget(null);
            }}
          >
            Cancel
          </button>
          <button
            className="btn"
            onClick={async () => {
              try {
                await jsonFetch(
                  `${API_BASE}/receptionist/appointments/${updateTarget.appointmentCode}/reschedule`,
                  token,
                  {
                    method: "PATCH",
                    body: JSON.stringify({
                      newDate: updateDate,
                      newTime: updateSelectedSlot,
                      newDentistCode: updateDentistCode,
                      reason: updateTarget.reason,
                    }),
                  }
                  );
                setInfo(
                  `Updated ${updateTarget.appointmentCode} to ${updateDate} ${updateSelectedSlot}`
                  );
                setUpdateModalOpen(false);
                setUpdateTarget(null);
                await load();
              } catch (e) {
                setError(e.message);
              }
            }}
            disabled={!updateDentistCode || !updateDate || !updateSelectedSlot}
          >
            Save Update
          </button>
        </div>
      </div>
    </div>
  ) : null;

    return (
      <div className="appt-main">
        <div className="appt-page">
          <header className="page-header">
            <div>
              <h1>Appointment Management</h1>
              <p className="sub">
                Create, confirm, reschedule &amp; cancel appointments
              </p>
            </div>
            <div className="date-filter">
              <div className="field">
                <label>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Dentist Filter</label>
                <select
                  value={dentistCodeFilter}
                  onChange={(e) => setDentistCodeFilter(e.target.value)}
                  disabled={loadingDentists}
                >
                  <option value="">Select a dentist</option>
                  {loadingDentists && <option disabled>Loading dentists...</option>}
                  {!loadingDentists && dentists.map((dentist) => {
                    const dentistName = dentist.userId?.name || dentist.name || 'Unknown';
                    const dentistCode = dentist.dentistCode || dentist.code || dentist._id;
                    const specialization = dentist.specialization || 'General';
                    return (
                      <option key={dentistCode} value={dentistCode}>
                        {dentistName} - {dentistCode} ({specialization})
                      </option>
                    );
                  })}
                </select>
              </div>
              <button className="btn ghost" onClick={load}>
                Refresh
              </button>
            </div>
          </header>

          <div className="patient-switch">
            <label>
              <input
                type="radio"
                value="registered"
                checked={patientType === "registered"}
                onChange={() => setPatientType("registered")}
              />
              Registered patient
            </label>
            <label>
              <input
                type="radio"
                value="unregistered"
                checked={patientType === "unregistered"}
                onChange={() => setPatientType("unregistered")}
              />
              Unregistered patient
            </label>
          </div>

          {patientType === "unregistered" && (
            <div className="patient-switch">
              <label>
                <input
                  type="radio"
                  value="account"
                  checked={unregisteredMode === "account"}
                  onChange={() => setUnregisteredMode("account")}
                />
                Create account then book
              </label>
              <label>
                <input
                  type="radio"
                  value="walkin"
                  checked={unregisteredMode === "walkin"}
                  onChange={() => setUnregisteredMode("walkin")}
                />
                Book without account
              </label>
            </div>
          )}

          {error && <div className="alert error">{error}</div>}
          {info && <div className="alert ok">{info}</div>}

          <section className="grid">
            <div className="card">
              {/* Registered form */}
              {patientType === "registered" && (
                <>
                  <h2>Book for Registered Patient</h2>
                  <form className="form" onSubmit={submitRegistered}>
                    <div className="field">
                      <label>Patient Code</label>
                      <select
                        value={registeredPatientCode}
                        onChange={(e) => setRegisteredPatientCode(e.target.value)}
                        disabled={loadingPatients}
                      >
                        <option value="">Select a patient</option>
                        {loadingPatients && <option disabled>Loading patients...</option>}
                        {!loadingPatients && patients.map((patient) => {
                          const patientName = patient.name || patient.userId?.name || 'Unknown';
                          const patientCode = patient.patientCode || patient.code || patient._id;
                          return (
                            <option key={patientCode} value={patientCode}>
                              {patientName} - {patientCode}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    {appointmentForm}
                    <button type="submit" className="btn">
                      Book Appointment
                    </button>
                  </form>
                </>
              )}

                            {/* Unregistered with account */}
              {patientType === "unregistered" &&
                unregisteredMode === "account" && (
                  <>
                    <h2>Create Account &amp; Book</h2>
                    <form className="form" onSubmit={submitAccountFlow}>
                      <div className="field"><label>Name</label>
                        <input
                          value={accountForm.name}
                          onChange={(e) =>
                            setAccountForm({ ...accountForm, name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="field"><label>Email</label>
                        <input
                          type="email"
                          value={accountForm.email}
                          onChange={(e) =>
                            setAccountForm({ ...accountForm, email: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="field"><label>Phone</label>
                        <input
                          value={accountForm.phone}
                          onChange={(e) =>
                            setAccountForm({ ...accountForm, phone: e.target.value })
                          }
                          required
                          maxLength="10"
                          pattern="\d{10}"
                          title="Phone number must be exactly 10 digits"
                        />
                      </div>
                      <div className="field"><label>NIC</label>
                        <input
                          value={accountForm.nic}
                          onChange={(e) =>
                            setAccountForm({ ...accountForm, nic: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="field"><label>Date of Birth</label>
                        <input
                          type="date"
                          value={accountForm.dob}
                          onChange={(e) =>
                            setAccountForm({ ...accountForm, dob: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="field"><label>Gender</label>
                        <select
                          value={accountForm.gender}
                          onChange={(e) =>
                            setAccountForm({ ...accountForm, gender: e.target.value })
                          }
                        >
                          <option>Male</option>
                          <option>Female</option>
                          <option>Other</option>
                        </select>
                      </div>
                      <div className="field"><label>Address</label>
                        <input
                          value={accountForm.address}
                          onChange={(e) =>
                            setAccountForm({ ...accountForm, address: e.target.value })
                          }
                        />
                      </div>
                      <div className="field"><label>Allergies</label>
                        <input
                          value={accountForm.allergies}
                          onChange={(e) =>
                            setAccountForm({ ...accountForm, allergies: e.target.value })
                          }
                        />
                      </div>
                      <div className="field"><label>Password</label>
                        <input
                          type="password"
                          value={accountForm.password}
                          onChange={(e) =>
                            setAccountForm({ ...accountForm, password: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="field"><label>Confirm Password</label>
                        <input
                          type="password"
                          value={accountForm.confirmPassword}
                          onChange={(e) =>
                            setAccountForm({
                              ...accountForm,
                              confirmPassword: e.target.value,
                            })
                          }
                          required
                        />
                      </div>

                      <div className="divider" />
                      {appointmentForm}
                      <button type="submit" className="btn">
                        Create account &amp; book
                      </button>
                    </form>
                  </>
                )}

          {/* Walk-in */}
              {patientType === "unregistered" &&
                unregisteredMode === "walkin" && (
                  <>
                    <h2>Walk-in Appointment</h2>
                    <form className="form" onSubmit={submitWalkIn}>
                      <div className="field"><label>Name</label>
                        <input
                          value={walkInForm.name}
                          onChange={(e) =>
                            setWalkInForm({ ...walkInForm, name: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="field"><label>Phone</label>
                        <input
                          value={walkInForm.phone}
                          onChange={(e) =>
                            setWalkInForm({ ...walkInForm, phone: e.target.value })
                          }
                          required
                          maxLength="10"
                          pattern="\d{10}"
                          title="Phone number must be exactly 10 digits"
                        />
                      </div>
                      <div className="field"><label>Email</label>
                        <input
                          type="email"
                          value={walkInForm.email}
                          onChange={(e) =>
                            setWalkInForm({ ...walkInForm, email: e.target.value })
                          }
                        />
                      </div>
                      <div className="field"><label>Age</label>
                        <input
                          type="number"
                          value={walkInForm.age}
                          onChange={(e) =>
                            setWalkInForm({ ...walkInForm, age: e.target.value })
                          }
                        />
                      </div>
                      <div className="field"><label>Identity Number</label>
                        <input
                          value={walkInForm.identityNumber}
                          onChange={(e) =>
                            setWalkInForm({
                              ...walkInForm,
                              identityNumber: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="field"><label>Notes</label>
                        <textarea
                          value={walkInForm.notes}
                          onChange={(e) =>
                            setWalkInForm({ ...walkInForm, notes: e.target.value })
                          }
                        />
                      </div>

                      <div className="divider" />
                      {appointmentForm}
                      <button type="submit" className="btn">
                        Register details &amp; book
                      </button>
                    </form>
                  </>
                )}
            </div>

            <div className="card">
              <h2>
                Appointments - <span className="muted">{dayLabel}</span>
              </h2>
              <div className="table-wrap">
                {loading ? (
                  <div className="alert muted">Loading…</div>
                ) : groupedAppointments.length === 0 ? (
                  <div className="alert muted">No appointments</div>
                ) : (
                  groupedAppointments.map(({ dentist, list }) => {
                    // Get dentist name from the first appointment in the list
                    const dentistName = list[0]?.dentistName || 'Unknown';
                    return (
                    <div key={dentist} className="doctor-block">
                      <h3 className="doctor-title">{dentistName} - {dentist}</h3>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Appointment</th>
                            <th>Patient</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Created By</th>
                            <th>Accepted By</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((a) => (
                            <tr key={a.appointmentCode}>
                              <td>{formatTime(a.appointment_date)}</td>
                              <td className="mono">{a.appointmentCode}</td>
                              <td>
                                {a.patientType === "unregistered"
                                  ? a.patientSnapshot?.name || a.patient_code
                                  : `${a.patientName || 'Unknown'} - ${a.patient_code}`}
                              </td>
                              <td>{a.patientType || "registered"}</td>
                              <td>
                                <span
                                  className={`pill ${
                                    a.status === "confirmed"
                                      ? "success"
                                      : a.status === "pending"
                                      ? "warn"
                                      : a.status === "completed"
                                      ? "info"
                                      : "danger"
                                  }`}
                                >
                                  {a.status}
                                </span>
                              </td>
                              <td>{a.createdByCode || "-"}</td>
                              <td>{a.acceptedByCode || "-"}</td>
                              <td className="actions">
                                {a.status === "pending" && (
                                  <button
                                    className="btn small"
                                    onClick={() =>
                                      confirmAppointment(a.appointmentCode)
                                    }
                                  >
                                    Confirm
                                  </button>
                                )}
                                <button
                                  className="btn dark small"
                                  onClick={() => {
                                    setUpdateTarget(a);
                                    setUpdateDate(
                                      a.appointment_date
                                        .toString()
                                        .slice(0, 10)
                                      );
                                    setUpdateDentistCode(a.dentist_code);
                                    setUpdateSelectedSlot("");
                                    setUpdateModalOpen(true);
                                  }}
                                >
                                  Update
                                </button>
                                <button
                                  className="btn danger small"
                                  onClick={() =>
                                    cancelAppointment(a.appointmentCode)
                                  }
                                >
                                  Cancel
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </div>
        {updateModal}
      </div>
    );
}







