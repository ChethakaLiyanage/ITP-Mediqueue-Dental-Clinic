const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Counter = require("./Counter");
const { pad } = require("../utils/seq");

const InventorySchema = new Schema(
  {
    itemCode: { 
      type: String, 
      unique: true, 
      sparse: true 
    },
    itemName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    unit: {
      type: String,
      trim: true,
      default: "pcs"
    },
    category: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    minStockLevel: {
      type: Number,
      default: 10
    },
    supplier: {
      type: String,
      trim: true
    },
    lastRestocked: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// Auto-generate itemCode before saving
InventorySchema.pre("save", async function (next) {
  if (this.isNew && !this.itemCode) {
    const counter = await Counter.findOneAndUpdate(
      { scope: "inventory" },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
    this.itemCode = `ITEM-${pad(counter.seq, 3)}`;
  }
  next();
});

// Index for faster queries
InventorySchema.index({ itemName: 1 });
InventorySchema.index({ isActive: 1 });

module.exports = mongoose.model("Inventory", InventorySchema);
