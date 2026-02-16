import mongoose from 'mongoose'

import type { ISubaccountManagerUserProfile } from './userProfiles.model'
import type { IInternalAccount } from './accounts.model'

// =============================================================================
// INTERFACES
// =============================================================================

export interface ISubaccountManagerAssignmentPermissions {
  transferFrom: boolean
  transferTo: boolean
}

export interface ISubaccountManagerAssignment extends mongoose.Document {
  userProfile: mongoose.Types.ObjectId | mongoose.HydratedDocument<ISubaccountManagerUserProfile>
  account: mongoose.Types.ObjectId | mongoose.HydratedDocument<IInternalAccount>
  isActive: boolean
  permissions: ISubaccountManagerAssignmentPermissions
  createdAt: Date
  updatedAt: Date
}

// =============================================================================
// MODEL
// =============================================================================

type SubaccountManagerAssignmentModel = mongoose.Model<ISubaccountManagerAssignment>

const subaccountManagerAssignmentSchema = new mongoose.Schema<ISubaccountManagerAssignment, SubaccountManagerAssignmentModel>({
  userProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubaccountManagerUserProfile',
    required: true
  },
  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InternalAccount',
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
    },
    transferTo: {
      type: Boolean,
      default: true
    }
  }
}, {
  collection: 'subaccountManagerAssignments',
  timestamps: true
})

// Indexes
subaccountManagerAssignmentSchema.index({ userProfile: 1, isActive: 1 })
subaccountManagerAssignmentSchema.index({ account: 1, isActive: 1 })
subaccountManagerAssignmentSchema.index({ userProfile: 1, account: 1 }, { unique: true })

export const SubaccountManagerAssignment = mongoose.model<ISubaccountManagerAssignment, SubaccountManagerAssignmentModel>(
  'SubaccountManagerAssignment',
  subaccountManagerAssignmentSchema
)
