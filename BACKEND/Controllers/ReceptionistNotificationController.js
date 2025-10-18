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

    // Get today's booked appointments (confirmed immediately)
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    const todayBooked = await Appointment.find({
      status: 'confirmed',
      createdAt: { $gte: todayStart, $lt: todayEnd },
      // Exclude auto-confirmed appointments (those with autoConfirmedAt)
      autoConfirmedAt: { $exists: false }
    }).sort({ createdAt: -1 }).limit(20).lean();

    const patientCodes = new Set();
    const dentistCodes = new Set();
    [...pending, ...autoConfirmed, ...cancelled, ...todayBooked].forEach(a => {
      if (a?.patient_code) patientCodes.add(a.patient_code);
      if (a?.patientCode) patientCodes.add(a.patientCode);
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
      
      // Get patient information - handle all possible data sources
      let patientInfo = null;
      
      // Try to get patient info from patientMap if patient_code or patientCode exists
      if (a.patient_code) {
        patientInfo = patientMap.get(a.patient_code);
      } else if (a.patientCode) {
        patientInfo = patientMap.get(a.patientCode);
      }
      
      // If no patient info found, try all possible guest data sources
      if (!patientInfo) {
        // Try patientSnapshot first
        if (a.patientSnapshot && (a.patientSnapshot.name || a.patientSnapshot.phone)) {
          patientInfo = {
            name: a.patientSnapshot.name || 'Guest Patient',
            contact: a.patientSnapshot.phone || a.patientSnapshot.contact || null,
            email: a.patientSnapshot.email || null,
          };
        }
        // Try guestInfo
        else if (a.guestInfo && (a.guestInfo.name || a.guestInfo.phone)) {
          patientInfo = {
            name: a.guestInfo.name || 'Guest Patient',
            contact: a.guestInfo.phone || a.guestInfo.contact || null,
            email: a.guestInfo.email || null,
          };
        }
        // Try direct fields on the appointment
        else if (a.patientName || a.patientPhone || a.patientEmail) {
          patientInfo = {
            name: a.patientName || 'Guest Patient',
            contact: a.patientPhone || a.patientContact || null,
            email: a.patientEmail || null,
          };
        }
        // Try alternative field names
        else if (a.name || a.phone || a.email) {
          patientInfo = {
            name: a.name || 'Guest Patient',
            contact: a.phone || a.contact || null,
            email: a.email || null,
          };
        }
        // FORCE FIX: If still no data, use appointment code as name
        else {
          patientInfo = {
            name: `Patient ${a.appointmentCode}`,
            contact: 'Contact not available',
            email: null,
          };
        }
      }
      
      // If still no patient info, show a default message
      if (!patientInfo) {
        patientInfo = {
          name: a.patient_code || 'Unknown Patient',
          contact: null,
          email: null,
        };
      }
      
      
      // DEBUG: Log what we're sending for AP-0010, AP-0011, AP-0012, AP-0013
      if (['AP-0010', 'AP-0011', 'AP-0012', 'AP-0013'].includes(a.appointmentCode)) {
        const appointmentDate = a.appointment_date || a.appointmentDate;
        console.log(`[FIX] ${a.appointmentCode} appointment_date:`, a.appointment_date);
        console.log(`[FIX] ${a.appointmentCode} appointmentDate:`, a.appointmentDate);
        console.log(`[FIX] ${a.appointmentCode} final appointment_date:`, appointmentDate);
        console.log(`[FIX] ${a.appointmentCode} UTC time:`, appointmentDate);
        console.log(`[FIX] ${a.appointmentCode} Local time:`, appointmentDate ? new Date(appointmentDate).toLocaleString() : 'N/A');
        console.log(`[FIX] ${a.appointmentCode} ISO string:`, appointmentDate ? new Date(appointmentDate).toISOString() : 'N/A');
        
        // FIX: Convert UTC to local timezone for display
        if (appointmentDate) {
          const utcDate = new Date(appointmentDate);
          const localDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000)); // Add 5.5 hours for local timezone
          console.log(`[FIX] ${a.appointmentCode} Fixed local time:`, localDate.toLocaleString());
        }
      }
      
      // Get dentist information - handle both field names
      const dentistCode = a.dentist_code || a.dentistCode;
      const dentistInfo = dentistMap.get(dentistCode);
      
      return {
        appointmentCode: a.appointmentCode,
        patient_code: a.patient_code,
        patient: patientInfo,
        dentist_code: dentistCode,
        dentist: dentistInfo,
        appointment_date: a.appointment_date || a.appointmentDate,
        appointmentReason: a.reason || 'No reason provided',
        cancellationReason: a.cancellationReason || null,
        requestedAt: a.createdAt,
        pendingExpiresAt: a.createdAt ? new Date(a.createdAt.getTime() + (4 * 60 * 60 * 1000)) : null,
        expiresInMinutes: expiresInMs != null ? Math.max(0, Math.round(expiresInMs / 60000)) : null,
        status: a.status,
        origin: a.origin || 'online',
        createdByCode: a.createdByCode || 'SYSTEM',
      };
    });

    const fmtAutoConfirmed = autoConfirmed.map(a => {
      // Get patient information - handle both registered and guest patients
      let patientInfo = null;
      
      // Try to get patient info from patientMap if patient_code or patientCode exists
      if (a.patient_code) {
        patientInfo = patientMap.get(a.patient_code);
      } else if (a.patientCode) {
        patientInfo = patientMap.get(a.patientCode);
      }
      
      // If no patient info found and we have patientSnapshot, use that
      if (!patientInfo && a.patientSnapshot) {
        patientInfo = {
          name: a.patientSnapshot.name || 'Guest Patient',
          contact: a.patientSnapshot.phone || null,
          email: a.patientSnapshot.email || null,
        };
      }
      
      // If still no patient info and we have guestInfo, use that
      if (!patientInfo && a.guestInfo) {
        patientInfo = {
          name: a.guestInfo.name || 'Guest Patient',
          contact: a.guestInfo.phone || null,
          email: a.guestInfo.email || null,
        };
      }
      
      // If still no patient info, show a default message
      if (!patientInfo) {
        patientInfo = {
          name: a.patient_code || 'Unknown Patient',
          contact: null,
          email: null,
        };
      }
      
      return {
        appointmentCode: a.appointmentCode,
        patient_code: a.patient_code,
        patient: patientInfo,
        dentist_code: a.dentist_code || a.dentistCode,
        dentist: dentistMap.get(a.dentist_code || a.dentistCode) || null,
        appointment_date: a.appointment_date || a.appointmentDate,
        appointmentReason: a.reason || 'No reason provided',
        requestedAt: a.createdAt,
        autoConfirmedAt: a.autoConfirmedAt,
        confirmedByCode: a.acceptedByCode || 'SYSTEM',
        status: a.status,
        origin: a.origin || 'online',
        confirmationStatus: a.confirmationStatus || {
          whatsappSent: false,
          whatsappSentAt: null,
          whatsappError: null,
          pdfSent: false,
          pdfSentAt: null,
          pdfError: null,
          confirmationMessage: null
        }
      };
    });

    const fmtCancelled = cancelled.map(a => {
      // Get patient information - handle both registered and guest patients
      let patientInfo = null;
      
      // Try to get patient info from patientMap if patient_code or patientCode exists
      if (a.patient_code) {
        patientInfo = patientMap.get(a.patient_code);
      } else if (a.patientCode) {
        patientInfo = patientMap.get(a.patientCode);
      }
      
      // If no patient info found and we have patientSnapshot, use that
      if (!patientInfo && a.patientSnapshot) {
        patientInfo = {
          name: a.patientSnapshot.name || 'Guest Patient',
          contact: a.patientSnapshot.phone || null,
          email: a.patientSnapshot.email || null,
        };
      }
      
      // If still no patient info and we have guestInfo, use that
      if (!patientInfo && a.guestInfo) {
        patientInfo = {
          name: a.guestInfo.name || 'Guest Patient',
          contact: a.guestInfo.phone || null,
          email: a.guestInfo.email || null,
        };
      }
      
      // If still no patient info, show a default message
      if (!patientInfo) {
        patientInfo = {
          name: a.patient_code || 'Unknown Patient',
          contact: null,
          email: null,
        };
      }
      
      return {
        appointmentCode: a.appointmentCode,
        patient_code: a.patient_code,
        patient: patientInfo,
        dentist_code: a.dentist_code || a.dentistCode,
        dentist: dentistMap.get(a.dentist_code || a.dentistCode) || null,
        appointment_date: a.appointment_date || a.appointmentDate,
        appointmentReason: a.reason || 'No reason provided',
        requestedAt: a.createdAt,
        cancelledAt: a.updatedAt,
        cancelledByCode: a.cancelledByCode || a.canceledByCode || 'UNKNOWN',
        cancellationReason: a.cancellationReason || 'No reason provided',
        status: a.status,
        origin: a.origin || 'online',
      };
    });

    const fmtTodayBooked = todayBooked.map(a => {
      // Get patient information - handle both registered and guest patients
      let patientInfo = null;
      
      // Try to get patient info from patientMap if patient_code or patientCode exists
      if (a.patient_code) {
        patientInfo = patientMap.get(a.patient_code);
      } else if (a.patientCode) {
        patientInfo = patientMap.get(a.patientCode);
      }
      
      // If no patient info found and we have patientSnapshot, use that
      if (!patientInfo && a.patientSnapshot) {
        patientInfo = {
          name: a.patientSnapshot.name || 'Guest Patient',
          contact: a.patientSnapshot.phone || null,
          email: a.patientSnapshot.email || null,
        };
      }
      
      // If still no patient info and we have guestInfo, use that
      if (!patientInfo && a.guestInfo) {
        patientInfo = {
          name: a.guestInfo.name || 'Guest Patient',
          contact: a.guestInfo.phone || null,
          email: a.guestInfo.email || null,
        };
      }
      
      // If still no patient info, show a default message
      if (!patientInfo) {
        patientInfo = {
          name: a.patient_code || 'Unknown Patient',
          contact: null,
          email: null,
        };
      }
      
      return {
        appointmentCode: a.appointmentCode,
        patient_code: a.patient_code,
        patient: patientInfo,
        dentist_code: a.dentist_code || a.dentistCode,
        dentist: dentistMap.get(a.dentist_code || a.dentistCode) || null,
        appointment_date: a.appointment_date || a.appointmentDate,
        appointmentReason: a.reason || 'No reason provided',
        createdAt: a.createdAt,
        createdByCode: a.createdByCode || 'SYSTEM',
        status: a.status,
        origin: a.origin || 'online',
        confirmationStatus: a.confirmationStatus || {
          whatsappSent: false,
          whatsappSentAt: null,
          whatsappError: null,
          pdfSent: false,
          pdfSentAt: null,
          pdfError: null,
          confirmationMessage: null
        }
      };
    });


    return res.status(200).json({ 
      pending: fmtPending, 
      autoConfirmed: fmtAutoConfirmed,
      cancelled: fmtCancelled,
      todayBooked: fmtTodayBooked
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: e.message || 'Failed to list appointment notifications' });
  }
}

module.exports = { testSend, listLogs, listAppointmentNotifications };


