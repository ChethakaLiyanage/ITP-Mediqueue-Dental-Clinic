// backend/Model/ClinicEventModel.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Counter = require("./Counter");

const ClinicEventSchema = new Schema(
  {
    // Keep simple; the unique partial index is added below (no field-level index here)
    eventCode:   { type: String, trim: true },

    title:       { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    startDate:   { type: Date, required: true, index: true },
    endDate:     { type: Date, required: true, index: true },
    allDay:      { type: Boolean, default: true },
    isPublished: { type: Boolean, default: false, index: true },
    imageUrl:    { type: String, trim: true },

    // Audit (object refs)
    createdBy:   { type: Schema.Types.ObjectId, ref: "User", index: true },
    updatedBy:   { type: Schema.Types.ObjectId, ref: "User" },
    deletedBy:   { type: Schema.Types.ObjectId, ref: "User" },

    // Snapshot codes (shown in UI even if populate fails)
    createdByCode: { type: String, trim: true },
    updatedByCode: { type: String, trim: true },
    deletedByCode: { type: String, trim: true },

    // Soft-delete
    deletedAt:   { type: Date },
    isDeleted:   { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Basic validation
ClinicEventSchema.pre("validate", function (next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    return next(new Error("endDate cannot be earlier than startDate"));
  }
  next();
});

// Helpful indexes
ClinicEventSchema.index({ startDate: 1, endDate: 1 });
ClinicEventSchema.index({ title: "text", description: "text" });
ClinicEventSchema.index({ isPublished: 1, startDate: 1 });
ClinicEventSchema.index({ isDeleted: 1, startDate: 1 });

// Partial-unique event code among non-deleted docs
ClinicEventSchema.index(
  { eventCode: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

// Auto-generate eventCode: EV-0001, EV-0002, ...
ClinicEventSchema.pre("save", async function (next) {
  if (this.eventCode) return next();
  try {
    const c = await Counter.findOneAndUpdate(
      { scope: "clinic_event" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const pad = String(c.seq).padStart(4, "0");
    this.eventCode = `EV-${pad}`;
    next();
  } catch (e) {
    next(e);
  }
});

module.exports = mongoose.model("ClinicEvent", ClinicEventSchema);
