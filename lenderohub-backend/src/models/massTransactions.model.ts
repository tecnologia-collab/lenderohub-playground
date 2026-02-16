import mongoose from 'mongoose';

export interface IMassTransaction extends mongoose.Document {
  name: string;
  totalAmount: number;
  transactionCount: number;
  status: string;
  transactions: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
}

const schema = new mongoose.Schema({
  name: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  transactionCount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export const MassTransaction = mongoose.model<IMassTransaction>('MassTransaction', schema);
