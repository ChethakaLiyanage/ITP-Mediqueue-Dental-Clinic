// Model/ScheduleModel.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ScheduleSchema = new Schema(
  {
    // Core Identification
    dentistCode: { 
      type: String, 
      required: true, 
      index: true 
    },
    date: { 
      type: Date, 
      required: true, 
      index: true 
    },
    timeSlot: { 
      type: String, 
      required: true 
    }, // e.g., "09:00-09:30"

    // Time & Slot Details
    slotDuration: { 
      type: Number, 
      required: true, 
      default: 30 
    }, // Duration in minutes

    // Status & Availability
    status: {
      type: String,
      enum: ['available', 'booked', 'blocked_leave', 'blocked_event', 'blocked_maintenance'],
      default: 'available',
      required: true
    },
    isAvailable: { 
      type: Boolean, 
      default: true, 
      index: true 
    },

    // Appointment Details (when booked) - Will be recreated with new appointment system
    appointmentId: { 
      type: String,
      sparse: true 
    },
    patientCode: { 
      type: String, 
      sparse: true 
    },
    reason: { 
      type: String, 
      trim: true 
    },

    // Blocking Information
    blockedBy: { 
      type: String, 
      enum: ['leave', 'event', 'maintenance'],
      sparse: true 
    },
    blockingId: { 
      type: Schema.Types.ObjectId, 
      sparse: true 
    }, // Reference to leave/event record
    blockingReason: { 
      type: String, 
      trim: true 
    },

    // Metadata
    createdBy: { 
      type: String, 
      trim: true 
    },
    lastModifiedBy: { 
      type: String, 
      trim: true 
    },

    // Performance Fields
    workingHours: {
      start: { type: String }, // e.g., "09:00"
      end: { type: String }    // e.g., "17:00"
    },
    dayOfWeek: { 
      type: String, 
      enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      index: true 
    }
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
ScheduleSchema.index({ dentistCode: 1, date: 1, timeSlot: 1 }, { unique: true });
ScheduleSchema.index({ dentistCode: 1, date: 1, isAvailable: 1 });
ScheduleSchema.index({ date: 1, status: 1 });
ScheduleSchema.index({ appointmentId: 1 }, { sparse: true });

// Pre-save middleware to set dayOfWeek
ScheduleSchema.pre("save", function (next) {
  if (this.date) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    this.dayOfWeek = dayNames[this.date.getDay()];
  }
  next();
});

// Pre-save middleware to update isAvailable based on status
ScheduleSchema.pre("save", function (next) {
  this.isAvailable = this.status === 'available';
  next();
});

// Static method to get available slots for a dentist on a specific date
ScheduleSchema.statics.getAvailableSlots = function(dentistCode, date) {
  return this.find({
    dentistCode: dentistCode,
    date: date,
    isAvailable: true,
    status: 'available'
  }).sort({ timeSlot: 1 });
};

// Static method to get all slots for a dentist on a specific date
ScheduleSchema.statics.getAllSlots = function(dentistCode, date) {
  return this.find({
    dentistCode: dentistCode,
    date: date
  }).sort({ timeSlot: 1 });
};

// Instance method to book a slot
ScheduleSchema.methods.bookSlot = function(appointmentId, patientCode, reason, createdBy) {
  this.status = 'booked';
  this.isAvailable = false;
  this.appointmentId = appointmentId;
  this.patientCode = patientCode;
  this.reason = reason;
  this.lastModifiedBy = createdBy;
  return this.save();
};

// Instance method to block a slot
ScheduleSchema.methods.blockSlot = function(blockedBy, blockingId, blockingReason, lastModifiedBy) {
  this.status = `blocked_${blockedBy}`;
  this.isAvailable = false;
  this.blockedBy = blockedBy;
  this.blockingId = blockingId;
  this.blockingReason = blockingReason;
  this.lastModifiedBy = lastModifiedBy;
  return this.save();
};

// Instance method to free a slot
ScheduleSchema.methods.freeSlot = function(lastModifiedBy) {
  this.status = 'available';
  this.isAvailable = true;
  this.appointmentId = undefined;
  this.patientCode = undefined;
  this.reason = undefined;
  this.blockedBy = undefined;
  this.blockingId = undefined;
  this.blockingReason = undefined;
  this.lastModifiedBy = lastModifiedBy;
  return this.save();
};

module.exports = mongoose.model("ScheduleModel", ScheduleSchema, "schedulemodels");
