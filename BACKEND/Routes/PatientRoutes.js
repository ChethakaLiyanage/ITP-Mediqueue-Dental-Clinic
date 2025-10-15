const express = require("express");
const Patient_router = express.Router();
//insert model
const Patient = require("../Model/PatientModel");
//insert controller
const PatientControllers = require("../Controllers/PatientControllers");

Patient_router.get("/", PatientControllers.getAllPatients);
Patient_router.post("/", PatientControllers.addPatients);
Patient_router.get("/code/:patientCode", PatientControllers.getByCode);
Patient_router.get("/:id", PatientControllers.getById);
Patient_router.get("/api/patients/count", PatientControllers.getPatientsCount);

// New route to get patient by user ID
Patient_router.get("/user/:userId", PatientControllers.getByUserId);

//export
module.exports = Patient_router;