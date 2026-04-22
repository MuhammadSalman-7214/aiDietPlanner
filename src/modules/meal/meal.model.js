const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  calories: { type: Number, required: true },
  protein: { type: Number, required: true },
  carbs: { type: Number, required: true },
  fats: { type: Number, required: true },
  weightGrams: { type: Number },
  category: { type: String, required: true, enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
  dietType: { type: String, required: true },
  foodRole: { type: String, enum: ['protein', 'carb', 'fat', 'mixed'] },
  nutritionStatus: { type: String },
  normalizationSource: { type: String },
  confidence: { type: Number },
}, { timestamps: true });

module.exports = mongoose.model('Food', foodSchema);
