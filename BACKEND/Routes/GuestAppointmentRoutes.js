const express = require("express");
const router = express.Router();
const {
  sendGuestOtp,
  verifyGuestOtp,
  getGuestAppointment,
  rescheduleGuestAppointment,
  cancelGuestAppointment,
} = require("../Controllers/GuestAppointmentControllers");

// Guest appointment management routes (no authentication required)
// Guests verify their identity using phone/email + OTP

// Step 1: Send OTP to guest's phone/email
router.post("/send-otp", sendGuestOtp);

// Step 2: Verify OTP
router.post("/verify-otp", verifyGuestOtp);

// Get guest appointment details (requires phone/email verification)
router.get("/:appointmentCode", getGuestAppointment);

// Reschedule guest appointment (requires phone/email verification)
router.put("/:appointmentCode/reschedule", rescheduleGuestAppointment);

// Cancel guest appointment (requires phone/email verification)
router.delete("/:appointmentCode", cancelGuestAppointment);

module.exports = router;
