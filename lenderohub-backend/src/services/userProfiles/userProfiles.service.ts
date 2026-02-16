/**
 * UserProfiles Service
 *
 * Handles all business logic for user profiles:
 * - CRUD operations for profiles
 * - Permission management
 * - Profile switching
 */

import mongoose from 'mongoose'

import {
  UserProfile,
  UserProfileType,
  SystemUserProfile,
  CorporateUserProfile,
  AdministratorUserProfile,
  SubaccountManagerUserProfile,
  CommissionAgentUserProfile,
  CommissionType,
  type IUserProfile,
  type ICorporateUserProfile,
  type IAdministratorUserProfile,
  type ISubaccountManagerUserProfile,
  type ICommissionAgentUserProfile,
  corporatePermissions,
  administratorPermissions,
  subaccountManagerPermissions,
  defaultSubaccountGroups
} from '../../models/userProfiles.model'
import { CorporateClient, RegularClient } from '../../models/clients.model'
import { UserModel, type IUser } from '../../models/user.model'
import {
  corporatePermissionDefaults,
  administratorPermissionDefaults,
  subaccountManagerPermissionDefaults
} from '../../config/profilePermissions'

// =============================================================================
// TYPES
// =============================================================================

export interface CreateProfileOptions {
  userId: string
  profileType: UserProfileType
  clientId: string
  readOnly?: boolean
  commissionType?: CommissionType
  rfc?: string
}

export interface UpdatePermissionsOptions {
  profileId: string
  permissions: Record<string, boolean>
}

export interface ProfileWithUser extends IUserProfile {
  user: IUser
}

// =============================================================================
// SERVICE
// =============================================================================

class UserProfilesService {
  /**
   * Create a new profile for a user
   */
  async createProfile(options: CreateProfileOptions, session?: mongoose.ClientSession): Promise<mongoose.HydratedDocument<IUserProfile>> {
    const { userId, profileType, clientId, readOnly, commissionType, rfc } = options

    // Validate user exists
    const user = await UserModel.findById(userId).session(session ?? null)
    if (!user) {
      throw new Error('Usuario no encontrado')
    }

    // Validate client exists and matches profile type
    const client = await this.validateClientForProfileType(clientId, profileType, session)

    // Check if profile already exists for this user + client combination
    const existingProfile = await UserProfile.findOne({
      user: userId,
      client: clientId,
      type: profileType,
      isActive: true
    }).session(session ?? null)

    if (existingProfile) {
      throw new Error('El usuario ya tiene un perfil activo de este tipo para este cliente')
    }

    // Create profile based on type
    let profile: mongoose.HydratedDocument<IUserProfile>

    switch (profileType) {
      case UserProfileType.System:
        profile = new SystemUserProfile({
          user: userId,
          isActive: true
        })
        break

      case UserProfileType.Corporate:
        profile = new CorporateUserProfile({
          user: userId,
          client: clientId,
          isActive: true,
          permissions: readOnly ? this.getReadOnlyPermissions(corporatePermissions) : { ...corporatePermissionDefaults },
          subaccountGroups: [...defaultSubaccountGroups],
          settings: {
            speiInOwnAccounts: true,
            speiOutOwnAccounts: true,
            betweenOwnAccounts: true,
            commissionRequests: true
          },
          favourites: {
            beneficiaries: [],
            costCentres: [],
            accounts: []
          }
        })
        break

      case UserProfileType.Administrator:
        profile = new AdministratorUserProfile({
          user: userId,
          client: clientId,
          isActive: true,
          permissions: readOnly ? this.getReadOnlyPermissions(administratorPermissions) : { ...administratorPermissionDefaults },
          subaccountGroups: [...defaultSubaccountGroups],
          settings: {
            speiInOwnAccounts: true,
            speiOutOwnAccounts: true,
            betweenOwnAccounts: true,
            commissionRequests: true
          },
          favourites: {
            beneficiaries: [],
            costCentres: [],
            accounts: []
          }
        })
        break

      case UserProfileType.SubaccountManager:
        profile = new SubaccountManagerUserProfile({
          user: userId,
          client: clientId,
          isActive: true,
          permissions: readOnly ? this.getReadOnlyPermissions(subaccountManagerPermissions) : { ...subaccountManagerPermissionDefaults },
          subaccountGroups: [...defaultSubaccountGroups],
          settings: {
            speiInOwnAccounts: true,
            speiOutOwnAccounts: true,
            betweenOwnAccounts: true,
            commissionRequests: true
          },
          favourites: {
            beneficiaries: [],
            costCentres: [],
            accounts: []
          }
        })
        break

      case UserProfileType.CommissionAgent:
        if (!commissionType) {
          throw new Error('Se requiere el tipo de comisión para crear un perfil de comisionista')
        }
        profile = new CommissionAgentUserProfile({
          user: userId,
          client: clientId,
          isActive: true,
          commissionType,
          rfc,
          settings: {
            commissionRequests: true
          },
          previousIdentificationDocuments: [],
          previousFinancialStatements: [],
          previousProofsOfAddress: []
        })
        break

      default:
        throw new Error(`Tipo de perfil no soportado: ${profileType}`)
    }

    await profile.save({ session })
    return profile
  }

