import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Contexts/AuthContext";
import {
  Calendar,
  Clock,
  Shield,
  CheckCircle,
  Search,
  Stethoscope,
  Star,
  Award,
  Users,
  AlertCircle,
} from "lucide-react";
import { validateOTP } from "../../utils/validation";

const apiBase = "http://localhost:5000";
const SLOT_INTERVAL_MINUTES = 30;
const WORK_START_MINUTES = 9 * 60;
const WORK_END_MINUTES = 18 * 60;

/* ---------------- helpers ---------------- */
function toMinutesFromHHMM(value) {
  if (!value || value === "all") return null;
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}
function formatMinutesToHHMM(minutes) {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}
function addMinutesToDate(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}
function getSlotIso(slot) {
  if (!slot) return "";
  if (typeof slot === "string") return slot;
  if (typeof slot === "object" && slot.iso) return slot.iso;
  return "";
}
function buildSlotLabels(slot, fallbackDuration) {
  const iso = getSlotIso(slot);
  if (!iso) return { timeLabel: "Unavailable", dateLabel: "" };
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return { timeLabel: "Unavailable", dateLabel: "" };
  
  // Use the displayTime from backend if available (it's already in correct format)
  if (slot.displayTime) {
    const startTime = slot.displayTime;
    const endTime = addMinutesToTimeString(startTime, fallbackDuration);
    return {
      timeLabel: `${startTime} - ${endTime}`,
      dateLabel: start.toLocaleDateString(),
    };
  }
  
  // Fallback to original logic
  const end = addMinutesToDate(start, fallbackDuration);
  return {
    timeLabel: `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`,
    dateLabel: start.toLocaleDateString(),
  };
}

