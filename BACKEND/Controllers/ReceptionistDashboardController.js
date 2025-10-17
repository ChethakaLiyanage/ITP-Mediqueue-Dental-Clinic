// Controllers/ReceptionistDashboardController.js
const Appointment = require("../Model/AppointmentModel");
const Queue = require("../Model/QueueModel");
const ClinicEvent = require("../Model/ClinicEventModel");
const Inquiry = require("../Model/InquiryModel");
const Dentist = require("../Model/DentistModel");
const Notification = require("../Model/NotificationLogModel");

// ---- Config you can tweak ----
const DEFAULT_TZ_OFFSET_MIN = 330; // Asia/Colombo = +05:30
const AVG_SERVICE_MINUTES = 15;    // used for ETA calculation
const BOOKING_STATUSES = ["pending", "confirmed"]; 
const DONE_STATUSES = ["completed"];              
const CANCEL_STATUSES = ["cancelled"];             

// ---- date helpers ----
function toLocalDateString(d = new Date(), tzOffsetMin = DEFAULT_TZ_OFFSET_MIN) {
  const utc = new Date(d.getTime() + tzOffsetMin * 60 * 1000);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getLocalDayRange(localDateStr, tzOffsetMin = DEFAULT_TZ_OFFSET_MIN) {
  const msLocalStart = Date.parse(`${localDateStr}T00:00:00.000Z`);
  const msLocalEnd = Date.parse(`${localDateStr}T23:59:59.999Z`);
  const start = new Date(msLocalStart - tzOffsetMin * 60 * 1000);
  const end = new Date(msLocalEnd - tzOffsetMin * 60 * 1000);
  return { start, end };
}

function weekdayName(date, tzOffsetMin = DEFAULT_TZ_OFFSET_MIN) {
  const utc = new Date(date.getTime() + tzOffsetMin * 60 * 1000);
  const day = utc.getUTCDay(); // 0=Sun
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day];
}

function parseWindows(windowStr) {
  if (!windowStr || typeof windowStr !== 'string') return [];
  return windowStr.split(",").map(s => {
    const [start, end] = s.trim().split("-");
    return { start, end };
  });
}

function generateSlots(windows, stepMin = 30) {
  const result = [];
  for (const w of windows) {
    if (!w.start || !w.end) continue;
    const [sh, sm] = w.start.split(":").map(Number);
    const [eh, em] = w.end.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    for (let t = startMin; t + stepMin <= endMin; t += stepMin) {
      const hh = String(Math.floor(t / 60)).padStart(2, "0");
      const mm = String(t % 60).padStart(2, "0");
      result.push(`${hh}:${mm}`);
    }
  }
  return result;
}

