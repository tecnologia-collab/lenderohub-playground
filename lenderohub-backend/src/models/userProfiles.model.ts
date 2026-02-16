import * as dinero from 'dinero.js'
import mongoose from 'mongoose'

import * as clientsModels from './clients.model'
import * as uploadsModels from './uploads.model'
import { dayjs } from '../utils/dayjs'
import {
  corporatePermissions,
  corporatePermissionDefaults,
  administratorPermissions,
  administratorPermissionDefaults,
  subaccountManagerPermissions,
  subaccountManagerPermissionDefaults,
  type CorporatePermission,
  type AdministratorPermission,
  type SubaccountManagerPermission
} from '../config/profilePermissions'

// =============================================================================
// ENUMS
// =============================================================================

export enum UserProfileType {
  System = 'system',
  Corporate = 'corporate',
  Administrator = 'administrator',
  SubaccountManager = 'subaccountManager',
  CommissionAgent = 'commissionAgent'
}

export enum CommissionType {
  Resico = 'resico',
  EntrepreneurialActivity = 'entrepreneurialActivity',
  JuridicalPerson = 'juridicalPerson'
}

// =============================================================================
// COMMON INTERFACES - Favourites
// =============================================================================

export interface IFavourites {
  beneficiaries: mongoose.Types.ObjectId[]
  costCentres: mongoose.Types.ObjectId[]
  accounts: mongoose.Types.ObjectId[]
}

interface IHasFavourites {
  favourites: IFavourites
}

const favouritesSchema = {
  favourites: {
    beneficiaries: {
      type: [mongoose.Types.ObjectId],
      ref: 'Beneficiary',
      default: []
    },
    costCentres: {
      type: [mongoose.Types.ObjectId],
      ref: 'CostCentre',
      default: []
    },
    accounts: {
      type: [mongoose.Types.ObjectId],
      ref: 'InternalAccount',
      default: []
    }
  }
}

// =============================================================================
// COMMON INTERFACES - Subaccount Groups
// =============================================================================

export interface ISubaccountGroup {
  name: string
  subaccountIds: string[]
}

const subaccountGroupSchema = new mongoose.Schema<ISubaccountGroup>({
  name: {
    type: String,
    required: true
  },
  subaccountIds: [{
    type: String
  }]
}, { _id: false })

export const defaultSubaccountGroups: ISubaccountGroup[] = [
  { name: 'CLIENTES', subaccountIds: [] },
  { name: 'PROVEEDORES', subaccountIds: [] }
]

// =============================================================================
// COMMON INTERFACES - Notification Settings
// =============================================================================

export interface INotificationSettings {
  notificationEmail?: string
  speiInOwnAccounts: boolean
  speiOutOwnAccounts: boolean
  betweenOwnAccounts: boolean
  commissionRequests: boolean
}

const notificationSettingsSchema = {
  notificationEmail: { type: String },
  speiInOwnAccounts: { type: Boolean, default: true },
  speiOutOwnAccounts: { type: Boolean, default: true },
  betweenOwnAccounts: { type: Boolean, default: true },
  commissionRequests: { type: Boolean, default: true }
}

// Commission agent has fewer notification options
export interface ICommissionAgentNotificationSettings {
  notificationEmail?: string
  commissionRequests: boolean
}

const commissionAgentNotificationSettingsSchema = {
  notificationEmail: { type: String },
  commissionRequests: { type: Boolean, default: true }
}

// =============================================================================
// BASE USER PROFILE
// =============================================================================

export interface IUserProfile extends mongoose.Document {
  _id: mongoose.Types.ObjectId
  type: UserProfileType
  user: mongoose.Types.ObjectId | mongoose.Document
  isActive: boolean
  permissions?: Record<string, boolean>
  createdAt: Date
  updatedAt: Date

  // Methods
  hasPermission(permission: string): boolean
  hasSomePermissions(...permissions: string[]): boolean
}

type UserProfileModel = mongoose.Model<IUserProfile>

