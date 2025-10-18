// Controllers/ReceptionistAppointmentController.js
const Appointment = require('../Model/AppointmentModel');
const Queue = require('../Model/QueueModel');
const UnregisteredPatient = require('../Model/UnregisteredPatientModel');
const Receptionist = require('../Model/ReceptionistModel');
const Patient = require('../Model/PatientModel');
const User = require('../Model/User');
const { fromDateTimeYMD_HM, dayStartUTC, dayEndUTC } = require('../utils/time');
const {
  sendApptConfirmed,
  sendApptCanceled,
  scheduleApptReminder24h,
  sendAppointmentPdf,
} = require('../Services/NotificationService');
const NotificationService = require('../Services/NotificationService');

const DAILY_CAP = 20;
const PENDING = 'pending';
const CONFIRMED = 'confirmed';
const ACTIVE_STATUSES = [PENDING, CONFIRMED, 'completed'];

function isToday(dateObj) {
  const today = new Date();
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const appointmentLocal = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  return appointmentLocal.getTime() === todayLocal.getTime();
}

async function resolveReceptionistContext(req, fallback) {
  console.log('🔍 Resolving receptionist context:', {
    user: req.user,
    fallback: fallback
  });
  
  let code = req.user?.receptionistCode || req.user?.code || null;
  let doc = null;
  
  console.log('🔍 Initial code from req.user:', code);
  
  if (req.user?._id) {
    doc = await Receptionist.findOne({ userId: req.user._id }, 'receptionistCode').lean();
    console.log('🔍 Found receptionist doc:', doc);
    if (doc?.receptionistCode) code = doc.receptionistCode;
  }
  if (!doc && code) {
    doc = await Receptionist.findOne({ receptionistCode: code }, 'receptionistCode').lean();
    console.log('🔍 Found receptionist doc by code:', doc);
  }
  if (!code && fallback) code = fallback;
  
  console.log('🔍 Final resolved code:', code);
  return { code: code || null, doc };
}

async function countDentistDay(dentist_code, dateStr) {
  const s = dayStartUTC(dateStr);
  const e = dayEndUTC(dateStr);
  return Appointment.countDocuments({
    dentist_code,
    status: { $in: [PENDING, CONFIRMED] },
    appointment_date: { $gte: s, $lte: e },
  });
}

async function hasOverlap(dentist_code, when, excludeAppointmentCode = null) {
  const q = {
    dentist_code,
    appointment_date: when,
    isActive: true,
    status: { $in: ACTIVE_STATUSES },
  };
  if (excludeAppointmentCode) q.appointmentCode = { $ne: excludeAppointmentCode };
  return !!(await Appointment.exists(q));
}

async function nextQueuePosition(dentistCode, dateStr) {
  const s = dayStartUTC(dateStr);
  const e = dayEndUTC(dateStr);
  const last = await Queue.find({ dentistCode, date: { $gte: s, $lte: e } })
    .sort({ position: -1 })
    .limit(1)
    .lean();
  return last.length ? last[0].position + 1 : 1;
}

function buildUnregisteredSnapshot(body = {}) {
  return {
    name: body.name?.trim() || null,
    phone: body.phone?.trim() || null,
    email: body.email?.trim() || null,
    age: typeof body.age === 'number' ? body.age : body.age ? Number(body.age) || null : null,
    identityNumber: body.identityNumber?.trim() || body.nic?.trim() || null,
  };
}

async function resolveRegisteredPhone(patientCode) {
  const p = await Patient.findOne({ patientCode }).select('userId').lean();
  if (!p?.userId) return null;
  const u = await User.findById(p.userId).select('contact_no phone').lean();
  return u?.contact_no || u?.phone || null;
}
async function resolveUnregisteredPhone(unregCode) {
  const up = await UnregisteredPatient.findOne({ unregisteredPatientCode: unregCode })
    .select('phone')
    .lean();
  return up?.phone || null;
}