// Helper function to add minutes to a time string (HH:MM format)
function addMinutesToTimeString(timeString, minutes) {
  const [hours, mins] = timeString.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60);
  const newMins = totalMinutes % 60;
  return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
}
function dedupeSlots(slots) {
  const seen = new Set();
  return slots.filter((s) => {
    const key = `${s.doctorId || s.doctorCode}-${getSlotIso(s)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function getDoctorDisplayName(doc, index = 0) {
  if (!doc) return "Doctor";
  return (
    doc.displayName ||
    doc.name ||
    doc.fullName ||
    doc.user?.name ||
    doc.userId?.name ||
    (doc.specialization ? `Dr. ${doc.specialization}` : (doc.dentistCode || `Doctor ${index + 1}`))
  );
}
function normalizeDoctorList(list) {
  return list.map((doc, index) => ({
    ...doc,
    displayName: getDoctorDisplayName(doc, index),
  }));
}

/* ---- exact-minute key helper (for exact-time collision) ---- */
function minuteKey(d) {
  const dt = new Date(d);
  return [
    dt.getFullYear(),
    dt.getMonth(),
    dt.getDate(),
    dt.getHours(),
    dt.getMinutes(),
  ].join("-");
}

/* ---- ranges + "booked" helpers ---- */
function parseBlockToRange(block) {
  // Accepts various shapes and returns {start: Date, end: Date}
  if (!block) return null;

  const startIso =
    block.startIso ||
    block.start ||
    block.iso ||
    (typeof block === "string" ? block : null);

  const start = startIso ? new Date(startIso) : null;
  if (!start || Number.isNaN(start.getTime())) return null;

  let end = null;
  if (block.end) {
    end = new Date(block.end);
  } else {
    const dur = Number(block.durationMinutes || block.duration || 30);
    end = addMinutesToDate(start, dur);
  }

  if (Number.isNaN(end.getTime())) return null;
  return { start, end };
}
function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}
function isEntryBookedLike(entry) {
  const status = (entry.status || "").toLowerCase();
  return (
    entry.booked === true ||
    entry.isBooked === true ||
    entry.available === false ||
    status === "booked" ||
    status === "confirmed" ||
    status === "reserved" ||
    status === "blocked_event" ||
    status === "blocked_leave" ||
    status === "past" ||
    status === "unavailable" ||
    status === "no_show" ||
    status === "cancelled"
  );
}

/* ---- doctor loader helpers (probe multiple endpoints) ---- */
const DOCTOR_ENDPOINTS = [
  "/receptionist/dentists?q=&limit=200",
  "/receptionist/dentists",
  "/dentists?limit=200",
  "/dentists",
  "/api/dentists",
  "/users?role=doctor",
  "/staff?type=dentist",
];

function normalizeDoctorRecord(d, index = 0) {
  const _id =
    d._id || d.id || d.userId?._id || d.user?._id || d.code || d.dentistCode || d.dentist_code;
  const name =
    d.displayName ||
    d.name ||
    d.fullName ||
    d.user?.name ||
    d.userId?.name ||
    (d.firstName || d.firstname
      ? `${d.firstName || d.firstname} ${d.lastName || d.lastname || ""}`.trim()
      : undefined);

  const specialization = d.specialization || d.title || d.role || d.department;
  const dentistCode = d.dentistCode || d.dentist_code || d.code;

  return {
    ...d,
    _id,
    displayName:
      name ||
      (specialization ? `Dr. ${specialization}` : dentistCode || `Doctor ${index + 1}`),
    dentistCode,
    specialization,
  };
}
function extractDoctorsFromResponse(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json?.dentists)) return json.dentists;
  if (Array.isArray(json?.data)) return json.data;
  if (json?.results && Array.isArray(json.results)) return json.results;
  return [];
}

/* ---------------- component ---------------- */
export default function BookAppointment() {
  const navigate = useNavigate();
  const { token, logout } = useAuth();

  // Check if user is authenticated
  const isAuthenticated = !!token;

  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [doctorError, setDoctorError] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [doctorSchedule, setDoctorSchedule] = useState(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [isDoctorOnLeave, setIsDoctorOnLeave] = useState(false);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("all");
  const [duration, setDuration] = useState(30);

  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpMeta, setOtpMeta] = useState(null);
  const [otpStatus, setOtpStatus] = useState("");
  const [otpError, setOtpError] = useState("");
  const [reason, setReason] = useState("");
  const [otpFieldError, setOtpFieldError] = useState("");

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedDoctorInfo, setSelectedDoctorInfo] = useState(null);
  const selectedDoctorDisplayName = selectedDoctorInfo ? getDoctorDisplayName(selectedDoctorInfo) : null;
  const selectedDoctorInitial = selectedDoctorDisplayName ? selectedDoctorDisplayName.charAt(0) : "D";

  // Guest booking information
  const [guestInfo, setGuestInfo] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    age: "",
    gender: ""
  });
  const [guestErrors, setGuestErrors] = useState({});
  const [bookingType, setBookingType] = useState(isAuthenticated ? "registered" : "guest");

  // "Book for someone else" state
  const [bookingForSomeoneElse, setBookingForSomeoneElse] = useState(false);
  const [otherPersonDetails, setOtherPersonDetails] = useState({
    name: "",
    contact: "",
    age: "",
    gender: "",
    relation: "",
    notes: ""
  });
  const [otherPersonErrors, setOtherPersonErrors] = useState({});

  /* ---- load doctors (probe multiple endpoints) ---- */
  const loadDoctors = async () => {
    setLoadingDoctors(true);
    setDoctorError("");
    try {
      console.log('=== LOADING DOCTORS ===');
      console.log('API Base:', apiBase);
      console.log('Token available:', !!token);
      
      // Headers for API calls - include token if available
      const headers = { 
        "Content-Type": "application/json" 
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      let found = null;
      for (const path of DOCTOR_ENDPOINTS) {
        const url = `${apiBase}${path}`;
        console.log('Trying endpoint:', url);
        try {
          const res = await fetch(url, { headers });
          console.log('Response status:', res.status);
          if (!res.ok) {
            console.log('Endpoint failed:', path, 'Status:', res.status);
            continue;
          }
          const json = await res.json().catch(() => ({}));
          console.log('Response data:', json);
          const raw = extractDoctorsFromResponse(json);
          console.log('Extracted doctors:', raw);
          if (raw.length) {
            found = raw.map((d, i) => normalizeDoctorRecord(d, i));
            console.log('Normalized doctors:', found);
            break;
          }
        } catch (error) {
          console.log('Endpoint error:', path, error);
          // try next endpoint
        }
      }

      if (!found || !found.length) {
        throw new Error(
          "Could not find a working doctors endpoint. Tried: " + DOCTOR_ENDPOINTS.join(", ")
        );
      }

      console.log('Final doctors list:', found);
      setDoctors(found);
      const firstId = found[0]._id || found[0].dentistCode;
      setDoctorId(firstId || "");
    } catch (e) {
      setDoctors([]);
      setDoctorId("");
      setDoctorError(e.message || "Failed to load doctors");
    } finally {
      setLoadingDoctors(false);
    }
  };

  useEffect(() => {
    loadDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- step state ---- */
  useEffect(() => {
    if (selectedSlot) setCurrentStep(3);
    else if (slots.length > 0) setCurrentStep(2);
    else setCurrentStep(1);
  }, [selectedSlot, slots]);

  /* ---- selected doctor info ---- */
  useEffect(() => {
    if (!doctorId) {
      setSelectedDoctorInfo(null);
      return;
    }
    const doctor =
      doctors.find((d) => d._id === doctorId) ||
      doctors.find((d) => d.id === doctorId) ||
      doctors.find((d) => d.dentistCode === doctorId) ||
      null;
    setSelectedDoctorInfo(doctor);
  }, [doctorId, doctors]);

  /* ---- duration/time sanity ---- */
  const handleDurationChange = (value) => {
    const minutes = Number(value);
    setDuration(minutes);
    if (time !== "all") {
      const selectedMinutes = toMinutesFromHHMM(time);
      if (selectedMinutes === null || selectedMinutes + minutes > WORK_END_MINUTES) {
        setTime("all");
      }
    }
  };

  /* ---- generate slots ---- */
  const generateSlots = (dateStr, timeStr, doctor) => {
    console.log('=== GENERATING SLOTS ===');
    console.log('Date:', dateStr);
    console.log('Time:', timeStr);
    console.log('Doctor:', doctor);
    
    const results = [];
    const doctorName = getDoctorDisplayName(doctor);
    const doctorIdentifier = doctor?._id || null;
    const doctorCode = doctor?.dentistCode || doctor?.dentist_code || doctorIdentifier;
    const durationMinutes = Number(duration) || SLOT_INTERVAL_MINUTES;
    const pushSlot = (startIso) => {
      results.push({ iso: startIso, duration: durationMinutes, doctorName, doctorId: doctorIdentifier, doctorCode });
    };

    // Get doctor's schedule for this day
    const dayName = getDayName(dateStr);
    const daySchedule = doctor?.availability_schedule?.[dayName];
    
    console.log('Day name:', dayName);
    console.log('Day schedule:', daySchedule);
    
    if (!daySchedule) {
      console.log('No schedule available for this day, using default times');
      // Fallback to default times if no schedule
      if (timeStr === "all") {
        let startMinutes = WORK_START_MINUTES;
        while (startMinutes + durationMinutes <= WORK_END_MINUTES) {
          const hhmm = formatMinutesToHHMM(startMinutes);
          const start = new Date(`${dateStr}T${hhmm}:00`);
          pushSlot(start.toISOString());
          startMinutes += SLOT_INTERVAL_MINUTES;
        }
      } else {
        const selectedMinutes = toMinutesFromHHMM(timeStr);
        if (selectedMinutes !== null && selectedMinutes + durationMinutes <= WORK_END_MINUTES) {
          const start = new Date(`${dateStr}T${timeStr}:00`);
          pushSlot(start.toISOString());
        }
      }
      return results;
    }

    // Handle both string and array formats for daySchedule
    let scheduleString = daySchedule;
    if (Array.isArray(daySchedule) && daySchedule.length > 0) {
      scheduleString = daySchedule[0]; // Take the first time slot if it's an array
    }
    
    console.log('Schedule string:', scheduleString);
    
    // Parse the time range for this day
    const timeRange = parseTimeRange(scheduleString);
    console.log('Parsed time range:', timeRange);
    
    if (!timeRange) {
      console.log('Could not parse time range, using default times');
      // Fallback to default times if parsing fails
      if (timeStr === "all") {
        let startMinutes = WORK_START_MINUTES;
        while (startMinutes + durationMinutes <= WORK_END_MINUTES) {
          const hhmm = formatMinutesToHHMM(startMinutes);
          const start = new Date(`${dateStr}T${hhmm}:00`);
          pushSlot(start.toISOString());
          startMinutes += SLOT_INTERVAL_MINUTES;
        }
      } else {
        const selectedMinutes = toMinutesFromHHMM(timeStr);
        if (selectedMinutes !== null && selectedMinutes + durationMinutes <= WORK_END_MINUTES) {
          const start = new Date(`${dateStr}T${timeStr}:00`);
          pushSlot(start.toISOString());
        }
      }
      return results;
    }

    // Generate slots based on doctor's actual schedule
    if (timeStr === "all") {
      // Generate all slots within the doctor's working hours
      let startMinutes = timeRange.start;
      while (startMinutes + durationMinutes <= timeRange.end) {
        const hhmm = formatMinutesToHHMM(startMinutes);
        const start = new Date(`${dateStr}T${hhmm}:00`);
        pushSlot(start.toISOString());
        startMinutes += SLOT_INTERVAL_MINUTES;
      }
    } else {
      // Generate slot for specific time if it's within doctor's schedule
      const selectedMinutes = toMinutesFromHHMM(timeStr);
      if (selectedMinutes !== null && 
          selectedMinutes >= timeRange.start && 
          selectedMinutes + durationMinutes <= timeRange.end) {
        const start = new Date(`${dateStr}T${timeStr}:00`);
        pushSlot(start.toISOString());
      }
    }
    
    console.log('Generated slots:', results);
    return results;
  };

  /* ---- fetch booked blocks (returns ranges + exact start minute keys) ---- */
  const fetchBookedBlocks = async (docId, day) => {
    // For guest users, return empty booked blocks (they can see all available slots)
    if (!token) {
      return { ranges: [], exactStartKeys: new Set() };
    }
    const headers = { 
      Authorization: `Bearer ${token}`, 
      "Content-Type": "application/json" 
    };

    const urls = [
      `${apiBase}/appointments/booked?doctorId=${encodeURIComponent(docId)}&date=${encodeURIComponent(day)}`,
      `${apiBase}/appointments/occupied?doctorId=${encodeURIComponent(docId)}&date=${encodeURIComponent(day)}`,
      `${apiBase}/appointments?doctorId=${encodeURIComponent(docId)}&date=${encodeURIComponent(day)}&status=confirmed`,
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, { headers });
        if (!res.ok) continue;
        const raw = await res.json().catch(() => []);
        const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
        if (!arr.length) continue;

        const ranges = [];
        const exactStartKeys = new Set();

        arr.forEach((block) => {
          const r = parseBlockToRange(block);
          if (!r) return;
          ranges.push(r);
          exactStartKeys.add(minuteKey(r.start));
        });

        if (ranges.length || exactStartKeys.size) return { ranges, exactStartKeys };
      } catch {
        // try next
      }
    }
    return { ranges: [], exactStartKeys: new Set() };
  };

  /* ---- filter out past & booked (exact-time collisions too) ---- */
  const filterUnavailable = (slotsArr, booked) => {
    const now = new Date();
    const ranges = booked?.ranges || [];
    const exactStartKeys = booked?.exactStartKeys || new Set();

    return slotsArr.filter((s) => {
      const iso = getSlotIso(s);
      if (!iso) return false;

      const start = new Date(iso);
      if (Number.isNaN(start.getTime())) return false;

      // Hide past times on the same day
      if (
        start < now &&
        start.getFullYear() === now.getFullYear() &&
        start.getMonth() === now.getMonth() &&
        start.getDate() === now.getDate()
      ) return false;

      // Server says it's booked/unavailable - enhanced filtering
      if (isEntryBookedLike(s)) return false;

      // Check for specific unavailable statuses
      const status = (s.status || "").toLowerCase();
      if (status === "blocked_event" || status === "blocked_leave" || 
          status === "no_show" || status === "cancelled") {
        return false;
      }

      // 🔒 exact start-time collision (your "This dentist is already booked for that exact time" case)
      if (exactStartKeys.has(minuteKey(start))) return false;

      // Range overlap backstop
      const dur = Number(s.duration) || Number(s.durationMinutes) || 30;
      const end = addMinutesToDate(start, dur);
      for (const br of ranges) {
        if (intervalsOverlap(start, end, br.start, br.end)) return false;
      }
      
      // Only show slots that are explicitly marked as available
      return status === "available" || status === "free" || status === "bookable" || 
             status === "open" || status === "";
    });
  };

  /* ---- fetch doctor schedule ---- */
  const fetchDoctorSchedule = async (dentistCode) => {
    if (!dentistCode) {
      setDoctorSchedule(null);
      setSelectedDoctor(null);
      setIsDoctorOnLeave(false);
      return;
    }

    setLoadingSchedule(true);
    try {
      // Fetch doctor details and schedule
      const response = await fetch(`${apiBase}/dentists/code/${dentistCode}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const doctor = data.dentist || data;
        
        setSelectedDoctor(doctor);
        setDoctorSchedule(doctor.availability_schedule || null);
        
        console.log('=== DOCTOR SCHEDULE DEBUG ===');
        console.log('Doctor data:', doctor);
        console.log('Doctor schedule loaded:', doctor.availability_schedule);
        console.log('Selected date:', date);
        console.log('Day name:', getDayName(date));
        console.log('Day schedule:', doctor.availability_schedule?.[getDayName(date)]);
      } else {
        console.error('Failed to fetch doctor schedule');
        setDoctorSchedule(null);
        setSelectedDoctor(null);
      }
    } catch (error) {
      console.error('Error fetching doctor schedule:', error);
      setDoctorSchedule(null);
      setSelectedDoctor(null);
    } finally {
      setLoadingSchedule(false);
    }
  };

  /* ---- check if doctor is on leave ---- */
  const checkDoctorLeave = async (dentistCode, checkDate) => {
    if (!dentistCode || !checkDate) {
      setIsDoctorOnLeave(false);
      return;
    }

    console.log('=== CHECKING DOCTOR LEAVE ===');
    console.log('Dentist Code:', dentistCode);
    console.log('Check Date:', checkDate);
    console.log('API URL:', `${apiBase}/leave/check-availability?dentistCode=${dentistCode}&date=${checkDate}`);

    try {
      const response = await fetch(`${apiBase}/leave/check-availability?dentistCode=${dentistCode}&date=${checkDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Leave check response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Leave check response data:', data);
        setIsDoctorOnLeave(data.isOnLeave || false);
        console.log('Doctor leave status set to:', data.isOnLeave || false);
      } else {
        const errorText = await response.text();
        console.error('Failed to check doctor leave status:', response.status, errorText);
        setIsDoctorOnLeave(false);
      }
    } catch (error) {
      console.error('Error checking doctor leave status:', error);
      setIsDoctorOnLeave(false);
    }
  };

  /* ---- fetch or build slots ---- */
  const searchSlots = async () => {
    if (!date || !doctorId || !time) return;
    setLoading(true);
    setSelectedSlot(null);

    try {
      const url = new URL(`${apiBase}/appointments/availability`);
      url.searchParams.set("doctorId", doctorId);
      url.searchParams.set("date", date);
      url.searchParams.set("duration", String(duration));
      if (time !== "all") url.searchParams.set("time", time);

      const res = await fetch(url.toString(), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json().catch(() => ({}));
      const avRaw = Array.isArray(data) ? data : data?.slots || [];
      
      console.log('🔍 Backend availability response:', {
        url: url.toString(),
        status: res.status,
        data: data,
        avRaw: avRaw,
        slotsCount: avRaw.length
      });

      let normalized = avRaw.map((entry) => {
        if (typeof entry === "object") {
          let slotDoctorId = entry.doctorId || entry.dentistId || entry.doctor?._id || entry.dentist?._id;
          const slotDoctorCode = entry.dentistCode || entry.doctorCode || entry.dentist_code;

          const doctorMatch =
            (slotDoctorId && doctors.find((d) => d._id === slotDoctorId)) ||
            (slotDoctorCode && doctors.find((d) => d.dentistCode === slotDoctorCode));

          if (doctorMatch && !slotDoctorId) slotDoctorId = doctorMatch._id;

          const doctorName =
            entry.doctorName || doctorMatch?.displayName || getDoctorDisplayName(entry.doctor || doctorMatch);

          return {
            ...entry,
            duration,
            doctorId: slotDoctorId,
            doctorCode: slotDoctorCode || doctorMatch?.dentistCode,
            doctorName,
          };
        }
        return { iso: entry, duration, doctorId };
      });

      // Backend now does comprehensive filtering, so trust its response
      // Only filter out past times (frontend-specific check)
      const beforeFilterCount = normalized.length;
      normalized = normalized.filter((s) => {
        const iso = getSlotIso(s);
        if (!iso) return false;
        const start = new Date(iso);
        if (Number.isNaN(start.getTime())) return false;
        
        // Only hide past times on the same day (backend doesn't handle this)
        const now = new Date();
        if (
          start < now &&
          start.getFullYear() === now.getFullYear() &&
          start.getMonth() === now.getMonth() &&
          start.getDate() === now.getDate()
        ) return false;
        
        return true;
      });
      
      console.log('🔍 Slot filtering results:', {
        beforeFilter: beforeFilterCount,
        afterFilter: normalized.length,
        finalSlots: normalized.map(s => ({
          time: getSlotIso(s),
          status: s.status,
          dentistCode: s.dentistCode
        }))
      });

      if (!normalized.length) {
        console.log('⚠️ Backend returned no slots - dentist may be on leave or no availability');
        setSlots([]);
      } else {
        console.log('✅ Setting slots from backend:', normalized.length, 'slots');
        setSlots(normalized);
      }
    } catch (err) {
      console.error('❌ Backend availability API failed:', err);
      // If backend fails, show no slots (better safe than sorry)
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-search when filters change (comment this block if you want manual-only via button)
  useEffect(() => {
    if (!doctorId || !date || !time) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }
    searchSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, date, time, duration]);

  useEffect(() => {
    setOtpSent(false);
    setOtpCode("");
    setOtpMeta(null);
    setOtpError("");
  }, [selectedSlot]);

  // Fetch doctor schedule when doctor is selected
  useEffect(() => {
    if (doctorId) {
      console.log('=== FETCHING DOCTOR SCHEDULE ===');
      console.log('Looking for doctorId:', doctorId);
      console.log('Available doctors:', doctors);
      
      const selectedDoc = doctors.find(doc => 
        doc.dentistCode === doctorId || 
        doc._id === doctorId || 
        doc.id === doctorId
      );
      
      console.log('Found selected doctor:', selectedDoc);
      
      if (selectedDoc && selectedDoc.dentistCode) {
        fetchDoctorSchedule(selectedDoc.dentistCode);
      } else {
        console.log('No dentistCode found for selected doctor');
        setSelectedDoctor(null);
        setDoctorSchedule(null);
        setIsDoctorOnLeave(false);
      }
    } else {
      setSelectedDoctor(null);
      setDoctorSchedule(null);
      setIsDoctorOnLeave(false);
    }
  }, [doctorId, doctors]);

  // Check doctor leave status when doctor and date change
  useEffect(() => {
    if (doctorId && date) {
      const selectedDoc = doctors.find(doc => 
        doc.dentistCode === doctorId || 
        doc._id === doctorId || 
        doc.id === doctorId
      );
      if (selectedDoc && selectedDoc.dentistCode) {
        console.log('=== TEMPORARILY DISABLED LEAVE CHECK ===');
        console.log('Would check leave for:', selectedDoc.dentistCode, 'on', date);
        // Temporarily disable leave checking to test
        setIsDoctorOnLeave(false);
        // checkDoctorLeave(selectedDoc.dentistCode, date);
      }
    } else {
      setIsDoctorOnLeave(false);
    }
  }, [doctorId, date, doctors]);

  // Reset time selection when doctor or date changes
  useEffect(() => {
    setTime("all");
  }, [doctorId, date]);

  /* ---- choose slot ---- */
  const holdSlot = (slot) => {
    const doctorMatch =
      doctors.find((d) => d._id === slot.doctorId) ||
      doctors.find((d) => d.dentistCode === (slot.dentistCode || slot.doctorCode));
    setSelectedSlot({
      ...slot,
      doctorId: slot.doctorId || doctorMatch?._id,
      doctorCode: slot.dentistCode || slot.doctorCode || doctorMatch?.dentistCode,
      doctorName: slot.doctorName || doctorMatch?.displayName || getDoctorDisplayName(doctorMatch),
    });
    setCurrentStep(3);
    setSelectedDoctorInfo(doctorMatch || null);
  };

  /* ---- OTP ---- */
  const sendOtp = async () => {
    if (!selectedSlot) { setOtpError("Select a timeslot before requesting an OTP."); return; }
    
    // Validate "other person details" if booking for someone else
    if (bookingForSomeoneElse) {
      const errors = {};
      if (!otherPersonDetails.name?.trim()) errors.name = "Name is required";
      if (!otherPersonDetails.contact?.trim()) errors.contact = "Contact is required";
      
      if (Object.keys(errors).length > 0) {
        setOtherPersonErrors(errors);
        setOtpError("Please fill in all required fields for the other person.");
        return;
      }
    }
    
    try {
      setOtpError(""); setOtpStatus("");
      if (!token) { 
        navigate("/login", { replace: true }); 
        return; 
      }
      const slotIso = getSlotIso(selectedSlot);
      if (!slotIso) { setOtpError("Unable to determine the selected slot."); return; }

      const doctorForSlot =
        doctors.find((d) => d._id === selectedSlot.doctorId) ||
        doctors.find((d) => d.dentistCode === (selectedSlot.dentistCode || selectedSlot.doctorCode)) ||
        doctors.find((d) => d._id === doctorId);

      const body = {
        slotIso,
        durationMinutes: selectedSlot.duration || duration,
        dentistCode: selectedSlot.dentistCode || selectedSlot.doctorCode || doctorForSlot?.dentistCode,
        doctorId: selectedSlot.doctorId || doctorForSlot?._id,
        doctorName: selectedSlot.doctorName || doctorForSlot?.displayName || getDoctorDisplayName(doctorForSlot),
        reason,
        bookingForSomeoneElse,
        otherPersonDetails: bookingForSomeoneElse ? otherPersonDetails : undefined
      };

      const res = await fetch(`${apiBase}/appointments/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setOtpError(data.message || "Failed to send OTP. Please try again."); return; }

      // Log OTP to console for development
      if (data.otp) {
        console.log('═══════════════════════════════════════════════');
        console.log('🔐 APPOINTMENT OTP CODE:', data.otp);
        console.log('📱 Sent to:', data.sentPhone);
        console.log('⏰ Expires at:', new Date(data.expiresAt).toLocaleString());
        console.log('═══════════════════════════════════════════════');
      }

      setOtpSent(true);
      setOtpMeta({ id: data.otpId, expiresAt: data.expiresAt, sentPhone: data.sentPhone, slotIso });
      setOtpStatus(data.message || "OTP sent successfully");
    } catch (err) {
      setOtpError(err.message || "Failed to send OTP.");
    }
  };

  const verifyOtpAndConfirm = async () => {
    if (!otpMeta?.id) { setOtpError("Request an OTP before attempting to verify."); return; }
    
    // Validate OTP format
    const otpValidation = validateOTP(otpCode);
    if (!otpValidation.isValid) {
      setOtpFieldError(otpValidation.message);
      return;
    }
    
    setOtpFieldError("");
    setOtpError("");
    
    try {
      // Debug token status
      console.log('🔍 OTP Verification Debug:', {
        hasToken: !!token,
        tokenLength: token?.length,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'No token',
        otpId: otpMeta.id,
        otpCode: otpCode
      });
      
      if (!token) { 
        console.log('❌ No token found, redirecting to login');
        navigate("/login", { replace: true }); 
        return; 
      }

      const res = await fetch(`${apiBase}/appointments/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          otpId: otpMeta.id, 
          code: otpCode, 
          reason,
          bookingForSomeoneElse,
          otherPersonDetails: bookingForSomeoneElse ? otherPersonDetails : undefined
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { 
        console.log('❌ OTP verification failed:', res.status, data);
        if (res.status === 401) {
          setOtpError("Authentication failed. Please log in again.");
          // Clear token and redirect to login
          localStorage.removeItem('auth');
          localStorage.removeItem('token');
          navigate("/login", { replace: true });
          return;
        }
        setOtpError(data.message || "OTP verification failed. Please try again."); 
        return; 
      }

      setOtpStatus(data.message || "Appointment confirmed");
      setOtpSent(false);
      setOtpCode("");
      setOtpMeta(null);
      setSelectedSlot(null);
      await searchSlots();
      setCurrentStep(1);
      navigate("/", { replace: true });
    } catch (err) {
      setOtpError(err.message || "Unable to confirm appointment.");
    }
  };

  /* ---- Guest Booking ---- */
  const validateGuestInfo = () => {
    const errors = {};
    
    if (!guestInfo.name.trim()) errors.name = "Name is required";
    if (!guestInfo.phone.trim()) errors.phone = "Phone is required";
    else if (!/^[0-9]{9,15}$/.test(guestInfo.phone.replace(/[\s\-\(\)]/g, ''))) {
      errors.phone = "Please provide a valid phone number";
    }
    if (!guestInfo.email.trim()) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestInfo.email)) {
      errors.email = "Please provide a valid email address";
    }
    
    setGuestErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const bookGuestAppointment = async () => {
    if (!selectedSlot) { 
      setOtpError("Select a timeslot before booking."); 
      return; 
    }
    
    if (!validateGuestInfo()) {
      setOtpError("Please fill in all required fields correctly.");
      return;
    }

    try {
      setOtpError("");
      setOtpStatus("");
      
      const slotIso = getSlotIso(selectedSlot);
      if (!slotIso) { 
        setOtpError("Unable to determine the selected slot."); 
        return; 
      }

      const doctorForSlot =
        doctors.find((d) => d._id === selectedSlot.doctorId) ||
        doctors.find((d) => d.dentistCode === (selectedSlot.dentistCode || selectedSlot.doctorCode)) ||
        doctors.find((d) => d._id === doctorId);

      const body = {
        dentist_code: selectedSlot.dentistCode || selectedSlot.doctorCode || doctorForSlot?.dentistCode,
        appointment_date: slotIso,
        reason: reason.trim(),
        name: guestInfo.name.trim(),
        phone: guestInfo.phone.trim(),
        email: guestInfo.email.trim(),
        address: guestInfo.address.trim(),
        age: guestInfo.age ? parseInt(guestInfo.age) : undefined,
        gender: guestInfo.gender && guestInfo.gender.trim() ? guestInfo.gender : undefined
      };

      const res = await fetch(`${apiBase}/appointments/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { 
        setOtpError(data.message || "Failed to book appointment. Please try again."); 
        return; 
      }

      setOtpStatus(data.message || "Appointment booked successfully!");
      setSelectedSlot(null);
      setGuestInfo({ name: "", phone: "", email: "", address: "", age: "", gender: "" });
      setReason("");
      await searchSlots();
      setCurrentStep(1);
      
      // Show success message and redirect after delay
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 3000);
      
    } catch (err) {
      setOtpError(err.message || "Unable to book appointment.");
    }
  };

  /* ---- helper functions ---- */
  const getDayName = (dateStr) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const date = new Date(dateStr);
    return days[date.getDay()];
  };

  const parseTimeRange = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    
    // Handle formats like "09:00-17:00", "09:00 - 17:00", "09:00-17:00"
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!match) return null;
    
    const [, startH, startM, endH, endM] = match;
    return {
      start: parseInt(startH) * 60 + parseInt(startM),
      end: parseInt(endH) * 60 + parseInt(endM)
    };
  };

  const generateTimeSlots = (startMin, endMin, slotDuration) => {
    const slots = [];
    let currentMin = startMin;
    
    while (currentMin + slotDuration <= endMin) {
      const label = formatMinutesToHHMM(currentMin);
      slots.push({ value: label, label });
      currentMin += slotDuration;
    }
    
    return slots;
  };

  /* ---- UI options ---- */
  const timeOptions = useMemo(() => {
    console.log('=== TIME OPTIONS DEBUG ===');
    console.log('isDoctorOnLeave:', isDoctorOnLeave);
    console.log('selectedDoctor:', selectedDoctor);
    console.log('doctorSchedule:', doctorSchedule);
    console.log('date:', date);
    
    // If doctor is on leave, show unavailable message
    if (isDoctorOnLeave) {
      console.log('Doctor is on leave, returning unavailable message');
      return [{ value: "unavailable", label: "Doctor is on leave for this date" }];
    }

    // If no doctor selected or no schedule, show default times
    if (!selectedDoctor || !doctorSchedule) {
      console.log('No doctor selected or no schedule, using default times');
      const opts = [{ value: "all", label: "All Times (09:00 - 18:00)" }];
      let startMinutes = WORK_START_MINUTES;
      while (startMinutes + (Number(duration) || SLOT_INTERVAL_MINUTES) <= WORK_END_MINUTES) {
        const label = formatMinutesToHHMM(startMinutes);
        opts.push({ value: label, label });
        startMinutes += SLOT_INTERVAL_MINUTES;
      }
      return opts;
    }

    const dayName = getDayName(date);
    const daySchedule = doctorSchedule[dayName];
    
    console.log('Day name:', dayName);
    console.log('Day schedule:', daySchedule);
    
    // If doctor is not available on this day, return empty options
    if (!daySchedule) {
      console.log('Doctor not available on this day');
      return [{ value: "unavailable", label: "Doctor not available on this day" }];
    }

    // Handle both string and array formats for daySchedule
    let scheduleString = daySchedule;
    if (Array.isArray(daySchedule) && daySchedule.length > 0) {
      scheduleString = daySchedule[0]; // Take the first time slot if it's an array
    }
    
    console.log('Schedule string to parse:', scheduleString);

    // Parse the time range for this day
    const timeRange = parseTimeRange(scheduleString);
    console.log('Parsed time range:', timeRange);
    
    if (!timeRange) {
      console.log('No valid time range parsed');
      return [{ value: "unavailable", label: "No schedule available" }];
    }

    const slotDuration = Number(duration) || SLOT_INTERVAL_MINUTES;
    const timeSlots = generateTimeSlots(timeRange.start, timeRange.end, slotDuration);
    console.log('Generated time slots:', timeSlots);
    
    // Add "All Times" option with the doctor's working hours
    const allTimesLabel = `All Times (${formatMinutesToHHMM(timeRange.start)} - ${formatMinutesToHHMM(timeRange.end)})`;
    
    const finalOptions = [
      { value: "all", label: allTimesLabel },
      ...timeSlots
    ];
    
    console.log('Final time options:', finalOptions);
    return finalOptions;
  }, [selectedDoctor, doctorSchedule, date, duration, isDoctorOnLeave]);

  /* ---------------- render ---------------- */
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #fff7ed 100%)',
      fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'
    }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)', color: 'white', padding: '4rem 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '1rem' }}>Book Your Dental Appointment</h1>
          <p style={{ fontSize: '1.25rem', opacity: 0.9, maxWidth: '600px', margin: '0 auto' }}>
            Choose your preferred dentist and time slot for professional dental care
          </p>
        </div>
      </div>

      {/* Main */}
      <div style={{ maxWidth: '1200px', margin: '-2rem auto 2rem', padding: '0 2rem' }}>
        <div style={{ background: 'white', borderRadius: '1.5rem', boxShadow: '0 25px 50px rgba(0,0,0,0.1)', padding: '2rem', border: '1px solid #e5e7eb' }}>
          {/* Filters */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1.25rem' }}>
              <Search style={{ marginRight: '0.5rem', color: '#3b82f6' }} size={24} />
              Select Your Preferences
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              {/* Doctor */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Choose Doctor
                </label>
                <div style={{ position: 'relative' }}>
                  <Stethoscope style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                  <select
                    value={doctorId}
                    onChange={(e) => {
                      console.log('=== DOCTOR SELECTION ===');
                      console.log('Selected doctor ID:', e.target.value);
                      console.log('Available doctors:', doctors);
                      setDoctorId(e.target.value);
                    }}
                    disabled={loadingDoctors || !!doctorError}
                    style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', border: '2px solid #e5e7eb', borderRadius: '0.75rem', background: 'white', fontSize: '0.875rem' }}
                  >
                    {loadingDoctors && <option>Loading doctors...</option>}
                    {!loadingDoctors && doctorError && <option>Unable to load doctors</option>}
                    {!loadingDoctors && !doctorError && doctors.length === 0 && <option>No doctors found</option>}
                    {!loadingDoctors && !doctorError &&
                      doctors.map((doc, i) => {
                        const id = doc._id || doc.id || doc.dentistCode || `doc-${i}`;
                        return (
                          <option key={id} value={id}>
                            {doc.displayName || getDoctorDisplayName(doc, i)}
                          </option>
                        );
                      })}
                  </select>
                </div>
                {doctorError && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: '#b91c1c', fontSize: 12 }}>{doctorError}</span>
                    <button
                      onClick={loadDoctors}
                      style={{
                        border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8,
                        padding: '6px 10px', fontSize: 12, cursor: 'pointer'
                      }}
                    >
                      Reload doctors
                    </button>
                  </div>
                )}
              </div>

              {/* Date */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Preferred Date
                </label>
                <div style={{ position: 'relative' }}>
                  <Calendar style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', border: '2px solid #e5e7eb', borderRadius: '0.75rem', background: 'white', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              {/* Duration */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Duration
                </label>
                <div style={{ position: 'relative' }}>
                  <Clock style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                  <select
                    value={duration}
                    onChange={(e) => handleDurationChange(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2.5rem', border: '2px solid #e5e7eb', borderRadius: '0.75rem', background: 'white', fontSize: '0.875rem' }}
                  >
                    {[30, 45, 60, 90].map((m) => (
                      <option key={m} value={m}>{m} minutes</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Time */}
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Preferred Time
                  {loadingSchedule && <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem' }}>(Loading...)</span>}
                </label>
                <div style={{ position: 'relative' }}>
                  <Clock style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                  <select
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    disabled={loadingSchedule || isDoctorOnLeave}
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem 0.75rem 0.75rem 2.5rem', 
                      border: '2px solid #e5e7eb', 
                      borderRadius: '0.75rem', 
                      background: loadingSchedule || isDoctorOnLeave ? '#f9fafb' : 'white', 
                      fontSize: '0.875rem',
                      cursor: loadingSchedule || isDoctorOnLeave ? 'not-allowed' : 'pointer',
                      opacity: loadingSchedule || isDoctorOnLeave ? 0.6 : 1
                    }}
                  >
                    {timeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Search Slots button */}
            <div style={{ marginTop: '1rem' }}>
              <button
                onClick={searchSlots}
                disabled={loading || !doctorId || !date || isDoctorOnLeave || loadingSchedule}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: isDoctorOnLeave ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  padding: '0.75rem 1.25rem',
                  border: 'none',
                  borderRadius: '0.6rem',
                  fontWeight: 600,
                  cursor: loading || !doctorId || !date || isDoctorOnLeave || loadingSchedule ? 'not-allowed' : 'pointer',
                  opacity: loading || !doctorId || !date || isDoctorOnLeave || loadingSchedule ? 0.6 : 1
                }}
              >
                <Search size={18} />
                {isDoctorOnLeave ? "Doctor on Leave" : loading ? "Searching..." : "Search Slots"}
              </button>
            </div>
          </div>

          {/* Slots */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1.0rem' }}>
              <Clock style={{ marginRight: '0.5rem', color: '#f97316' }} size={24} />
              Available Time Slots
            </h3>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                <div style={{
                  width: '3rem', height: '3rem', border: '3px solid #e5e7eb',
                  borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite',
                  margin: '0 auto 1rem'
                }} />
                <p style={{ fontWeight: '500' }}>Searching for available slots...</p>
              </div>
            ) : slots.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '3rem', color: '#6b7280',
                background: '#f9fafb', borderRadius: '1rem', border: '2px dashed #d1d5db'
              }}>
                <AlertCircle size={48} style={{ margin: '0 auto 1rem', color: '#9ca3af' }} />
                <p style={{ fontWeight: '500', marginBottom: '0.5rem' }}>No slots available</p>
                <p style={{ fontSize: '0.875rem' }}>Try selecting a different doctor, date, or time range, then press <strong>Search Slots</strong>.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {slots.map((slot) => {
                  const { timeLabel, dateLabel } = buildSlotLabels(slot, Number(duration) || SLOT_INTERVAL_MINUTES);
                  const isSelected = selectedSlot && getSlotIso(selectedSlot) === getSlotIso(slot);
                  const key = `${slot.doctorId || slot.doctorCode}-${getSlotIso(slot)}`;
                  
                  // Only show truly available slots
                  const status = (slot.status || "").toLowerCase();
                  const isAvailable = status === "available" || status === "free" || status === "bookable" || 
                                     status === "open" || status === "";
                  
                  console.log('🔍 Slot availability check:', {
                    time: getSlotIso(slot),
                    status: status,
                    isAvailable: isAvailable,
                    slot: slot
                  });
                  
                  if (!isAvailable) return null;
                  
                  return (
                    <button
                      key={key}
                      onClick={() => holdSlot(slot)}
                      style={{
                        padding: '1.25rem',
                        borderRadius: '1rem',
                        border: isSelected ? '2px solid #10b981' : '2px solid #d1fae5',
                        background: isSelected ? '#ecfdf5' : '#f0fdf4',
                        color: isSelected ? '#065f46' : '#064e3b',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'left',
                        position: 'relative'
                      }}
                    >
                      <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '0.5rem' }}>
                        {timeLabel}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                        {dateLabel}
                      </div>
                      <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#059669' }}>
                        ✓ Available
                      </div>
                      {isSelected && (
                        <CheckCircle size={20} style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', color: '#f97316' }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Confirm & OTP */}
          {selectedSlot && (
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '2rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1.5rem' }}>
                <CheckCircle style={{ marginRight: '0.5rem', color: '#16a34a' }} size={24} />
                Confirm Your Appointment
              </h3>

              <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #bbf7d0', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={18} style={{ color: '#16a34a' }} />
                    <span style={{ color: '#166534', fontWeight: '500' }}>
                      {new Date(getSlotIso(selectedSlot)).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={18} style={{ color: '#16a34a' }} />
                    <span style={{ color: '#166534', fontWeight: '500' }}>
                      {(() => {
                        const start = new Date(getSlotIso(selectedSlot));
                        const end = addMinutesToDate(start, Number(duration) || 30);
                        return `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
                      })()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Stethoscope size={18} style={{ color: '#16a34a' }} />
                    <span style={{ color: '#166534', fontWeight: '500' }}>
                      {doctors.find((d) => d._id === selectedSlot.doctorId)?.displayName ||
                        doctors.find((d) => d._id === selectedSlot.doctorId)?.name ||
                        selectedSlot.doctorName ||
                        "Selected Doctor"}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Reason for Visit (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., consultation, cleaning, pain relief"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '0.75rem', background: 'white', fontSize: '0.875rem' }}
                />
              </div>

              {/* Book for Someone Else Checkbox - Only for registered users */}
              {bookingType === "registered" && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '1rem', border: '2px solid #e5e7eb', borderRadius: '0.75rem', background: bookingForSomeoneElse ? '#eff6ff' : 'white' }}>
                    <input
                      type="checkbox"
                      checked={bookingForSomeoneElse}
                      onChange={(e) => {
                        setBookingForSomeoneElse(e.target.checked);
                        if (!e.target.checked) {
                          setOtherPersonDetails({ name: "", contact: "", age: "", gender: "", relation: "", notes: "" });
                          setOtherPersonErrors({});
                        }
                      }}
                      style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: '600', color: '#374151' }}>
                      📅 Book this appointment for someone else
                    </span>
                  </label>
                </div>
              )}

              {/* Other Person Details Form - Only show when booking for someone else */}
              {bookingType === "registered" && bookingForSomeoneElse && (
                <div style={{ border: '2px solid #e5e7eb', borderRadius: '1rem', background: '#f9fafb', padding: '1.5rem', marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={20} style={{ color: '#3b82f6' }} />
                    Person Details (Who the appointment is for)
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="Enter their full name"
                        value={otherPersonDetails.name}
                        onChange={(e) => {
                          setOtherPersonDetails({...otherPersonDetails, name: e.target.value});
                          if (otherPersonErrors.name) setOtherPersonErrors({...otherPersonErrors, name: ""});
                        }}
                        style={{ 
                          width: '100%', 
                          padding: '0.75rem', 
                          border: `2px solid ${otherPersonErrors.name ? '#dc2626' : '#e5e7eb'}`, 
                          borderRadius: '0.75rem', 
                          background: 'white', 
                          fontSize: '0.875rem' 
                        }}
                      />
                      {otherPersonErrors.name && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{otherPersonErrors.name}</span>}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        Contact (Phone/Email) *
                      </label>
                      <input
                        type="text"
                        placeholder="Phone number or email"
                        value={otherPersonDetails.contact}
                        onChange={(e) => {
                          setOtherPersonDetails({...otherPersonDetails, contact: e.target.value});
                          if (otherPersonErrors.contact) setOtherPersonErrors({...otherPersonErrors, contact: ""});
                        }}
                        style={{ 
                          width: '100%', 
                          padding: '0.75rem', 
                          border: `2px solid ${otherPersonErrors.contact ? '#dc2626' : '#e5e7eb'}`, 
                          borderRadius: '0.75rem', 
                          background: 'white', 
                          fontSize: '0.875rem' 
                        }}
                      />
                      {otherPersonErrors.contact && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{otherPersonErrors.contact}</span>}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        Age
                      </label>
                      <input
                        type="number"
                        placeholder="Enter their age"
                        value={otherPersonDetails.age}
                        onChange={(e) => setOtherPersonDetails({...otherPersonDetails, age: e.target.value})}
                        style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '0.75rem', background: 'white', fontSize: '0.875rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        Gender
                      </label>
                      <select
                        value={otherPersonDetails.gender}
                        onChange={(e) => setOtherPersonDetails({...otherPersonDetails, gender: e.target.value})}
                        style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '0.75rem', background: 'white', fontSize: '0.875rem' }}
                      >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        Relation to You
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., son, daughter, spouse, parent"
                        value={otherPersonDetails.relation}
                        onChange={(e) => setOtherPersonDetails({...otherPersonDetails, relation: e.target.value})}
                        style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '0.75rem', background: 'white', fontSize: '0.875rem' }}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        Additional Notes
                      </label>
                      <textarea
                        placeholder="Any special requirements or notes..."
                        value={otherPersonDetails.notes}
                        onChange={(e) => setOtherPersonDetails({...otherPersonDetails, notes: e.target.value})}
                        style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '0.75rem', background: 'white', fontSize: '0.875rem', minHeight: '80px', resize: 'vertical' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Booking Type Selection */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                  Booking Type
                </label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={() => setBookingType("registered")}
                    disabled={!isAuthenticated}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: `2px solid ${bookingType === "registered" ? '#3b82f6' : '#e5e7eb'}`,
                      borderRadius: '0.75rem',
                      background: bookingType === "registered" ? '#eff6ff' : 'white',
                      color: bookingType === "registered" ? '#1e40af' : '#374151',
                      fontWeight: '500',
                      cursor: isAuthenticated ? 'pointer' : 'not-allowed',
                      opacity: isAuthenticated ? 1 : 0.5
                    }}
                  >
                    {isAuthenticated ? '✓ Registered User (OTP)' : '✗ Login Required'}
                  </button>
                  <button
                    onClick={() => setBookingType("guest")}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: `2px solid ${bookingType === "guest" ? '#16a34a' : '#e5e7eb'}`,
                      borderRadius: '0.75rem',
                      background: bookingType === "guest" ? '#f0fdf4' : 'white',
                      color: bookingType === "guest" ? '#166534' : '#374151',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Guest User (No OTP)
                  </button>
                </div>
              </div>

              {/* Guest Information Form */}
              {bookingType === "guest" && (
                <div style={{ border: '2px solid #e5e7eb', borderRadius: '1rem', background: '#f9fafb', padding: '1.5rem', marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
                    Guest Information
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="Enter your full name"
                        value={guestInfo.name}
                        onChange={(e) => setGuestInfo({...guestInfo, name: e.target.value})}
                        style={{ 
                          width: '100%', 
                          padding: '0.75rem', 
                          border: `2px solid ${guestErrors.name ? '#dc2626' : '#e5e7eb'}`, 
                          borderRadius: '0.75rem', 
                          background: 'white', 
                          fontSize: '0.875rem' 
                        }}
                      />
                      {guestErrors.name && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{guestErrors.name}</span>}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        placeholder="Enter your phone number"
                        value={guestInfo.phone}
                        onChange={(e) => setGuestInfo({...guestInfo, phone: e.target.value})}
                        style={{ 
                          width: '100%', 
                          padding: '0.75rem', 
                          border: `2px solid ${guestErrors.phone ? '#dc2626' : '#e5e7eb'}`, 
                          borderRadius: '0.75rem', 
                          background: 'white', 
                          fontSize: '0.875rem' 
                        }}
                      />
                      {guestErrors.phone && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{guestErrors.phone}</span>}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        Email Address *
                      </label>
                      <input
                        type="email"
                        placeholder="Enter your email"
                        value={guestInfo.email}
                        onChange={(e) => setGuestInfo({...guestInfo, email: e.target.value})}
                        style={{ 
                          width: '100%', 
                          padding: '0.75rem', 
                          border: `2px solid ${guestErrors.email ? '#dc2626' : '#e5e7eb'}`, 
                          borderRadius: '0.75rem', 
                          background: 'white', 
                          fontSize: '0.875rem' 
                        }}
                      />
                      {guestErrors.email && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{guestErrors.email}</span>}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        Address
                      </label>
                      <input
                        type="text"
                        placeholder="Enter your address"
                        value={guestInfo.address}
                        onChange={(e) => setGuestInfo({...guestInfo, address: e.target.value})}
                        style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '0.75rem', background: 'white', fontSize: '0.875rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        Age
                      </label>
                      <input
                        type="number"
                        placeholder="Enter your age"
                        value={guestInfo.age}
                        onChange={(e) => setGuestInfo({...guestInfo, age: e.target.value})}
                        style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '0.75rem', background: 'white', fontSize: '0.875rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        Gender
                      </label>
                      <select
                        value={guestInfo.gender}
                        onChange={(e) => setGuestInfo({...guestInfo, gender: e.target.value})}
                        style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '0.75rem', background: 'white', fontSize: '0.875rem' }}
                      >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ border: '2px solid #e5e7eb', borderRadius: '1rem', background: 'white', padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                  <Shield style={{ marginRight: '0.5rem', color: '#3b82f6' }} size={20} />
                  <h4 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                    {bookingType === "guest" ? "Complete Booking" : "Secure OTP Verification"}
                  </h4>
                </div>

                {otpStatus && (
                  <div style={{ padding: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                    <p style={{ color: '#166534', margin: 0, fontSize: '0.875rem' }}>
                      {otpStatus}
                      {otpMeta?.sentPhone ? ` (sent to ${otpMeta.sentPhone})` : ""}
                      {otpMeta?.expiresAt ? ` - expires at ${new Date(otpMeta.expiresAt).toLocaleTimeString()}` : ""}
                    </p>
                  </div>
                )}

                {otpError && (
                  <div style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                    <p style={{ color: '#dc2626', margin: 0, fontSize: '0.875rem' }}>{otpError}</p>
                  </div>
                )}

                {bookingType === "guest" ? (
                  <button
                    onClick={bookGuestAppointment}
                    style={{ 
                      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', 
                      color: 'white', 
                      padding: '0.75rem 1.5rem', 
                      border: 'none', 
                      borderRadius: '0.5rem', 
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Book Appointment
                  </button>
                ) : !otpSent ? (
                  <button
                    onClick={sendOtp}
                    style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', padding: '0.75rem 1.5rem', border: 'none', borderRadius: '0.5rem', fontWeight: '600' }}
                  >
                    Send OTP Code
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        placeholder="Enter 6-digit OTP"
                        value={otpCode}
                        onChange={(e) => {
                          setOtpCode(e.target.value);
                          if (otpFieldError) setOtpFieldError("");
                        }}
                        onBlur={() => {
                          if (otpCode && !validateOTP(otpCode).isValid) {
                            setOtpFieldError(validateOTP(otpCode).message);
                          }
                        }}
                        maxLength={6}
                        style={{ 
                          width: '100%', 
                          padding: '0.75rem', 
                          border: otpFieldError ? '2px solid #dc2626' : '2px solid #e5e7eb', 
                          borderRadius: '0.5rem', 
                          fontSize: '0.875rem', 
                          textAlign: 'center', 
                          letterSpacing: '0.1em', 
                          fontWeight: '600' 
                        }}
                      />
                      {otpFieldError && (
                        <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          {otpFieldError}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={verifyOtpAndConfirm}
                      disabled={!otpCode.trim() || !!otpFieldError}
                      style={{ 
                        background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', 
                        color: 'white', 
                        padding: '0.75rem 1.5rem', 
                        border: 'none', 
                        borderRadius: '0.5rem', 
                        fontWeight: '600', 
                        opacity: (!otpCode.trim() || !!otpFieldError) ? 0.5 : 1 
                      }}
                    >
                      Verify & Confirm
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

