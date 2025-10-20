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
  checkAppointments,
  requestAppointmentChange
} = require("../Controllers/AppointmentController");
const requireAuth = require("../middleware/requireAuth");
const optionalAuth = require("../middleware/optionalAuth");
const requireRole = require("../middleware/requireRole");

const router = express.Router();

// GET /appointments/check - Check appointments for unregistered users (no auth required)
router.get("/check", checkAppointments);

// GET /appointments/available-slots - Get available time slots (no auth required for booking)
router.get("/available-slots", getAvailableSlots);

// POST /appointments - Create appointment (allows both authenticated and unregistered users)
router.post("/", optionalAuth, createAppointment);

// PUT /appointments/:id - Update appointment (allows both authenticated and unregistered users)
router.put("/:id", optionalAuth, updateAppointment);

// DELETE /appointments/:id - Cancel appointment (allows both authenticated and unregistered users)
router.delete("/:id", optionalAuth, cancelAppointment);

// All other routes require authentication
router.use(requireAuth);

// GET /appointments - Get appointments (for patients, dentists, admins)
router.get("/", getAppointments);

// OTP routes for appointment booking
router.post("/send-otp", requireRole(["Patient"]), sendOTP);
router.post("/verify-otp", requireRole(["Patient"]), verifyOTP);

// GET /appointments/:id - Get a specific appointment
router.get("/:id", getAppointment);



// POST /appointments/:id/request-change - Request change for confirmed appointment
router.post("/:id/request-change", requestAppointmentChange);

module.exports = router;
