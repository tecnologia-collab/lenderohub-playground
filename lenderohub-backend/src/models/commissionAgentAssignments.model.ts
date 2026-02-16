import mongoose from 'mongoose'

import type { ICommissionAgentUserProfile } from './userProfiles.model'

// Forward reference to avoid circular dependency
// CostCentre is imported at runtime via population

// =============================================================================
// INTERFACES
// =============================================================================

export interface ICommissionAgentAssignment extends mongoose.Document {
  userProfile: mongoose.Types.ObjectId | mongoose.HydratedDocument<ICommissionAgentUserProfile>
  costCentre: mongoose.Types.ObjectId | mongoose.Document
  transferInCommissionPercentage: number
  isEnabled: boolean
  assignedAt?: Date
  createdAt: Date
  updatedAt: Date
}

// =============================================================================
// MODEL
// =============================================================================

type CommissionAgentAssignmentModel = mongoose.Model<ICommissionAgentAssignment>

const commissionAgentAssignmentSchema = new mongoose.Schema<ICommissionAgentAssignment, CommissionAgentAssignmentModel>({
  userProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommissionAgentUserProfile',
    required: true
  },
  costCentre: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CostCentre',
    required: true
  },
  transferInCommissionPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  isEnabled: {
    type: Boolean,
    required: true,
    default: false
  },
  assignedAt: {
    type: Date
  }
}, {
  collection: 'commissionAgentAssignments',
  timestamps: true
})

// Indexes
commissionAgentAssignmentSchema.index({ userProfile: 1, isEnabled: 1 })
commissionAgentAssignmentSchema.index({ costCentre: 1 }, {
  unique: true,
  partialFilterExpression: { isEnabled: true }
})

export const CommissionAgentAssignment = mongoose.model<ICommissionAgentAssignment, CommissionAgentAssignmentModel>(
  'CommissionAgentAssignment',
  commissionAgentAssignmentSchema
)
