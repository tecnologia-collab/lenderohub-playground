/**
 * Permission Utilities
 *
 * Utility functions for working with user profiles and permissions.
 * Based on LenderoPay's permission system.
 */

import mongoose from 'mongoose'

import * as clientsModels from '../models/clients.model'
import * as userProfilesModels from '../models/userProfiles.model'

// =============================================================================
// PROFILE VISIBILITY
// =============================================================================

/**
 * Check if a user profile can see another user
 * Determines visibility based on profile type and client relationships
 */
export function userProfileCanSeeUser(
  requestUserProfile: mongoose.HydratedDocument<userProfilesModels.IUserProfile>,
  requestedUser: mongoose.Document & { profiles?: mongoose.HydratedDocument<userProfilesModels.IUserProfile>[] }
): boolean {
  // Helper: Get corporate client from profile
  function getCorporateClientFromProfile(
    profile: userProfilesModels.IUserProfile
  ): mongoose.HydratedDocument<clientsModels.ICorporateClient> | undefined {
    if (profile.type === userProfilesModels.UserProfileType.System) {
      return undefined
    }

    if ([userProfilesModels.UserProfileType.Corporate, userProfilesModels.UserProfileType.CommissionAgent].includes(profile.type)) {
      const profileWithCorp = profile as userProfilesModels.ICorporateUserProfile | userProfilesModels.ICommissionAgentUserProfile
      return profileWithCorp.client as mongoose.HydratedDocument<clientsModels.ICorporateClient>
    }

    // Administrator or SubaccountManager
    const profileWithRegular = profile as userProfilesModels.IAdministratorUserProfile | userProfilesModels.ISubaccountManagerUserProfile
    const regularClient = profileWithRegular.client as mongoose.HydratedDocument<clientsModels.IRegularClient>
    return regularClient.corporateClient as mongoose.HydratedDocument<clientsModels.ICorporateClient>
  }

  // Helper: Get regular client from profile
  function getRegularClientFromProfile(
    profile: userProfilesModels.IUserProfile
  ): mongoose.HydratedDocument<clientsModels.IRegularClient> | undefined {
    if (![userProfilesModels.UserProfileType.Administrator, userProfilesModels.UserProfileType.SubaccountManager].includes(profile.type)) {
      return undefined
    }
    const profileWithRegular = profile as userProfilesModels.IAdministratorUserProfile | userProfilesModels.ISubaccountManagerUserProfile
    return profileWithRegular.client as mongoose.HydratedDocument<clientsModels.IRegularClient>
  }

  // Same user can always see themselves
  const requestUser = requestUserProfile.user as mongoose.Document
  if (requestUser._id.equals(requestedUser._id)) {
    return true
  }

  // System can see everyone
  if (requestUserProfile.type === userProfilesModels.UserProfileType.System) {
    return true
  }

  // Corporate can see users with profiles under same corporate client
  if (requestUserProfile.type === userProfilesModels.UserProfileType.Corporate) {
    const requestedCorporateClients = (requestedUser.profiles ?? [])
      .map(profile => getCorporateClientFromProfile(profile))
      .filter((client): client is mongoose.HydratedDocument<clientsModels.ICorporateClient> => client != null)

    const requestCorporateUserProfile = requestUserProfile as mongoose.HydratedDocument<userProfilesModels.ICorporateUserProfile>
    const requestCorporateClient = requestCorporateUserProfile.client as mongoose.HydratedDocument<clientsModels.ICorporateClient>

    return requestedCorporateClients.some(
      corporateClient => corporateClient._id.toString() === requestCorporateClient._id.toString()
    )
  }

  // Administrator can see SubaccountManagers (and other Admins if has permission)
  if (requestUserProfile.type === userProfilesModels.UserProfileType.Administrator) {
    const visibleProfileTypes = [userProfilesModels.UserProfileType.SubaccountManager]

    if (requestUserProfile.hasPermission('adminOtherAdmins')) {
      visibleProfileTypes.push(userProfilesModels.UserProfileType.Administrator)
    }

    const filteredProfiles = (requestedUser.profiles ?? []).filter(
      profile => visibleProfileTypes.includes(profile.type)
    )

    const requestedRegularClients = filteredProfiles
      .map(profile => getRegularClientFromProfile(profile))
      .filter((client): client is mongoose.HydratedDocument<clientsModels.IRegularClient> => client != null)

    const requestAdminProfile = requestUserProfile as mongoose.HydratedDocument<userProfilesModels.IAdministratorUserProfile>
    const requestRegularClient = requestAdminProfile.client as mongoose.HydratedDocument<clientsModels.IRegularClient>

    return requestedRegularClients.some(
      regularClient => regularClient._id.toString() === requestRegularClient._id.toString()
    )
  }

  return false
}

