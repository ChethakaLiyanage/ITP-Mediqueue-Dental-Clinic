const express = require("express");
const patientTreatmentplan_router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const patientTreatmentplanController = require("../Controllers/PatientTreatmentplanControllers");

// Apply authentication middleware to all routes
patientTreatmentplan_router.use(requireAuth);

// Patient treatment plan routes
patientTreatmentplan_router.get("/my-treatments", patientTreatmentplanController.getMyTreatments);
patientTreatmentplan_router.get("/:id", patientTreatmentplanController.getTreatmentById);
patientTreatmentplan_router.get("/search", patientTreatmentplanController.searchTreatments);
patientTreatmentplan_router.get("/dentists", patientTreatmentplanController.getMyDentists);

module.exports = patientTreatmentplan_router;
