// Controllers/PrescriptionControllers.js

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // kept per your request
const Prescription = require("../Model/PrescriptionModel");
const PrescriptionHistory = require("../Model/PrescriptionHistoryModel");
const Treatmentplan = require("../Model/TreatmentplanModel");

/* ----------------------------- history writer ----------------------------- */
async function writeHistory(event, rxDoc, note) {
  if (!rxDoc) return;
  try {
    await PrescriptionHistory.create({
      event,
      patientCode: rxDoc.patientCode,
      planCode: rxDoc.planCode,
      prescriptionCode: rxDoc.prescriptionCode,
      version: rxDoc.version,
      actorDentistCode: rxDoc.dentistCode,
      snapshot: rxDoc,
      note,
    });
  } catch (e) {
    console.warn("Rx history skipped:", e?.message);
  }
}

/* ---------------------------------- list ---------------------------------- */
// GET /prescriptions?patientCode=&planCode=&active=1
// If Dentist logged in -> auto filter by their dentistCode
const getAllPrescriptions = async (req, res) => {
  try {
    const filter = {};
    if (req.query.patientCode)
      filter.patientCode = String(req.query.patientCode).trim();
    if (req.query.planCode) filter.planCode = String(req.query.planCode).trim();
    if (req.query.active === "1") filter.isActive = true;
    if (req.query.active === "0") filter.isActive = false;

    if (req.user?.role === "Dentist" && req.user?.dentistCode) {
      filter.dentistCode = req.user.dentistCode;
    }

    const items = await Prescription.find(filter).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ items });
  } catch (err) {
    console.error("getAllPrescriptions error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /prescriptions/my  (dentist’s own; optional patientCode/planCode)
const getMyPrescriptions = async (req, res) => {
  try {
    const dentistCode = req.user?.dentistCode;
    if (!dentistCode) return res.status(401).json({ message: "Unauthorized" });

    const filter = { dentistCode };
    if (req.query.patientCode)
      filter.patientCode = String(req.query.patientCode).trim();
    if (req.query.planCode) filter.planCode = String(req.query.planCode).trim();
    if (req.query.active === "1") filter.isActive = true;
    if (req.query.active === "0") filter.isActive = false;

    const items = await Prescription.find(filter).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ items });
  } catch (err) {
    console.error("getMyPrescriptions error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* --------------------------------- create --------------------------------- */
// POST /prescriptions
// body: { patientCode, planCode, medicines: [{name, dosage, instructions}] }
const addPrescriptions = async (req, res) => {
  try {
    const { patientCode, planCode, medicines } = req.body;

    const dentistCode =
      req.user?.role === "Dentist" ? req.user.dentistCode : req.body.dentistCode;

    if (!patientCode || !planCode || !dentistCode) {
      return res
        .status(400)
        .json({ message: "patientCode, planCode, dentistCode are required" });
    }
    if (!Array.isArray(medicines) || medicines.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one medicine with dosage is required" });
    }
    for (const m of medicines) {
      if (!m.name || !m.dosage) {
        return res
          .status(400)
          .json({ message: "Each medicine must include name and dosage" });
      }
    }

    const tp = await Treatmentplan.findOne({
      patientCode,
      planCode,
      isDeleted: false,
      ...(req.user?.role === "Dentist" && req.user?.dentistCode
        ? { dentistCode: req.user.dentistCode }
        : {}),
    }).lean();
    if (!tp) return res.status(404).json({ message: "Active treatment plan not found" });

    const existingActive = await Prescription.findOne({
      patientCode,
      planCode,
      isActive: true,
      ...(req.user?.role === "Dentist" && req.user?.dentistCode
        ? { dentistCode: req.user.dentistCode }
        : {}),
    });
    if (existingActive) {
      return res.status(409).json({
        message:
          "Active prescription already exists for this plan. Use revise endpoint.",
      });
    }

    const doc = new Prescription({
      patientCode,
      planCode,
      plan_id: tp._id,
      dentistCode,
      medicines,
      issuedAt: new Date(),
      version: 1,
      isActive: true,
    });

    await doc.save();
    await writeHistory("create", doc.toObject());
    return res.status(201).json({ prescription: doc });
  } catch (err) {
    console.error("addPrescriptions error:", err);
    return res.status(500).json({ message: "Unable to add prescription" });
  }
};

/* --------------------------------- get one -------------------------------- */
// GET /prescriptions/:id
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid ObjectId" });

    const match = { _id: id };
    if (req.user?.role === "Dentist" && req.user?.dentistCode) {
      match.dentistCode = req.user.dentistCode;
    }

    const rx = await Prescription.findOne(match).lean();
    if (!rx) return res.status(404).json({ message: "Prescription not found" });
    return res.status(200).json({ prescription: rx });
  } catch (err) {
    console.error("getById error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /prescriptions/code/:patientCode/:planCode  (active)
const getActiveByPlan = async (req, res) => {
  try {
    const { patientCode, planCode } = req.params;
    const match = { patientCode, planCode, isActive: true };
    if (req.user?.role === "Dentist" && req.user?.dentistCode) {
      match.dentistCode = req.user.dentistCode;
    }
    const rx = await Prescription.findOne(match).lean();
    if (!rx) return res.status(404).json({ message: "Active prescription not found" });
    return res.status(200).json({ prescription: rx });
  } catch (err) {
    console.error("getActiveByPlan error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* --------------------------------- update --------------------------------- */
// PUT /prescriptions/:id
// rules: NO deletion; update allowed only if ≤24h since issuedAt AND patient not seen
const updatePrescription = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid ObjectId" });

    const rx = await Prescription.findById(id);
    if (!rx) return res.status(404).json({ message: "Prescription not found" });

    // Dentist can only edit their own
    if (req.user?.role === "Dentist" && req.user?.dentistCode !== rx.dentistCode) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!rx.isEditable()) {
      return res
        .status(403)
        .json({ message: "Updates are locked (older than 24h or already seen by patient)" });
    }

    if (!Array.isArray(req.body.medicines) || req.body.medicines.length === 0) {
      return res
        .status(400)
        .json({ message: "Updated prescription must include at least one medicine" });
    }

    rx.medicines = req.body.medicines;
    await rx.save();

    await writeHistory("update", rx.toObject(), "inline edit within 24h & not seen");
    return res.status(200).json({ prescription: rx });
  } catch (err) {
    console.error("updatePrescription error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ------------------------------- mark seen -------------------------------- */
// PATCH /prescriptions/:id/seen
const markSeenByPatient = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid ObjectId" });

    const rx = await Prescription.findById(id);
    if (!rx) return res.status(404).json({ message: "Prescription not found" });

    // Dentist scope check not required; this is a patient action
    if (!rx.patientSeenAt) {
      rx.patientSeenAt = new Date();
      await rx.save();
    }
    return res.status(200).json({
      prescription: rx,
      note: "Patient marked as seen; further edits locked.",
    });
  } catch (err) {
    console.error("markSeenByPatient error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* --------------------------------- revise --------------------------------- */
// POST /prescriptions/my/revise/:patientCode/:planCode  (dentist-owned)
const reviseMyPrescriptionForPlan = async (req, res) => {
  try {
    const dentistCode = req.user?.dentistCode;
    if (!dentistCode) return res.status(401).json({ message: "Unauthorized" });

    const { patientCode, planCode } = req.params;

    const tp = await Treatmentplan.findOne({
      patientCode,
      planCode,
      isDeleted: false,
      dentistCode,
    }).lean();
    if (!tp) return res.status(404).json({ message: "Active treatment plan not found" });

    const prev = await Prescription.findOne({
      patientCode,
      planCode,
      isActive: true,
      dentistCode,
    });
    if (!prev) return res.status(404).json({ message: "No active prescription to revise" });

    prev.isActive = false;
    await prev.save();

    const newDoc = new Prescription({
      patientCode,
      planCode,
      plan_id: tp._id,
      dentistCode,
      prescriptionCode: prev.prescriptionCode,
      version: prev.version + 1,
      medicines:
        Array.isArray(req.body.medicines) && req.body.medicines.length > 0
          ? req.body.medicines
          : prev.medicines,
      issuedAt: new Date(),
      patientSeenAt: null,
      isActive: true,
    });

    await newDoc.save();

    await writeHistory("revise", prev.toObject(), "previous version closed");
    await writeHistory(
      "revise",
      newDoc.toObject(),
      `new version due to treatment plan v${tp.version} update`
    );

    return res.status(201).json({ prescription: newDoc, previous: prev });
  } catch (err) {
    console.error("reviseMyPrescriptionForPlan error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// PUT /prescriptions/code/:patientCode/:planCode/:prescriptionCode
// Only the owning dentist can update
const updatePrescriptionByCode = async (req, res) => {
  try {
    const { patientCode, planCode, prescriptionCode } = req.params;

    const rx = await Prescription.findOne({
      patientCode,
      planCode,
      prescriptionCode,
      isActive: true,
    });
    if (!rx) return res.status(404).json({ message: "Prescription not found" });

    if (req.user?.role === "Dentist" && req.user?.dentistCode !== rx.dentistCode) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!rx.isEditable()) {
      return res
        .status(403)
        .json({ message: "Updates are locked (older than 24h or already seen by patient)" });
    }

    if (!Array.isArray(req.body.medicines) || req.body.medicines.length === 0) {
      return res
        .status(400)
        .json({ message: "Updated prescription must include at least one medicine" });
    }

    rx.medicines = req.body.medicines;
    await rx.save();

    await writeHistory("update", rx.toObject(), "updated via RX code");
    return res.status(200).json({ prescription: rx });
  } catch (err) {
    console.error("updatePrescriptionByCode error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getAllPrescriptions,
  getMyPrescriptions,
  addPrescriptions,
  getById,
  getActiveByPlan,
  updatePrescription,
  markSeenByPatient,
  reviseMyPrescriptionForPlan,
  updatePrescriptionByCode,
};
