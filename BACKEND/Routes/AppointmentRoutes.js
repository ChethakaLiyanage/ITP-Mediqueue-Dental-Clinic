const express = require("express");
const {
  getAppointments,
  getAvailableSlots,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  getAppointment
} = require("../Controllers/AppointmentController");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// GET /appointments - Get appointments (for patients, dentists, admins)
router.get("/", getAppointments);

// GET /appointments/available-slots - Get available time slots for a dentist
router.get("/available-slots", getAvailableSlots);

// GET /appointments/:id - Get a specific appointment
router.get("/:id", getAppointment);

// POST /appointments - Create a new appointment (patients only)
router.post("/", requireRole(["Patient"]), createAppointment);

// PUT /appointments/:id - Update an appointment
router.put("/:id", updateAppointment);

// DELETE /appointments/:id - Cancel an appointment
router.delete("/:id", cancelAppointment);

module.exports = router;
