import mongoose from 'mongoose'

import * as accountsModels from './accounts.model'
import type { ISubaccountManagerUserProfile } from './userProfiles.model'

// =============================================================================
// INTERFACES
// =============================================================================

export interface ICashManagementAssignmentPermissions {
  transferFrom: boolean
}

export interface ICashManagementAssignment extends mongoose.Document {
  userProfile: mongoose.Types.ObjectId | mongoose.HydratedDocument<ISubaccountManagerUserProfile>
  account: mongoose.Types.ObjectId | mongoose.HydratedDocument<accountsModels.IVirtualBagAccount>
  isActive: boolean
  permissions: ICashManagementAssignmentPermissions
  createdAt: Date
  updatedAt: Date
}

// =============================================================================
// MODEL
// =============================================================================

type CashManagementAssignmentModel = mongoose.Model<ICashManagementAssignment>

const cashManagementAssignmentSchema = new mongoose.Schema<ICashManagementAssignment, CashManagementAssignmentModel>({
  userProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubaccountManagerUserProfile',
    required: true
  },
  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VirtualBagAccount',
    required: true
  },
  isActive: {
    type: Boolean,
    required: true,
    default: true
  },
  permissions: {
    transferFrom: {
      type: Boolean,
      default: true
    }
  }
}, {
  collection: 'cashManagementAssignments',
  timestamps: true
})

// Indexes
cashManagementAssignmentSchema.index({ userProfile: 1, isActive: 1 })
cashManagementAssignmentSchema.index({ account: 1, isActive: 1 })
cashManagementAssignmentSchema.index({ userProfile: 1, account: 1 }, { unique: true })

export const CashManagementAssignment = mongoose.model<ICashManagementAssignment, CashManagementAssignmentModel>(
  'CashManagementAssignment',
  cashManagementAssignmentSchema
)