function toLocalHHmm(d, tzOffsetMin = DEFAULT_TZ_OFFSET_MIN) {
  const t = new Date(d.getTime() + tzOffsetMin * 60 * 1000);
  const hh = String(t.getUTCHours()).padStart(2, "0");
  const mm = String(t.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function estimateWaitMinutes(waitingCount) {
  return waitingCount * AVG_SERVICE_MINUTES;
}

// ----------------------------------------------------------

async function getReceptionistDashboard(req, res) {
  try {
    const tzOffsetMin = Number(req.query.tzOffsetMin ?? DEFAULT_TZ_OFFSET_MIN);
    const localDateStr = req.query.date || toLocalDateString(new Date(), tzOffsetMin);
    const { start, end } = getLocalDayRange(localDateStr, tzOffsetMin);
    const now = new Date();

    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);

    // ---------- Parallel queries ----------
    const [
      apptAgg,
      nextAppts,
      nextQueueAppts,
      queueAgg,
      queueToday,
      openInquiryCount,
      latestInquiries,
      publishedEvents,
      dentists,
      unreadNotifications
    ] = await Promise.all([
      Appointment.aggregate([
        { $match: { appointment_date: { $gte: start, $lte: end } } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),

      Appointment.find({
        appointment_date: { $gte: now, $lte: end },
        status: { $in: BOOKING_STATUSES }
      })
        .sort({ appointment_date: 1 })
        .limit(5)
        .select("appointmentCode patient_code dentist_code appointment_date status reason")
        .lean(),

      Queue.find({
        date: { $gte: now, $lte: end },
        status: { $in: ['waiting', 'called'] }
      })
        .sort({ date: 1 })
        .limit(5)
        .select("appointmentCode patientCode dentistCode date status")
        .lean(),

      Queue.aggregate([
        { $match: { date: { $gte: start, $lte: end } } },
        { $group: { _id: { dentistCode: "$dentistCode", status: "$status" }, count: { $sum: 1 } } }
      ]),

      Queue.find({ date: { $gte: start, $lte: end } })
        .sort({ position: 1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("appointmentCode patientCode dentistCode position status updatedAt")
        .lean(),

      Inquiry.countDocuments({ status: "open" }),
      Inquiry.find({})
        .sort({ updatedAt: -1 })
        .limit(5)
        .select("inquiryCode subject status updatedAt")
        .lean(),

      ClinicEvent.find({
        isPublished: true,
        isDeleted: { $ne: true }
      })
        .sort({ startDate: 1 })
        .limit(10)
        .select("eventCode title startDate endDate imageUrl")
        .lean(),

      Dentist.find({})
        .select("dentistCode availability_schedule userId")
        .populate({ path: "userId", select: "name email" })
        .lean(),

      Notification.countDocuments({ isRead: false })
    ]);

    // Add patient names to queue appointments
    const Patient = require("../Model/PatientModel");
    const User = require("../Model/User");
    
    const enrichedQueueAppts = await Promise.all(nextQueueAppts.map(async (item) => {
      let patientName = 'Unknown Patient';
      
      // Handle guest patients (GUEST- prefix)
      if (item.patientCode.startsWith('GUEST-')) {
        patientName = 'Guest Patient';
      } else {
        // Handle registered patients
        try {
          const patient = await Patient.findOne({ patientCode: item.patientCode })
            .populate('userId', 'name')
            .lean();
          
          if (patient?.userId?.name) {
            patientName = patient.userId.name;
          }
        } catch (error) {
          console.error(`[getReceptionistDashboard] Error fetching patient name for ${item.patientCode}:`, error);
        }
      }
      
      return {
        ...item,
        patientName,
        patient_code: item.patientCode, // Map to expected field name
        dentist_code: item.dentistCode, // Map to expected field name
        appointment_date: item.date,    // Map to expected field name
        timeLocal: item.date ? toLocalHHmm(item.date, tzOffsetMin) : null,
        appointmentDateISO: item.date ? item.date.toISOString() : null
      };
    }));

    const nextAppointments = [
      ...nextAppts.map(appt => ({
        ...appt,
        timeLocal: appt.appointment_date ? toLocalHHmm(appt.appointment_date, tzOffsetMin) : null,
        appointmentDateISO: appt.appointment_date ? appt.appointment_date.toISOString() : null
      })),
      ...enrichedQueueAppts
    ].sort((a, b) => {
      const dateA = a.appointment_date || a.date;
      const dateB = b.appointment_date || b.date;
      return new Date(dateA) - new Date(dateB);
    }).slice(0, 5); // Limit to 5 total appointments

    const eventsNormalized = publishedEvents.map(ev => ({
      ...ev,
      start: ev.startDate,
      end: ev.endDate
    }));

    // ---------- Appointments metrics ----------
    const byStatus = Object.fromEntries(apptAgg.map(x => [x._id || "unknown", x.count]));
    const totalAppts = apptAgg.reduce((s, x) => s + x.count, 0);
    const pending = BOOKING_STATUSES.reduce((s, st) => s + (byStatus[st] || 0), 0);
    const completed = DONE_STATUSES.reduce((s, st) => s + (byStatus[st] || 0), 0);
    const cancelled = CANCEL_STATUSES.reduce((s, st) => s + (byStatus[st] || 0), 0);

    // ---------- Queue by dentist ----------
    const queuesByDentist = {};
    for (const g of queueAgg) {
      const dentistKey = g?._id?.dentistCode || g?._id?.dentist_code || "unknown";
      const st = g?._id?.status;
      if (!queuesByDentist[dentistKey]) {
        queuesByDentist[dentistKey] = {
          dentistCode: dentistKey,
          dentist_code: dentistKey,
          waiting: 0,
          called: 0,
          in_treatment: 0,
          no_show: 0,
          completed: 0,
          cancelled: 0
        };
      }
      if (st === "waiting") queuesByDentist[dentistKey].waiting += g.count;
      else if (st === "called") queuesByDentist[dentistKey].called += g.count;
      else if (st === "in_treatment") queuesByDentist[dentistKey].in_treatment += g.count;
      else if (st === "no-show" || st === "no_show") queuesByDentist[dentistKey].no_show += g.count;
      else if (st === "completed") queuesByDentist[dentistKey].completed += g.count;
      else if (st === "cancelled" || st === "canceled") queuesByDentist[dentistKey].cancelled += g.count;
    }
    const queuesArray = Object.values(queuesByDentist);

    const etaByDentist = {};
    for (const entry of queuesArray) {
      etaByDentist[entry.dentistCode] = estimateWaitMinutes(entry.waiting);
    }

    // ---------- Dentist availability ----------
    const todayWeekday = weekdayName(new Date(`${localDateStr}T12:00:00.000Z`), tzOffsetMin);
    const [todaysBooked, queueBookings] = await Promise.all([
      Appointment.find({
        appointment_date: { $gte: start, $lte: end },
        status: { $in: [...BOOKING_STATUSES, ...DONE_STATUSES] }
      }).select("dentist_code appointment_date status").lean(),
      Queue.find({
        date: { $gte: start, $lte: end },
        status: { $in: ['waiting', 'called', 'in_treatment'] }
      }).select("dentistCode date status").lean()
    ]);

    const bookedMap = new Map();
    for (const a of todaysBooked) {
      const t = toLocalHHmm(a.appointment_date, tzOffsetMin);
      const key = a.dentist_code;
      if (!bookedMap.has(key)) bookedMap.set(key, new Set());
      bookedMap.get(key).add(t);
    }
    for (const q of queueBookings) {
      const t = toLocalHHmm(q.date, tzOffsetMin);
      const key = q.dentistCode;
      if (!bookedMap.has(key)) bookedMap.set(key, new Set());
      bookedMap.get(key).add(t);
    }

    const dentistAvailabilityToday = dentists.map(d => {
      const code = d.dentistCode || d.dentist_code;
      const sched = (d.availability_schedule && (d.availability_schedule[todayWeekday] || d.availability_schedule[todayWeekday.substring(0,3)])) || "";
      const windows = parseWindows(sched);
      const allSlots = generateSlots(windows, 30);
      const booked = Array.from(bookedMap.get(code) || []);
      const available = allSlots.filter(s => !booked.includes(s));
      return {
        dentist_code: code,
        dentist_name: d?.userId?.name || null,
        schedule_window: sched,
        slots_total: allSlots.length,
        slots_booked: booked.length,
        slots_available: available.length,
        next_free_slot: available[0] || null
      };
    });

    // ---------- Queue live view ----------
    const queueLive = {};
    for (const q of queueToday) {
      const dentistKey = q.dentistCode || q.dentist_code;
      if (!dentistKey) continue;
      if (!queueLive[dentistKey]) {
        queueLive[dentistKey] = {
          dentistCode: dentistKey,
          dentist_code: dentistKey,
          waiting: [],
          called: [],
          in_treatment: [],
          no_show: [],
          completed: [],
          cancelled: []
        };
      }
      const bucket = (q.status || "waiting").replace("-", "_");
      if (!queueLive[dentistKey][bucket]) {
        queueLive[dentistKey][bucket] = [];
      }
      queueLive[dentistKey][bucket].push({
        _id: q._id,
        appointmentCode: q.appointmentCode,
        patientCode: q.patientCode,
        position: q.position,
        status: q.status,
        updatedAt: q.updatedAt
      });
    }

    // ---------- Assemble response ----------
    const response = {
      context: { tzOffsetMin, localDate: localDateStr, rangeUTC: { start, end } },
      cards: {
        appointmentsToday: { total: totalAppts, pendingOrConfirmed: pending, completed, cancelled },
        queueToday: {
          totalWaiting: queuesArray.reduce((s, d) => s + d.waiting, 0),
          totalCalled: queuesArray.reduce((s, d) => s + d.called, 0),
          totalInTreatment: queuesArray.reduce((s, d) => s + (d.in_treatment || 0), 0),
          totalNoShow: queuesArray.reduce((s, d) => s + d.no_show, 0),
          totalCompleted: queuesArray.reduce((s, d) => s + d.completed, 0)
        },
        inquiries: { openCount: openInquiryCount, latest: latestInquiries },
        events: { 
          publishedTodayCount: publishedEvents.filter(e => new Date(e.startDate) < end && new Date(e.endDate) > start).length,
          totalPublished: publishedEvents.length,
          items: eventsNormalized
        }
      },
      nextAppointments,
      queuesByDentist: queuesArray.map(d => ({
        ...d,
        dentist_name: dentists.find(doc => doc.dentistCode === d.dentistCode)?.userId?.name || d.dentistCode,
        etaMinutes: etaByDentist[d.dentistCode] || 0
      })),
      queueLiveByDentist: queueLive,
      dentistAvailabilityToday,
      unreadNotificationCount: unreadNotifications,
      pagination: { page, limit }
    };

    return res.status(200).json(response);
  } catch (err) {
    console.error("getReceptionistDashboard error:", err);
    return res.status(500).json({ message: "Failed to load dashboard", error: String(err?.message || err) });
  }
}

module.exports = {
  getReceptionistDashboard
};
