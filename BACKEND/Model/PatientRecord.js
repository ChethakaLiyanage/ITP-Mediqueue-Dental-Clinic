const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PatientRecordSchema = new Schema({
  patientId: {
    type: Schema.Types.ObjectId,
    ref: "PatientModel",
    required: true
  },
  dentistId: {
    type: Schema.Types.ObjectId,
    ref: "DentistModel"
    // optional: not always linked to a dentist
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  fileUrl: {
    type: String,
    trim: true
    // or store GridFS ObjectId instead if using GridFS
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model(
  "PatientRecord",  // file/model name
  PatientRecordSchema    // schema object
);
