const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const Appointment = require("../Model/AppointmentModel");
const OtpToken = require("../Model/OtpToken");
const { sendSms, normalizePhone } = require("../utils/sms");

const OTP_EXPIRY_MS = 300000; // 5 minutes

function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

// Send OTP to guest's phone for verification
const sendGuestOtp = async (req, res) => {
  try {
    const { appointmentCode, phone, email } = req.body;

    if (!appointmentCode) {
      return res.status(400).json({ message: "Appointment code is required" });
    }

    if (!phone && !email) {
      return res.status(400).json({ message: "Phone number or email is required" });
    }

    // Find the guest appointment
    const appointment = await Appointment.findOne({
      appointmentCode,
      isGuestBooking: true,
    }).lean();

    if (!appointment) {
      return res.status(404).json({ message: "Guest appointment not found" });
    }

    // Verify the phone or email matches the appointment
    const phoneMatch = phone && appointment.guestInfo?.phone === phone;
    const emailMatch = email && appointment.guestInfo?.email?.toLowerCase() === email.toLowerCase();

    if (!phoneMatch && !emailMatch) {
      return res.status(403).json({ 
        message: "Phone number or email does not match the appointment record" 
      });
    }

    // Generate OTP
    const otp = generateOtp();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    // Store OTP
    const otpRecord = await OtpToken.create({
      userId: null, // Guest has no userId
      context: "guest-appointment",
      codeHash,
      expiresAt,
      data: {
        appointmentCode,
        phone: appointment.guestInfo?.phone,
        email: appointment.guestInfo?.email,
      },
    });

    // Send OTP via SMS
    if (phone) {
      try {
        const normalizedPhone = normalizePhone(phone);
        await sendSms({
          to: normalizedPhone,
          body: `Your Medi Queue appointment verification code is ${otp}. It expires in 5 minutes.`,
        });

        // Include OTP in response for development mode
        const responseData = {
          message: "OTP sent successfully to your phone",
          otpId: otpRecord._id,
          expiresAt: expiresAt.toISOString(),
          sentTo: "phone",
        };

        // Only include the actual OTP in non-production environments for debugging
        if (process.env.NODE_ENV !== "production") {
          responseData.otp = otp;
          console.log(`[GUEST APPOINTMENT OTP] Code: ${otp} sent to ${normalizedPhone}`);
        }

        return res.status(200).json(responseData);
      } catch (err) {
        await otpRecord.deleteOne();
        console.error("Failed to send OTP SMS:", err);
        return res.status(500).json({ 
          message: "Failed to send OTP. Please try again later." 
        });
      }
    }

    // If only email provided (SMS sending not implemented for email yet)
    return res.status(200).json({
      message: "OTP generated successfully",
      otpId: otpRecord._id,
      expiresAt: expiresAt.toISOString(),
      sentTo: "email",
      note: "For now, check your appointment confirmation for contact information",
    });
  } catch (err) {
    console.error("sendGuestOtp error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// Verify OTP and return a temporary access token
const verifyGuestOtp = async (req, res) => {
  try {
    const { otpId, code } = req.body;

    if (!otpId || !code) {
      return res.status(400).json({ message: "otpId and code are required" });
    }

    const otpRecord = await OtpToken.findOne({ 
      _id: otpId, 
      context: "guest-appointment" 
    });

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    if (otpRecord.expiresAt < new Date()) {
      await otpRecord.deleteOne().catch(() => {});
      return res.status(400).json({ message: "OTP has expired" });
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      await otpRecord.deleteOne().catch(() => {});
      return res.status(429).json({ message: "Too many invalid attempts. Request a new OTP." });
    }

    const isMatch = await bcrypt.compare(String(code), otpRecord.codeHash);
    if (!isMatch) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // OTP is valid, return appointment code for further operations
    const { appointmentCode } = otpRecord.data;

    // Delete the OTP after successful verification
    await otpRecord.deleteOne();

    return res.status(200).json({
      message: "OTP verified successfully",
      appointmentCode,
      verified: true,
    });
  } catch (err) {
    console.error("verifyGuestOtp error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// Get guest appointment details (after OTP verification)
const getGuestAppointment = async (req, res) => {
  try {
    const { appointmentCode } = req.params;
    const { phone, email } = req.query;

    if (!phone && !email) {
      return res.status(400).json({ 
        message: "Phone number or email is required for verification" 
      });
    }

    const appointment = await Appointment.findOne({
      appointmentCode,
      isGuestBooking: true,
    }).lean();

    if (!appointment) {
      return res.status(404).json({ message: "Guest appointment not found" });
    }

    // Verify the phone or email matches
    const phoneMatch = phone && appointment.guestInfo?.phone === phone;
    const emailMatch = email && appointment.guestInfo?.email?.toLowerCase() === email.toLowerCase();

    if (!phoneMatch && !emailMatch) {
      return res.status(403).json({ 
        message: "Unauthorized access" 
      });
    }

    return res.status(200).json({ appointment });
  } catch (err) {
    console.error("getGuestAppointment error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// Reschedule guest appointment
const rescheduleGuestAppointment = async (req, res) => {
  try {
    const { appointmentCode } = req.params;
    const { newDate, phone, email } = req.body;

    if (!phone && !email) {
      return res.status(400).json({ 
        message: "Phone number or email is required for verification" 
      });
    }

    if (!newDate) {
      return res.status(400).json({ message: "New appointment date is required" });
    }

    const appointment = await Appointment.findOne({
      appointmentCode,
      isGuestBooking: true,
    });

    if (!appointment) {
      return res.status(404).json({ message: "Guest appointment not found" });
    }

    // Verify the phone or email matches
    const phoneMatch = phone && appointment.guestInfo?.phone === phone;
    const emailMatch = email && appointment.guestInfo?.email?.toLowerCase() === email.toLowerCase();

    if (!phoneMatch && !emailMatch) {
      return res.status(403).json({ 
        message: "Unauthorized access" 
      });
    }

    // Check if appointment can be rescheduled
    if (appointment.status === "cancelled" || appointment.status === "completed") {
      return res.status(400).json({ 
        message: `Cannot reschedule ${appointment.status} appointment` 
      });
    }

    // Check if the new date is in the future
    const newAppointmentDate = new Date(newDate);
    if (newAppointmentDate < new Date()) {
      return res.status(400).json({ 
        message: "Cannot reschedule to a past date" 
      });
    }

    // Check if the slot is available
    const existingAppointment = await Appointment.findOne({
      dentist_code: appointment.dentist_code,
      appointment_date: newAppointmentDate,
      status: { $in: ["pending", "confirmed"] },
      _id: { $ne: appointment._id },
    });

    if (existingAppointment) {
      return res.status(409).json({
        message: "This time slot is already booked. Please choose another time.",
      });
    }

    // Update the appointment
    appointment.appointment_date = newAppointmentDate;
    appointment.status = "pending"; // Reset to pending for receptionist confirmation
    await appointment.save();

    return res.status(200).json({
      message: "Appointment rescheduled successfully. Awaiting receptionist confirmation.",
      appointment,
    });
  } catch (err) {
    console.error("rescheduleGuestAppointment error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// Cancel guest appointment
const cancelGuestAppointment = async (req, res) => {
  try {
    const { appointmentCode } = req.params;
    const { phone, email } = req.body;

    if (!phone && !email) {
      return res.status(400).json({ 
        message: "Phone number or email is required for verification" 
      });
    }

    const appointment = await Appointment.findOne({
      appointmentCode,
      isGuestBooking: true,
    });

    if (!appointment) {
      return res.status(404).json({ message: "Guest appointment not found" });
    }

    // Verify the phone or email matches
    const phoneMatch = phone && appointment.guestInfo?.phone === phone;
    const emailMatch = email && appointment.guestInfo?.email?.toLowerCase() === email.toLowerCase();

    if (!phoneMatch && !emailMatch) {
      return res.status(403).json({ 
        message: "Unauthorized access" 
      });
    }

    // Check if appointment can be cancelled
    if (appointment.status === "cancelled") {
      return res.status(400).json({ 
        message: "Appointment is already cancelled" 
      });
    }

    if (appointment.status === "completed") {
      return res.status(400).json({ 
        message: "Cannot cancel a completed appointment" 
      });
    }

    // Cancel the appointment
    appointment.status = "cancelled";
    await appointment.save();

    return res.status(200).json({
      message: "Appointment cancelled successfully",
      appointment,
    });
  } catch (err) {
    console.error("cancelGuestAppointment error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

module.exports = {
  sendGuestOtp,
  verifyGuestOtp,
  getGuestAppointment,
  rescheduleGuestAppointment,
  cancelGuestAppointment,
};
