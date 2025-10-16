// Controllers/TreatmentplanControllers.js

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // kept per your request
const Treatmentplan = require("../Model/TreatmentplanModel");
const Counter = require("../Model/Counter"); // inspect/resync counters
let TreatmentplanHistory;
try {
  TreatmentplanHistory = require("../Model/TreatmentplanHistory");
} catch (_) {
  TreatmentplanHistory = null;
}

/* --------------------------------- helpers -------------------------------- */
async function writeHistory(event, afterDoc, extra = {}) {
  if (!TreatmentplanHistory || !afterDoc) return;
  try {
    await TreatmentplanHistory.create({
      event, // "create" | "update" | "archive" | "restore"
      patientCode: afterDoc.patientCode,
      planCode: afterDoc.planCode,
      dentistCode: afterDoc.dentistCode,
      version: afterDoc.version,
      snapshot: afterDoc,
      ...extra,
    });
  } catch (e) {
    console.warn("history write skipped:", e?.message);
  }
}

/** Compute current max numeric plan code for a patient (TP-003 -> 3) */
async function getMaxPlanNumberInDb(patientCode) {
  const rows = await Treatmentplan.aggregate([
    { $match: { patientCode } },
    {
      $project: {
        n: {
          $toInt: {
            $arrayElemAt: [{ $split: ["$planCode", "-"] }, 1],
          },
        },
      },
    },
    { $group: { _id: null, maxN: { $max: "$n" } } },
  ]);
  return rows?.[0]?.maxN || 0;
}

