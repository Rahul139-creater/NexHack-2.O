import mongoose from 'mongoose';

const citationSchema = new mongoose.Schema({
  recordId: { type: String, required: true },
  rev: { type: Number, required: true }
}, { _id: false });

const resultSchema = new mongoose.Schema({
  taskId: { type: String, required: true },
  attempt: { type: Number, default: 1 },
  idempotencyKey: { type: String, required: true, unique: true },
  body: { type: String, required: true },
  citations: [citationSchema],
  createdBy: { type: String, required: true },
  tool: { type: String, default: 'api' },
  applied: { type: Boolean, default: false }
}, {
  timestamps: true
});

resultSchema.index({ taskId: 1 });

export const Result = mongoose.models.Result || mongoose.model('Result', resultSchema);
