const Leave = require("../Model/LeaveModel");
const Dentist = require("../Model/DentistModel");
const ScheduleService = require("../Services/ScheduleService");

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function addLeave(req, res) {
  try {
    const { dentistCode, dateFrom, dateTo, reason, createdBy } = req.body || {};

    if (!dentistCode) {
      return res.status(400).json({ message: "dentistCode is required" });
    }

    if (!dateFrom || !dateTo) {
      return res.status(400).json({ message: "dateFrom and dateTo are required" });
    }

    const fromDate = parseDate(dateFrom);
    const toDate = parseDate(dateTo);

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    if (fromDate > toDate) {
      return res.status(400).json({ message: "dateFrom cannot be later than dateTo" });
    }

    const dentist = await Dentist.findOne({ dentistCode }).lean();
    if (!dentist) {
      return res.status(404).json({ message: "Dentist not found" });
    }

    const overlap = await Leave.findOne({
      dentistCode,
      dateFrom: { $lte: toDate },
      dateTo: { $gte: fromDate },
    }).lean();

    if (overlap) {
      return res.status(409).json({
        message: "Leave period overlaps with existing leave",
        existingLeave: overlap,
      });
    }

    const leave = await Leave.create({
      dentistCode,
      dentistName: dentist.name || (req.body && req.body.dentistName) || dentistCode,
      dateFrom: fromDate,
      dateTo: toDate,
      reason: reason || "Not available",
      createdBy: createdBy || "system",
    });

    // Auto-update ScheduleModel - block slots for leave period
    try {
      await ScheduleService.blockSlots(
        dentistCode,
        fromDate,
        toDate,
        'leave',
        leave._id.toString(),
        reason || "Leave period",
        createdBy || "system"
      );
      console.log(`✅ Blocked ScheduleModel slots for leave: ${leave._id} (${dentistCode})`);
    } catch (scheduleError) {
      console.error(`⚠️ Failed to block ScheduleModel slots for leave ${leave._id}:`, scheduleError.message);
      // Don't fail the leave creation if schedule update fails
    }

    return res.status(201).json({
      message: "Leave period added successfully",
      leave,
    });
  } catch (error) {
    console.error("addLeave error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
}

async function listLeaves(req, res) {
  try {
    const { dentistCode } = req.query || {};
    const filter = dentistCode ? { dentistCode: String(dentistCode).trim() } : {};
    const leaves = await Leave.find(filter).sort({ dateFrom: -1 }).lean();
    return res.status(200).json(leaves);
  } catch (error) {
    console.error("listLeaves error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
}

async function getDentistLeaves(req, res) {
  try {
    const { dentistCode } = req.params;
    const { from, to } = req.query || {};

    if (!dentistCode) {
      return res.status(400).json({ message: "dentistCode is required" });
    }

    const filter = { dentistCode };
    if (from || to) {
      const fromDate = from ? parseDate(from) : null;
      const toDate = to ? parseDate(to) : null;

      if ((from && !fromDate) || (to && !toDate)) {
        return res.status(400).json({ message: "Invalid date range" });
      }

      filter.dateFrom = { $lte: toDate || new Date("2099-12-31") };
      filter.dateTo = { $gte: fromDate || new Date("1900-01-01") };
    }

    const leaves = await Leave.find(filter).sort({ dateFrom: 1 }).lean();

    return res.status(200).json({
      dentistCode,
      leaves,
      count: leaves.length,
    });
  } catch (error) {
    console.error("getDentistLeaves error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
}

async function updateLeave(req, res) {
  try {
    const { id } = req.params;
    const { dateFrom, dateTo, reason } = req.body || {};

    if (!id) {
      return res.status(400).json({ message: "Leave id is required" });
    }

    const leave = await Leave.findById(id);
    if (!leave) {
      return res.status(404).json({ message: "Leave period not found" });
    }

    const nextFrom = dateFrom ? parseDate(dateFrom) : leave.dateFrom;
    const nextTo = dateTo ? parseDate(dateTo) : leave.dateTo;

    if ((dateFrom && !nextFrom) || (dateTo && !nextTo)) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    if (nextFrom > nextTo) {
      return res.status(400).json({ message: "dateFrom cannot be later than dateTo" });
    }

    const overlap = await Leave.findOne({
      _id: { $ne: leave._id },
      dentistCode: leave.dentistCode,
      dateFrom: { $lte: nextTo },
      dateTo: { $gte: nextFrom },
    }).lean();

    if (overlap) {
      return res.status(409).json({
        message: "Leave period overlaps with existing leave",
        existingLeave: overlap,
      });
    }

    // Store old values for ScheduleModel update
    const oldFrom = leave.dateFrom;
    const oldTo = leave.dateTo;
    
    leave.dateFrom = nextFrom;
    leave.dateTo = nextTo;
    if (reason !== undefined) {
      leave.reason = reason;
    }

    await leave.save();

    // Auto-update ScheduleModel if dates changed
    if (oldFrom.getTime() !== nextFrom.getTime() || oldTo.getTime() !== nextTo.getTime()) {
      try {
        // Unblock old slots first
        await ScheduleService.unblockSlots(
          leave.dentistCode,
          oldFrom,
          oldTo,
          leave.createdBy || "system"
        );
        
        // Block new slots
        await ScheduleService.blockSlots(
          leave.dentistCode,
          nextFrom,
          nextTo,
          'leave',
          leave._id.toString(),
          leave.reason || "Leave period",
          leave.createdBy || "system"
        );
        
        console.log(`✅ Updated ScheduleModel slots for leave update: ${leave._id} (${leave.dentistCode})`);
      } catch (scheduleError) {
        console.error(`⚠️ Failed to update ScheduleModel slots for leave update ${leave._id}:`, scheduleError.message);
        // Don't fail the leave update if schedule update fails
      }
    }

    return res.status(200).json({
      message: "Leave period updated successfully",
      leave,
    });
  } catch (error) {
    console.error("updateLeave error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
}

async function deleteLeave(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "Leave id is required" });
    }

    const leave = await Leave.findById(id);
    if (!leave) {
      return res.status(404).json({ message: "Leave period not found" });
    }

    // Auto-update ScheduleModel - unblock slots for leave period
    try {
      await ScheduleService.unblockSlots(
        leave.dentistCode,
        leave.dateFrom,
        leave.dateTo,
        leave.createdBy || "system"
      );
      console.log(`✅ Unblocked ScheduleModel slots for deleted leave: ${leave._id} (${leave.dentistCode})`);
    } catch (scheduleError) {
      console.error(`⚠️ Failed to unblock ScheduleModel slots for deleted leave ${leave._id}:`, scheduleError.message);
      // Don't fail the deletion if schedule update fails
    }

    await Leave.findByIdAndDelete(id);

    return res.status(200).json({ message: "Leave period deleted successfully" });
  } catch (error) {
    console.error("deleteLeave error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
}

async function checkAvailability(req, res) {
  try {
    const { dentistCode, date } = req.query || {};

    if (!dentistCode || !date) {
      return res.status(400).json({ message: "dentistCode and date are required" });
    }

    const checkDate = parseDate(date);
    if (!checkDate) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    const onLeave = await Leave.exists({
      dentistCode,
      dateFrom: { $lte: checkDate },
      dateTo: { $gte: checkDate },
    });

    return res.status(200).json({
      dentistCode,
      date,
      isAvailable: !onLeave,
      isOnLeave: Boolean(onLeave),
    });
  } catch (error) {
    console.error("checkAvailability error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
}

module.exports = {
  addLeave,
  listLeaves,
  getDentistLeaves,
  updateLeave,
  deleteLeave,
  checkAvailability,
};