// =============================================================================
// USER PERMISSIONS
// =============================================================================

export interface IUserPermissions {
  isSelf: boolean
  canBlockUnblock: boolean
  canResetPasswordOrToken: boolean
  canEditSessionTTL: boolean
  canSetOrToggleSetting: boolean
  canUpdateGeneralData: boolean
}

/**
 * Get permissions that the requesting profile has against a requested user
 */
export function getPermissionsAgainstRequestedUser(
  requestUserProfile: mongoose.HydratedDocument<userProfilesModels.IUserProfile>,
  requestedUser: mongoose.Document
): IUserPermissions {
  const requestUser = requestUserProfile.user as mongoose.Document
  const isSelf = requestedUser._id.toString() === requestUser._id.toString()

  // Block/Unblock
  let canBlockUnblock = false
  if (!isSelf) {
    if (requestUserProfile.type === userProfilesModels.UserProfileType.System) {
      canBlockUnblock = true
    } else if (requestUserProfile.type === userProfilesModels.UserProfileType.Corporate) {
      canBlockUnblock = requestUserProfile.hasPermission('usersManagement')
    }
  }

  // Reset Password/Token
  let canResetPasswordOrToken = isSelf
  if (!isSelf) {
    if (requestUserProfile.type === userProfilesModels.UserProfileType.System) {
      canResetPasswordOrToken = true
    } else if (requestUserProfile.type === userProfilesModels.UserProfileType.Corporate) {
      canResetPasswordOrToken = requestUserProfile.hasPermission('usersManagement')
    }
  }

  // Edit Session TTL
  let canEditSessionTTL = false
  if (isSelf) {
    if (requestUserProfile.type === userProfilesModels.UserProfileType.System) {
      canEditSessionTTL = true
    } else if ([userProfilesModels.UserProfileType.Corporate, userProfilesModels.UserProfileType.Administrator].includes(requestUserProfile.type)) {
      canEditSessionTTL = requestUserProfile.hasPermission('editSessionTTL')
    }
  } else {
    if (requestUserProfile.type === userProfilesModels.UserProfileType.System) {
      canEditSessionTTL = true
    } else if (requestUserProfile.type === userProfilesModels.UserProfileType.Corporate) {
      canEditSessionTTL = requestUserProfile.hasPermission('usersManagement')
    }
  }

  // Settings
  const canSetOrToggleSetting = isSelf

  // Update General Data
  let canUpdateGeneralData = false
  if (!isSelf) {
    if ([userProfilesModels.UserProfileType.System, userProfilesModels.UserProfileType.Corporate].includes(requestUserProfile.type)) {
      canUpdateGeneralData = requestUserProfile.hasPermission('usersManagement')
    }
  }

  return {
    isSelf,
    canBlockUnblock,
    canResetPasswordOrToken,
    canEditSessionTTL,
    canSetOrToggleSetting,
    canUpdateGeneralData
  }
}

// =============================================================================
// PROFILE PERMISSIONS
// =============================================================================

export interface IProfilePermissions {
  canDelete: boolean
  canEdit: boolean
  canSeePermissions: boolean
}

/**
 * Get permissions that the requesting profile has against a requested profile
 */
