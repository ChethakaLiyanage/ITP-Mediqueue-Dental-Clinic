const express = require("express");
const treatmentplan_router = express.Router();
const requireAuth = require("../middleware/requireAuth");

//insert model
const Treatmentplan = require("../Model/TreatmentplanModel");
const TreatmentplanHistory = require("../Model/TreatmentplanHistory");
//insert controller
const TreatmentplanController = require("../Controllers/DentistTreatmentplanControllers");

// Apply authentication middleware to all routes
treatmentplan_router.use(requireAuth);

treatmentplan_router.get("/",TreatmentplanController.getAllTreatmentplans);
treatmentplan_router.post("/", (req, res, next) => {
  console.log('=== TREATMENT PLAN ROUTE DEBUG ===');
  console.log('POST /treatmentplans route hit');
  console.log('Request body:', req.body);
  console.log('Request user:', req.user);
  next();
}, TreatmentplanController.addTreatmentplans);
treatmentplan_router.get("/code/:planCode",TreatmentplanController.getByCode);  
treatmentplan_router.get("/:id",TreatmentplanController.getById);
treatmentplan_router.put("/code/:patientCode/:planCode",TreatmentplanController.updateTreatmentplanByCode);
treatmentplan_router.put("/:id",TreatmentplanController.updateTreatmentplanById);
treatmentplan_router.delete("/code/:patientCode/:planCode",TreatmentplanController.deleteTreatmentplanByCode); 
treatmentplan_router.post("/restore/:patientCode/:planCode", TreatmentplanController.restoreByCode);
treatmentplan_router.get("/counter/:patientCode", TreatmentplanController.getCounterForPatient);
treatmentplan_router.post("/counter/:patientCode/resync", TreatmentplanController.resyncCounterForPatient);

// history list with dentist filtering -> GET /treatmentplans/history/list
treatmentplan_router.get("/history/list", async (req, res) => {
  try {
    // Get dentist code from query parameter or authenticated user
    const dentistCode = req.query.dentistCode || req.user?.dentistCode;
    
    let filter = {};
    
    // If dentist code is provided, filter by it in the snapshot
    if (dentistCode) {
      filter['snapshot.dentistCode'] = dentistCode;
    }
    
    const items = await TreatmentplanHistory.find(filter).sort({ createdAt: -1 }).lean();
    res.status(200).json({ items });
  } catch (err) {
    console.error("Error fetching treatment plan history:", err);
    res.status(500).json({ message: "Failed to read treatment plan history" });
  }
});

 // <-- use this
//exportdeleteTreatmentplanByCode
module.exports = treatmentplan_router;