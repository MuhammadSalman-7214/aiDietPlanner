const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  isEmailVerified: { type: Boolean, default: false },
  emailOtpHash: { type: String },
  emailOtpExpiresAt: { type: Date },
  emailOtpLastSentAt: { type: Date },
  age: { type: Number },
  gender: { type: String, enum: ['male', 'female'] },
  weight: { type: Number },
  height: { type: Number },
  activityLevel: { type: String },
  goal: { type: String, enum: ['loss', 'gain', 'maintain'] },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