/* ---------------- Create Appointment ---------------- */
async function createByReceptionist(req, res) {
  try {
    const {
      patientCode,
      dentistCode,
      date,
      time,
      reason = '',
      confirmNow,
      patientType: incomingPatientType,
      patientSnapshot: incomingSnapshot,
    } = req.body || {};

    if (!patientCode || !dentistCode || !date || !time) {
      return res
        .status(400)
        .json({ message: 'patientCode, dentistCode, date, time are required' });
    }

    const { code: receptionistCode } = await resolveReceptionistContext(
      req,
      req.body?.receptionistCode
    );
    if (!receptionistCode) {
      return res
        .status(400)
        .json({ message: 'Unable to resolve receptionist code from session' });
    }

    const when = fromDateTimeYMD_HM(date, time);
    if (!when) return res.status(400).json({ message: 'Invalid time HH:mm' });

    // Determine if appointment should be confirmed immediately or pending
    // - Appointments FOR today: confirm immediately (direct to queue)
    // - Future appointments: create as pending (auto-confirm after 4 hours)
    const shouldConfirmNow = confirmNow !== undefined ? confirmNow : isToday(when);

    const patientType =
      incomingPatientType === 'unregistered' ? 'unregistered' : 'registered';
    let patientSnapshot = undefined;

    if (patientType === 'unregistered') {
      const snapshot = buildUnregisteredSnapshot(incomingSnapshot || {});
      if (!snapshot.name || !snapshot.phone) {
        const up = await UnregisteredPatient.findOne({
          unregisteredPatientCode: patientCode,
        }).lean();
        if (up) {
          snapshot.name = snapshot.name || up.name || null;
          snapshot.phone = snapshot.phone || up.phone || null;
          snapshot.email = snapshot.email || up.email || null;
          snapshot.identityNumber =
            snapshot.identityNumber || up.identityNumber || null;
        }
      }
      if (!snapshot.name || !snapshot.phone) {
        return res
          .status(400)
          .json({ message: 'Unregistered patient requires name and phone' });
      }
      
      //  Phone number  validation
      if (!/^\d{10}$/.test(snapshot.phone)) {
        return res.status(400).json({ 
          message: 'Phone number must be exactly 10 digits' 
        });
      }
      
     patientSnapshot = snapshot;
    }

   // Check if patient already has appointment at this exact time
    const existingAppointment = await Appointment.findOne({
      patient_code: patientCode,
      appointment_date: when,
      isActive: true,
      status: { $in: ['pending', 'confirmed', 'completed'] }
    });

    if (existingAppointment) {
      return res.status(409).json({ 
        message: 'This patient already has an appointment at this time' 
      });
    }

    //  Direct to Queue if appointment is for today
    if (shouldConfirmNow && isToday(when)) {
      const position = await nextQueuePosition(dentistCode, date);
      const queue = await Queue.create({
        appointmentCode: `TMP-${Date.now()}`,
        patientCode,
        dentistCode,
        date: when, // FIX: use actual datetime
        position,
        status: 'waiting',
        reason: reason || 'General consultation',
      });

      // Create appointment record for tracking (but it's already confirmed)
      const appointment = await Appointment.create({
        patient_code: patientCode,
        dentist_code: dentistCode,
        appointment_date: when,
        reason,
        status: CONFIRMED,
        origin: 'receptionist',
        patientType,
        patientSnapshot,
        createdByCode: receptionistCode,
        acceptedByCode: receptionistCode,
        acceptedAt: new Date(),
        pendingExpiresAt: null,
        isActive: true,
      });

      // Update queue with actual appointment code
      await Queue.updateOne(
        { _id: queue._id },
        { appointmentCode: appointment.appointmentCode }
      );

      // Send enhanced confirmation with WhatsApp and PDF
      try {
        const Notify = require('../Services/NotificationService');
        const contactInfo = await Notify.getPatientContact(patientCode);
        
        if (contactInfo?.phone) {
          const result = await Notify.sendAppointmentConfirmed({
            to: contactInfo.phone,
            patientType: patientType,
            patientCode: patientCode,
            dentistCode: dentistCode,
            appointmentCode: appointment.appointmentCode,
            datetimeISO: when.toISOString(),
            reason: reason,
            patientName: contactInfo.name || patientSnapshot?.name,
            phone: contactInfo.phone,
            email: contactInfo.email,
            nic: contactInfo.nic,
            passport: contactInfo.passport
          });

          // Update appointment with confirmation status
          await Appointment.updateOne(
            { _id: appointment._id },
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

          console.log(`[Today's Appointment] Sent confirmation for ${appointment.appointmentCode}: WhatsApp=${result.whatsapp.status}, PDF=${result.pdf.status}`);
        }
      } catch (notificationError) {
        console.error('[Today\'s Appointment][notification-error]', appointment.appointmentCode, notificationError);
      }

      return res.status(201).json({
        message: 'Appointment confirmed and added to queue',
        appointment: {
          appointmentCode: appointment.appointmentCode,
          status: 'confirmed',
          queuePosition: position,
          date: when,
          patientCode,
          dentistCode,
        },
      });
    }

    // Normal Appointment flow
    const total = await countDentistDay(dentistCode, date);
    if (shouldConfirmNow && total >= DAILY_CAP) {
      return res
        .status(409)
        .json({ message: `Daily cap ${DAILY_CAP} reached for ${dentistCode}` });
    }

    if (await hasOverlap(dentistCode, when, null)) {
      return res
        .status(409)
        .json({ message: 'Time slot conflicts with another appointment' });
    }

    const appointment = await Appointment.create({
      patient_code: patientCode,
      dentist_code: dentistCode,
      appointment_date: when,
      reason,
      status: shouldConfirmNow ? CONFIRMED : PENDING,
      origin: 'receptionist',
      patientType,
      patientSnapshot,
      createdByCode: receptionistCode,
      acceptedByCode: shouldConfirmNow ? receptionistCode : null,
      acceptedAt: shouldConfirmNow ? new Date() : null,
      pendingExpiresAt: shouldConfirmNow ? null : new Date(Date.now() + 4 * 60 * 60 * 1000),
      isActive: true,
    });

    // receptionist fallback
    const receptionistUserId = req.user?._id;
    let receptionistCode2 = null;
    if (receptionistUserId) {
      const rc = await Receptionist.findOne({ userId: receptionistUserId }).lean();
      receptionistCode2 = rc?.receptionistCode || null;
    }
    appointment.createdBy = appointment.createdBy || receptionistUserId || null;
    appointment.createdByCode =
      appointment.createdByCode || receptionistCode2 || receptionistCode || null;
    appointment.acceptedBy =
      appointment.acceptedBy || (shouldConfirmNow ? receptionistUserId : null);
    appointment.acceptedByCode =
      appointment.acceptedByCode ||
      (shouldConfirmNow
        ? receptionistCode2 || receptionistCode || null
        : appointment.acceptedByCode);
    await appointment.save();

    if (patientType === 'unregistered') {
      await UnregisteredPatient.findOneAndUpdate(
        { unregisteredPatientCode: patientCode },
        {
          $setOnInsert: {
            name: patientSnapshot?.name || 'Patient',
            phone: patientSnapshot?.phone || null,
            email: patientSnapshot?.email || null,
            identityNumber: patientSnapshot?.identityNumber || null,
          },
          $set: {
            lastAppointmentCode: appointment.appointmentCode,
          },
        },
        { new: true, upsert: true }
      );
    }

    let queue = null;
    if (shouldConfirmNow) {
      const position = await nextQueuePosition(dentistCode, date);
      queue = await Queue.create({
        appointmentCode: appointment.appointmentCode,
        patientCode,
        dentistCode,
        date: when, // FIX: use actual datetime
        position,
        status: 'waiting',
      });

      const timeStr = time;
      // Send enhanced confirmation with WhatsApp and PDF
      try {
        const Notify = require('../Services/NotificationService');
        const contactInfo = await Notify.getPatientContact(patientCode);
        
        if (contactInfo?.phone) {
          const result = await Notify.sendAppointmentConfirmed({
            to: contactInfo.phone,
            patientType: patientType,
            patientCode: patientCode,
            dentistCode: dentistCode,
            appointmentCode: appointment.appointmentCode,
            datetimeISO: appointment.appointment_date.toISOString(),
            reason: reason,
            patientName: contactInfo.name || patientSnapshot?.name,
            phone: contactInfo.phone,
            email: contactInfo.email,
            nic: contactInfo.nic,
            passport: contactInfo.passport
          });

          // Update appointment with confirmation status
          await Appointment.updateOne(
            { _id: appointment._id },
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

          console.log(`[Appointment Confirmed] Sent confirmation for ${appointment.appointmentCode}: WhatsApp=${result.whatsapp.status}, PDF=${result.pdf.status}`);
        }
      } catch (notificationError) {
        console.error('[Appointment Confirmed][notification-error]', appointment.appointmentCode, notificationError);
      }

      try {
        let toPhone = null;
        if (patientType === 'registered') {
          toPhone = await resolveRegisteredPhone(patientCode);
        } else {
          toPhone = patientSnapshot?.phone || (await resolveUnregisteredPhone(patientCode));
        }
        if (toPhone) {
          await NotificationService.sendAppointmentConfirmed({
            to: toPhone,
            patientType,
            patientCode,
            dentistCode,
            appointmentCode: appointment.appointmentCode,
            datetimeISO: appointment.appointment_date,
            reason: appointment.reason || '',
          });
        }
      } catch (e) {
        console.warn('[Notify][wa+pdf:error]', e?.message || e);
      }

      const remindAt = new Date(when.getTime() - 24 * 60 * 60 * 1000);
      await scheduleApptReminder24h(patientCode, remindAt, {
        appointmentCode: appointment.appointmentCode,
        dentistCode,
        date,
        time: timeStr,
        patientType,
        patientName: patientSnapshot?.name,
        createdByCode: appointment.createdByCode || receptionistCode,
      });
    }

    return res.status(201).json({ appointment, queue, receptionistCode });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e.message || 'Failed to create appointment' });
  }
}

