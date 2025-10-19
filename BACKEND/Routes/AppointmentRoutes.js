const express = require("express");
const {
  getAppointments,
  getAvailableSlots,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  getAppointment,
  sendOTP,
  verifyOTP,
  checkAppointments
} = require("../Controllers/AppointmentController");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");

const router = express.Router();

// GET /appointments/check - Check appointments for unregistered users (no auth required)
router.get("/check", checkAppointments);

// GET /appointments/available-slots - Get available time slots (no auth required for booking)
router.get("/available-slots", getAvailableSlots);

// POST /appointments - Create appointment (allow both authenticated and unregistered users)
router.post("/", createAppointment);

// All other routes require authentication
router.use(requireAuth);

// GET /appointments - Get appointments (for patients, dentists, admins)
router.get("/", getAppointments);

// OTP routes for appointment booking
router.post("/send-otp", requireRole(["Patient"]), sendOTP);
router.post("/verify-otp", requireRole(["Patient"]), verifyOTP);

// GET /appointments/:id - Get a specific appointment
router.get("/:id", getAppointment);

// POST /appointments - Create a new appointment (patients only) - moved above auth middleware

// PUT /appointments/:id - Update an appointment
router.put("/:id", updateAppointment);

// DELETE /appointments/:id - Cancel an appointment
router.delete("/:id", cancelAppointment);

module.exports = router;
