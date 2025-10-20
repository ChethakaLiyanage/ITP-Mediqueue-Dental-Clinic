// Controllers/PatientTreatmentplanControllers.js

const mongoose = require("mongoose");
const Treatmentplan = require("../Model/TreatmentplanModel");
const Prescription = require("../Model/PrescriptionModel");
let TreatmentplanHistory;
try {
  TreatmentplanHistory = require("../Model/TreatmentplanHistory");
} catch (_) {
  TreatmentplanHistory = null;
}

/* --------------------------------- Patient Treatment Plan Controllers --------------------------------- */

// GET /api/treatments/my-treatments - Get all treatment plans for authenticated patient
const getMyTreatments = async (req, res) => {
  try {
    const patientCode = req.user?.patientCode;
    if (!patientCode) {
      return res.status(401).json({ 
        success: false,
        message: "Patient code not found. Please log in again." 
      });
    }

    const includeDeleted = req.query.includeDeleted === "1";
    const includeArchived = req.query.includeArchived === "1";
    const filter = { patientCode };
    
    if (!includeDeleted) {
      filter.isDeleted = false;
    }

    // By default, only show active treatments (not archived)
    // Medical history will use includeArchived=1 to get all treatments
    if (!includeArchived && !req.query.status) {
      filter.status = 'active';
    }

    // Optional filters from query params
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.dentistCode) {
      filter.dentistCode = String(req.query.dentistCode).trim();
    }
    if (req.query.planCode) {
      filter.planCode = String(req.query.planCode).trim();
    }

    const treatments = await Treatmentplan.find(filter)
      .sort({ created_date: -1 })
      .lean();

    // Populate dentist names
    const DentistModel = require("../Model/DentistModel");
    const User = require("../Model/User");
    
    const enrichedTreatments = await Promise.all(
      treatments.map(async (treatment) => {
        try {
          const dentist = await DentistModel.findOne({ dentistCode: treatment.dentistCode }).lean();
          if (dentist && dentist.userId) {
            const user = await User.findById(dentist.userId).select('name').lean();
            if (user) {
              treatment.dentistName = user.name;
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch dentist info for ${treatment.dentistCode}:`, err.message);
        }
        return treatment;
      })
    );

    return res.status(200).json({ 
      success: true,
      treatments: enrichedTreatments,
      count: enrichedTreatments.length 
    });
  } catch (err) {
    console.error("getMyTreatments error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch treatment plans" 
    });
  }
};

// GET /api/treatments/:id - Get single treatment plan by ID
const getTreatmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const patientCode = req.user?.patientCode;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid treatment plan ID" 
      });
    }

    const includeDeleted = req.query.includeDeleted === "1";
    const filter = { _id: id, patientCode };
    
    if (!includeDeleted) {
      filter.isDeleted = false;
    }

    const treatment = await Treatmentplan.findOne(filter).lean();

    if (!treatment) {
      return res.status(404).json({ 
        success: false,
        message: "Treatment plan not found" 
      });
    }

    return res.status(200).json({ 
      success: true,
      treatment 
    });
  } catch (err) {
    console.error("getTreatmentById error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch treatment plan" 
    });
  }
};

// GET /api/treatments/plan/:planCode - Get treatment plan by code
const getTreatmentByCode = async (req, res) => {
  try {
    const { planCode } = req.params;
    const patientCode = req.user?.patientCode;

    const includeDeleted = req.query.includeDeleted === "1";
    const filter = { planCode, patientCode };
    
    if (!includeDeleted) {
      filter.isDeleted = false;
    }

    const treatment = await Treatmentplan.findOne(filter).lean();

    if (!treatment) {
      return res.status(404).json({ 
        success: false,
        message: "Treatment plan not found" 
      });
    }

    return res.status(200).json({ 
      success: true,
      treatment 
    });
  } catch (err) {
    console.error("getTreatmentByCode error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch treatment plan" 
    });
  }
};

// GET /api/treatments/stats - Get treatment plan statistics for patient
const getTreatmentStats = async (req, res) => {
  try {
    const patientCode = req.user?.patientCode;

    const stats = await Treatmentplan.aggregate([
      { $match: { patientCode } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "active"] },
                    { $eq: ["$isDeleted", false] }
                  ]
                },
                1,
                0
              ]
            }
          },
          archived: {
            $sum: {
              $cond: [{ $eq: ["$status", "archived"] }, 1, 0]
            }
          },
          deleted: {
            $sum: {
              $cond: [{ $eq: ["$isDeleted", true] }, 1, 0]
            }
          },
          dentistCount: {
            $addToSet: "$dentistCode"
          }
        }
      },
      {
        $addFields: {
          uniqueDentists: { $size: "$dentistCount" }
        }
      },
      {
        $project: {
          total: 1,
          active: 1,
          archived: 1,
          deleted: 1,
          uniqueDentists: 1
        }
      }
    ]);

    const result = stats[0] || { 
      total: 0, 
      active: 0, 
      archived: 0, 
      deleted: 0, 
      uniqueDentists: 0 
    };

    return res.status(200).json({ 
      success: true,
      stats: result 
    });
  } catch (err) {
    console.error("getTreatmentStats error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch treatment statistics" 
    });
  }
};

// GET /api/treatments/history/:planCode - Get treatment plan history (if available)
const getTreatmentHistory = async (req, res) => {
  try {
    const { planCode } = req.params;
    const patientCode = req.user?.patientCode;

    // Verify patient owns this treatment plan
    const treatment = await Treatmentplan.findOne({ 
      planCode, 
      patientCode 
    }).lean();

    if (!treatment) {
      return res.status(404).json({ 
        success: false,
        message: "Treatment plan not found" 
      });
    }

    // Get history if available
    let history = [];
    if (TreatmentplanHistory) {
      try {
        history = await TreatmentplanHistory.find({ 
          planCode, 
          patientCode 
        })
        .sort({ createdAt: -1 })
        .lean();
      } catch (err) {
        console.warn("Treatment history fetch failed:", err?.message);
      }
    }

    return res.status(200).json({ 
      success: true,
      history,
      treatment,
      hasHistory: history.length > 0
    });
  } catch (err) {
    console.error("getTreatmentHistory error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch treatment history" 
    });
  }
};

// GET /api/treatments/dentist/:dentistCode - Get treatments by specific dentist
const getTreatmentsByDentist = async (req, res) => {
  try {
    const { dentistCode } = req.params;
    const patientCode = req.user?.patientCode;

    const includeDeleted = req.query.includeDeleted === "1";
    const filter = { patientCode, dentistCode };
    
    if (!includeDeleted) {
      filter.isDeleted = false;
    }

    const treatments = await Treatmentplan.find(filter)
      .sort({ created_date: -1 })
      .lean();

    return res.status(200).json({ 
      success: true,
      treatments,
      dentistCode,
      count: treatments.length 
    });
  } catch (err) {
    console.error("getTreatmentsByDentist error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch treatments by dentist" 
    });
  }
};

// GET /api/treatments/:id/prescriptions - Get all prescriptions for a specific treatment plan
const getTreatmentPrescriptions = async (req, res) => {
  try {
    const { id } = req.params;
    const patientCode = req.user?.patientCode;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid treatment plan ID" 
      });
    }

    // Verify patient owns this treatment plan
    const treatment = await Treatmentplan.findOne({ 
      _id: id, 
      patientCode 
    }).lean();

    if (!treatment) {
      return res.status(404).json({ 
        success: false,
        message: "Treatment plan not found" 
      });
    }

    // Get all prescriptions for this treatment plan
    const prescriptions = await Prescription.find({ 
      planCode: treatment.planCode,
      patientCode 
    })
    .sort({ issuedAt: -1 })
    .lean();

    return res.status(200).json({ 
      success: true,
      prescriptions,
      treatment,
      count: prescriptions.length 
    });
  } catch (err) {
    console.error("getTreatmentPrescriptions error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch treatment prescriptions" 
    });
  }
};

// GET /api/treatments/export - Export treatment plans for patient (placeholder for PDF)
const exportTreatments = async (req, res) => {
  try {
    const patientCode = req.user?.patientCode;

    const includeDeleted = req.query.includeDeleted === "1";
    const filter = { patientCode };
    
    if (!includeDeleted) {
      filter.isDeleted = false;
    }

    const treatments = await Treatmentplan.find(filter)
      .sort({ created_date: -1 })
      .lean();

    // TODO: Implement actual PDF generation here
    // For now, return JSON with export info
    return res.status(200).json({ 
      success: true,
      treatments,
      exportInfo: {
        patientCode,
        exportDate: new Date(),
        format: "JSON",
        includeDeleted,
        note: "PDF export functionality coming soon"
      }
    });
  } catch (err) {
    console.error("exportTreatments error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Export failed" 
    });
  }
};

// GET /api/treatments/search - Search treatments by diagnosis or notes
const searchTreatments = async (req, res) => {
  try {
    const patientCode = req.user?.patientCode;
    const { query, includeDeleted } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ 
        success: false,
        message: "Search query must be at least 2 characters long" 
      });
    }

    const filter = { 
      patientCode,
      $or: [
        { diagnosis: { $regex: query.trim(), $options: 'i' } },
        { treatment_notes: { $regex: query.trim(), $options: 'i' } },
        { planCode: { $regex: query.trim(), $options: 'i' } },
        { dentistCode: { $regex: query.trim(), $options: 'i' } }
      ]
    };

    if (includeDeleted !== "1") {
      filter.isDeleted = false;
    }

    const treatments = await Treatmentplan.find(filter)
      .sort({ created_date: -1 })
      .lean();

    return res.status(200).json({ 
      success: true,
      treatments,
      searchQuery: query,
      count: treatments.length 
    });
  } catch (err) {
    console.error("searchTreatments error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Search failed" 
    });
  }
};

// GET /api/treatments/dentists - Get list of dentists who have treated this patient
const getMyDentists = async (req, res) => {
  try {
    const patientCode = req.user?.patientCode;

    const dentists = await Treatmentplan.aggregate([
      { $match: { patientCode, isDeleted: false } },
      {
        $group: {
          _id: "$dentistCode",
          treatmentCount: { $sum: 1 },
          firstTreatment: { $min: "$created_date" },
          lastTreatment: { $max: "$updated_date" },
          activeTreatments: {
            $sum: {
              $cond: [{ $eq: ["$status", "active"] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          dentistCode: "$_id",
          treatmentCount: 1,
          firstTreatment: 1,
          lastTreatment: 1,
          activeTreatments: 1,
          _id: 0
        }
      },
      { $sort: { lastTreatment: -1 } }
    ]);

    return res.status(200).json({ 
      success: true,
      dentists,
      count: dentists.length 
    });
  } catch (err) {
    console.error("getMyDentists error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch dentist information" 
    });
  }
};

module.exports = {
  getMyTreatments,
  getTreatmentById,
  getTreatmentByCode,
  getTreatmentStats,
  getTreatmentHistory,
  getTreatmentsByDentist,
  getTreatmentPrescriptions,
  exportTreatments,
  searchTreatments,
  getMyDentists,
};