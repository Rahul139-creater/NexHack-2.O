import mongoose from 'mongoose';

const recordSchema = new mongoose.Schema({
  recordId: { type: String, required: true, unique: true },
  type: {
    type: String,
    enum: ['brief', 'decision', 'document'],
    required: true
  },
  currentRevision: { type: Number, default: 1, min: 1 },
  readers: [{ type: String }],
  writers: [{ type: String }]
}, {
  timestamps: true
});

export const Record = mongoose.models.Record || mongoose.model('Record', recordSchema);