const userProfileSchema = new mongoose.Schema<IUserProfile, UserProfileModel>({
  type: {
    type: String,
    enum: Object.values(UserProfileType),
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    required: true,
    default: true
  }
}, {
  collection: 'userProfiles',
  discriminatorKey: 'type',
  timestamps: true,
  toJSON: { virtuals: false },
  toObject: { virtuals: false },
  methods: {
    hasPermission(permission: string): boolean {
      if (this.permissions == null) {
        // System profile or profile without permissions = full access
        return true
      }
      if (!(permission in this.permissions)) {
        return false
      }
      return this.permissions[permission]
    },
    hasSomePermissions(...permissions: string[]): boolean {
      return permissions.some(permission => this.hasPermission(permission))
    }
  }
})

// Indexes
userProfileSchema.index({ user: 1, isActive: 1 })
userProfileSchema.index({ type: 1, isActive: 1 })

export const UserProfile = mongoose.model<IUserProfile, UserProfileModel>('UserProfile', userProfileSchema)

// =============================================================================
// SYSTEM USER PROFILE (Superadmin - no permissions needed)
// =============================================================================

export type ISystemUserProfile = IUserProfile

type SystemUserProfileModel = mongoose.Model<ISystemUserProfile>

const systemUserProfileSchema = new mongoose.Schema<ISystemUserProfile, SystemUserProfileModel>({})

export const SystemUserProfile = UserProfile.discriminator(
  'SystemUserProfile',
  systemUserProfileSchema,
  UserProfileType.System
)

// =============================================================================
// CORPORATE USER PROFILE (15 permissions)
// =============================================================================

export interface ICorporateUserProfile extends IUserProfile, IHasFavourites {
  client: mongoose.Types.ObjectId | mongoose.HydratedDocument<clientsModels.ICorporateClient>
  settings: INotificationSettings
  permissions: Record<CorporatePermission, boolean>
  subaccountGroups: ISubaccountGroup[]
}

type CorporateUserProfileModel = mongoose.Model<ICorporateUserProfile>

// Build permissions schema dynamically from config
const corporatePermissionsSchema: Record<string, { type: BooleanConstructor; default: boolean }> = {}
for (const perm of corporatePermissions) {
  corporatePermissionsSchema[perm] = {
    type: Boolean,
    default: corporatePermissionDefaults[perm]
  }
}

const corporateUserProfileSchema = new mongoose.Schema<ICorporateUserProfile, CorporateUserProfileModel>({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CorporateClient',
    required: true
  },
  ...favouritesSchema,
  settings: notificationSettingsSchema,
  permissions: corporatePermissionsSchema,
  subaccountGroups: {
    type: [subaccountGroupSchema],
    default: defaultSubaccountGroups
  }
})

// Index for client lookup
corporateUserProfileSchema.index({ client: 1 })

export const CorporateUserProfile = UserProfile.discriminator(
  'CorporateUserProfile',
  corporateUserProfileSchema,
  UserProfileType.Corporate
)

// =============================================================================
// ADMINISTRATOR USER PROFILE (12 permissions)
// =============================================================================

export interface IAdministratorUserProfile extends IUserProfile, IHasFavourites {
  client: mongoose.Types.ObjectId | mongoose.HydratedDocument<clientsModels.IRegularClient>
  settings: INotificationSettings
  permissions: Record<AdministratorPermission, boolean>
  subaccountGroups: ISubaccountGroup[]
}

type AdministratorUserProfileModel = mongoose.Model<IAdministratorUserProfile>

// Build permissions schema dynamically from config
const administratorPermissionsSchema: Record<string, { type: BooleanConstructor; default: boolean }> = {}
for (const perm of administratorPermissions) {
  administratorPermissionsSchema[perm] = {
    type: Boolean,
    default: administratorPermissionDefaults[perm]
  }
}

const administratorUserProfileSchema = new mongoose.Schema<IAdministratorUserProfile, AdministratorUserProfileModel>({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RegularClient',
    required: true
  },
  ...favouritesSchema,
  settings: notificationSettingsSchema,
  permissions: administratorPermissionsSchema,
  subaccountGroups: {
    type: [subaccountGroupSchema],
    default: defaultSubaccountGroups
  }
})

