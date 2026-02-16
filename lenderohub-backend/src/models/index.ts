// src/models/index.ts - Barrel file
import mongoose from 'mongoose';

// ============== Tipos compartidos ==============

// Fiscal Address
export interface IFiscalAddress {
  street?: string;
  exteriorNumber?: string;
  interiorNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export const fiscalAddressDocument = {
  street: { type: String },
  exteriorNumber: { type: String },
  interiorNumber: { type: String },
  neighborhood: { type: String },
  city: { type: String },
  state: { type: String },
  postalCode: { type: String },
  country: { type: String, default: 'MX' }
};

// Location
export interface ILocation {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

export const locationDocument = {
  latitude: { type: Number },
  longitude: { type: Number },
  accuracy: { type: Number }
};

// ============== Exports de modelos ==============
export * from './accounts.model'
export * from './accountMovements.model'
export * from './auditLog.model'
export * from './beneficiaries.model'
export * from './cashBags.model'
export * from './clients.model'
export * from './clusters.model'
export * from './adminCostCentreAssignments.model'
export * from './commissionAgentBalances.model'
export * from './commissionAgentAssignments.model'
export * from './commissionBalanceMovements.model'
export * from './commissionRequests.model'
export * from './costCentreAccumulators.model'
export * from './massTransactions.model'
export * from './monthlyCharges.model'
export * from './providerAccounts.model'
export * from './subaccountManagerAssignments.model'
export * from './transactions.model'
export * from './uploads.model'
export * from './user.model'
export * from './userBeneficiaries.model'
export * from './userEvents.model'
// Note: userProfiles.model exports UserProfileType and CommissionType which conflict with user.model
// Import directly from userProfiles.model when using the new profile system
export {
  UserProfile,
  SystemUserProfile,
  CorporateUserProfile,
  AdministratorUserProfile,
  SubaccountManagerUserProfile,
  CommissionAgentUserProfile,
  UserProfileType as ProfileType,
  CommissionType as ProfileCommissionType,
  type IUserProfile,
  type ISystemUserProfile,
  type ICorporateUserProfile,
  type IAdministratorUserProfile,
  type ISubaccountManagerUserProfile,
  type ICommissionAgentUserProfile,
  type IFavourites,
  type ISubaccountGroup,
  type INotificationSettings,
  type UserProfileWithClient,
  type UserProfileWithFavourites,
  type UserProfileWithPermissions,
  defaultSubaccountGroups,
  corporatePermissions,
  administratorPermissions,
  subaccountManagerPermissions
} from './userProfiles.model'
export * from './userSettings.model'
export * from './massBeneficiaryImport.model'
export * from './massTransferOut.model'
export * from './registrationRequest.model'
export * from './beneficiaryCluster.model'
