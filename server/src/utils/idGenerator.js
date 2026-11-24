import { Counter } from '../models/Counter.js';

const TYPE_PREFIX_MAP = {
  brief: 'BRF',
  decision: 'DEC',
  document: 'DOC',
  task: 'TSK'
};

export async function generateId(typeOrPrefix) {
  const prefix = TYPE_PREFIX_MAP[typeOrPrefix] || typeOrPrefix.toUpperCase();
  const counter = await Counter.findByIdAndUpdate(
    prefix,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  const sequenceStr = String(counter.seq).padStart(3, '0');
  return `${prefix}-${sequenceStr}`;
}
