// Jobs/notificationCron.js
const cron = require('node-cron');
const Appointment = require('../Model/AppointmentModel');
const Queue = require('../Model/QueueModel');
const Notify = require('../Services/NotificationService');

// format helpers
function toDate(d) {
  try {
    const dt = new Date(d);
    return dt.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}
function toTime(d) {
  try {
    const dt = new Date(d);
    // Format time in local timezone (not UTC)
    return dt.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'Asia/Colombo'
    });
  } catch {
    return '';
  }
}

/* ---------------- Auto-confirm expired pending appointments ---------------- */
async function autoConfirmExpiredPending() {
  const now = new Date();
  console.log(`[autoConfirmExpiredPending] Running at ${now.toISOString()}`);

  // Find appointments with pendingExpiresAt field
  const expired = await Appointment.find({
    status: 'pending',
    pendingExpiresAt: { $lte: now },
  }).limit(200).lean();

  // Find appointments without pendingExpiresAt but created more than 4 hours ago
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const expiredByTime = await Appointment.find({
    status: 'pending',
    $or: [
      { pendingExpiresAt: { $exists: false } },
      { pendingExpiresAt: null }
    ],
    createdAt: { $lte: fourHoursAgo }
  }).limit(200).lean();

  const allExpired = [...expired, ...expiredByTime];
  console.log(`[autoConfirmExpiredPending] Found ${allExpired.length} expired appointments:`, 
    allExpired.map(a => ({ 
      appointmentCode: a.appointmentCode, 
      status: a.status, 
      createdAt: a.createdAt,
      fourHoursAgo: fourHoursAgo.toISOString()
    }))
  );

  if (!allExpired.length) {
    console.log(`[autoConfirmExpiredPending] No expired appointments found`);
    return;
  }

  for (const appt of allExpired) {
    try {
      console.log(`[autoConfirmExpiredPending] Processing appointment ${appt.appointmentCode}`);
      
      // Auto-confirm the appointment instead of cancelling
      const updateResult = await Appointment.updateOne(
        { _id: appt._id, status: 'pending' },
        {
          $set: {
            status: 'confirmed',
            acceptedByCode: 'SYSTEM',
            acceptedAt: now,
            autoConfirmedAt: now,
          },
          $unset: { pendingExpiresAt: '' },
        }
      );
      
      console.log(`[autoConfirmExpiredPending] Update result for ${appt.appointmentCode}:`, updateResult);

      // Send enhanced confirmation notification to patient
      if (appt.patient_code || appt.guestInfo?.phone) {
        try {
          // Get patient contact information
          let contactInfo = null;
          if (appt.patient_code) {
            contactInfo = await Notify.getPatientContact(appt.patient_code);
          } else if (appt.guestInfo) {
            contactInfo = {
              phone: appt.guestInfo.phone,
              email: appt.guestInfo.email,
              name: appt.guestInfo.name
            };
          }

          if (contactInfo?.phone) {
            // Send WhatsApp confirmation with PDF
            const result = await Notify.sendAppointmentConfirmed({
              to: contactInfo.phone,
              patientType: appt.patientType || (appt.isGuestBooking ? 'unregistered' : 'registered'),
              patientCode: appt.patient_code,
              dentistCode: appt.dentist_code,
              appointmentCode: appt.appointmentCode,
              datetimeISO: appt.appointment_date.toISOString(),
              reason: appt.reason,
              patientName: contactInfo.name || appt.patientSnapshot?.name,
              phone: contactInfo.phone,
              email: contactInfo.email,
              nic: appt.patientSnapshot?.nic,
              passport: appt.patientSnapshot?.passport
            });

            // Update appointment with confirmation status
            await Appointment.updateOne(
              { _id: appt._id },
              {
                $set: {
                  'confirmationStatus.whatsappSent': result.whatsapp.status === 'success',
                  'confirmationStatus.whatsappSentAt': result.whatsapp.status === 'success' ? new Date() : null,
                  'confirmationStatus.whatsappError': result.whatsapp.status === 'failed' ? result.whatsapp.error : null,
                  'confirmationStatus.pdfSent': result.pdf.status === 'success',
                  'confirmationStatus.pdfSentAt': result.pdf.status === 'success' ? new Date() : null,
                  'confirmationStatus.pdfError': result.pdf.status === 'failed' ? result.pdf.error : null,
                  'confirmationStatus.confirmationMessage': result.message
                }
              }
            );

            console.log(`[cron:auto-confirm] Sent confirmation for ${appt.appointmentCode}: WhatsApp=${result.whatsapp.status}, PDF=${result.pdf.status}`);
          } else {
            console.log(`[cron:auto-confirm] No phone number found for appointment ${appt.appointmentCode}`);
          }
        } catch (notificationError) {
          console.error('[cron:auto-confirm][notification-error]', appt.appointmentCode, notificationError);
          
          // Update appointment with error status
          await Appointment.updateOne(
            { _id: appt._id },
            {
              $set: {
                'confirmationStatus.whatsappError': String(notificationError),
                'confirmationStatus.pdfError': String(notificationError)
              }
            }
          );
        }
      }

      console.log(`[cron:auto-confirm] Auto-confirmed appointment: ${appt.appointmentCode}`);
    } catch (err) {
      console.error('[cron:auto-confirm][error]', appt.appointmentCode, err);
    }
  }
}

