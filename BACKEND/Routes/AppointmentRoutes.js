const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");

const {
  bookAppointment,
  bookGuestAppointment,
  listAppointments,
  updateAppointment,
  deleteAppointment,
  confirmAppointment,
  sendAppointmentOtp,
  verifyAppointmentOtp,
  getAvailableSlots,
} = require("../Controllers/AppointmentControllers");

// Registered user routes (require authentication)
router.post("/", requireAuth, bookAppointment);

// Public routes (no authentication required)
router.get("/", listAppointments);

// Guest user routes (no authentication required)
router.post("/guest", bookGuestAppointment);

// Management routes (require authentication for patient operations)
router.put("/:id", requireAuth, updateAppointment);
router.patch("/:id", requireAuth, updateAppointment);
router.delete("/:id", requireAuth, deleteAppointment);

// Convenience route for receptionists to confirm pending appointments
router.patch("/:id/confirm", confirmAppointment);

// OTP routes (for registered users)
router.post("/send-otp", requireAuth, sendAppointmentOtp);
router.post("/verify-otp", requireAuth, verifyAppointmentOtp);

// Public routes
router.get("/available-slots", getAvailableSlots);

// Additional endpoints for frontend compatibility
router.get("/booked", (req, res) => {
  // Return empty array for now - this should check for booked appointments
  res.json([]);
});

router.get("/occupied", (req, res) => {
  // Return empty array for now - this should check for occupied slots
  res.json([]);
});

router.get("/availability", getAvailableSlots); // Frontend compatibility endpoint

module.exports = router;