/* ----------------------------- list / search ------------------------------ */
// GET /treatmentplans
const getAllTreatmentplans = async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === "1";
    const filter = includeArchived ? {} : { isDeleted: false };

    // If a Dentist is logged in, only show THEIR treatment plans
    if (req.user?.role === "Dentist" && req.user?.dentistCode) {
      filter.dentistCode = req.user.dentistCode;
    }

    const treatmentplans = await Treatmentplan.find(filter).lean();
    return res.status(200).json({ treatmentplans });
  } catch (err) {
    console.error("getAllTreatmentplans error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /treatmentplans/my  (dentist’s own)
const getMyTreatmentplans = async (req, res) => {
  try {
    const dentistCode = req.user?.dentistCode;
    if (!dentistCode) return res.status(401).json({ message: "Unauthorized" });

    const includeArchived = req.query.includeArchived === "1";
    const filter = includeArchived
      ? { dentistCode }
      : { dentistCode, isDeleted: false };

    const plans = await Treatmentplan.find(filter).lean();
    return res.status(200).json({ treatmentplans: plans });
  } catch (err) {
    console.error("getMyTreatmentplans error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* --------------------------------- create --------------------------------- */
// POST /treatmentplans
const addTreatmentplans = async (req, res) => {
  try {
    console.log('=== TREATMENT PLAN CREATION DEBUG ===');
    console.log('Request body:', req.body);
    console.log('Request user:', req.user);
    
    const { patientCode, diagnosis, treatment_notes, version } = req.body;

    // force dentistCode from login if Dentist, otherwise allow body (e.g., Admin)
    const dentistCode =
      req.user?.role === "Dentist" ? req.user.dentistCode : req.body.dentistCode;

    console.log('Extracted values:', { patientCode, dentistCode, diagnosis, treatment_notes, version });

    if (!patientCode || !dentistCode || !diagnosis) {
      console.log('Validation failed:', { patientCode: !!patientCode, dentistCode: !!dentistCode, diagnosis: !!diagnosis });
      return res.status(400).json({
        message: "patientCode, dentistCode, and diagnosis are required",
      });
    }

    const doc = new Treatmentplan({
      patientCode,
      dentistCode,
      diagnosis,
      treatment_notes,
      version: version || 1,
      created_date: new Date(),
      updated_date: new Date(),
    });

    console.log('Treatment plan document created:', doc);
    console.log('Saving treatment plan...');
    
    await doc.save();
    console.log('Treatment plan saved successfully:', doc);
    
    await writeHistory("create", doc.toObject());
    console.log('History written successfully');
    
    return res.status(201).json({ treatmentplans: doc });
  } catch (err) {
    console.error("addTreatmentplans error:", err);
    return res.status(500).json({ message: "Unable to add treatment plan" });
  }
};

/* --------------------------------- get one -------------------------------- */
// GET /treatmentplans/:id
const getById = async (req, res) => {
  try {
    const { id } = req.params;
    const includeArchived = req.query.includeArchived === "1";
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ObjectId" });
    }
    const filter = includeArchived ? { _id: id } : { _id: id, isDeleted: false };

    // Dentist scope
    if (req.user?.role === "Dentist" && req.user?.dentistCode) {
      filter.dentistCode = req.user.dentistCode;
    }

    const treatmentplan = await Treatmentplan.findOne(filter).lean();
    if (!treatmentplan)
      return res.status(404).json({ message: "Treatment plan not found" });
    return res.status(200).json({ treatmentplans: treatmentplan });
  } catch (err) {
    console.error("getById error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /treatmentplans/code/:planCode
const getByCode = async (req, res) => {
  try {
    const { planCode } = req.params;
    const includeArchived = req.query.includeArchived === "1";
    const filter = includeArchived ? { planCode } : { planCode, isDeleted: false };

    // Dentist scope
    if (req.user?.role === "Dentist" && req.user?.dentistCode) {
      filter.dentistCode = req.user.dentistCode;
    }

    const treatmentplan = await Treatmentplan.findOne(filter).lean();
    if (!treatmentplan)
      return res.status(404).json({ message: "Treatment plan not found" });
    return res.status(200).json({ treatmentplan });
  } catch (err) {
    console.error("getByCode error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* --------------------------------- update --------------------------------- */
// PUT /treatmentplans/code/:patientCode/:planCode
const updateTreatmentplanByCode = async (req, res) => {
  try {
    const { patientCode, planCode } = req.params;
    const { diagnosis, treatment_notes } = req.body;

    const $set = { updated_date: new Date() };
    if (typeof diagnosis !== "undefined") $set.diagnosis = diagnosis;
    if (typeof treatment_notes !== "undefined") $set.treatment_notes = treatment_notes;
    if (Object.keys($set).length === 1) {
      return res.status(400).json({
        message: "Provide diagnosis or treatment_notes to update",
      });
    }

    const match = { patientCode, planCode, isDeleted: false };
    // Dentist scope
    if (req.user?.role === "Dentist" && req.user?.dentistCode) {
      match.dentistCode = req.user.dentistCode;
    }

    const treatmentplan = await Treatmentplan.findOneAndUpdate(
      match,
      { $set },
      { new: true, runValidators: true }
    );

    if (!treatmentplan) {
      return res
        .status(404)
        .json({ message: "Unable to update (not found or archived)" });
    }

    await writeHistory("update", treatmentplan.toObject());
    return res.status(200).json({ treatmentplan });
  } catch (err) {
    console.error("updateTreatmentplanByCode error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// PUT /treatmentplans/my/:patientCode/:planCode  (explicit dentist route)
const updateMyTreatmentplanByCode = async (req, res) => {
  req.user = req.user || {};
  req.user.role = "Dentist";
  return updateTreatmentplanByCode(req, res);
};

// PUT /treatmentplans/:id
const updateTreatmentplanById = async (req, res) => {
  try {
    const { id } = req.params;
    const { diagnosis, treatment_notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ObjectId" });
    }

    const $set = { updated_date: new Date() };
    if (typeof diagnosis !== "undefined") $set.diagnosis = diagnosis;
    if (typeof treatment_notes !== "undefined") $set.treatment_notes = treatment_notes;
    if (Object.keys($set).length === 1) {
      return res.status(400).json({
        message: "Provide diagnosis or treatment_notes to update",
      });
    }

    const match = { _id: id, isDeleted: false };
    // Dentist scope
    if (req.user?.role === "Dentist" && req.user?.dentistCode) {
      match.dentistCode = req.user.dentistCode;
    }

    const treatmentplan = await Treatmentplan.findOneAndUpdate(
      match,
      { $set },
      { new: true, runValidators: true }
    );

    if (!treatmentplan) {
      return res
        .status(404)
        .json({ message: "Unable to update (not found or archived)" });
    }

    await writeHistory("update", treatmentplan.toObject());
    return res.status(200).json({ treatmentplan });
  } catch (err) {
    console.error("updateTreatmentplanById error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ------------------------------ soft delete ------------------------------- */
// DELETE /treatmentplans/code/:patientCode/:planCode
const deleteTreatmentplanByCode = async (req, res) => {
  try {
    const patientCode = String(req.params.patientCode || "").trim();
    const planCode = String(req.params.planCode || "").trim();

    const match = { patientCode, planCode, isDeleted: false };
    // Dentist scope
    if (req.user?.role === "Dentist" && req.user?.dentistCode) {
      match.dentistCode = req.user.dentistCode;
    }

    const treatmentplan = await Treatmentplan.findOneAndUpdate(
      match,
      {
        $set: {
          isDeleted: true,
          status: "archived",
          deletedAt: new Date(),
          deletedBy: req.user?.id || "system",
          deleteReason: req.body?.reason || "no reason given",
          updated_date: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!treatmentplan) {
      return res
        .status(404)
        .json({ message: "Treatment plan not found or already archived" });
    }

    await writeHistory("archive", treatmentplan);
    return res.status(200).json({ message: "Archived", treatmentplan });
  } catch (err) {
    console.error("deleteTreatmentplanByCode error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// DELETE /treatmentplans/my/:patientCode/:planCode
const deleteMyTreatmentplanByCode = async (req, res) => {
  req.user = req.user || {};
  req.user.role = "Dentist";
  return deleteTreatmentplanByCode(req, res);
};

// DELETE /treatmentplans/:id  (kept; still dentist-scoped if Dentist role)
const deleteTreatmentplanById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ObjectId" });
    }

    const match = { _id: id, isDeleted: false };
    if (req.user?.role === "Dentist" && req.user?.dentistCode) {
      match.dentistCode = req.user.dentistCode;
    }

    const treatmentplan = await Treatmentplan.findOneAndUpdate(
      match,
      {
        $set: {
          isDeleted: true,
          status: "archived",
          deletedAt: new Date(),
          deletedBy: req.user?.id || "system",
          deleteReason: req.body?.reason || "no reason given",
          updated_date: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!treatmentplan) {
      return res
        .status(404)
        .json({ message: "Treatment plan not found or already archived" });
    }

    await writeHistory("archive", treatmentplan);
    return res.status(200).json({ message: "Archived", treatmentplan });
  } catch (err) {
    console.error("deleteTreatmentplanById error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* --------------------------------- restore -------------------------------- */
// POST /treatmentplans/restore/:patientCode/:planCode
const restoreByCode = async (req, res) => {
  try {
    const patientCode = String(req.params.patientCode || "").trim();
    const planCode = String(req.params.planCode || "").trim();

    const match = { patientCode, planCode, isDeleted: true };
    if (req.user?.role === "Dentist" && req.user?.dentistCode) {
      match.dentistCode = req.user.dentistCode;
    }

    const tp = await Treatmentplan.findOneAndUpdate(
      match,
      {
        $set: {
          isDeleted: false,
          status: "active",
          deletedAt: null,
          deletedBy: null,
          deleteReason: null,
          updated_date: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!tp) {
      return res
        .status(404)
        .json({ message: "Archived treatment plan not found" });
    }

    await writeHistory("restore", tp);
    return res.status(200).json({ message: "Restored", treatmentplan: tp });
  } catch (err) {
    console.error("restoreByCode error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ------------------- counter introspection / resync ----------------------- */
// GET /treatmentplans/counter/:patientCode
const getCounterForPatient = async (req, res) => {
  try {
    const patientCode = String(req.params.patientCode || "").trim();
    const scope = `tplan:${patientCode}`;
    const counter = await Counter.findOne({ scope }).lean();
    const seq = counter?.seq || 0;
    const maxInDb = await getMaxPlanNumberInDb(patientCode);

    return res.status(200).json({
      patientCode,
      scope,
      counterSeq: seq,
      maxPlanNumberInDb: maxInDb,
      nextGeneratedWouldBe: `TP-${String(seq + 1).padStart(3, "0")}`,
      explanation:
        "Counters are monotonic for auditability. Hard-deleting documents in MongoDB UI does not rewind the counter.",
    });
  } catch (err) {
    console.error("getCounterForPatient error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /treatmentplans/counter/:patientCode/resync
const resyncCounterForPatient = async (req, res) => {
  try {
    const patientCode = String(req.params.patientCode || "").trim();
    const scope = `tplan:${patientCode}`;

    const old = await Counter.findOne({ scope }).lean();
    const oldSeq = old?.seq || 0;
    const maxInDb = await getMaxPlanNumberInDb(patientCode);

    const updated = await Counter.findOneAndUpdate(
      { scope },
      { $set: { seq: maxInDb } },
      { upsert: true, new: true }
    ).lean();

    return res.status(200).json({
      patientCode,
      scope,
      oldSeq,
      maxPlanNumberInDb: maxInDb,
      newSeq: updated.seq,
      note:
        "Counter aligned to existing data. Next insert will be TP-" +
        String(updated.seq + 1).padStart(3, "0") +
        ". Avoid hard deletes in production.",
    });
  } catch (err) {
    console.error("resyncCounterForPatient error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* --------------------------------- exports -------------------------------- */
module.exports = {
  getAllTreatmentplans,
  getMyTreatmentplans,
  addTreatmentplans,
  getById,
  getByCode,
  updateTreatmentplanByCode,
  updateMyTreatmentplanByCode,
  updateTreatmentplanById,
  deleteTreatmentplanByCode,
  deleteMyTreatmentplanByCode,
  deleteTreatmentplanById,
  restoreByCode,
  getCounterForPatient,
  resyncCounterForPatient,
};
