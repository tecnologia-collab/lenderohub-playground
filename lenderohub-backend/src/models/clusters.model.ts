import mongoose from 'mongoose';

export interface ICluster extends mongoose.Document {
  name: string;
  description?: string;
  accounts: mongoose.Types.ObjectId[];
  active: boolean;
  lastModifiedBy?: mongoose.Types.ObjectId;
}

const clusterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  accounts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Account' }],
  active: { type: Boolean, default: true },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export const Cluster = mongoose.model<ICluster>('Cluster', clusterSchema);
