const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: {
    type: String,
    required: true,
    maxlength: 150,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true // store hashed
  },
  contact_no: {
    type: String,
    trim: true
  },
  role: {
    type: String,
    enum: ["Patient", "Dentist", "Receptionist", "Manager", "Admin"],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  dentistCode: {
    type: String,
    unique: true,
    sparse: true
  },
  managerCode: {
    type: String,
    unique: true,
    sparse: true
  },
  receptionistCode: {
    type: String,
    unique: true,
    sparse: true
  },
  resetPasswordToken: {
    type: String,
  },
  resetPasswordExpires: {
    type: Date,
  }
}, { timestamps: true });

// Indexes
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ resetPasswordToken: 1, resetPasswordExpires: 1 }, { sparse: true });

module.exports = mongoose.model(
  "User",   // file/model name
  UserSchema     // schema object
);
