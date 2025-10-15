const express = require("express");
const patientPrescription_router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const patientPrescriptionController = require("../Controllers/PatientPrescriptionControllers");

// Apply authentication middleware to all routes
patientPrescription_router.use(requireAuth);

// Patient prescription routes
patientPrescription_router.get("/my-prescriptions", patientPrescriptionController.getMyPrescriptions);
patientPrescription_router.get("/:id", patientPrescriptionController.getPrescriptionById);
patientPrescription_router.get("/plan/:planCode", patientPrescriptionController.getPrescriptionsByPlan);
patientPrescription_router.get("/stats", patientPrescriptionController.getPrescriptionStats);
patientPrescription_router.get("/history/:id", patientPrescriptionController.getPrescriptionHistory);
patientPrescription_router.get("/dentist/:dentistCode", patientPrescriptionController.getPrescriptionsByDentist);
patientPrescription_router.patch("/:id/seen", patientPrescriptionController.markPrescriptionSeen);
patientPrescription_router.get("/:id/editable", patientPrescriptionController.checkPrescriptionEditable);
patientPrescription_router.get("/export", patientPrescriptionController.exportPrescriptions);

module.exports = patientPrescription_router;