  /**
   * Get all profiles for a user
   */
  async getProfilesForUser(userId: string): Promise<mongoose.HydratedDocument<IUserProfile>[]> {
    const profiles = await UserProfile.find({
      user: userId,
      isActive: true
    }).populate('client')

    return profiles
  }

  /**
   * Get a single profile by ID
   */
  async getProfileById(profileId: string): Promise<mongoose.HydratedDocument<IUserProfile> | null> {
    const profile = await UserProfile.findById(profileId)
      .populate('user')
      .populate('client')

    return profile
  }

  /**
   * Get profile with full user data
   */
  async getProfileWithUser(profileId: string): Promise<ProfileWithUser | null> {
    const profile = await UserProfile.findById(profileId)
      .populate('user')
      .populate('client')

    if (!profile) return null

    return profile as unknown as ProfileWithUser
  }

  /**
   * Update profile permissions
   */
  async updatePermissions(
    options: UpdatePermissionsOptions,
    requestingProfile: mongoose.HydratedDocument<IUserProfile>
  ): Promise<mongoose.HydratedDocument<IUserProfile>> {
    const { profileId, permissions } = options

    const profile = await UserProfile.findById(profileId)
    if (!profile) {
      throw new Error('Perfil no encontrado')
    }

    // Validate requesting profile can edit this profile's permissions
    const canEdit = this.canEditPermissions(requestingProfile, profile)
    if (!canEdit) {
      throw new Error('No tienes permiso para editar los permisos de este perfil')
    }

    // Get valid permissions for this profile type
    const validPermissions = this.getValidPermissionsForType(profile.type)
    if (!validPermissions) {
      throw new Error('Este tipo de perfil no tiene permisos configurables')
    }

    // Filter and validate permissions
    const filteredPermissions: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(permissions)) {
      if (validPermissions.includes(key)) {
        filteredPermissions[key] = Boolean(value)
      }
    }

    // Update permissions
    profile.permissions = { ...profile.permissions, ...filteredPermissions }
    await profile.save()

