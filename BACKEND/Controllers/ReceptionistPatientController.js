// Controllers/ReceptionistPatientController.js
const bcrypt = require('bcryptjs');
const Patient = require("../Model/PatientModel");
const Appointment = require("../Model/AppointmentModel");
const User = require("../Model/User");
const Receptionist = require("../Model/ReceptionistModel");
const { sendPatientAccountCreated } = require("../Services/NotificationService");
const NotificationService = require("../Services/NotificationService");

function maskNIC(nic) {
  if (!nic || nic.length < 6) return nic || null;
  return nic.slice(0, 4) + "*".repeat(Math.max(0, nic.length - 6)) + nic.slice(-2);
}
function calcAge(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d)) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

async function resolveReceptionistContext(req) {
  let code = req.user?.receptionistCode || req.user?.code || null;
  let doc = null;

  if (req.user?._id) {
    doc = await Receptionist.findOne({ userId: req.user._id }, 'receptionistCode').lean();
    if (doc?.receptionistCode) {
      code = doc.receptionistCode;
    }
  }

  if (!doc && code) {
    doc = await Receptionist.findOne({ receptionistCode: code }, 'receptionistCode').lean();
  }

  return { code: code || null, doc };
}

async function buildReceptionistPatientDTO(p) {
  const dto = {
    patientCode: p.patientCode || null,
    age: calcAge(p.dob),
    nic: p.nic || null,         // This line should show full NIC
    gender: p.gender || null,
    addressShort: p.address || null,
    registeredByCode: p.registeredByCode || null,
  };

  if (p.userId) {
    const u = await User.findById(p.userId).select("name email contact_no").lean();
    if (u) {
      dto.name = u.name || null;
      dto.email = u.email || null;
      dto.phone = u.contact_no || null;
    }
  }
  return dto;
}

exports.listPatientsForReceptionist = async (req, res) => {
  try {
    const { search = "", limit = 20 } = req.query;
    const filter = {};
    let userIds = [];

    if (search) {
      const users = await User.find({
        $or: [
          { name: new RegExp(search, "i") },
          { email: new RegExp(search, "i") },
          { contact_no: new RegExp(search, "i") },
        ],
      }).select("_id").limit(100).lean();
      userIds = users.map(u => u._id);
      filter.$or = [
        { patientCode: new RegExp(search, "i") },
        ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
      ];
    }

    const patients = await Patient.find(filter)
      .select("userId patientCode dob nic address gender registeredByCode")
      .limit(Number(limit) || 20)
      .sort({ updatedAt: -1 })
      .lean();

    console.log('First patient data:', patients[0]); // ADD THIS LINE TO DEBUG

    const items = [];
    for (const p of patients) {
      console.log('Patient NIC:', p.nic); // ADD THIS TO SEE NIC VALUES
      items.push(await buildReceptionistPatientDTO(p));
    }

    return res.status(200).json({ items });
  } catch (err) {
    console.error("listPatientsForReceptionist error:", err);
    return res.status(500).json({ message: "Failed to load patients", error: String(err?.message || err) });
  }
};

exports.getPatientForReceptionist = async (req, res) => {
  try {
    const { patientCode } = req.params;
    const p = await Patient.findOne({ patientCode })
      .select("userId patientCode dob nic address gender registeredByCode registeredBy")
      .lean();

    if (!p) return res.status(404).json({ message: "Patient not found" });

    const dto = await buildReceptionistPatientDTO(p);

    if (p.registeredByCode) dto.registeredByCode = p.registeredByCode;

    const appts = await Appointment.find(
      { patient_code: patientCode },
      { appointmentCode: 1, dentist_code: 1, appointment_date: 1, status: 1, reason: 1, createdByCode: 1 }
    )
      .sort({ appointment_date: -1 })
      .limit(10)
      .lean();

    dto.appointments = appts.map(a => ({
      appointmentCode: a.appointmentCode,
      dentist_code: a.dentist_code,
      date: a.appointment_date,
      status: a.status,
      createdByCode: a.createdByCode || null,
      reason: a.reason ? String(a.reason).slice(0, 60) : null,
    }));

    return res.status(200).json(dto);
  } catch (err) {
    console.error("getPatientForReceptionist error:", err);
    return res.status(500).json({ message: "Failed to load patient", error: String(err?.message || err) });
  }
};

exports.registerPatientForReceptionist = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      nic,
      dob,
      gender,
      address = '',
      allergies = '',
      password = '',
      confirmPassword = '',
    } = req.body || {};

    const passwordClean = String(password || '').trim();
    const confirmClean = String(confirmPassword || '').trim();

    if (!name || !email || !phone || !nic || !dob || !gender || !passwordClean) {
      return res.status(400).json({ message: 'name, email, phone, nic, dob, gender, password are required' });
    }

    if (passwordClean.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    if (passwordClean !== confirmClean) {
      return res.status(400).json({ message: 'Password confirmation does not match' });
    }

    const emailClean = String(email).toLowerCase().trim();
    const existsUser = await User.findOne({ email: emailClean });
    if (existsUser) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const existsNIC = await Patient.findOne({ nic: nic.trim() });
    if (existsNIC) {
      return res.status(409).json({ message: 'A patient with this NIC already exists' });
    }

    const passwordHash = await bcrypt.hash(passwordClean, 10);

    const user = await User.create({
      name: name.trim(),
      email: emailClean,
      password: passwordHash,
      role: 'Patient',
      contact_no: phone.trim(),
    });

    const { code: receptionistCode, doc } = await resolveReceptionistContext(req);
    if (!receptionistCode) {
      return res.status(400).json({ message: 'Unable to resolve receptionist code from session' });
    }

    const patient = await Patient.create({
      userId: user._id,
      nic: nic.trim(),
      dob: new Date(dob),
      gender,
      address: address.trim(),
      allergies: allergies.trim(),
      registeredBy: doc?._id || null,
      registeredByCode: receptionistCode,
    });

    const receptionistUserId = req.user?._id;
    let receptionistDoc = null;
    let receptionistCode2 = null;
    if (receptionistUserId) {
      receptionistDoc = await Receptionist.findOne({ userId: receptionistUserId }).lean();
      receptionistCode2 = receptionistDoc?.receptionistCode || null;
    }

    patient.registeredBy = receptionistDoc?._id || patient.registeredBy || null;
    patient.registeredByCode = receptionistCode2 || patient.registeredByCode || null;
    await patient.save();

    try {
      await NotificationService.sendAccountCreatedWhatsApp({
        to: user.contact_no || null,
        patientName: user.name,
        email: user.email,
        tempPassword: passwordClean,
        patientCode: patient.patientCode
      });
    } catch (e) {}

    await sendPatientAccountCreated(patient.patientCode, {
      name: name.trim(),
      email: emailClean,
      password: passwordClean,
      loginEmail: emailClean,
      tempPassword: passwordClean,
      receptionistCode,
    });

    return res.status(201).json({
      message: 'Patient account created',
      patient: {
        patientCode: patient.patientCode,
        name: name.trim(),
        email: emailClean,
        phone: phone.trim(),
        registeredByCode: receptionistCode,
      },
    });
  } catch (err) {
    console.error('registerPatientForReceptionist error:', err);
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Duplicate entry detected' });
    }
    return res.status(500).json({ message: err.message || 'Failed to create patient account' });
  }
};
