const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Counter = require("./Counter");
const { pad } = require("../utils/seq");

// Subdocument schema for medicines
const MedicineSchema = new Schema(
  {
    name: { 
      type: String,
      required: true,
      trim: true, 
      maxlength: 200 
    },
    dosage: { 
      type: String,
      required: true,
      trim: true, 
      maxlength: 100 
    },
    instructions: { 
      type: String, 
      trim: true 
    },
  },
  { _id: false }
);

const PrescriptionSchema = new Schema(
  {
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
    plan_id: { 
      type: Schema.Types.ObjectId, 
      ref: "Treatmentplan" 
    },
    dentistCode: { 
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
      default: 1 
    },
    // multiple medicines per prescription
    medicines: {
      type: [MedicineSchema],
      validate: v => Array.isArray(v) && v.length > 0,
    },

    issuedAt: { 
      type: Date, 
      default: Date.now 
    },
    patientSeenAt: { 
      type: Date, 
      default: null 
    },
    lockedAt: { 
      type: Date, 
      default: null 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
  },
  { timestamps: true }
);

// Unique index: one prescription per treatment plan
PrescriptionSchema.index(
  { planCode: 1 },
  { unique: true }
);

// generate Prescription code per dentist (global counter)
async function genPrescriptionCode(dentistCode) {
  const scope = `rx:${dentistCode}`; // Global counter per dentist
  const c = await Counter.findOneAndUpdate(
    { scope },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return `RX-${pad(c.seq, 3)}`;
}

PrescriptionSchema.pre("validate", async function (next) {
  try {
    if (this.isNew && !this.prescriptionCode) {
      // If all prescriptions were deleted for this dentist, reset counter so we start at RX-001 again
      if (this.dentistCode) {
        const existingCount = await this.constructor.countDocuments({ dentistCode: this.dentistCode });
        if (existingCount === 0) {
          const scope = `rx:${this.dentistCode}`;
          await Counter.findOneAndUpdate(
            { scope },
            { $set: { seq: 0 } },
            { upsert: true }
          );
        }
      }
      this.prescriptionCode = await genPrescriptionCode(this.dentistCode);
    }
    next();
  } catch (e) {
    next(e);
  }
});

// Check if prescription is editable (patient must be "In Treatment")
PrescriptionSchema.methods.isEditable = async function () {
  const now = new Date();
  const within24h = now - this.issuedAt <= 24 * 60 * 60 * 1000;
  const notSeen = !this.patientSeenAt;
  
  if (!within24h || !notSeen || this.isActive !== true) {
    return false;
  }
  
  // Check if patient is "In Treatment" in queue
  try {
    const mongoose = require("mongoose");
    const Queue = mongoose.model("Queue"); // Assuming you have a Queue model
    
    const queueEntry = await Queue.findOne({
      patientCode: this.patientCode,
      dentistCode: this.dentistCode,
      status: "In Treatment" // Patient must be "In Treatment"
    });
    
    return !!queueEntry;
  } catch (e) {
    return false;
  }
};

module.exports = mongoose.model("Prescription", PrescriptionSchema);