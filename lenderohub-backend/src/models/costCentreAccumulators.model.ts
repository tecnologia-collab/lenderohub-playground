import mongoose from 'mongoose';

export interface ICostCentreAccumulator extends mongoose.Document {
  costCentre: mongoose.Types.ObjectId;
  type: string;
  period: string;
  amount: number;
  count: number;
}

const schema = new mongoose.Schema({
  costCentre: { type: mongoose.Schema.Types.ObjectId, ref: 'CostCentre', required: true },
  type: { type: String, required: true },
  period: { type: String, required: true },
  amount: { type: Number, default: 0 },
  count: { type: Number, default: 0 }
}, { timestamps: true });

export const CostCentreAccumulator = mongoose.model<ICostCentreAccumulator>('CostCentreAccumulator', schema);
