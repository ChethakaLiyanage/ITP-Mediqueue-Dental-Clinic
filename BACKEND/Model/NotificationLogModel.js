// Model/NotificationLogModel.js (NEW)
const mongoose2 = require('mongoose');
const Schema2 = mongoose2.Schema;
const Counter2 = require('./Counter');
const { pad: pad2 } = require('../utils/seq');

const NotificationLogSchema = new Schema2({
  notificationCode: { type: String, unique: true, sparse: true },
  recipientType: { type: String, enum: ['Patient','Dentist'], required: true },
  recipientCode: { type: String, required: true, index: true },
  channel: { type: String, enum:  ['whatsapp','sms','email','push','console','auto'], default: 'auto' },
  templateKey: { type: String, required: true }, // 'APPT_CONFIRMED','APPT_CANCELED','APPT_REMINDER_24H','DENTIST_DAILY_RUN'
  scheduledFor: { type: Date },
  sentAt: { type: Date },
  status: { type: String, enum: ['queued','sent','failed','canceled'], default: 'queued', index: true },
  error: { type: String },
  meta: { type: Object },
}, { timestamps: true });

NotificationLogSchema.pre('save', async function(next){
  if (this.isNew && !this.notificationCode) {
    const c = await Counter2.findOneAndUpdate(
      { scope: 'notification' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.notificationCode = `NTF-${pad2(c.seq,4)}`;
  }
  next();
});

module.exports = mongoose2.model('NotificationLog', NotificationLogSchema);

