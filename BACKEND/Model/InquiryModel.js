const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Counter = require("./Counter");
const { pad } = require("../utils/seq");

// Chat message schema for both patient and receptionist messages
const MessageSchema = new Schema(
  {
    senderType: { 
      type: String, 
      enum: ["patient", "receptionist", "system"], 
      required: true 
    },
    senderCode: { type: String, trim: true }, // Patient code or Receptionist code
    senderName: { type: String, trim: true }, // Display name
    message: { type: String, required: true, trim: true },
    messageType: { 
      type: String, 
      enum: ["text", "appointment_change_request", "system_notification"], 
      default: "text" 
    },
    appointmentCode: { type: String, trim: true }, // If related to appointment
    metadata: { type: Schema.Types.Mixed }, // Additional data for special message types
    timestamp: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false }
  },
  { _id: true }
);

const InquirySchema = new Schema(
  {
    patientCode: { type: String, required: true, index: true, trim: true },
    patientName: { type: String, trim: true }, // Patient's display name

    subject: { type: String, required: true, trim: true },
    initialMessage: { type: String, required: true, trim: true }, // First message

    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
      index: true
    },

    assignedTo: { type: String, trim: true, index: true }, // Receptionist code
    assignedToName: { type: String, trim: true }, // Receptionist name

    // Chat messages array
    messages: { type: [MessageSchema], default: [] },

    // Legacy support for old responses
    responses: { type: [Schema.Types.Mixed], default: [] },

    inquiryCode: { type: String, unique: true, sparse: true },
    
    // Chat-specific fields
    lastMessageAt: { type: Date, default: Date.now },
    unreadCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

InquirySchema.pre("save", async function (next) {
  if (this.isNew && !this.inquiryCode) {
    const c = await Counter.findOneAndUpdate(
      { scope: "inquiry" },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
    this.inquiryCode = `INQ-${pad(c.seq, 4)}`;
  }
  next();
});

InquirySchema.index({ status: 1, createdAt: -1 });
InquirySchema.index({ patientCode: 1, createdAt: -1 });
InquirySchema.index({ lastMessageAt: -1 });
InquirySchema.index({ assignedTo: 1, status: 1 });

// Helper method to add a message to the chat
InquirySchema.methods.addMessage = function(senderType, senderCode, senderName, message, messageType = "text", appointmentCode = null, metadata = null) {
  const newMessage = {
    senderType,
    senderCode,
    senderName,
    message,
    messageType,
    appointmentCode,
    metadata,
    timestamp: new Date(),
    isRead: false
  };
  
  this.messages.push(newMessage);
  this.lastMessageAt = new Date();
  
  // Update unread count for receptionists
  if (senderType === "patient") {
    this.unreadCount += 1;
  }
  
  return newMessage;
};

// Helper method to mark messages as read
InquirySchema.methods.markAsRead = function(receptionistCode) {
  this.messages.forEach(msg => {
    if (msg.senderType === "patient" && !msg.isRead) {
      msg.isRead = true;
    }
  });
  this.unreadCount = 0;
};

module.exports = mongoose.model("InquiryModel", InquirySchema);

