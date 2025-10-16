// Model/ReceptionistModel.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Counter = require("./Counter");
const { pad } = require("../utils/seq");

const ReceptionistSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  deskNo: {
    type: String,
    trim: true
  },
  receptionistCode: {
    type: String,
    unique: true,
    sparse: true
  }
}, { timestamps: true });

// Auto-generate receptionistCode using Counter
ReceptionistSchema.pre("save", async function (next) {
  if (this.isNew && !this.receptionistCode) {
    const c = await Counter.findOneAndUpdate(
      { scope: "receptionist" },          // separate scope for receptionists
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
    this.receptionistCode = `R-${pad(c.seq, 4)}`; // e.g. R-0001
  }
  next();
});

ReceptionistSchema.index({ userId: 1 });

module.exports = mongoose.model(
  "ReceptionistModel",
  ReceptionistSchema
);

