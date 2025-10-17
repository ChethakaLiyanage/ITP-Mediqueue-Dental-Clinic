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
    
    // ✅ Only allow today's date (2025/10/17) - ignore any other date requests
    const today = "2025-10-17"; // Hardcoded to show only 2025-10-17 appointments
    
    // ✅ Force today's date regardless of what's requested
    const dayStart = new Date(today + "T00:00:00");
    const dayEnd = new Date(today + "T23:59:59");

    const q = { date: { $gte: dayStart, $lte: dayEnd } };
    if (dentistCode) q.dentistCode = dentistCode;

    // ❌ REMOVED: All auto-status updates
    // Dentist manually changes all statuses per requirements

    // ✅ Fetch only today's items without auto-updating
    const items = await Queue.find(q).sort({ date: 1 }).lean();

    // ✅ Add patient names to queue items
    const Patient = require('../Model/PatientModel');
    const User = require('../Model/User');
    
    const enrichedItems = await Promise.all(items.map(async (item) => {
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
          console.error(`[listQueue] Error fetching patient name for ${item.patientCode}:`, error);
        }
      }
      
      return {
        ...item,
        patientName
      };
    }));

    console.log(`[listQueue] Showing only today's (${today}) appointments: ${enrichedItems.length} items`);
    return res.json({ items: enrichedItems });
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
    // ✅ Only work with today's date (2025-10-17) - ignore any other date requests
    const today = "2025-10-17"; // Hardcoded to work with 2025-10-17
    const { start, end } = ymdToUTC(today);

    // ✅ First, remove any yesterday's queue items (any status) to clean up old data
    const yesterday = "2025-10-16"; // Hardcoded yesterday date
    const yesterdayStart = new Date(yesterday + "T00:00:00");
    const yesterdayEnd = new Date(yesterday + "T23:59:59");
    
    const removedYesterday = await Queue.deleteMany({
      date: { $gte: yesterdayStart, $lte: yesterdayEnd }
    });
    
    if (removedYesterday.deletedCount > 0) {
      console.log(`[migrateToday] Removed ${removedYesterday.deletedCount} yesterday's queue items`);
    }

    // ✅ Keep existing today's queue items (they were created directly from appointments)
    // Only migrate appointments that are NOT already in the queue

    const appts = await Appointment.find({
      status: { $in: ['pending', 'confirmed'] },
      appointment_date: { $gte: start, $lte: end },
    }).lean();

    console.log(`[migrateToday] Found ${appts.length} appointments for today (${today})`);
    
    const validAppts = appts.filter((a) => a.patient_code && a.dentist_code && a.appointmentCode);
    const invalidAppts = appts.filter((a) => !a.patient_code || !a.dentist_code || !a.appointmentCode);
    
    if (invalidAppts.length > 0) {
      console.log(`[migrateToday] Skipping ${invalidAppts.length} invalid appointments:`, 
        invalidAppts.map(a => ({ 
          id: a._id, 
          patient_code: a.patient_code, 
          dentist_code: a.dentist_code, 
          appointmentCode: a.appointmentCode 
        }))
      );
    }

    // ✅ Check which appointments are NOT already in queue to avoid duplicates
    const existingQueueAppointmentCodes = await Queue.find({
      date: { $gte: start, $lte: end }
    }).distinct('appointmentCode');
    
    const appointmentsToMigrate = validAppts.filter(appt => 
      !existingQueueAppointmentCodes.includes(appt.appointmentCode)
    );
    
    console.log(`[migrateToday] ${appointmentsToMigrate.length} appointments need migration (${validAppts.length - appointmentsToMigrate.length} already in queue)`);

    const toInsert = appointmentsToMigrate.map((a, idx) => ({
      appointmentCode: a.appointmentCode,
      patientCode: a.patient_code,
      dentistCode: a.dentist_code,
      date: a.appointment_date, // ✅ Full datetime preserved
      position: idx + 1,
      status: "waiting", // ✅ All start as waiting
    }));

    if (toInsert.length) {
      // Create queue items individually to trigger pre('save') middleware for queueCode generation
      const queueItems = [];
      for (const itemData of toInsert) {
        const queueItem = new Queue(itemData);
        await queueItem.save(); // This will trigger pre('save') and generate queueCode
        console.log(`[migrateToday] Created queue item with queueCode: ${queueItem.queueCode}`);
        queueItems.push(queueItem);
      }
      
      // Remove only the appointments that were successfully migrated
      const migratedAppointmentCodes = toInsert.map(item => item.appointmentCode);
      await Appointment.deleteMany({ appointmentCode: { $in: migratedAppointmentCodes } });
    }

    return res.json({ 
      moved: toInsert.length, 
      removedYesterday: removedYesterday.deletedCount,
      alreadyInQueue: validAppts.length - appointmentsToMigrate.length,
      date: today 
    });
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
    
    console.log(`[switchTime] Request for queueCode: ${queueCode}`);
    console.log(`[switchTime] New time: ${newTime}`);
    
    const item = await Queue.findOne({ queueCode });
    if (!item) {
      console.log(`[switchTime] Queue item not found for code: ${queueCode}`);
      return res.status(404).json({ message: "Queue item not found" });
    }

    console.log(`[switchTime] Found item:`, {
      queueCode: item.queueCode,
      patientCode: item.patientCode,
      oldDate: item.date,
      newTime: newTime
    });

    const oldTime = item.date;

    // ✅ Track time switch
    item.previousTime = oldTime;
    item.date = new Date(newTime);
    // Status remains 'waiting' - Action column shows "Time switched"
    
    console.log(`[switchTime] Before save - item.date:`, item.date);
    const savedItem = await item.save();
    console.log(`[switchTime] After save - savedItem.date:`, savedItem.date);
    
    // Verify the update by querying the database again
    const verifyItem = await Queue.findOne({ queueCode });
    console.log(`[switchTime] Verification query - verifyItem.date:`, verifyItem.date);

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