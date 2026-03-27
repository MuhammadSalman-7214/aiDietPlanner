const mongoose = require('mongoose');

const dietSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bmr: Number,
  tdee: Number,
  targetCalories: Number,
  macros: {
    protein: Number,
    carbs: Number,
    fats: Number,
  },
}, { timestamps: true });

module.exports = mongoose.model('DietPlan', dietSchema);
