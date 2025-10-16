// Model/DentistModel.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Counter = require("./Counter");
const { pad } = require("../utils/seq");

const AdminSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    permission:[{
        type:String
    }],
    adminCode: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

AdminSchema.pre("save", async function (next) {
  if (this.isNew && !this.adminCode) {
    const c = await Counter.findOneAndUpdate(
      { scope: "admin" },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
    this.adminCode = `AD-${pad(c.seq, 4)}`;
  }
  next();
});

module.exports = mongoose.model("AdminModel", AdminSchema);
