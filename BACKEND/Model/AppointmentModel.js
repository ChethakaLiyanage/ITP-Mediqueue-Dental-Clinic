const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Counter = require("./Counter");
const { pad } = require("../utils/seq");

const AppointmentSchema = new Schema(
  {
    // Basic appointment info
    patientCode: { 
      type: String, 
      required: true, 
      index: true 
    },
    dentistCode: { 
      type: String, 
      required: true, 
      index: true 
    },
    
    // Booking for someone else fields
    isBookingForSomeoneElse: {
      type: Boolean,
      default: false
    },
    actualPatientName: {
      type: String,
      trim: true
    },
    actualPatientEmail: {
      type: String,
      trim: true
    },
    actualPatientPhone: {
      type: String,
      trim: true
    },
    actualPatientAge: {
      type: Number
    },
    relationshipToPatient: {
      type: String,
      trim: true,
      enum: ['Self', 'Spouse', 'Child', 'Parent', 'Sibling', 'Friend', 'Other']
    },
    
    // Date and time
    appointmentDate: { 
      type: Date, 
      required: true, 
      index: true 
    },
    duration: { 
      type: Number, 
      default: 30 // minutes
    },
    
    // Appointment details
    reason: { 
      type: String, 
      trim: true 
    },
    notes: { 
      type: String, 
      trim: true 
    },
    
    // Status tracking
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled", "no-show"],
      default: "pending",
      index: true
    },
    
    // Unique appointment code
    appointmentCode: { 
      type: String, 
      unique: true, 
      sparse: true 
    },
    
    // Tracking fields
    createdAt: { 
      type: Date, 
      default: Date.now 
    },
    updatedAt: { 
      type: Date, 
      default: Date.now 
    },
    createdBy: { 
      type: String, 
      trim: true 
    },
    updatedBy: { 
      type: String, 
      trim: true 
    }
  },
  {
    timestamps: true
  }
);

// Indexes for better performance
AppointmentSchema.index({ patientCode: 1, appointmentDate: 1 });
// Removed the unique compound index that was causing duplicate key errors
AppointmentSchema.index({ status: 1, appointmentDate: 1 });

// Pre-save middleware to generate appointment code
AppointmentSchema.pre('save', async function(next) {
  if (this.isNew && !this.appointmentCode) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { scope: 'appointmentCode' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.appointmentCode = `AP-${pad(counter.seq, 4)}`;
    } catch (error) {
      console.error('Error generating appointment code:', error);
      this.appointmentCode = `AP-${Date.now()}`;
    }
  }
  
  // Update the updatedAt field
  this.updatedAt = new Date();
  next();
});

// Static method to find appointments by date range
AppointmentSchema.statics.findByDateRange = function(startDate, endDate, dentistCode = null) {
  const query = {
    appointmentDate: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  if (dentistCode) {
    query.dentistCode = dentistCode;
  }
  
  return this.find(query).sort({ appointmentDate: 1 });
};

// Static method to find available time slots
AppointmentSchema.statics.findAvailableSlots = function(dentistCode, date, duration = 30) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return this.find({
    dentistCode,
    appointmentDate: {
      $gte: startOfDay,
      $lte: endOfDay
    },
    status: { $in: ['pending', 'confirmed'] }
  }).sort({ appointmentDate: 1 });
};

// Instance method to check if appointment can be cancelled
AppointmentSchema.methods.canBeCancelled = function() {
  const now = new Date();
  const appointmentTime = new Date(this.appointmentDate);
  const hoursUntilAppointment = (appointmentTime - now) / (1000 * 60 * 60);
  
  return this.status === 'pending' || this.status === 'confirmed' && hoursUntilAppointment > 24;
};

// Instance method to check if appointment can be rescheduled
AppointmentSchema.methods.canBeRescheduled = function() {
  const now = new Date();
  const appointmentTime = new Date(this.appointmentDate);
  const hoursUntilAppointment = (appointmentTime - now) / (1000 * 60 * 60);
  
  return this.status === 'pending' || this.status === 'confirmed' && hoursUntilAppointment > 2;
};

module.exports = mongoose.model("Appointment", AppointmentSchema, "appointmentmodels");
