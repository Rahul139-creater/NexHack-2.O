import mongoose from 'mongoose';

const recordRefSchema = new mongoose.Schema({
  recordId: { type: String, required: true },
  rev: { type: Number, required: true }
}, { _id: false });

const taskSchema = new mongoose.Schema({
  taskId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  briefRef: {
    recordId: { type: String, required: true },
    rev: { type: Number, required: true }
  },
  status: {
    type: String,
    enum: ['open', 'claimed', 'result_saved', 'completed', 'stale', 'conflict'],
    default: 'open'
  },
  owner: { type: String, default: null },
  tool: { type: String, default: null },
  lease: {
    expiresAt: { type: Date, default: null }
  },
  fencingToken: { type: Number, default: 0 },
  nextAction: { type: String, default: null },
  dependsOn: [recordRefSchema]
}, {
  timestamps: true
});

export const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);
