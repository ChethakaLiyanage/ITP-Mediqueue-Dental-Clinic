const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Counter = require("./Counter");
const { pad } = require("../utils/seq");

const AppointmentSchema = new Schema(
  {
    // store codes (strings) instead of ObjectId refs
    patient_code:   { type: String, required: function() { return !this.isGuestBooking && !this.isBookingForSomeoneElse; }, index: true },
    dentist_code:   { type: String, required: true, index: true },

    appointment_date: { type: Date, required: true, index: true }, // full date & time
    reason:           { type: String, trim: true },

    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
    },

    queue_no: { type: Number },

    // human-readable code: AP-0001, AP-0002, ...
    appointmentCode: { type: String, unique: true, sparse: true },

    // Guest booking support
    isGuestBooking: { type: Boolean, default: false },
    guestInfo: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      email: { type: String, trim: true },
      address: { type: String, trim: true },
      age: { type: Number },
      gender: { type: String, enum: ['male', 'female', 'other'], required: false }
    },

    // "Book for someone else" support
    isBookingForSomeoneElse: { type: Boolean, default: false },
    bookerPatientCode: { type: String, trim: true, index: true }, // The patient who made the booking
    appointmentForPatientCode: { type: String, trim: true, index: true }, // The patient the appointment is for (if registered)
    otherPersonDetails: {
      name: { type: String, trim: true },
      contact: { type: String, trim: true },
      age: { type: Number },
      gender: { type: String, enum: ['male', 'female', 'other', ''] },
      relation: { type: String, trim: true }, // Relation to booker (e.g., 'son', 'daughter', 'spouse', 'parent', 'friend')
      notes: { type: String, trim: true }
    },

    // Tracking fields
    createdByCode: { type: String, trim: true },
    acceptedByCode: { type: String, trim: true },
    acceptedAt: { type: Date },
    autoConfirmedAt: { type: Date },

    reminders: {
      dayBeforeSentAt: { type: Date },
      twoHourSentAt:   { type: Date },
    },
  },
  { timestamps: true }
);

// unique per dentist per exact time (by code)
AppointmentSchema.index({ dentist_code: 1, appointment_date: 1 }, { unique: true });

// Custom validation for guest bookings and booking for someone else
AppointmentSchema.pre("validate", function(next) {
  if (this.isGuestBooking) {
    // For guest bookings, ensure guest info is provided
    if (!this.guestInfo || !this.guestInfo.name || !this.guestInfo.phone || !this.guestInfo.email) {
      return next(new Error("Guest information (name, phone, email) is required for guest bookings"));
    }
  } else if (this.isBookingForSomeoneElse) {
    // For "booking for someone else", ensure booker code is provided
    if (!this.bookerPatientCode) {
      return next(new Error("bookerPatientCode is required when booking for someone else"));
    }
    // Ensure other person's details are provided
    if (!this.otherPersonDetails || !this.otherPersonDetails.name || !this.otherPersonDetails.contact) {
      return next(new Error("Other person's name and contact are required when booking for someone else"));
    }
  } else {
    // For regular registered user bookings, ensure patient_code is provided
    if (!this.patient_code) {
      return next(new Error("patient_code is required for registered user bookings"));
    }
  }
  next();
});

// auto-generate AP-0001 style codes
AppointmentSchema.pre("save", async function (next) {
  if (this.isNew && !this.appointmentCode) {
    const c = await Counter.findOneAndUpdate(
      { scope: "appointment" },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
    this.appointmentCode = `AP-${pad(c.seq, 4)}`; // AP-0001
  }
  next();
});

module.exports = mongoose.model("AppointmentModel", AppointmentSchema);