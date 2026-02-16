/**
 * Beneficiary Cluster Model
 *
 * Groups of beneficiaries (Finco instruments) for quick selection
 * during mass dispersals. Each cluster belongs to a cost centre.
 */

import mongoose from 'mongoose';

// ============================================================================
// Interface
// ============================================================================

export interface IBeneficiaryCluster extends mongoose.Document {
  name: string;
  description?: string;
  costCentreId: mongoose.Types.ObjectId;
  corporateClientId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  beneficiaries: string[];  // Finco instrument IDs (not ObjectIds)
  color?: string;           // hex color for UI display
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Schema
// ============================================================================

const beneficiaryClusterSchema = new mongoose.Schema<IBeneficiaryCluster>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  costCentreId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CostCentre',
    required: true,
    index: true
  },
  corporateClientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  beneficiaries: [{
    type: String,
    trim: true
  }],
  color: {
    type: String,
    trim: true,
    match: /^#[0-9A-Fa-f]{6}$/
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  collection: 'beneficiaryClusters',
  timestamps: true
});

// Unique cluster name per cost centre (only among active clusters)
beneficiaryClusterSchema.index(
  { costCentreId: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true }
  }
);

// ============================================================================
// Export
// ============================================================================

export const BeneficiaryCluster = mongoose.model<IBeneficiaryCluster>(
  'BeneficiaryCluster',
  beneficiaryClusterSchema
);
