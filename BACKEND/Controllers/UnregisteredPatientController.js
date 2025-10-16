const UnregisteredPatient = require("../Model/UnregisteredPatientModel");
const Appointment = require("../Model/AppointmentModel");
const Receptionist = require("../Model/ReceptionistModel");

async function resolveReceptionistContext(req, fallback) {
  let code = req.user?.receptionistCode || req.user?.code || null;
  let doc = null;

  if (req.user?._id) {
    doc = await Receptionist.findOne({ userId: req.user._id }, "receptionistCode").lean();
    if (doc?.receptionistCode) {
      code = doc.receptionistCode;
    }
  }

  if (!doc && code) {
    doc = await Receptionist.findOne({ receptionistCode: code }, "receptionistCode").lean();
  }

  if (!code && fallback) code = fallback;

  return { code: code || null, doc };
}

exports.createUnregisteredPatient = async (req, res) => {
  try {
    const {
      name,
      phone,
      email = "",
      age = null,
      identityNumber = "",
      notes = "",
    } = req.body || {};

    if (!name || !phone) {
      return res.status(400).json({ message: "name and phone are required" });
    }

    const { code: receptionistCode, doc } = await resolveReceptionistContext(
      req,
      req.body?.receptionistCode
    );
    if (!receptionistCode) {
      return res
        .status(400)
        .json({ message: "Unable to resolve receptionist code from session" });
    }

    const receptionistUserId = req.user?._id || null;

    const baseDoc = {
      name: String(name).trim(),
      phone: String(phone).trim(),
      email: String(email || "").trim() || undefined,
      notes: String(notes || "").trim() || undefined,
      createdBy: doc?._id || undefined,       // keep existing createdBy/createdByCode
      createdByCode: receptionistCode,
      addedBy: receptionistUserId || undefined, // NEW: who clicked "register"
      addedByCode: receptionistCode,            // NEW: receptionist code for that user
    };

    if (age !== undefined && age !== null && age !== "") {
      const ageNum = Number(age);
      if (!Number.isNaN(ageNum)) baseDoc.age = ageNum;
    }
    if (identityNumber) baseDoc.identityNumber = String(identityNumber).trim();

    const criteria = identityNumber
      ? { identityNumber: String(identityNumber).trim() }
      : { phone: String(phone).trim() };

    const existing = await UnregisteredPatient.findOne(criteria).lean();

    if (existing) {
      await UnregisteredPatient.updateOne(
        { _id: existing._id },
        { $set: baseDoc }
      );
      const record = await UnregisteredPatient.findById(existing._id).lean();
      return res.status(200).json({ unregisteredPatient: record });
    }

    const up = await UnregisteredPatient.create(baseDoc);
    return res.status(201).json({ unregisteredPatient: up });
  } catch (err) {
    console.error("createUnregisteredPatient error:", err);
    return res
      .status(500)
      .json({ message: err.message || "Failed to add unregistered patient" });
  }
};

exports.listUnregisteredPatients = async (req, res) => {
  try {
    const { search = "", limit = 50 } = req.query;
    const filter = {};
    if (search) {
      // Escape special regex characters to prevent regex syntax errors
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { unregisteredPatientCode: new RegExp(escapedSearch, "i") },
        { name: new RegExp(escapedSearch, "i") },
        { phone: new RegExp(escapedSearch, "i") },
        { identityNumber: new RegExp(escapedSearch, "i") },
      ];
    }

    const items = await UnregisteredPatient.find(filter)
      .sort({ updatedAt: -1 })
      .limit(Number(limit) || 50)
      .lean();

    return res.status(200).json({ items });
  } catch (err) {
    console.error("listUnregisteredPatients error:", err);
    return res
      .status(500)
      .json({ message: err.message || "Failed to list unregistered patients" });
  }
};

exports.getUnregisteredPatient = async (req, res) => {
  try {
    const { code } = req.params;
    const patient = await UnregisteredPatient.findOne({
      unregisteredPatientCode: code,
    }).lean();
    if (!patient)
      return res
        .status(404)
        .json({ message: "Unregistered patient not found" });

    const appointments = await Appointment.find({
      $or: [
        { patientType: "unregistered", patient_code: code },
        { patient_code: code } // Also check appointments that might have wrong patientType
      ]
    })
      .select(
        "appointmentCode dentist_code appointment_date status reason createdByCode acceptedByCode patientType"
      )
      .sort({ appointment_date: -1 })
      .limit(20)
      .lean();

    console.log(`Found ${appointments.length} appointments for unregistered patient ${code}`);
    console.log('Appointments:', appointments.map(a => ({
      appointmentCode: a.appointmentCode,
      patientType: a.patientType,
      patient_code: a.patient_code
    })));

    const mapped = appointments.map((a) => ({
      appointmentCode: a.appointmentCode,
      dentist_code: a.dentist_code,
      date: a.appointment_date,
      status: a.status,
      reason: a.reason,
      createdByCode: a.createdByCode || null,
      acceptedByCode: a.acceptedByCode || null,
    }));

    // also expose addedByCode for the details page
    patient.addedByCode = patient.addedByCode || null;

    return res.status(200).json({ patient, appointments: mapped });
  } catch (err) {
    console.error("getUnregisteredPatient error:", err);
    return res
      .status(500)
      .json({ message: err.message || "Failed to load unregistered patient" });
  }
};
