const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PrescriptionHistorySchema = new Schema(
  {
    event: { 
        type: String,
        enum: ["create", "update", "revise"],
        required: true 
    },
    patientCode: {
        type: String,
        required: true,
        index: true 
    },
    planCode: {
        type: String,
        required: true,
        index: true 
    },
    prescriptionCode: {
        type: String,
        required: true,
        index: true 
    },
    version: {
        type: Number,
        required: true 
    },
    // Dentist who did it
    actorDentistCode: {
         type: String,
        required: true 
    },
    at: { 
        type: Date,
        default: Date.now 
    },
    // full snapshot for audit
    snapshot: { 
        type: Object,
        required: true 
    },
    // optional note (e.g., “treatment plan v bumped”)
    note: { 
        type: String 
    },
  },
  { timestamps: false }
);

module.exports = mongoose.model("PrescriptionHistory", PrescriptionHistorySchema);
