// backend/Controllers/ReceptionistLeaveController.js
const Leave = require("../Model/LeaveModel");
const { removeQueueForLeave } = require("./ReceptionistQueueController");
const Appointment = require("../Model/AppointmentModel");
const { sendApptCanceled } = require("../Services/NotificationService");
const ScheduleService = require("../Services/ScheduleService");

async function addLeave(req, res) {
  try {
    const { dentistCode, dentistName, dateFrom, dateTo, reason } = req.body;
    if (!dentistCode || !dateFrom || !dateTo) {
      return res
        .status(400)
        .json({ success: false, message: "dentistCode, dateFrom, dateTo required" });
    }

    // ✅ Check if a leave already exists for the same dentist in the same date range
    const existing = await Leave.findOne({
      dentistCode,
      dateFrom: { $lte: new Date(dateTo) },
      dateTo: { $gte: new Date(dateFrom) },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A leave already exists for this dentist in the selected date range",
      });
    }

    // receptionist code from token
    const createdBy = req.user?.receptionistCode || req.user?.id || "RECEPTIONIST";

    const leave = await Leave.create({
      dentistCode,
      dentistName,
      dateFrom,
      dateTo,
      reason,
      createdBy,
    });

    // Auto-update ScheduleModel - block slots for leave period
    try {
      await ScheduleService.blockSlots(
        dentistCode,
        new Date(dateFrom),
        new Date(dateTo),
        'leave',
        leave._id.toString(),
        reason || "Leave period",
        createdBy
      );
      console.log(`✅ Blocked ScheduleModel slots for receptionist leave: ${leave._id} (${dentistCode})`);
    } catch (scheduleError) {
      console.error(`⚠️ Failed to block ScheduleModel slots for receptionist leave ${leave._id}:`, scheduleError.message);
      // Don't fail the leave creation if schedule update fails
    }

    // Cancel existing appointments for this dentist in this range
    const cancelledAppts = await cancelAppointmentsForLeave(
      dentistCode,
      new Date(dateFrom),
      new Date(dateTo),
      reason
    );

    // Remove queue entries if any
    const removedQueue = await removeQueueForLeave(
      dentistCode,
      new Date(dateFrom),
      new Date(dateTo),
      reason
    );

    return res.status(201).json({
      success: true,
      message: "Leave added successfully",
      leave,
      cancelledAppts,
      removedQueue,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to add leave" });
  }
}

async function listLeaves(req, res) {
  try {
    const { dentistCode } = req.query;
    const q = dentistCode ? { dentistCode } : {};
    const items = await Leave.find(q).sort({ dateFrom: -1 });
    return res.json({ success: true, items });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to list leaves" });
  }
}

async function updateLeave(req, res) {
  try {
    const { id } = req.params;
    const updated = await Leave.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "Leave not found" });
    return res.json({ success: true, updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to update leave" });
  }
}

async function deleteLeave(req, res) {
  try {
    const { id } = req.params;
    const deleted = await Leave.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: "Leave not found" });
    return res.json({ success: true, message: "Leave deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to delete leave" });
  }
}

// Cancel appointments for leave
async function cancelAppointmentsForLeave(
  dentistCode,
  dateFrom,
  dateTo,
  reason = "Dentist on leave"
) {
  try {
    const dayStart = new Date(new Date(dateFrom).setHours(0, 0, 0, 0));
    const dayEnd = new Date(new Date(dateTo).setHours(23, 59, 59, 999));

    const cancelled = await Appointment.find({
      dentist_code: dentistCode,
      appointment_date: { $gte: dayStart, $lte: dayEnd },
      status: { $in: ["pending", "confirmed"] },
      isActive: true,
    });

    if (!cancelled.length) return { count: 0 };

    for (const appt of cancelled) {
      appt.status = "cancelled";
      appt.isActive = false;
      appt.cancellationReason = reason;
      appt.canceledByCode = "LEAVE_AUTO";
      appt.canceledAt = new Date();
      await appt.save();

      try {
        // Format time in local timezone (not UTC)
        const localTime = appt.appointment_date.toLocaleTimeString('en-US', { 
          hour12: false, 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'Asia/Colombo'
        });
        
        await sendApptCanceled(appt.patient_code, {
          appointmentCode: appt.appointmentCode,
          dentistCode: dentistCode,
          date: appt.appointment_date.toISOString().slice(0, 10),
          time: localTime,
          reason,
        });
      } catch (e) {
        console.error("Failed to send cancellation notification", e);
      }
    }

    return { count: cancelled.length };
  } catch (err) {
    console.error("[cancelAppointmentsForLeave]", err);
    throw err;
  }
}

module.exports = { addLeave, listLeaves, updateLeave, deleteLeave };
