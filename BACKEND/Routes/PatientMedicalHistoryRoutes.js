// Routes/PatientMedicalHistoryRoutes.js

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/requireAuth');

// Import controller functions
const {
  getMedicalHistory,
  getMedicalHistorySummary,
  exportMedicalHistory
} = require('../Controllers/PatientMedicalHistoryController');

// Apply authentication to all routes
router.use(verifyToken);

// GET /api/medical-history - Get comprehensive medical history
router.get('/', getMedicalHistory);

// GET /api/medical-history/summary - Get medical history summary
router.get('/summary', getMedicalHistorySummary);

// GET /api/medical-history/export - Export medical history
router.get('/export', exportMedicalHistory);

module.exports = router;