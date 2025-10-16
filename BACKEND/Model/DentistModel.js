// Model/DentistModel.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Counter = require("./Counter");
const { pad } = require("../utils/seq");

const PhotoSchema = new Schema(
  {
    filename: String,
    mimeType: String,
    size: Number,
    url: String, // e.g., http://localhost:5000/uploads/dentists/<file>
  },
  { _id: false }
);

const DentistSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    license_no: { type: String, required: true },
    specialization: { type: String, trim: true },
    availability_schedule: { type: Object }, // { Mon: "09:00-17:00", ... }
    photo: PhotoSchema, // << NEW
    dentistCode: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

DentistSchema.pre("save", async function (next) {
  if (this.isNew && !this.dentistCode) {
    const c = await Counter.findOneAndUpdate(
      { scope: "dentist" },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
    this.dentistCode = `Dr-${pad(c.seq, 4)}`;
  }
  next();
});

module.exports = mongoose.model("DentistModel", DentistSchema);
