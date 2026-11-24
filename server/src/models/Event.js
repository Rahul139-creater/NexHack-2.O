import mongoose from 'mongoose';

const recordRefSchema = new mongoose.Schema({
  recordId: { type: String, required: true },
  rev: { type: Number, required: true }
}, { _id: false });

const eventSchema = new mongoose.Schema({
  actor: { type: String, required: true },
  tool: { type: String, default: 'api' },
  action: { type: String, required: true },
  taskId: { type: String, default: null },
  recordRefs: [recordRefSchema],
  meta: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  timestamp: { type: Date, default: Date.now }
});

eventSchema.index({ taskId: 1, timestamp: -1 });
eventSchema.index({ timestamp: -1 });

export const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);