/* ---------------- Migrate Appointments to Queue (Dawn) ---------------- */
async function migrateAppointmentsToQueue() {
  const today = "2025-10-17"; // Hardcoded to work with 2025-10-17
  const start = new Date(`${today}T00:00:00Z`);
  const end = new Date(`${today}T23:59:59Z`);

  try {
    // ✅ STEP 1: Delete ALL entries BEFORE today (not just yesterday)
    // This removes 9/21 and any older entries
    await Queue.deleteMany({ 
      date: { $lt: start } 
    });

    console.log(`[cron:migrate] Deleted all queue entries before ${today}`);

    // ✅ Keep existing today's queue items (they were created directly from appointments)
    // Only migrate appointments that are NOT already in the queue

    // ✅ STEP 2: Find today's confirmed/pending appointments
    const todaysAppts = await Appointment.find({
      appointment_date: { $gte: start, $lte: end },
      status: { $in: ['pending', 'confirmed'] },
      isActive: true,
    }).lean();

    if (!todaysAppts.length) {
      console.log(`[cron:migrate] No appointments to migrate for ${today}`);
      return;
    }

    // ✅ Check which appointments are NOT already in queue to avoid duplicates
    const existingQueueAppointmentCodes = await Queue.find({
      date: { $gte: start, $lte: end }
    }).distinct('appointmentCode');
    
    const appointmentsToMigrate = todaysAppts.filter(appt => 
      !existingQueueAppointmentCodes.includes(appt.appointmentCode)
    );
    
    console.log(`[cron:migrate] ${appointmentsToMigrate.length} appointments need migration (${todaysAppts.length - appointmentsToMigrate.length} already in queue)`);

    if (!appointmentsToMigrate.length) {
      console.log(`[cron:migrate] All appointments already in queue for ${today}`);
      return;
    }

    // ✅ STEP 3: Insert into queue - preserve full datetime, set status as 'waiting'
    let position = 1;
    for (const appt of appointmentsToMigrate) {
      try {
        await Queue.create({
          appointmentCode: appt.appointmentCode,
          patientCode: appt.patient_code,
          dentistCode: appt.dentist_code,
          date: appt.appointment_date, // ✅ Full datetime preserved
          position: position++,
          status: 'waiting', // ✅ All start as waiting
        });

        // ✅ STEP 4: Remove from Appointment table
        await Appointment.deleteOne({ _id: appt._id });
      } catch (err) {
        console.error('[cron:migrate][error]', appt.appointmentCode, err);
      }
    }

    console.log(`[cron:migrate] Migrated ${appointmentsToMigrate.length} appointments to queue for ${today}`);
  } catch (e) {
    console.error('[cron:migrate][fatal]', e);
  }
}

/* ---------------- Reminder: notify patients 24h before ---------------- */
async function sendTomorrowReminders() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tStart = new Date(toDate(tomorrow) + "T00:00:00");
  const tEnd = new Date(toDate(tomorrow) + "T23:59:59");

  try {
    const appts = await Appointment.find({
      appointment_date: { $gte: tStart, $lte: tEnd },
      status: 'confirmed',
      isActive: true,
    }).lean();

    for (const appt of appts) {
      try {
        await Notify.sendReminder(appt.patient_code, {
          appointmentCode: appt.appointmentCode,
          dentistCode: appt.dentist_code,
          date: toDate(appt.appointment_date),
          time: toTime(appt.appointment_date),
          patientType: appt.patientType,
          patientName: appt.patientSnapshot?.name,
        });
      } catch (err) {
        console.error('[cron:reminder][error]', appt.appointmentCode, err);
      }
    }

    if (appts.length) {
      console.log(`[cron:reminder] Sent ${appts.length} reminders for tomorrow`);
    }
  } catch (e) {
    console.error('[cron:reminder][fatal]', e);
  }
}

/* ---------------- CRON SCHEDULES ---------------- */

// every minute → auto-confirm + process notifications
cron.schedule('* * * * *', async () => {
  try {
    await autoConfirmExpiredPending();
  } catch (e) {
    console.error('[cron:auto-confirm][fatal]', e);
  }

  try {
    await Notify.processDueQueue();
  } catch (e) {
    console.error('[cron:processDueQueue][fatal]', e);
  }
});

// ✅ every midnight (00:00) → migrate appointments (per queue_part6.txt)
cron.schedule('0 0 * * *', async () => {
  try {
    await migrateAppointmentsToQueue();
  } catch (e) {
    console.error('[cron:migrate][fatal]', e);
  }
});

// every day 09:00 → send tomorrow reminders
cron.schedule('0 9 * * *', async () => {
  try {
    await sendTomorrowReminders();
  } catch (e) {
    console.error('[cron:reminder][fatal]', e);
  }
});

// run once on boot
(async () => {
  try {
    await autoConfirmExpiredPending();
    await Notify.processDueQueue();
  } catch (e) {
    console.error('[cron:init-run][fatal]', e);
  }
})();