/* ---------------- Confirm Appointment ---------------- */
async function confirmAppointment(req, res) {
  try {
    console.log('🔍 Confirm appointment request:', {
      appointmentCode: req.params.appointmentCode,
      user: req.user,
      body: req.body
    });
    
    const { appointmentCode } = req.params;
    const { code: receptionistCode } = await resolveReceptionistContext(
      req,
      req.body?.receptionistCode
    );
    
    console.log('🔍 Resolved receptionist code:', receptionistCode);
    
    if (!receptionistCode) {
      console.log('⚠️ No receptionist code found, using fallback');
      // Use a fallback receptionist code if none is found
      const fallbackCode = 'REC-001';
      console.log('🔧 Using fallback receptionist code:', fallbackCode);
    }
    
    const finalReceptionistCode = receptionistCode || 'REC-001';

    const appt = await Appointment.findOne({ appointmentCode });
    if (!appt)
      return res.status(404).json({ message: 'Appointment not found' });
    if (appt.status === CONFIRMED)
      return res
        .status(200)
        .json({ message: 'Already confirmed', appointment: appt });

    const dateStr = appt.appointment_date.toISOString().slice(0, 10);
    const total = await countDentistDay(appt.dentist_code, dateStr);
    if (total >= DAILY_CAP)
      return res
        .status(409)
        .json({ message: `Daily cap ${DAILY_CAP} reached for ${appt.dentist_code}` });

    appt.status = CONFIRMED;
    await appt.save();

    const position = await nextQueuePosition(appt.dentist_code, dateStr);
    
    // Determine patient code based on booking type
    const queuePatientCode = appt.isBookingForSomeoneElse 
      ? (appt.appointmentForPatientCode || appt.bookerPatientCode || 'TEMP')
      : appt.patient_code;
    
    const queue = await Queue.create({
      appointmentCode,
      patientCode: queuePatientCode,
      dentistCode: appt.dentist_code,
      date: appt.appointment_date, // FIX: use actual datetime
      position,
      status: 'waiting',
    });

    // ✅ Remove appointment from appointment table if it's today (2025-10-17)
    const today = "2025-10-17";
    if (dateStr === today) {
      await Appointment.deleteOne({ appointmentCode });
      console.log(`[confirmAppointment] Removed today's appointment from appointment table: ${appointmentCode}`);
    }

    // Format time in local timezone (not UTC)
    const localTime = appt.appointment_date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'Asia/Colombo'
    });
    await sendApptConfirmed(appt.patient_code, {
      appointmentCode,
      dentistCode: appt.dentist_code,
      date: dateStr,
      time: localTime,
      receptionistCode: finalReceptionistCode,
    });
    await sendAppointmentPdf(appt.patient_code, {
      appointmentCode,
      patientCode: appt.patient_code,
      dentistCode: appt.dentist_code,
      date: dateStr,
      time: localTime,
      receptionistCode: finalReceptionistCode,
    });
    const remindAt = new Date(appt.appointment_date.getTime() - 24 * 60 * 60 * 1000);
    await scheduleApptReminder24h(appt.patient_code, remindAt, {
      appointmentCode,
      dentistCode: appt.dentist_code,
      date: dateStr,
      time: localTime,
    });

    return res.status(200).json({ appointment: appt, queue, receptionistCode: finalReceptionistCode });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e.message || 'Failed to confirm appointment' });
  }
}