// Index for client lookup
administratorUserProfileSchema.index({ client: 1 })

export const AdministratorUserProfile = UserProfile.discriminator(
  'AdministratorUserProfile',
  administratorUserProfileSchema,
  UserProfileType.Administrator
)

// =============================================================================
// SUBACCOUNT MANAGER USER PROFILE (8 permissions)
// =============================================================================

export interface ISubaccountManagerUserProfile extends IUserProfile, IHasFavourites {
  client: mongoose.Types.ObjectId | mongoose.HydratedDocument<clientsModels.IRegularClient>
  settings: INotificationSettings
  permissions: Record<SubaccountManagerPermission, boolean>
  subaccountGroups: ISubaccountGroup[]
  // Virtual fields (populated via virtuals)
  assignments?: mongoose.Document[]
  cashManagementAssignments?: mongoose.Document[]
}

type SubaccountManagerUserProfileModel = mongoose.Model<ISubaccountManagerUserProfile>

// Build permissions schema dynamically from config
const subaccountManagerPermissionsSchema: Record<string, { type: BooleanConstructor; default: boolean }> = {}
for (const perm of subaccountManagerPermissions) {
  subaccountManagerPermissionsSchema[perm] = {
    type: Boolean,
    default: subaccountManagerPermissionDefaults[perm]
  }
}

const subaccountManagerUserProfileSchema = new mongoose.Schema<ISubaccountManagerUserProfile, SubaccountManagerUserProfileModel>({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RegularClient',
    required: true
  },
  ...favouritesSchema,
  settings: notificationSettingsSchema,
  permissions: subaccountManagerPermissionsSchema,
  subaccountGroups: {
    type: [subaccountGroupSchema],
    default: defaultSubaccountGroups
  }
})

// Virtual: SubaccountManagerAssignments
subaccountManagerUserProfileSchema.virtual('assignments', {
  ref: 'SubaccountManagerAssignment',
  localField: '_id',
  foreignField: 'userProfile',
  match: () => ({ isActive: true })
})

// Virtual: CashManagementAssignments
subaccountManagerUserProfileSchema.virtual('cashManagementAssignments', {
  ref: 'CashManagementAssignment',
  localField: '_id',
  foreignField: 'userProfile',
  match: () => ({ isActive: true })
})

// Index for client lookup
subaccountManagerUserProfileSchema.index({ client: 1 })

export const SubaccountManagerUserProfile = UserProfile.discriminator(
  'SubaccountManagerUserProfile',
  subaccountManagerUserProfileSchema,
  UserProfileType.SubaccountManager
)

// =============================================================================
// COMMISSION AGENT USER PROFILE (No configurable permissions)
// =============================================================================

export interface ICommissionAgentUserProfile extends IUserProfile {
  client: mongoose.Types.ObjectId | mongoose.HydratedDocument<clientsModels.ICorporateClient>
  commissionType: CommissionType
  rfc?: string
  identificationDocument?: mongoose.Types.ObjectId | mongoose.HydratedDocument<uploadsModels.IUpload>
  financialStatement?: mongoose.Types.ObjectId | mongoose.HydratedDocument<uploadsModels.IUpload>
  proofOfAddress?: mongoose.Types.ObjectId | mongoose.HydratedDocument<uploadsModels.IUpload>
  settings: ICommissionAgentNotificationSettings
  previousIdentificationDocuments: (mongoose.Types.ObjectId | mongoose.HydratedDocument<uploadsModels.IUpload>)[]
  previousFinancialStatements: (mongoose.Types.ObjectId | mongoose.HydratedDocument<uploadsModels.IUpload>)[]
  previousProofsOfAddress: (mongoose.Types.ObjectId | mongoose.HydratedDocument<uploadsModels.IUpload>)[]
  commissionTransferOutFee: dinero.Dinero | dinero.DineroObject | number
  // Virtual fields
  assignments?: mongoose.Document[]
  beneficiaries?: mongoose.Document[]
  requests?: mongoose.Document[]
  currentMonthBalance?: mongoose.Document | null
  // Methods
  getMonthlyBalance(month?: string): Promise<mongoose.Document | null>
}

