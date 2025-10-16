const mongoose = require("mongoose");

const LeaveSchema = new mongoose.Schema({
  
  dentistCode: { type: String, required: true, index: true },
  dentistName: { type: String },
  dateFrom: { type: Date, required: true },
  dateTo: { type: Date, required: true },
  reason: { type: String, default: "Not available" },
  createdBy: { type: String }, // receptionist or dentist who added
}, { timestamps: true });

// Static method to check if dentist is on leave for a specific date
LeaveSchema.statics.isDentistOnLeave = async function(dentistCode, date) {
  try {
    const leave = await this.findOne({
      dentistCode: dentistCode,
      dateFrom: { $lte: date },
      dateTo: { $gte: date }
    });
    return !!leave;
  } catch (error) {
    console.error('Error checking dentist leave:', error);
    return false;
  }
};

module.exports = mongoose.model("Leave", LeaveSchema);
