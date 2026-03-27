const mongoose = require('mongoose');

const userProgressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetCalories: { type: Number, required: true },
  date: { type: String, required: true },
  consumedCalories: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('UserProgress', userProgressSchema);
