// Model/QueueHistoryModel.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const QueueHistorySchema = new Schema({
  queueCode: { type: String, index: true },
  appointmentCode: { type: String },
  patientCode: { type: String },
  dentistCode: { type: String },
  date: { type: Date, index: true },
  position: Number,
  status: String,
  switchedFrom: Date,
  switchedTo: Date,
}, { timestamps: true });

module.exports = mongoose.model('QueueHistory', QueueHistorySchema);
