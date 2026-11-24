import mongoose from 'mongoose';

const reviewFlagSchema = new mongoose.Schema({
  taskId: { type: String, required: true },
  reason: { type: String, required: true },
  changedRecord: {
    recordId: { type: String, required: true },
    fromRev: { type: Number, required: true },
    toRev: { type: Number, required: true }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: { type: String, default: null }
}, {
  timestamps: true
});

reviewFlagSchema.index({ taskId: 1 });
reviewFlagSchema.index({ status: 1 });

export const ReviewFlag = mongoose.models.ReviewFlag || mongoose.model('ReviewFlag', reviewFlagSchema);
