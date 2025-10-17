const Appointment = require('../Model/AppointmentModel');
const Patient = require('../Model/PatientModel');
const Dentist = require('../Model/DentistModel');
const NotificationLog2 = require('../Model/NotificationLogModel');
const { sendApptConfirmed: sendConf, sendApptCanceled: sendCanc } = require('../Services/NotificationService');

async function testSend(req, res) {
  try {
    const { toType, toCode, templateKey, meta } = req.body || {};
    if (!toType || !toCode || !templateKey) return res.status(400).json({ message: 'toType, toCode, templateKey required' });
    const fn = templateKey === 'APPT_CONFIRMED' ? sendConf : sendCanc;
    const log = await (fn ? fn(toCode, meta || {}) : null);
    return res.status(200).json({ log });
  } catch (e) { console.error(e); return res.status(500).json({ message: e.message || 'Failed to send test' }); }
}

async function listLogs(req, res) {
  try {
    const { appointmentCode, recipientCode } = req.query;
    const q = {};
    if (appointmentCode) q['meta.appointmentCode'] = appointmentCode;
    if (recipientCode) q.recipientCode = recipientCode;
    const items = await NotificationLog2.find(q).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ items });
  } catch (e) { console.error(e); return res.status(500).json({ message: e.message || 'Failed to list logs' }); }
}

async function listAppointmentNotifications(req, res) {
  try {
    const pending = await Appointment.find({
      status: 'pending',
    }).sort({ createdAt: 1 }).lean();

    const autoConfirmed = await Appointment.find({
      status: 'confirmed',
      autoConfirmedAt: { $exists: true },
    }).sort({ autoConfirmedAt: -1 }).limit(20).lean();

    const cancelled = await Appointment.find({
      status: 'cancelled',
      // Exclude auto-cancelled appointments by filtering out those cancelled within 10 seconds of creation
      $expr: {
        $gt: [
          { $subtract: ["$updatedAt", "$createdAt"] },
          10000 // 10 seconds in milliseconds
        ]
      }
    }).sort({ updatedAt: -1 }).limit(20).lean();

    const patientCodes = new Set();
    const dentistCodes = new Set();
    [...pending, ...autoConfirmed, ...cancelled].forEach(a => {
      if (a?.patient_code) patientCodes.add(a.patient_code);
      if (a?.dentist_code) dentistCodes.add(a.dentist_code);
    });

    const patients = await Patient.find({ patientCode: { $in: Array.from(patientCodes) } })
      .populate({ path: 'userId', select: 'name contact_no email' }).lean();
    const dentists = await Dentist.find({ dentistCode: { $in: Array.from(dentistCodes) } })
      .populate({ path: 'userId', select: 'name contact_no' }).lean();

    const patientMap = new Map();
    for (const p of patients) {
      patientMap.set(p.patientCode, {
        name: p.userId?.name || p.patientCode,
        contact: p.userId?.contact_no || null,
        email: p.userId?.email || null,
      });
    }
    const dentistMap = new Map();
    for (const d of dentists) {
      dentistMap.set(d.dentistCode || d.dentist_code, {
        name: d.userId?.name || d.dentistCode || d.dentist_code,
        contact: d.userId?.contact_no || null,
      });
    }

    const fmtPending = pending.map(a => {
      // Calculate expiration time (4 hours from creation for pending appointments)
      const expiresInMs = a.createdAt ? (new Date(a.createdAt).getTime() + (4 * 60 * 60 * 1000) - Date.now()) : null;
      return {
        appointmentCode: a.appointmentCode,
        patient_code: a.patient_code,
        patient: patientMap.get(a.patient_code) || null,
        dentist_code: a.dentist_code,
        dentist: dentistMap.get(a.dentist_code) || null,
        appointment_date: a.appointment_date,
        appointmentReason: a.reason || 'No reason provided',
        cancellationReason: a.cancellationReason || null,
        requestedAt: a.createdAt,
        pendingExpiresAt: a.createdAt ? new Date(a.createdAt.getTime() + (4 * 60 * 60 * 1000)) : null,
        expiresInMinutes: expiresInMs != null ? Math.max(0, Math.round(expiresInMs / 60000)) : null,
        status: a.status,
        origin: 'online', // Default to online for all appointments
        createdByCode: a.createdByCode || 'SYSTEM',
      };
    });

    const fmtAutoConfirmed = autoConfirmed.map(a => ({
      appointmentCode: a.appointmentCode,
      patient_code: a.patient_code,
      patient: patientMap.get(a.patient_code) || null,
      dentist_code: a.dentist_code,
      dentist: dentistMap.get(a.dentist_code) || null,
      appointment_date: a.appointment_date,
      appointmentReason: a.reason || 'No reason provided',
      requestedAt: a.createdAt,
      autoConfirmedAt: a.autoConfirmedAt,
      confirmedByCode: a.acceptedByCode || 'SYSTEM',
      status: a.status,
      origin: a.origin || 'online',
    }));

    const fmtCancelled = cancelled.map(a => ({
      appointmentCode: a.appointmentCode,
      patient_code: a.patient_code,
      patient: patientMap.get(a.patient_code) || null,
      dentist_code: a.dentist_code,
      dentist: dentistMap.get(a.dentist_code) || null,
      appointment_date: a.appointment_date,
      appointmentReason: a.reason || 'No reason provided',
      requestedAt: a.createdAt,
      cancelledAt: a.updatedAt,
      cancelledByCode: a.cancelledByCode || a.canceledByCode || 'UNKNOWN',
      cancellationReason: a.cancellationReason || 'No reason provided',
      status: a.status,
      origin: a.origin || 'online',
    }));

    return res.status(200).json({ 
      pending: fmtPending, 
      autoConfirmed: fmtAutoConfirmed,
      cancelled: fmtCancelled
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e.message || 'Failed to list appointment notifications' });
  }
}

module.exports = { testSend, listLogs, listAppointmentNotifications };


