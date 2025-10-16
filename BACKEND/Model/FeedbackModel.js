const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const FeedbackSchema = new Schema({
   rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5                   // rating between 1 and 5
   },
   comment: {
    type: String,
    trim: true               // optional patient feedback
   },
   user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
   },
   submitted_date: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true }); 
module.exports = mongoose.model(
    "FeedbackModel",//file name
    FeedbackSchema //user schema
) 