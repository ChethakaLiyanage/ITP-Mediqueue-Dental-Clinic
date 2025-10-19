const express = require("express");
const router = express.Router();
const patientInquiryController = require("../Controllers/PatientInquiryControllers");
const { verifyToken } = require("../Controllers/DentistAuthControllers");

// Apply authentication middleware to all routes
router.use(verifyToken);

// Patient Inquiry Routes
// GET /api/inquiries/my - Get all inquiries for authenticated patient
router.get("/my", patientInquiryController.getMyInquiries);

// GET /api/inquiries/my/stats - Get inquiry stats for authenticated patient
router.get("/my/stats", patientInquiryController.getMyInquiryStats);

// POST /api/inquiries - Create new inquiry
router.post("/", patientInquiryController.createInquiry);

// GET /api/inquiries/:id - Get single inquiry by ID (patient can only see their own)
router.get("/:id", patientInquiryController.getMyInquiryById);

// PUT /api/inquiries/:id - Update inquiry (patient can only update their own)
router.put("/:id", patientInquiryController.updateMyInquiry);

// DELETE /api/inquiries/:id - Delete inquiry (patient can only delete their own)
router.delete("/:id", patientInquiryController.deleteMyInquiry);

// GET /api/inquiries/:id/messages - Get inquiry with chat messages
router.get("/:id/messages", patientInquiryController.getInquiryWithMessages);

// POST /api/inquiries/:id/messages - Add message to inquiry
router.post("/:id/messages", patientInquiryController.addMessage);

module.exports = router;
