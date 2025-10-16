// Model/DentistModel.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Counter = require("./Counter");
const { pad } = require("../utils/seq");

const ManagerSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
     department:{
        type:String
     },
    managerCode: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

// Initialize counter with starting value if it doesn't exist
const initializeCounter = async () => {
  const count = await Counter.countDocuments({ scope: "manager" });
  if (count === 0) {
    await Counter.create({ scope: "manager", seq: 1 });
  }
};

ManagerSchema.pre("save", async function (next) {
  if (this.isNew && !this.managerCode) {
    // Ensure counter is initialized
    await initializeCounter();
    
    // Get and increment the counter
    const c = await Counter.findOneAndUpdate(
      { scope: "manager" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    
    // Format as M-001, M-002, etc.
    this.managerCode = `M-${pad(c.seq, 3)}`;
  }
  next();
});

module.exports = mongoose.model("ManagerModel", ManagerSchema);
