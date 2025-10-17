// Routes/PatientMedicalHistoryRoutes.js

const express = require("express");
const router = express.Router();
const {
  getMedicalHistory,
  getSummary,
  exportMedicalHistory
} = require("../Controllers/PatientMedicalHistoryController");
const requireAuth = require("../middleware/requireAuth");

// Apply authentication middleware to all routes
router.use(requireAuth);

// GET /api/medical-history - Get comprehensive medical history
router.get("/", getMedicalHistory);

// GET /api/medical-history/summary - Get medical history summary
router.get("/summary", getSummary);

// GET /api/medical-history/export - Export medical history
router.get("/export", exportMedicalHistory);

module.exports = router;
