const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Counter = require("./Counter");
const { pad } = require("../utils/seq");

const UnregisteredPatientSchema = new Schema(
  {
    unregisteredPatientCode: { type: String, unique: true, sparse: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    age: { type: Number, min: 0, max: 120 },
    identityNumber: { type: String, trim: true, index: true, sparse: true },
    notes: { type: String, trim: true },

    createdBy: { type: Schema.Types.ObjectId, ref: "ReceptionistModel" },
    createdByCode: { type: String, trim: true },

    // NEW fields added without removing existing ones
    addedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    addedByCode: { type: String, trim: true, default: null },

    lastAppointmentCode: { type: String, trim: true },
  },
  { timestamps: true }
);

UnregisteredPatientSchema.pre("save", async function (next) {
  if (this.isNew && !this.unregisteredPatientCode) {
    const c = await Counter.findOneAndUpdate(
      { scope: "unregistered_patient" },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
    this.unregisteredPatientCode = `UP-${pad(c.seq, 4)}`;
  }
  next();
});

module.exports = mongoose.model("UnregisteredPatient", UnregisteredPatientSchema);

