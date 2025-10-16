const Leave = require("../Model/LeaveModel");
const ScheduleService = require("../Services/ScheduleService");

// GET /leave (optional dentistCode)
exports.list = async (req, res) => {
  try {
    const filter = {};
    if (req.query.dentistCode) filter.dentistCode = String(req.query.dentistCode).trim();
    const items = await Leave.find(filter).sort({ dateFrom: -1 }).lean();
    return res.status(200).json({ items });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch leave" });
  }
};

// POST /leave
exports.create = async (req, res) => {
  try {
    const { dentistCode, dentistName, dateFrom, dateTo, reason, createdBy } = req.body || {};
    
    // Debug: Log the received data
    console.log("🔍 Leave creation request body:", req.body);
    console.log("🔍 CreatedBy value:", createdBy);
    
    if (!dentistCode || !dentistName || !dateFrom || !dateTo) {
      return res.status(400).json({ message: "dentistCode, dentistName, dateFrom, dateTo are required" });
    }
    const leaveData = {
      dentistCode: String(dentistCode).trim(),
      dentistName: String(dentistName).trim(),
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      reason: reason || "",
      createdBy: createdBy || "Unknown",
    };
    
    console.log("💾 Creating leave with data:", leaveData);
    
    const doc = await Leave.create(leaveData);

    // Auto-update ScheduleModel - block slots for leave period
    try {
      await ScheduleService.blockSlots(
        dentistCode,
        new Date(dateFrom),
        new Date(dateTo),
        'leave',
        doc._id.toString(),
        reason || "Leave period",
        createdBy || "Unknown"
      );
      console.log(`✅ Blocked ScheduleModel slots for dentist leave: ${doc._id} (${dentistCode})`);
    } catch (scheduleError) {
      console.error(`⚠️ Failed to block ScheduleModel slots for dentist leave ${doc._id}:`, scheduleError.message);
      // Don't fail the leave creation if schedule update fails
    }
    
    console.log("✅ Leave created successfully:", doc);
    console.log("🔍 Created by in saved document:", doc.createdBy);
    
    return res.status(201).json({ leave: doc });
  } catch (err) {
    return res.status(500).json({ message: "Failed to create leave" });
  }
};


