const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const OtpTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    context: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    data: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

OtpTokenSchema.index({ userId: 1, context: 1 });

module.exports = mongoose.model("OtpToken", OtpTokenSchema);
