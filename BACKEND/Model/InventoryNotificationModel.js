const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Mirror item structure from InventoryRequest
const InventoryNotifItemSchema = new Schema(
  {
    itemName: { type: String, required: true, trim: true },
    itemCode: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

// Inventory Notification model mirrors InventoryRequest fields and adds notification metadata
const InventoryNotificationSchema = new Schema(
  {
    // Reference to the originating request (if applicable)
    requestId: { type: Schema.Types.ObjectId, ref: "InventoryRequest", index: true },

    // Core fields copied from InventoryRequest.js
    dentistCode: { type: String, required: true, trim: true, index: true },
    items: {
      type: [InventoryNotifItemSchema],
      validate: [arr => Array.isArray(arr) && arr.length > 0, "At least one item is required"],
    },
    notes: { type: String, trim: true },

    // Extra column: status (manager confirmed/declined etc.)
    status: { 
      type: String, 
      enum: ["Pending", "Approved", "Rejected", "Fulfilled"], 
      default: "Pending",
      index: true,
    },

    // Notification-specific fields
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InventoryNotification", InventoryNotificationSchema);

