import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  tokenHash: { type: String, required: true, unique: true },
  tool: { type: String, default: null }
}, {
  timestamps: true
});

export const User = mongoose.models.User || mongoose.model('User', userSchema);
