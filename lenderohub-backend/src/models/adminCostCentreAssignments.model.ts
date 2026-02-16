import mongoose from 'mongoose';

export interface IAdminCostCentreAssignment extends mongoose.Document {
  administrator: mongoose.Types.ObjectId;
  costCentre: mongoose.Types.ObjectId;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
}

const schema = new mongoose.Schema({
  administrator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  costCentre: { type: mongoose.Schema.Types.ObjectId, ref: 'CostCentre', required: true },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

schema.index({ costCentre: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
schema.index({ administrator: 1, isActive: 1 });

export const AdminCostCentreAssignment = mongoose.model<IAdminCostCentreAssignment>(
  'AdminCostCentreAssignment',
  schema
);