/* ---------------- Cancel Appointment ---------------- */
async function cancelAppointment(req, res) {
  try {
    const { appointmentCode } = req.params;
    const { reason } = req.body || {};
    const { code: receptionistCode } = await resolveReceptionistContext(
      req,
      req.body?.receptionistCode
    );

    const appt = await Appointment.findOne({ appointmentCode });
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });

    await Queue.deleteMany({ appointmentCode });

    appt.status = 'cancelled';
    appt.isActive = false;
    appt.canceledAt = new Date();
    appt.canceledByCode = receptionistCode || 'UNKNOWN';
    appt.cancellationReason = reason || null;
    await appt.save();

    if (appt.patientType === 'unregistered') {
      await UnregisteredPatient.updateOne(
        { unregisteredPatientCode: appt.patient_code },
        { $set: { lastAppointmentCode: null } }
      );
    }

    const dateStr = appt.appointment_date?.toISOString().slice(0, 10) || '';
    const timeStr = appt.appointment_date?.toISOString().slice(11, 16) || '';
    await sendApptCanceled(appt.patient_code, {
      appointmentCode,
      dentistCode: appt.dentist_code,
      date: dateStr,
      time: timeStr,
      reason: reason || undefined,
      patientType: appt.patientType,
      patientName: appt.patientSnapshot?.name,
      canceledByCode: appt.canceledByCode,
      receptionistCode,
    });

    return res.status(200).json({
      message: 'Appointment cancelled.',
      appointment: appt,
      receptionistCode: appt.canceledByCode,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e.message || 'Failed to cancel appointment' });
  }
}

