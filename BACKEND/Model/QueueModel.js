// Model/QueueModel.js (NEW)
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Counter = require('./Counter');
const { pad } = require('../utils/seq'); // you already have seq.js

const QueueSchema = new Schema({
  queueCode: { type: String, unique: true, sparse: true },
  appointmentCode: { type: String, required: true, index: true },
  patientCode: { type: String, required: true, index: true },
  dentistCode: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true }, // day bucket (UTC)
  position: { type: Number, required: true },
  status: { type: String, enum: ['waiting','called','in_treatment','completed','no_show'], default: 'waiting', index: true },
  calledAt: Date,
  startedAt: Date,
  completedAt: Date,
}, { timestamps: true });

QueueSchema.pre('save', async function(next){
  if (this.isNew && !this.queueCode) {
    const c = await Counter.findOneAndUpdate(
      { scope: 'queue' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.queueCode = `Q-${pad(c.seq,4)}`;
  }
  next();
});

module.exports = mongoose.model('Queue', QueueSchema);

