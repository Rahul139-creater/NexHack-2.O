import mongoose from 'mongoose';

const revisionSchema = new mongoose.Schema({
  recordId: { type: String, required: true },
  rev: { type: Number, required: true, min: 1 },
  content: { type: String, required: true },
  author: { type: String, required: true },
  tool: { type: String, default: 'api' },
  createdAt: { type: Date, default: Date.now }
});

revisionSchema.index({ recordId: 1, rev: 1 }, { unique: true });

export const Revision = mongoose.models.Revision || mongoose.model('Revision', revisionSchema);
