const mongoose = require('mongoose');

/**
 * Short-lived OTP records for password reset / change flows.
 * OTPs are stored hashed; plain codes never persist.
 */
const PasswordOtpSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true, lowercase: true, trim: true },
  otpHash: { type: String, required: true },
  purpose: { type: String, enum: ['reset', 'change'], default: 'reset' },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

PasswordOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordOtp', PasswordOtpSchema);
