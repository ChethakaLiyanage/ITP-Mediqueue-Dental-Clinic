// backend/Controllers/ReceptionistQueueController.js
const Queue = require('../Model/QueueModel');
const Appointment = require('../Model/AppointmentModel');
const { sendApptCanceled, sendApptConfirmed } = require('../Services/NotificationService');

const AVG_SERVICE_MIN = 20;

/* ---------------- Helpers ---------------- */
function ymdToUTC(ymd) {
  const [y, m, d] = (ymd || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return {
    start: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)),
    end: new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)),
  };
}

/* ---------------- Controllers ---------------- */

// list today's queue
async function listQueue(req, res) {
  try {
    const { date, dentistCode } = req.query;
    if (!date) return res.status(400).json({ message: "date is required" });

    const dayStart = new Date(date + "T00:00:00");
    const dayEnd = new Date(date + "T23:59:59");

    const q = { date: { $gte: dayStart, $lte: dayEnd } };
    if (dentistCode) q.dentistCode = dentistCode;

    // ❌ REMOVED: All auto-status updates
    // Dentist manually changes all statuses per requirements

    // ✅ Fetch all items without auto-updating
    const items = await Queue.find(q).sort({ dentistCode: 1, position: 1 }).lean();

    return res.json({ items });
  } catch (e) {
    console.error("[listQueue]", e);
    return res.status(500).json({ message: e.message || "Failed to list queue" });
  }
}

// update queue status (for dentist status changes)
async function updateStatus(req, res) {
  try {
    const { queueCode } = req.params;
    const { status } = req.body;
    
    const updateData = { status };
    
    // ✅ Track timestamps based on status change
    if (status === 'called') {
      updateData.calledAt = new Date();
    } else if (status === 'in_treatment') {
      updateData.startedAt = new Date();
    } else if (status === 'completed') {
      updateData.completedAt = new Date();
    }
    
    const updated = await Queue.findOneAndUpdate(
      { queueCode },
      { $set: updateData },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Queue item not found" });
    return res.json(updated);
  } catch (e) {
    console.error("[updateStatus]", e);
    return res.status(500).json({ message: e.message || "Failed to update" });
  }
}

// migrate appointments to queue
async function migrateToday(req, res) {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const { start, end } = ymdToUTC(dateStr);

    const appts = await Appointment.find({
      status: { $in: ['pending', 'confirmed'] },
      appointment_date: { $gte: start, $lte: end },
    }).lean();

    const toInsert = appts.map((a, idx) => ({
      appointmentCode: a.appointmentCode,
      patientCode: a.patient_code,
      dentistCode: a.dentist_code,
      date: a.appointment_date, // ✅ Full datetime preserved
      position: idx + 1,
      status: "waiting", // ✅ All start as waiting
    }));

    if (toInsert.length) {
      await Queue.insertMany(toInsert);
      // Remove migrated appointments
      const ids = appts.map(a => a._id);
      await Appointment.deleteMany({ _id: { $in: ids } });
    }

    return res.json({ moved: toInsert.length });
  } catch (e) {
    console.error("[migrateToday]", e);
    return res.status(500).json({ message: e.message || "Migration failed" });
  }
}

// ❌ REMOVED: accept() function - not needed per requirements
// Status changes are handled by updateStatus()

// ❌ REMOVED: complete() function - not needed per requirements
// Status changes are handled by updateStatus()

