// Controllers/PatientPrescriptionControllers.js

const mongoose = require("mongoose");
const Prescription = require("../Model/PrescriptionModel");
const PrescriptionHistory = require("../Model/PrescriptionHistoryModel");
const Treatmentplan = require("../Model/TreatmentplanModel");

/* --------------------------------- Patient Prescription Controllers --------------------------------- */

// GET /api/prescriptions/my-prescriptions - Get all prescriptions for authenticated patient
const getMyPrescriptions = async (req, res) => {
  try {
    const patientCode = req.user?.patientCode;
    if (!patientCode) {
      return res.status(401).json({ 
        success: false,
        message: "Patient code not found. Please log in again." 
      });
    }

    // By default, only show active prescriptions
    // To get all prescriptions (including inactive), pass ?includeInactive=1
    const filter = { patientCode };
    
    // Only show active prescriptions by default (for profile view)
    // Medical history will use includeInactive=1 to get all prescriptions
    if (req.query.includeInactive !== "1") {
      filter.isActive = true;
    }
    
    // Optional filters from query params
    if (req.query.active === "1") filter.isActive = true;
    if (req.query.active === "0") filter.isActive = false;
    if (req.query.planCode) filter.planCode = String(req.query.planCode).trim();
    if (req.query.dentistCode) filter.dentistCode = String(req.query.dentistCode).trim();

    const prescriptions = await Prescription.find(filter)
      .populate('plan_id', 'diagnosis treatment_notes planCode')
      .sort({ issuedAt: -1 })
      .lean();

    // Populate dentist names
    const DentistModel = require("../Model/DentistModel");
    const User = require("../Model/User");
    
    const enrichedPrescriptions = await Promise.all(
      prescriptions.map(async (prescription) => {
        try {
          const dentist = await DentistModel.findOne({ dentistCode: prescription.dentistCode }).lean();
          if (dentist && dentist.userId) {
            const user = await User.findById(dentist.userId).select('name').lean();
            if (user) {
              prescription.dentistName = user.name;
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch dentist info for ${prescription.dentistCode}:`, err.message);
        }
        return prescription;
      })
    );

    return res.status(200).json({ 
      success: true,
      prescriptions: enrichedPrescriptions,
      count: enrichedPrescriptions.length 
    });
  } catch (err) {
    console.error("getMyPrescriptions error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch prescriptions" 
    });
  }
};

// GET /api/prescriptions/:id - Get single prescription by ID (patient can only see their own)
const getPrescriptionById = async (req, res) => {
  try {
    const { id } = req.params;
    const patientCode = req.user?.patientCode;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid prescription ID" 
      });
    }

    const prescription = await Prescription.findOne({ 
      _id: id, 
      patientCode 
    })
    .populate('plan_id', 'diagnosis treatment_notes planCode')
    .lean();

    if (!prescription) {
      return res.status(404).json({ 
        success: false,
        message: "Prescription not found" 
      });
    }

    return res.status(200).json({ 
      success: true,
      prescription 
    });
  } catch (err) {
    console.error("getPrescriptionById error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch prescription" 
    });
  }
};

// GET /api/prescriptions/by-plan/:planCode - Get prescriptions by treatment plan
const getPrescriptionsByPlan = async (req, res) => {
  try {
    const { planCode } = req.params;
    const patientCode = req.user?.patientCode;

    const prescriptions = await Prescription.find({ 
      planCode, 
      patientCode 
    })
    .populate('plan_id', 'diagnosis treatment_notes')
    .sort({ issuedAt: -1 })
    .lean();

    return res.status(200).json({ 
      success: true,
      prescriptions 
    });
  } catch (err) {
    console.error("getPrescriptionsByPlan error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch prescriptions" 
    });
  }
};

// GET /api/prescriptions/:id/editable - Check if prescription is editable (patients can't edit, but useful for UI)
const checkPrescriptionEditable = async (req, res) => {
  try {
    const { id } = req.params;
    const patientCode = req.user?.patientCode;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid prescription ID" 
      });
    }

    const prescription = await Prescription.findOne({ 
      _id: id, 
      patientCode 
    });

    if (!prescription) {
      return res.status(404).json({ 
        success: false,
        message: "Prescription not found" 
      });
    }

    // Patients cannot edit prescriptions, but we can show if it's theoretically editable
    const isEditable = await prescription.isEditable();

    return res.status(200).json({ 
      success: true,
      isEditable,
      canPatientEdit: false,
      note: "Patients cannot edit prescriptions. Contact your dentist for changes."
    });
  } catch (err) {
    console.error("checkPrescriptionEditable error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to check editability" 
    });
  }
};

// PATCH /api/prescriptions/:id/seen - Mark prescription as seen by patient
const markPrescriptionSeen = async (req, res) => {
  try {
    const { id } = req.params;
    const patientCode = req.user?.patientCode;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid prescription ID" 
      });
    }

    const prescription = await Prescription.findOne({ 
      _id: id, 
      patientCode 
    });

    if (!prescription) {
      return res.status(404).json({ 
        success: false,
        message: "Prescription not found" 
      });
    }

    // Only mark as seen if not already seen
    if (!prescription.patientSeenAt) {
      prescription.patientSeenAt = new Date();
      await prescription.save();
      
      // Write to history if available
      try {
        await PrescriptionHistory.create({
          event: "patient_seen",
          patientCode: prescription.patientCode,
          planCode: prescription.planCode,
          prescriptionCode: prescription.prescriptionCode,
          version: prescription.version,
          actorPatientCode: patientCode,
          snapshot: prescription.toObject(),
          note: "Patient marked prescription as seen"
        });
      } catch (historyErr) {
        console.warn("Prescription history write failed:", historyErr?.message);
      }
    }

    return res.status(200).json({
      success: true,
      prescription,
      message: "Prescription marked as seen"
    });
  } catch (err) {
    console.error("markPrescriptionSeen error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to mark prescription as seen" 
    });
  }
};

// GET /api/prescriptions/stats - Get prescription statistics for patient
const getPrescriptionStats = async (req, res) => {
  try {
    const patientCode = req.user?.patientCode;

    const stats = await Prescription.aggregate([
      { $match: { patientCode } },
      {
        $addFields: {
          daysSinceIssued: {
            $divide: [
              { $subtract: [new Date(), "$issuedAt"] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$isActive", true] },
                    { $eq: ["$patientSeenAt", null] },
                    { $lte: ["$daysSinceIssued", 1] }
                  ]
                },
                1,
                0
              ]
            }
          },
          completed: {
            $sum: {
              $cond: [{ $ne: ["$patientSeenAt", null] }, 1, 0]
            }
          },
          expired: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$isActive", false] },
                    { $gt: ["$daysSinceIssued", 1] }
                  ]
                },
                1,
                0
              ]
            }
          },
          totalMedicines: {
            $sum: { $size: { $ifNull: ["$medicines", []] } }
          }
        }
      }
    ]);

    const result = stats[0] || { 
      total: 0, 
      active: 0, 
      completed: 0, 
      expired: 0, 
      totalMedicines: 0 
    };

    return res.status(200).json({ 
      success: true,
      stats: result 
    });
  } catch (err) {
    console.error("getPrescriptionStats error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch prescription statistics" 
    });
  }
};

// GET /api/prescriptions/history/:prescriptionCode - Get prescription history
const getPrescriptionHistory = async (req, res) => {
  try {
    const { prescriptionCode } = req.params;
    const patientCode = req.user?.patientCode;

    // Check if patient owns this prescription
    const prescription = await Prescription.findOne({ 
      prescriptionCode, 
      patientCode 
    }).lean();

    if (!prescription) {
      return res.status(404).json({ 
        success: false,
        message: "Prescription not found" 
      });
    }

    // Get history if available
    let history = [];
    try {
      history = await PrescriptionHistory.find({ 
        prescriptionCode, 
        patientCode 
      })
      .sort({ createdAt: -1 })
      .lean();
    } catch (err) {
      console.warn("Prescription history not available:", err?.message);
    }

    return res.status(200).json({ 
      success: true,
      history,
      prescription 
    });
  } catch (err) {
    console.error("getPrescriptionHistory error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch prescription history" 
    });
  }
};

// GET /api/prescriptions/export - Export prescriptions for patient (placeholder for PDF)
const exportPrescriptions = async (req, res) => {
  try {
    const patientCode = req.user?.patientCode;

    const prescriptions = await Prescription.find({ patientCode })
      .populate('plan_id', 'diagnosis treatment_notes planCode')
      .sort({ issuedAt: -1 })
      .lean();

    // TODO: Implement actual PDF generation here
    // For now, return JSON with export info
    return res.status(200).json({ 
      success: true,
      prescriptions,
      exportInfo: {
        patientCode,
        exportDate: new Date(),
        format: "JSON",
        note: "PDF export functionality coming soon"
      }
    });
  } catch (err) {
    console.error("exportPrescriptions error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Export failed" 
    });
  }
};

// GET /api/prescriptions/dentist/:dentistCode - Get prescriptions by specific dentist
const getPrescriptionsByDentist = async (req, res) => {
  try {
    const { dentistCode } = req.params;
    const patientCode = req.user?.patientCode;

    const prescriptions = await Prescription.find({ 
      patientCode, 
      dentistCode 
    })
    .populate('plan_id', 'diagnosis treatment_notes planCode')
    .sort({ issuedAt: -1 })
    .lean();

    return res.status(200).json({ 
      success: true,
      prescriptions,
      dentistCode 
    });
  } catch (err) {
    console.error("getPrescriptionsByDentist error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch prescriptions by dentist" 
    });
  }
};

module.exports = {
  getMyPrescriptions,
  getPrescriptionById,
  getPrescriptionsByPlan,
  checkPrescriptionEditable,
  markPrescriptionSeen,
  getPrescriptionStats,
  getPrescriptionHistory,
  exportPrescriptions,
  getPrescriptionsByDentist,
};