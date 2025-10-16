const mongoose = require('mongoose');

const appointmentOtpSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },
  otp: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: '15m' } // OTP will automatically expire after 15 minutes
  },
  verified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create a compound index for faster lookups
appointmentOtpSchema.index({ appointmentId: 1, phoneNumber: 1 });

// Static method to find and validate OTP
appointmentOtpSchema.statics.findAndValidateOtp = async function(appointmentId, otp, phoneNumber) {
  const otpRecord = await this.findOne({
    appointmentId,
    otp,
    phoneNumber,
    verified: false,
    expiresAt: { $gt: new Date() }
  });

  if (!otpRecord) {
    return { valid: false, message: 'Invalid or expired OTP' };
  }

  // Mark OTP as verified
  otpRecord.verified = true;
  await otpRecord.save();

  return { valid: true, message: 'OTP verified successfully' };
};

const AppointmentOtp = mongoose.model('AppointmentOtp', appointmentOtpSchema);

module.exports = AppointmentOtp;