// switch time (Update button - per queue_part4.txt)
async function switchTime(req, res) {
  try {
    const { queueCode } = req.params;
    const { newTime } = req.body;
    const item = await Queue.findOne({ queueCode });
    if (!item) return res.status(404).json({ message: "Queue item not found" });

    const oldTime = item.date;

    // ✅ Track time switch
    item.previousTime = oldTime;
    item.date = new Date(newTime);
    // Status remains 'waiting' - Action column shows "Time switched"
    await item.save();

    // ✅ Send WhatsApp notification (per queue_part4.txt)
    try {
      await sendApptConfirmed(item.patientCode, {
        appointmentCode: item.appointmentCode,
        dentistCode: item.dentistCode,
        date: new Date(newTime).toISOString().slice(0, 10),
        time: new Date(newTime).toISOString().slice(11, 16),
      });
    } catch (e) {
      console.error("[switchTime:notify]", e);
    }

    return res.json({
      message: "Time switched",
      oldTime,
      newTime: item.date,
      item,
    });
  } catch (e) {
    console.error("[switchTime]", e);
    return res.status(500).json({ message: e.message || "Failed to switch time" });
  }
}

// delete and update (Delete & Update button - per queue_part5.txt)
async function deleteAndUpdate(req, res) {
  try {
    const { queueCode } = req.params;
    const { newDentistCode, newDate, newTime, reason } = req.body;

    const item = await Queue.findOne({ queueCode });
    if (!item) return res.status(404).json({ message: "Queue item not found" });

    // ✅ Remove from queue (per queue_part5.txt)
    await Queue.deleteOne({ queueCode });

    // ✅ Insert into Appointment table for different day (per queue_part5.txt)
    const appt = await Appointment.create({
      patient_code: item.patientCode,
      dentist_code: newDentistCode,
      appointment_date: new Date(newDate + "T" + newTime),
      reason: reason || "Rebooked from queue",
      status: "confirmed",
      isActive: true,
      origin: "queue-rebook",
    });

    // ✅ Send WhatsApp notification (per queue_part5.txt)
    try {
      await sendApptConfirmed(item.patientCode, {
        appointmentCode: appt.appointmentCode,
        dentistCode: newDentistCode,
        date: newDate,
        time: newTime,
      });
    } catch (e) {
      console.error("[deleteAndUpdate:notify]", e);
    }

    return res.json({ message: "Deleted from queue and rebooked", appointment: appt });
  } catch (e) {
    console.error("[deleteAndUpdate]", e);
    return res.status(500).json({ message: e.message || "Failed to delete and update" });
  }
}

// ✅ NEW: Cancel button functionality (per queue_part3.txt)
async function cancelAppointment(req, res) {
  try {
    const { queueCode } = req.params;
    const { reason } = req.body;
    
    const item = await Queue.findOne({ queueCode });
    if (!item) return res.status(404).json({ message: "Queue item not found" });

    // ✅ Delete from queue (per queue_part3.txt)
    await Queue.deleteOne({ queueCode });

    // ✅ Send WhatsApp cancellation notification (per queue_part3.txt)
    try {
      await sendApptCanceled(item.patientCode, {
        appointmentCode: item.appointmentCode,
        dentistCode: item.dentistCode,
        date: item.date.toISOString().slice(0, 10),
        time: item.date.toISOString().slice(11, 16),
        reason: reason || "Appointment cancelled",
      });
    } catch (e) {
      console.error("[cancelAppointment:notify]", e);
    }

    return res.json({ message: "Appointment cancelled and removed from queue" });
  } catch (e) {
    console.error("[cancelAppointment]", e);
    return res.status(500).json({ message: e.message || "Failed to cancel" });
  }
}

/* --- remove queue entries when leave cancels appointments --- */
async function removeQueueForLeave(dentistCode, dateFrom, dateTo, reason = "Dentist on leave") {
  const qItems = await Queue.find({
    dentistCode,
    date: { $gte: dateFrom, $lte: dateTo },
  });

  for (const it of qItems) {
    await Queue.deleteOne({ _id: it._id });
    try {
      await sendApptCanceled(it.patientCode, {
        appointmentCode: it.appointmentCode,
        dentistCode: it.dentistCode,
        reason,
      });
    } catch {}
  }

  return qItems.length;
}

module.exports = {
  listQueue,
  updateStatus,
  migrateToday,
  switchTime,
  deleteAndUpdate,
  cancelAppointment, // ✅ NEW export
  removeQueueForLeave,
};