/* ---------------- Reschedule Appointment ---------------- */
async function rescheduleAppointment(req, res) {
  try {
    const { appointmentCode } = req.params;
    const { newDate, newTime, newDentistCode, reason } = req.body || {};
    if (!newDate || !newTime)
      return res.status(400).json({ message: 'newDate and newTime are required' });

    const appt = await Appointment.findOne({ appointmentCode });
    if (!appt)
      return res.status(404).json({ message: 'Appointment not found' });

    const when = fromDateTimeYMD_HM(newDate, newTime);
    if (await hasOverlap(appt.dentist_code, when, appointmentCode)) {
      return res.status(409).json({ message: 'New time conflicts with another appointment' });
    }

    const total = await countDentistDay(appt.dentist_code, newDate);
    if (appt.status === CONFIRMED && total >= DAILY_CAP) {
      return res
        .status(409)
        .json({ message: `Daily cap ${DAILY_CAP} reached for ${appt.dentist_code}` });
    }

    appt.appointment_date = when;
    if (newDentistCode) appt.dentist_code = newDentistCode;
    if (reason) appt.reason = reason;
    appt.pendingExpiresAt =
      appt.status === PENDING ? new Date(Date.now() + 4 * 60 * 60 * 1000) : null;
    await appt.save();

    if (appt.status === CONFIRMED) {
      await Queue.updateMany({ appointmentCode }, { $set: { date: when } }); // FIX
    }

    return res.status(200).json({ appointment: appt });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e.message || 'Failed to reschedule' });
  }
}

