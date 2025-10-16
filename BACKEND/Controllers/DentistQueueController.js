// Controllers/DentistQueueController.js
const Queue = require("../Model/QueueModel");
const Appointment = require("../Model/AppointmentModel");
const Schedule = require("../Model/ScheduleModel");
const Patient = require("../Model/PatientModel");
const User = require("../Model/User");

/**
 * GET today's queue for the logged-in dentist
 */
async function getTodayQueueForDentist(req, res) {
  try {
    const { dentistCode } = req.query;
    if (!dentistCode) {
      return res.status(400).json({ message: "dentistCode required" });
    }

    const today = new Date().toISOString().slice(0, 10);
    const start = new Date(`${today}T00:00:00Z`);
    const end = new Date(`${today}T23:59:59Z`);

    // fetch queues
    const queues = await Queue.find({
      dentistCode,
      date: { $gte: start, $lte: end },
    }).lean();

    // Get unique patient codes for bulk lookup
    const patientCodes = [...new Set(queues.map(q => q.patientCode).filter(Boolean))];
    
    // Bulk fetch patient names for performance
    const patientNameMap = new Map();
    if (patientCodes.length > 0) {
      try {
        const patients = await Patient.find({ 
          patientCode: { $in: patientCodes } 
        }).populate('userId', 'name').lean();
        
        patients.forEach(patient => {
          const name = patient.userId?.name || "Unknown";
          patientNameMap.set(patient.patientCode, name);
        });
      } catch (error) {
        console.error('Error bulk fetching patient names:', error.message);
      }
    }

    // join with appointment + patient + user details
    const withDetails = await Promise.all(
      queues.map(async (q) => {
        try {
          let appt = await Appointment.findOne({
            appointmentCode: q.appointmentCode,
          }).lean();

          if (!appt) {
            // Fallback: try to infer appointment by date/dentist/patient
            try {
              const day = new Date(q.date);
              const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
              const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);

              appt = await Appointment.findOne({
                dentist_code: q.dentistCode,
                appointment_date: { $gte: start, $lte: end },
                $or: [
                  { patient_code: q.patientCode },
                  { bookerPatientCode: q.patientCode },
                  { appointmentForPatientCode: q.patientCode },
                ],
              })
                .sort({ appointment_date: 1 })
                .lean();
            } catch {}

            if (!appt) {
              // Final fallback: try schedule to extract reason
              let reason = "-";
              
              try {
                // Try to get reason from schedule
                const d = new Date(q.date);
                const s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
                const e = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
                const sched = await Schedule.findOne({
                  dentistCode: q.dentistCode,
                  date: { $gte: s, $lte: e },
                  patientCode: q.patientCode,
                })
                  .sort({ date: 1 })
                  .lean();

                if (sched?.reason) {
                  reason = sched.reason;
                }
              } catch (error) {
                console.error('Error in fallback schedule lookup:', error.message);
              }

              console.warn('⚠️ No appointment found for queue:', q.appointmentCode, 'Using fallback data');
              return {
                ...q,
                queueNo: q.queueCode,
                patientCode: q.patientCode,
                patientName: patientNameMap.get(q.patientCode) || "Unknown",
                reason: reason,
                appointment_date: q.date,
                isBookingForSomeoneElse: false,
              };
            }
          }

          console.log('🔍 Queue item:', q.appointmentCode, 'isBookingForSomeoneElse:', appt?.isBookingForSomeoneElse);
          if (appt?.isBookingForSomeoneElse) {
            console.log('✅ Found booking for someone else:', appt.otherPersonDetails);
          }

          // Check if this is a "booking for someone else" appointment
          if (appt?.isBookingForSomeoneElse) {
            // For "booking for someone else": Show other person's details with booker's ID for identification
            return {
              ...q,
              queueNo: q.queueCode,
              reason: appt?.reason || "-",
              appointment_date: appt?.appointment_date || q.date,
              patientCode: appt.bookerPatientCode || "N/A", // ✅ BOOKER'S PATIENT ID (for identification)
              patientName: appt.otherPersonDetails?.name || "-", // ✅ OTHER PERSON'S NAME (who needs treatment)
              patientContact: appt.otherPersonDetails?.contact || "-",
              patientAge: appt.otherPersonDetails?.age || null,
              patientGender: appt.otherPersonDetails?.gender || null,
              patientRelation: appt.otherPersonDetails?.relation || null,
              patientNotes: appt.otherPersonDetails?.notes || null,
              // Booker information (who made the booking) - same as patientCode for clarity
              bookerPatientCode: appt.bookerPatientCode, // ✅ YOUR PATIENT ID
              appointmentForPatientCode: appt.appointmentForPatientCode || null, // If other person is registered
              isBookingForSomeoneElse: true,
            };
          }

          // Regular appointment: Show normal patient details
          const patientCode = appt?.patient_code || q.patientCode;
          const patientName = patientNameMap.get(patientCode) || "Unknown";

          return {
            ...q,
            queueNo: q.queueCode,
            reason: appt?.reason || "-",
            appointment_date: appt?.appointment_date || q.date,
            patientCode: patientCode,
            patientName: patientName, // ✅ from bulk lookup
            isBookingForSomeoneElse: false,
          };
        } catch (itemError) {
          console.error('❌ Error processing queue item:', q.appointmentCode, itemError.message);
          // Return a safe fallback to prevent entire request from failing
          return {
            ...q,
            queueNo: q.queueCode,
            patientCode: q.patientCode,
            patientName: patientNameMap.get(q.patientCode) || "Unknown",
            reason: "-",
            appointment_date: q.date,
            isBookingForSomeoneElse: false,
          };
        }
      })
    );

    console.log('✅ Returning', withDetails.length, 'queue items to dentist');
    res.json(withDetails);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/**
 * PATCH – update queue status for a dentist's patient
 */
async function updateQueueStatus(req, res) {
  try {
    const { id } = req.params;
    const { dentistCode, status } = req.body;

    if (!dentistCode) {
      return res.status(400).json({ message: "dentistCode is required" });
    }

    const q = await Queue.findOne({ _id: id, dentistCode });
    if (!q) {
      return res
        .status(404)
        .json({ message: "Queue entry not found for this dentist" });
    }

    if (status) q.status = status;
    await q.save();

    res.json(q);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = {
  getTodayQueueForDentist,
  updateQueueStatus,
};
