const Dentist = require("../Model/DentistModel");
const Leave = require("../Model/LeaveModel");
const User = require("../Model/User");

function getDayKey(date) {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][date.getDay()];
}

// GET /schedules/today
exports.getToday = async (req, res) => {
  try {
    const today = new Date();
    const dayKey = getDayKey(today);
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    const dentists = await Dentist.find({}).lean();

    // Map userId -> user name for dentist names
    const userIds = dentists.map(d => d.userId).filter(Boolean);
    let idToName = new Map();
    if (userIds.length) {
      const users = await User.find({ _id: { $in: userIds } }).select("_id name").lean();
      for (const u of users) idToName.set(String(u._id), u.name);
    }

    const codes = dentists.map(d => d.dentistCode).filter(Boolean);
    const leaves = await Leave.find({ dentistCode: { $in: codes }, dateFrom: { $lte: end }, dateTo: { $gte: start } }).lean();
    const codeToLeave = new Map();
    for (const lv of leaves) codeToLeave.set(lv.dentistCode, lv);

    const items = dentists.map(d => {
      const avail = (d.availability_schedule || {})[dayKey];
      
      // Handle different availability formats and provide defaults
      let slots = "-";
      if (avail) {
        if (Array.isArray(avail)) {
          slots = avail.join(", ");
        } else if (typeof avail === 'string') {
          slots = avail;
        }
      } else {
        // Provide default schedule if no availability is set
        // Most dental clinics work Monday-Friday 9:00-17:00
        const defaultSchedule = {
          'Mon': '09:00-17:00',
          'Tue': '09:00-17:00', 
          'Wed': '09:00-17:00',
          'Thu': '09:00-17:00',
          'Fri': '09:00-17:00',
          'Sat': '09:00-13:00',
          'Sun': 'Not Available'
        };
        slots = defaultSchedule[dayKey] || 'Not Available';
      }
      
      const leave = codeToLeave.get(d.dentistCode);
      
      // If dentist is on leave, show their schedule but indicate they're on leave
      let displaySlots = slots;
      if (leave && slots !== 'Not Available') {
        displaySlots = `${slots} (On Leave)`;
      }
      
      return {
        dentistCode: d.dentistCode,
        dentistName: idToName.get(String(d.userId)) || d.dentistName || d.name || undefined,
        day: dayKey,
        date: start,
        slots: displaySlots,
        onLeave: !!leave,
        leaveReason: leave?.reason || null,
        hasCustomSchedule: !!avail, // Track if dentist has custom schedule
      };
    });

    return res.status(200).json({ items, date: start });
  } catch (err) {
    return res.status(500).json({ message: "Failed to get today's schedules" });
  }
};