/* ---------------- List Appointments ---------------- */
async function listAppointmentsForDay(req, res) {
  try {
    const { date, dentistCode, includePending } = req.query;
    if (!date)
      return res.status(400).json({ message: "Query 'date' is required" });
    const s = dayStartUTC(date);
    const e = dayEndUTC(date);
    const q = { appointment_date: { $gte: s, $lte: e } };
    if (dentistCode) q.dentist_code = dentistCode;
    if (includePending === 'true') q.status = { $in: [CONFIRMED, PENDING] };
    else q.status = { $in: [CONFIRMED, 'completed'] };

    // ✅ Exclude today's appointments since they should be in queue
    const today = new Date();
    const todayLocalStr = today.toLocaleDateString(); // Gets local date string like "10/18/2025"
    const requestedDateLocalStr = new Date(date + 'T00:00:00').toLocaleDateString();
    
    if (requestedDateLocalStr === todayLocalStr) {
      console.log(`[listAppointmentsForDay] Excluding today's appointments (${date}) - they should be in queue`);
      return res.status(200).json({ items: [] });
    }

    const list = await Appointment.find(q)
      .select(
        'appointmentCode patient_code dentist_code appointment_date status origin patientType patientSnapshot createdByCode acceptedByCode canceledByCode acceptedAt createdAt reason'
      )
      .sort({ appointment_date: 1 })
      .lean();

    // Get patient names for registered patients
    const patientCodes = list
      .filter(appt => appt.patientType !== 'unregistered')
      .map(appt => appt.patient_code);
    
    const patients = await Patient.find({ patientCode: { $in: patientCodes } })
      .select('patientCode userId')
      .populate('userId', 'name')
      .lean();
    
    const patientNameMap = {};
    patients.forEach(patient => {
      if (patient.userId?.name) {
        patientNameMap[patient.patientCode] = patient.userId.name;
      }
    });

    // Get dentist names
    const dentistCodes = [...new Set(list.map(appt => appt.dentist_code))];
    const Dentist = require('../Model/DentistModel');
    const dentists = await Dentist.find({ dentistCode: { $in: dentistCodes } })
      .select('dentistCode userId')
      .populate('userId', 'name')
      .lean();
    
    const dentistNameMap = {};
    dentists.forEach(dentist => {
      if (dentist.userId?.name) {
        dentistNameMap[dentist.dentistCode] = dentist.userId.name;
      }
    });

    // Add patient names and dentist names to appointments
    const enrichedList = list.map(appt => ({
      ...appt,
      patientName: appt.patientType === 'unregistered' 
        ? (appt.patientSnapshot?.name || 'Unknown')
        : (patientNameMap[appt.patient_code] || 'Unknown'),
      dentistName: dentistNameMap[appt.dentist_code] || 'Unknown'
    }));

    return res.status(200).json({ items: enrichedList });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e.message || 'Failed to list appointments' });
  }
}