export function getPermissionsAgainstRequestedProfile(
  requestUserProfile: mongoose.HydratedDocument<userProfilesModels.IUserProfile>,
  requestedUserProfile: mongoose.HydratedDocument<userProfilesModels.IUserProfile>
): IProfilePermissions {
  const isSelf = requestedUserProfile._id.toString() === requestUserProfile._id.toString()

  // Delete
  let canDelete = false
  if (!isSelf) {
    if (requestUserProfile.type === userProfilesModels.UserProfileType.System) {
      canDelete = true
    } else if (requestUserProfile.type === userProfilesModels.UserProfileType.Corporate) {
      canDelete = requestUserProfile.hasPermission('usersNew')
    } else if (requestUserProfile.type === userProfilesModels.UserProfileType.Administrator) {
      if (requestedUserProfile.type === userProfilesModels.UserProfileType.Administrator) {
        canDelete = requestUserProfile.hasPermission('adminOtherAdmins')
      } else {
        canDelete = requestUserProfile.hasPermission('usersNew')
      }
    }
  }

  // Edit
  let canEdit = false
  if (!isSelf) {
    if (requestUserProfile.type === userProfilesModels.UserProfileType.System) {
      canEdit = true
    } else if (requestUserProfile.type === userProfilesModels.UserProfileType.Corporate) {
      canEdit = requestUserProfile.hasPermission('usersManagement')
    } else if (requestUserProfile.type === userProfilesModels.UserProfileType.Administrator) {
      if (requestedUserProfile.type === userProfilesModels.UserProfileType.Administrator) {
        canEdit = requestUserProfile.hasPermission('adminOtherAdmins')
      } else {
        canEdit = true
      }
    }
  }

  // See Permissions
  let canSeePermissions = false
  const profileWithoutPermissions = [
    userProfilesModels.UserProfileType.System,
    userProfilesModels.UserProfileType.CommissionAgent
  ].includes(requestedUserProfile.type)

  if (!isSelf && !profileWithoutPermissions) {
    if (requestUserProfile.type === userProfilesModels.UserProfileType.System) {
      canSeePermissions = true
    } else if (requestUserProfile.type === userProfilesModels.UserProfileType.Corporate) {
      canSeePermissions = requestUserProfile.hasPermission('usersManagement')
    } else if (requestUserProfile.type === userProfilesModels.UserProfileType.Administrator) {
      if (requestedUserProfile.type === userProfilesModels.UserProfileType.Administrator) {
        canSeePermissions = requestUserProfile.hasPermission('adminOtherAdmins')
      } else {
        canSeePermissions = true
      }
    }
  }

  return {
    canDelete,
    canEdit,
    canSeePermissions
  }
}

// =============================================================================
// ELIGIBLE PROFILES
// =============================================================================

export interface IUserProfileExtended extends userProfilesModels.IUserProfile {
  accessBlocked?: boolean
  blockReasons?: string[]
}

/**
 * Get eligible profiles for a user, checking for access blocks
 * (e.g., unpaid monthly charges)
 */
export async function getUserEligibleProfiles(
  user: mongoose.Document,
  selectedUserProfileId?: mongoose.Types.ObjectId
): Promise<mongoose.HydratedDocument<IUserProfileExtended>[]> {
  const filter: mongoose.FilterQuery<userProfilesModels.IUserProfile> = {
    user: user._id,
    isActive: true
  }

  if (selectedUserProfileId) {
    filter._id = selectedUserProfileId
  }

  const profiles = await userProfilesModels.UserProfile.find(filter).populate({
    path: 'client',
    populate: {
      path: 'costCentres',
      populate: [
        { path: 'monthlyCharges', match: { status: 'unpaid' } },
        { path: 'cluster' }
      ]
    }
  }) as mongoose.HydratedDocument<IUserProfileExtended>[]

  // Check for access blocks (unpaid charges)
  for (const profile of profiles) {
    if ([
      userProfilesModels.UserProfileType.System,
      userProfilesModels.UserProfileType.Corporate,
      userProfilesModels.UserProfileType.CommissionAgent
    ].includes(profile.type)) {
      profile.accessBlocked = false
      continue
    }

    // For Administrator and SubaccountManager, check client's cost centres
    const profileWithClient = profile as unknown as userProfilesModels.IAdministratorUserProfile | userProfilesModels.ISubaccountManagerUserProfile
    const client = profileWithClient.client as mongoose.Document & { costCentres?: Array<{ hasUnpaidMonthlyCharges?: () => boolean }> }

    let someCostCentreHasUnpaidCharges = false
    const blockReasons: string[] = []

    if (client?.costCentres) {
      for (const costCentre of client.costCentres) {
        if (costCentre.hasUnpaidMonthlyCharges?.()) {
          someCostCentreHasUnpaidCharges = true
          blockReasons.push('someCostCentreHasUnpaidCharges')
          break
        }
      }
    }

    profile.accessBlocked = someCostCentreHasUnpaidCharges
    profile.blockReasons = blockReasons
  }

  return profiles
}