    return profile
  }

  /**
   * Set all permissions to a specific value (for readOnly toggle)
   */
  async setAllPermissions(
    profileId: string,
    value: boolean,
    requestingProfile: mongoose.HydratedDocument<IUserProfile>
  ): Promise<mongoose.HydratedDocument<IUserProfile>> {
    const profile = await UserProfile.findById(profileId)
    if (!profile) {
      throw new Error('Perfil no encontrado')
    }

    const canEdit = this.canEditPermissions(requestingProfile, profile)
    if (!canEdit) {
      throw new Error('No tienes permiso para editar los permisos de este perfil')
    }

    const validPermissions = this.getValidPermissionsForType(profile.type)
    if (!validPermissions) {
      throw new Error('Este tipo de perfil no tiene permisos configurables')
    }

    const newPermissions: Record<string, boolean> = {}
    for (const perm of validPermissions) {
      newPermissions[perm] = value
    }

    profile.permissions = newPermissions
    await profile.save()

    return profile
  }

  /**
   * Deactivate a profile (soft delete)
   */
  async deactivateProfile(
    profileId: string,
    requestingProfile: mongoose.HydratedDocument<IUserProfile>
  ): Promise<mongoose.HydratedDocument<IUserProfile>> {
    const profile = await UserProfile.findById(profileId)
    if (!profile) {
      throw new Error('Perfil no encontrado')
    }

    // Can't deactivate own profile
    if (profile._id.toString() === requestingProfile._id.toString()) {
      throw new Error('No puedes desactivar tu propio perfil')
    }

    // Validate permissions to deactivate
    const canDelete = this.canDeleteProfile(requestingProfile, profile)
    if (!canDelete) {
      throw new Error('No tienes permiso para desactivar este perfil')
    }

    profile.isActive = false
    await profile.save()

    return profile
  }

  /**
   * Reactivate a profile
   */
  async reactivateProfile(
    profileId: string,
    requestingProfile: mongoose.HydratedDocument<IUserProfile>
  ): Promise<mongoose.HydratedDocument<IUserProfile>> {
    const profile = await UserProfile.findById(profileId)
    if (!profile) {
      throw new Error('Perfil no encontrado')
    }

    // Validate permissions
    if (requestingProfile.type !== UserProfileType.System &&
        requestingProfile.type !== UserProfileType.Corporate) {
      throw new Error('No tienes permiso para reactivar perfiles')
    }

    profile.isActive = true
    await profile.save()

    return profile
  }

  /**
   * Update profile settings (notifications)
   */
  async updateSettings(
    profileId: string,
    settings: Record<string, any>,
    requestingProfile: mongoose.HydratedDocument<IUserProfile>
  ): Promise<mongoose.HydratedDocument<IUserProfile>> {
    const profile = await UserProfile.findById(profileId)
    if (!profile) {
      throw new Error('Perfil no encontrado')
    }

    // Only self can update settings
    const isSelf = profile._id.toString() === requestingProfile._id.toString()
    if (!isSelf) {
      throw new Error('Solo puedes actualizar tus propios ajustes')
    }

    // Type-safe settings update based on profile type
    const profileWithSettings = profile as any
    if (profileWithSettings.settings) {
      profileWithSettings.settings = { ...profileWithSettings.settings, ...settings }
      profileWithSettings.markModified('settings')
    }

    await profile.save()
    return profile
  }

  /**
   * Add/remove favourites
   */
  async updateFavourites(
    profileId: string,
    favouriteType: 'beneficiaries' | 'costCentres' | 'accounts',
    itemId: string,
    action: 'add' | 'remove'
  ): Promise<mongoose.HydratedDocument<IUserProfile>> {
    const profile = await UserProfile.findById(profileId)
    if (!profile) {
      throw new Error('Perfil no encontrado')
    }

    // Check if profile type supports favourites
    if (![UserProfileType.Corporate, UserProfileType.Administrator, UserProfileType.SubaccountManager].includes(profile.type)) {
      throw new Error('Este tipo de perfil no soporta favoritos')
    }

    const profileWithFavourites = profile as unknown as ICorporateUserProfile | IAdministratorUserProfile | ISubaccountManagerUserProfile

    const objectId = new mongoose.Types.ObjectId(itemId)

    if (action === 'add') {
      if (!profileWithFavourites.favourites[favouriteType].some(id => id.equals(objectId))) {
        profileWithFavourites.favourites[favouriteType].push(objectId)
      }
    } else {
      profileWithFavourites.favourites[favouriteType] = profileWithFavourites.favourites[favouriteType].filter(
        id => !id.equals(objectId)
      )
    }

    await profile.save()
    return profile
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private async validateClientForProfileType(
    clientId: string,
    profileType: UserProfileType,
    session?: mongoose.ClientSession
  ): Promise<mongoose.Document> {
    if (profileType === UserProfileType.System) {
      // System profiles don't need a client
      return null as any
    }

    if (profileType === UserProfileType.Corporate || profileType === UserProfileType.CommissionAgent) {
      const client = await CorporateClient.findById(clientId).session(session ?? null)
      if (!client) {
        throw new Error('Cliente corporativo no encontrado')
      }
      return client
    }

    // Administrator and SubaccountManager need RegularClient
    const client = await RegularClient.findById(clientId).session(session ?? null)
    if (!client) {
      throw new Error('Cliente regular no encontrado')
    }
    return client
  }

  private getReadOnlyPermissions(permissions: readonly string[]): Record<string, boolean> {
    const result: Record<string, boolean> = {}
    for (const perm of permissions) {
      result[perm] = false
    }
    return result
  }

  private getValidPermissionsForType(type: UserProfileType): readonly string[] | null {
    switch (type) {
      case UserProfileType.Corporate:
        return corporatePermissions
      case UserProfileType.Administrator:
        return administratorPermissions
      case UserProfileType.SubaccountManager:
        return subaccountManagerPermissions
      default:
        return null
    }
  }

  private canEditPermissions(
    requestingProfile: mongoose.HydratedDocument<IUserProfile>,
    targetProfile: mongoose.HydratedDocument<IUserProfile>
  ): boolean {
    // Can't edit own permissions
    if (requestingProfile._id.toString() === targetProfile._id.toString()) {
      return false
    }

    // System can edit all
    if (requestingProfile.type === UserProfileType.System) {
      return true
    }

    // Corporate can edit if has usersManagement permission
    if (requestingProfile.type === UserProfileType.Corporate) {
      return requestingProfile.hasPermission('usersManagement')
    }

    // Administrator can edit SubaccountManager, and other Admins if has adminOtherAdmins
    if (requestingProfile.type === UserProfileType.Administrator) {
      if (targetProfile.type === UserProfileType.SubaccountManager) {
        return true
      }
      if (targetProfile.type === UserProfileType.Administrator) {
        return requestingProfile.hasPermission('adminOtherAdmins')
      }
    }

    return false
  }

  private canDeleteProfile(
    requestingProfile: mongoose.HydratedDocument<IUserProfile>,
    targetProfile: mongoose.HydratedDocument<IUserProfile>
  ): boolean {
    // System can delete all
    if (requestingProfile.type === UserProfileType.System) {
      return true
    }

    // Corporate can delete if has usersNew permission
    if (requestingProfile.type === UserProfileType.Corporate) {
      return requestingProfile.hasPermission('usersNew')
    }

    // Administrator can delete SubaccountManager if has usersNew, or other Admins if has adminOtherAdmins
    if (requestingProfile.type === UserProfileType.Administrator) {
      if (targetProfile.type === UserProfileType.SubaccountManager) {
        return requestingProfile.hasPermission('usersNew')
      }
      if (targetProfile.type === UserProfileType.Administrator) {
        return requestingProfile.hasPermission('adminOtherAdmins')
      }
    }

    return false
  }
}

export const userProfilesService = new UserProfilesService()