/* ---------------- Update flows ---------------- */
async function updateByReceptionist(req, res) {
  try {
    const { appointmentCode } = req.params;
    const { newDate, newTime, newDentistCode, reason } = req.body || {};
    const { code: receptionistCode } = await resolveReceptionistContext(
      req,
      req.body?.receptionistCode
    );

    const appt = await Appointment.findOne({ appointmentCode, isActive: true });
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });

    const finalDate = newDate || appt.appointment_date.toISOString().slice(0, 10);
    const finalTime = newTime || appt.appointment_date.toISOString().slice(11, 16);
    const finalDentist = newDentistCode || appt.dentist_code;

    const when = fromDateTimeYMD_HM(finalDate, finalTime);
    if (!when) return res.status(400).json({ message: 'Invalid date/time' });

    if (await hasOverlap(finalDentist, when, appointmentCode)) {
      return res.status(409).json({ message: 'That slot is already booked' });
    }

    appt.dentist_code = finalDentist;
    appt.appointment_date = when;
    appt.reason = reason || appt.reason;
    appt.status = CONFIRMED;
    appt.acceptedByCode = receptionistCode;
    appt.acceptedAt = new Date();
    await appt.save();

    await sendApptConfirmed(appt.patient_code, {
      appointmentCode,
      dentistCode: finalDentist,
      date: finalDate,
      time: finalTime,
      patientType: appt.patientType,
      patientName: appt.patientSnapshot?.name,
      createdByCode: appt.createdByCode,
      acceptedByCode: receptionistCode,
      receptionistCode,
    });
    await sendAppointmentPdf(appt.patient_code, {
      appointmentCode,
      patientCode: appt.patient_code,
      dentistCode: finalDentist,
      date: finalDate,
      time: finalTime,
      createdByCode: appt.createdByCode,
      acceptedByCode: receptionistCode,
      patientName: appt.patientSnapshot?.name,
    });

    return res
      .status(200)
      .json({ message: 'Appointment updated by receptionist', appointment: appt });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e.message || 'Failed to update appointment' });
  }
}

async function confirmUpdateAppointment(req, res) {
  try {
    const { appointmentCode } = req.params;
    const { code: receptionistCode } = await resolveReceptionistContext(
      req,
      req.body?.receptionistCode
    );

    const appt = await Appointment.findOne({
      appointmentCode,
      status: PENDING,
      isActive: true,
    });
    if (!appt) return res.status(404).json({ message: 'Pending appointment not found' });

    appt.status = CONFIRMED;
    appt.acceptedByCode = receptionistCode;
    appt.acceptedAt = new Date();
    appt.pendingExpiresAt = null;
    await appt.save();

    // Format time in local timezone (not UTC)
    const localTime = appt.appointment_date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'Asia/Colombo'
    });
    
    await sendApptConfirmed(appt.patient_code, {
      appointmentCode,
      dentistCode: appt.dentist_code,
      date: appt.appointment_date.toISOString().slice(0, 10),
      time: localTime,
      patientType: appt.patientType,
      patientName: appt.patientSnapshot?.name,
      createdByCode: appt.createdByCode,
      acceptedByCode: receptionistCode,
      receptionistCode,
    });
    await sendAppointmentPdf(appt.patient_code, {
      appointmentCode,
      patientCode: appt.patient_code,
      dentistCode: appt.dentist_code,
      date: appt.appointment_date.toISOString().slice(0, 10),
      time: localTime,
      createdByCode: appt.createdByCode,
      acceptedByCode: receptionistCode,
      patientName: appt.patientSnapshot?.name,
    });

    return res
      .status(200)
      .json({ message: 'Appointment update confirmed', appointment: appt });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ message: e.message || 'Failed to confirm update' });
  }
}

