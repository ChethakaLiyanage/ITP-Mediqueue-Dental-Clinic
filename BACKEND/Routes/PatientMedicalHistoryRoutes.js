// Routes/PatientMedicalHistoryRoutes.js

const express = require('express');
const router = express.Router();
const patientMedicalHistoryController = require('../Controllers/PatientMedicalHistoryController');
const verifyToken = require('../middleware/requireAuth');

// Apply authentication to all routes
router.use(verifyToken);

// GET /api/medical-history - Get comprehensive medical history
router.get('/', patientMedicalHistoryController.getMedicalHistory);

// GET /api/medical-history/summary - Get medical history summary
router.get('/summary', patientMedicalHistoryController.getMedicalHistorySummary);

// GET /api/medical-history/export - Export medical history
router.get('/export', patientMedicalHistoryController.exportMedicalHistory);

module.exports = router;