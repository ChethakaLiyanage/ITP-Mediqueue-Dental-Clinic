const Appointment = require('../Model/AppointmentModel');
const Receptionist = require('../Model/ReceptionistModel');
const Patient = require('../Model/PatientModel');
const Dentist = require('../Model/DentistModel');
const User = require('../Model/User');

function toDate(date) {
  try {
    return new Date(date);
  } catch (_) {
    return null;
  }
}

function formatTimeHHMM(dateObj) {
  if (!dateObj) return '';
  const d = new Date(dateObj);
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

// GET /admin/appointments/receptionist-activities
// Returns latest receptionist-created appointments formatted for the admin UI
exports.getReceptionistAppointmentActivities = async (req, res) => {
  try {
    const { receptionistId, receptionistCode, status, dateRange } = req.query || {};

    const query = { origin: 'receptionist' };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (receptionistCode) {
      query.$or = [
        { createdByCode: receptionistCode },
        { acceptedByCode: receptionistCode },
      ];
    } else if (receptionistId) {
      // Map receptionistId -> receptionistCode
      const r = await Receptionist.findById(receptionistId).select('receptionistCode').lean();
      if (r?.receptionistCode) {
        query.$or = [
          { createdByCode: r.receptionistCode },
          { acceptedByCode: r.receptionistCode },
        ];
      }
    }

    // Optional simple date filtering
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let from = null;
      if (dateRange === 'today') {
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (dateRange === 'week') {
        from = new Date(now);
        from.setDate(now.getDate() - 7);
      } else if (dateRange === 'month') {
        from = new Date(now);
        from.setMonth(now.getMonth() - 1);
      }
      if (from) {
        query.appointment_date = { $gte: from };
      }
    }

    const appts = await Appointment.find(query)
      .select(
        'appointmentCode patient_code patientType patientSnapshot dentist_code appointment_date status createdByCode acceptedByCode'
      )
      .sort({ appointment_date: -1 })
      .limit(200)
      .lean();

    // Map patient names for registered patients
    const registeredCodes = appts
      .filter(a => a.patientType !== 'unregistered')
      .map(a => a.patient_code);
    const patients = await Patient.find({ patientCode: { $in: registeredCodes } })
      .select('patientCode userId')
      .populate('userId', 'name')
      .lean();
    const patientNameMap = new Map();
    patients.forEach(p => {
      if (p.userId?.name) patientNameMap.set(p.patientCode, p.userId.name);
    });

    // Map dentist names if needed later
    const dentistCodes = [...new Set(appts.map(a => a.dentist_code))];
    const dentists = await Dentist.find({ dentistCode: { $in: dentistCodes } })
      .select('dentistCode userId')
      .populate('userId', 'name')
      .lean();
    const dentistNameMap = new Map();
    dentists.forEach(d => {
      if (d.userId?.name) dentistNameMap.set(d.dentistCode, d.userId.name);
    });

    // Map receptionist names by code
    const receptionistCodes = [...new Set(
      appts.flatMap(a => [a.createdByCode, a.acceptedByCode]).filter(Boolean)
    )];
    const recs = await Receptionist.find({ receptionistCode: { $in: receptionistCodes } })
      .select('receptionistCode userId')
      .populate('userId', 'name')
      .lean();
    const receptionistNameByCode = new Map();
    recs.forEach(r => {
      receptionistNameByCode.set(r.receptionistCode, r.userId?.name || 'Receptionist');
    });

    const activities = appts.map(a => {
      const dateObj = toDate(a.appointment_date);
      return {
        id: a._id?.toString(),
        appointmentCode: a.appointmentCode,
        patientName:
          a.patientType === 'unregistered'
            ? (a.patientSnapshot?.name || 'Unknown')
            : (patientNameMap.get(a.patient_code) || 'Unknown'),
        patientCode: a.patient_code,
        appointmentDate: dateObj ? dateObj.toISOString() : null,
        appointmentTime: formatTimeHHMM(dateObj),
        dentistCode: a.dentist_code,
        dentistName: dentistNameMap.get(a.dentist_code) || undefined,
        receptionistName:
          receptionistNameByCode.get(a.acceptedByCode || a.createdByCode) || 'Receptionist',
        receptionistCode: a.acceptedByCode || a.createdByCode || null,
        isRegisteredPatient: a.patientType !== 'unregistered',
        status: (a.status || 'pending'),
      };
    });

    return res.status(200).json({ success: true, activities });
  } catch (e) {
    console.error('[AdminAppointments][getReceptionistAppointmentActivities] error:', e);
    return res.status(500).json({ success: false, message: e.message || 'Failed to load receptionist appointments' });
  }
};

// GET /admin/appointments/receptionists
// Returns list of active receptionists to filter by
exports.getActiveAppointmentReceptionists = async (_req, res) => {
  try {
    const recs = await Receptionist.find({})
      .select('receptionistCode userId isActive')
      .populate('userId', 'name')
      .lean();

    const receptionists = (recs || [])
      .filter(r => r.isActive !== false)
      .map(r => ({
        id: r._id?.toString(),
        name: r.userId?.name || 'Receptionist',
        userCode: r.receptionistCode,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({ success: true, receptionists });
  } catch (e) {
    console.error('[AdminAppointments][getActiveAppointmentReceptionists] error:', e);
    return res.status(500).json({ success: false, message: e.message || 'Failed to load receptionists' });
  }
};


