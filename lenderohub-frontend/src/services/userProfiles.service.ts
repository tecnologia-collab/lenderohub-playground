/**
 * UserProfiles Service
 *
 * Handles API calls for the granular permissions system
 */

import { api } from '@/lib/api'

// =============================================================================
// TYPES
// =============================================================================

export type UserProfileType = 'system' | 'corporate' | 'administrator' | 'subaccountManager' | 'commissionAgent'
export type CommissionType = 'resico' | 'entrepreneurialActivity' | 'juridicalPerson'

export interface PermissionGroup {
  label: string
  permissions: string[]
}

export interface ProfileMetadata {
  profileTypes: UserProfileType[]
  commissionTypes: CommissionType[]
  permissions: Record<string, string[]>
  permissionLabels: Record<string, string>
  permissionGroups: Record<string, PermissionGroup>
}

export interface UserProfile {
  _id: string
  type: UserProfileType
  user: string
  client: {
    _id: string
    name: string
    alias?: string
    type: string
  }
  isActive: boolean
  permissions: Record<string, boolean>
  settings?: Record<string, boolean>
  favourites?: {
    beneficiaries: string[]
    costCentres: string[]
    accounts: string[]
  }
  subaccountGroups?: Array<{
    name: string
    subaccountIds: string[]
  }>
  createdAt: string
  updatedAt: string
}

export interface ProfilePermissionsResponse {
  profileId: string
  profileType: UserProfileType
  permissions: Record<string, boolean>
  availablePermissions: string[]
  permissionLabels: Record<string, string>
  permissionGroups: Record<string, PermissionGroup>
}

export interface CreateProfileRequest {
  profileType: UserProfileType
  clientId: string
  readOnly?: boolean
  commissionType?: CommissionType
  rfc?: string
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class UserProfilesService {
  private metadataCache: ProfileMetadata | null = null

  /**
   * Get profile metadata (types, permissions, labels, groups)
   * Cached after first fetch
   */
  async getMetadata(): Promise<ProfileMetadata> {
    if (this.metadataCache) {
      return this.metadataCache
    }

    const response = await api.get<{ success: boolean; data: ProfileMetadata }>('/metadata')
    if (response.success) {
      this.metadataCache = response.data
    }
    return response.data
  }

  /**
   * Clear metadata cache (useful after permission structure changes)
   */
  clearMetadataCache(): void {
    this.metadataCache = null
  }

  /**
   * Get all profiles for a user
   */
  async getProfilesForUser(userId: string): Promise<UserProfile[]> {
    const response = await api.get<{ success: boolean; data: UserProfile[] }>(
      `/users/${userId}/profiles`
    )
    return response.data
  }

  /**
   * Create a new profile for a user
   */
  async createProfile(userId: string, data: CreateProfileRequest): Promise<UserProfile> {
    const response = await api.post<{ success: boolean; data: UserProfile }>(
      `/users/${userId}/profiles`,
      data
    )
    return response.data
  }

  /**
   * Get permissions for a specific profile with metadata
   */
  async getProfilePermissions(profileId: string): Promise<ProfilePermissionsResponse> {
    const response = await api.get<{ success: boolean; data: ProfilePermissionsResponse }>(
      `/profiles/${profileId}/permissions`
    )
    return response.data
  }

  /**
   * Update specific permissions for a profile
   */
  async updateProfilePermissions(
    profileId: string,
    permissions: Record<string, boolean>
  ): Promise<UserProfile> {
    const response = await api.put<{ success: boolean; data: UserProfile }>(
      `/profiles/${profileId}/permissions`,
      { permissions }
    )
    return response.data
  }

  /**
   * Set all permissions to a specific value
   */
  async setAllPermissions(profileId: string, value: boolean): Promise<UserProfile> {
    const response = await api.post<{ success: boolean; data: UserProfile }>(
      `/profiles/${profileId}/permissions/set-all`,
      { value }
    )
    return response.data
  }

  /**
   * Get a single profile by ID
   */
  async getProfile(profileId: string): Promise<UserProfile> {
    const response = await api.get<{ success: boolean; data: UserProfile }>(
      `/profiles/${profileId}`
    )
    return response.data
  }

  /**
   * Deactivate a profile
   */
  async deactivateProfile(profileId: string): Promise<UserProfile> {
    const response = await api.delete<{ success: boolean; data: UserProfile }>(
      `/profiles/${profileId}`
    )
    return response.data
  }

  /**
   * Reactivate a profile
   */
  async reactivateProfile(profileId: string): Promise<UserProfile> {
    const response = await api.post<{ success: boolean; data: UserProfile }>(
      `/profiles/${profileId}/reactivate`
    )
    return response.data
  }

  /**
   * Update profile settings
   */
  async updateProfileSettings(
    profileId: string,
    settings: Record<string, boolean>
  ): Promise<UserProfile> {
    const response = await api.put<{ success: boolean; data: UserProfile }>(
      `/profiles/${profileId}/settings`,
      { settings }
    )
    return response.data
  }
}

// Export singleton instance
export const userProfilesService = new UserProfilesService()