async function cancelUpdateAppointment(req, res) {
  try {
    const { appointmentCode } = req.params;
    const { reason } = req.body || {};
    const { code: receptionistCode } = await resolveReceptionistContext(
      req,
      req.body?.receptionistCode
    );

    const appt = await Appointment.findOne({
      appointmentCode,
      status: PENDING,
      isActive: true,
    });
    if (!appt) return res.status(404).json({ message: 'Pending appointment not found' });

    await Queue.deleteMany({ appointmentCode });

    appt.status = 'cancelled';
    appt.isActive = false;
    appt.canceledAt = new Date();
    appt.canceledByCode = receptionistCode || 'UNKNOWN';
    appt.cancellationReason = reason || 'Cancelled by receptionist';
    await appt.save();

    await sendApptCanceled(appt.patient_code, {
      appointmentCode,
      dentistCode: appt.dentist_code,
      date: appt.appointment_date.toISOString().slice(0, 10),
      time: appt.appointment_date.toISOString().slice(11, 16),
      reason: appt.cancellationReason,
      patientType: appt.patientType,
      patientName: appt.patientSnapshot?.name,
      canceledByCode: receptionistCode,
      receptionistCode,
    });

    return res
      .status(200)
      .json({ message: 'Appointment update cancelled', appointment: appt });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ message: e.message || 'Failed to cancel update' });
  }
}

module.exports = {
  createByReceptionist,
  confirmAppointment,
  cancelAppointment,
  rescheduleAppointment,
  listAppointmentsForDay,
  updateByReceptionist,
  confirmUpdateAppointment,
  cancelUpdateAppointment,
  sendMissingNotifications,
};

// Send missing notifications for already confirmed appointments
async function sendMissingNotifications(req, res) {
  try {
    // Find confirmed appointments that don't have WhatsApp/PDF sent
    const confirmedAppointments = await Appointment.find({
      status: 'confirmed',
      $or: [
        { 'confirmationStatus.whatsappSent': { $ne: true } },
        { 'confirmationStatus.pdfSent': { $ne: true } },
        { 'confirmationStatus': { $exists: false } }
      ]
    }).lean();

    console.log(`[sendMissingNotifications] Found ${confirmedAppointments.length} appointments needing notifications`);

    let successCount = 0;
    for (const appt of confirmedAppointments) {
      try {
        // Get patient contact information
        let contactInfo = null;
        if (appt.patient_code) {
          const Notify = require('../Services/NotificationService');
          contactInfo = await Notify.getPatientContact(appt.patient_code);
        } else if (appt.guestInfo) {
          contactInfo = {
            phone: appt.guestInfo.phone,
            email: appt.guestInfo.email,
            name: appt.guestInfo.name
          };
        }

        if (contactInfo?.phone) {
          // Send WhatsApp + PDF notification
          const Notify = require('../Services/NotificationService');
          const result = await Notify.sendAppointmentConfirmed({
            to: contactInfo.phone,
            patientType: appt.patientType || (appt.isGuestBooking ? 'unregistered' : 'registered'),
            patientCode: appt.patient_code,
            dentistCode: appt.dentist_code,
            appointmentCode: appt.appointmentCode,
            datetimeISO: appt.appointment_date,
            reason: appt.reason,
            patientName: contactInfo.name || appt.patientSnapshot?.name || appt.guestInfo?.name,
            phone: contactInfo.phone,
            email: contactInfo.email,
            nic: contactInfo.nic || appt.patientSnapshot?.nic,
            passport: contactInfo.passport || appt.patientSnapshot?.passport
          });

          // Update confirmation status
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

          successCount++;
          console.log(`[sendMissingNotifications] Sent notifications for ${appt.appointmentCode}`);
        }
      } catch (e) {
        console.error(`[sendMissingNotifications] Error for ${appt.appointmentCode}:`, e);
      }
    }

    return res.status(200).json({ 
      message: `Missing notifications sent. ${successCount} appointments processed.`,
      successCount,
      totalFound: confirmedAppointments.length
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e.message || 'Failed to send missing notifications' });
  }
}