type CommissionAgentUserProfileModel = mongoose.Model<ICommissionAgentUserProfile>

const commissionAgentUserProfileSchema = new mongoose.Schema<ICommissionAgentUserProfile, CommissionAgentUserProfileModel>({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CorporateClient',
    required: true
  },
  commissionType: {
    type: String,
    enum: Object.values(CommissionType),
    required: true
  },
  rfc: {
    type: String,
    uppercase: true,
    trim: true
  },
  identificationDocument: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Upload'
  },
  financialStatement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Upload'
  },
  proofOfAddress: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Upload'
  },
  settings: commissionAgentNotificationSettingsSchema,
  previousIdentificationDocuments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Upload'
  }],
  previousFinancialStatements: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Upload'
  }],
  previousProofsOfAddress: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Upload'
  }],
  commissionTransferOutFee: {
    type: mongoose.Schema.Types.Mixed,
    default: function (): dinero.DineroObject {
      return {
        amount: 550,
        precision: 2,
        currency: 'MXN'
      }
    }
  }
}, {
  methods: {
    async getMonthlyBalance(month?: string): Promise<mongoose.Document | null> {
      // Import here to avoid circular dependency
      const { CommissionAgentBalance } = await import('./commissionAgentBalances.model')

      const date = dayjs(month, 'YYYY-MM', true)
      const key = (month === undefined || !date.isValid())
        ? dayjs().format('YYYY-MM')
        : month

      const balance = await CommissionAgentBalance.findOne({
        commissionAgentUserProfile: this._id,
        key
      })
      return balance
    }
  }
})

// Virtual: CommissionAgentAssignments
commissionAgentUserProfileSchema.virtual('assignments', {
  ref: 'CommissionAgentAssignment',
  localField: '_id',
  foreignField: 'userProfile',
  match: () => ({ isEnabled: true })
})

// Virtual: CommissionAgentBeneficiaries
commissionAgentUserProfileSchema.virtual('beneficiaries', {
  ref: 'CommissionAgentBeneficiary',
  localField: '_id',
  foreignField: 'userProfile',
  match: () => ({ status: 'active' })
})

// Virtual: CommissionRequests
commissionAgentUserProfileSchema.virtual('requests', {
  ref: 'CommissionRequest',
  localField: '_id',
  foreignField: 'userProfile'
})

// Virtual: Current month balance
commissionAgentUserProfileSchema.virtual('currentMonthBalance', {
  ref: 'CommissionAgentBalance',
  localField: '_id',
  foreignField: 'commissionAgentUserProfile',
  match: () => ({ key: dayjs().format('YYYY-MM') }),
  justOne: true
})

// Index for client lookup
commissionAgentUserProfileSchema.index({ client: 1 })
commissionAgentUserProfileSchema.index({ rfc: 1 }, { sparse: true })

export const CommissionAgentUserProfile = UserProfile.discriminator(
  'CommissionAgentUserProfile',
  commissionAgentUserProfileSchema,
  UserProfileType.CommissionAgent
)

// =============================================================================
// TYPE ALIASES
// =============================================================================

export type UserProfileWithClient = ICorporateUserProfile | IAdministratorUserProfile | ISubaccountManagerUserProfile | ICommissionAgentUserProfile

export type UserProfileWithFavourites = ICorporateUserProfile | IAdministratorUserProfile | ISubaccountManagerUserProfile

export type UserProfileWithPermissions = ICorporateUserProfile | IAdministratorUserProfile | ISubaccountManagerUserProfile

// =============================================================================
// RE-EXPORT PERMISSION TYPES
// =============================================================================

export {
  corporatePermissions,
  administratorPermissions,
  subaccountManagerPermissions,
  type CorporatePermission,
  type AdministratorPermission,
  type SubaccountManagerPermission
}
