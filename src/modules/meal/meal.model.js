const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  calories: { type: Number, required: true },
  protein: { type: Number, required: true },
  carbs: { type: Number, required: true },
  fats: { type: Number, required: true },
  category: { type: String, required: true, enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
  dietType: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Food', foodSchema);
