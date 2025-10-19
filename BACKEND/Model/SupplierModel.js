const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Counter = require("./Counter");
const { pad } = require("../utils/seq");

const SupplierSchema = new Schema(
  {
    supplierCode: {
      type: String,
      unique: true,
      sparse: true
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },
    contactPerson: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{10}$/, 'Phone number must be exactly 10 digits']
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zipCode: { type: String, trim: true },
      country: { type: String, trim: true, default: "Sri Lanka" }
    },
    category: {
      type: String,
      enum: ["Medical Equipment", "Dental Supplies", "Pharmaceuticals", "Office Supplies", "Other"],
      default: "Dental Supplies"
    },
    paymentTerms: {
      type: String,
      enum: ["Net 15", "Net 30", "Net 45", "Net 60", "Cash on Delivery", "Advance Payment"],
      default: "Net 30"
    },
    taxId: {
      type: String,
      trim: true
    },
    website: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    },
    lastOrderDate: {
      type: Date
    },
    totalOrders: {
      type: Number,
      default: 0
    },
    totalValue: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

// Auto-generate supplierCode before saving
SupplierSchema.pre("save", async function (next) {
  if (this.isNew && !this.supplierCode) {
    const counter = await Counter.findOneAndUpdate(
      { scope: "supplier" },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
    this.supplierCode = `SUP-${pad(counter.seq, 3)}`;
  }
  next();
});

// Indexes for faster queries
SupplierSchema.index({ companyName: 1 });
SupplierSchema.index({ email: 1 });
SupplierSchema.index({ category: 1 });
SupplierSchema.index({ isActive: 1 });

// Virtual for full address
SupplierSchema.virtual('fullAddress').get(function() {
  const addr = this.address;
  if (!addr) return '';
  
  const parts = [addr.street, addr.city, addr.state, addr.zipCode, addr.country]
    .filter(part => part && part.trim());
  return parts.join(', ');
});

// Ensure virtual fields are serialized
SupplierSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model("SupplierModel", SupplierSchema);
