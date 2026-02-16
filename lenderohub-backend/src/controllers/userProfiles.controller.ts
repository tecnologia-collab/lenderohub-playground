/**
 * UserProfiles Controller
 *
 * REST API endpoints for managing user profiles
 */

import { Request, Response } from 'express'

import { userProfilesService } from '../services/userProfiles/userProfiles.service'
import { UserProfileType, CommissionType } from '../models/userProfiles.model'
import {
  corporatePermissions,
  administratorPermissions,
  subaccountManagerPermissions,
  permissionLabels,
  permissionGroups
} from '../config/profilePermissions'

// =============================================================================
// PROFILES CRUD
// =============================================================================

/**
 * GET /api/v1/users/:userId/profiles
 * Get all profiles for a user
 */
export async function getProfilesForUser(req: Request, res: Response) {
  try {
    const { userId } = req.params

    const profiles = await userProfilesService.getProfilesForUser(userId)

    res.json({
      success: true,
      data: profiles
    })
  } catch (error: any) {
    console.error('Error getting profiles:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener perfiles'
    })
  }
}

/**
 * GET /api/v1/profiles/:profileId
 * Get a single profile by ID
 */
export async function getProfileById(req: Request, res: Response) {
  try {
    const { profileId } = req.params

    const profile = await userProfilesService.getProfileById(profileId)

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Perfil no encontrado'
      })
    }

    res.json({
      success: true,
      data: profile
    })
  } catch (error: any) {
    console.error('Error getting profile:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener perfil'
    })
  }
}

/**
 * POST /api/v1/users/:userId/profiles
 * Create a new profile for a user
 */
export async function createProfile(req: Request, res: Response) {
  try {
    const { userId } = req.params
    const { profileType, clientId, readOnly, commissionType, rfc } = req.body

    // Validate required fields
    if (!profileType) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el tipo de perfil'
      })
    }

    if (!clientId && profileType !== UserProfileType.System) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el cliente para este tipo de perfil'
      })
    }

    // Validate profile type
    if (!Object.values(UserProfileType).includes(profileType)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de perfil inválido'
      })
    }

    const profile = await userProfilesService.createProfile({
      userId,
      profileType,
      clientId,
      readOnly,
      commissionType,
      rfc
    })

    res.status(201).json({
      success: true,
      message: 'Perfil creado exitosamente',
      data: profile
    })
  } catch (error: any) {
    console.error('Error creating profile:', error)
    res.status(400).json({
      success: false,
      message: error.message || 'Error al crear perfil'
    })
  }
}

/**
 * DELETE /api/v1/profiles/:profileId
 * Deactivate a profile (soft delete)
 */
export async function deactivateProfile(req: Request, res: Response) {
  try {
    const { profileId } = req.params
    const requestingProfile = (req as any).userProfile

    if (!requestingProfile) {
      return res.status(401).json({
        success: false,
        message: 'Perfil de usuario no disponible'
      })
    }

    const profile = await userProfilesService.deactivateProfile(profileId, requestingProfile)

    res.json({
      success: true,
      message: 'Perfil desactivado exitosamente',
      data: profile
    })
  } catch (error: any) {
    console.error('Error deactivating profile:', error)
    res.status(400).json({
      success: false,
      message: error.message || 'Error al desactivar perfil'
    })
  }
}

/**
 * POST /api/v1/profiles/:profileId/reactivate
 * Reactivate a deactivated profile
 */
export async function reactivateProfile(req: Request, res: Response) {
  try {
    const { profileId } = req.params
    const requestingProfile = (req as any).userProfile

    if (!requestingProfile) {
      return res.status(401).json({
        success: false,
        message: 'Perfil de usuario no disponible'
      })
    }

    const profile = await userProfilesService.reactivateProfile(profileId, requestingProfile)

    res.json({
      success: true,
      message: 'Perfil reactivado exitosamente',
      data: profile
    })
  } catch (error: any) {
    console.error('Error reactivating profile:', error)
    res.status(400).json({
      success: false,
      message: error.message || 'Error al reactivar perfil'
    })
  }
}

// =============================================================================
// PERMISSIONS
// =============================================================================

/**
 * GET /api/v1/profiles/:profileId/permissions
 * Get permissions for a profile
 */
export async function getProfilePermissions(req: Request, res: Response) {
  try {
    const { profileId } = req.params

    const profile = await userProfilesService.getProfileById(profileId)

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Perfil no encontrado'
      })
    }

    // Get available permissions for this profile type
    let availablePermissions: readonly string[] = []
    switch (profile.type) {
      case UserProfileType.Corporate:
        availablePermissions = corporatePermissions
        break
      case UserProfileType.Administrator:
        availablePermissions = administratorPermissions
        break
      case UserProfileType.SubaccountManager:
        availablePermissions = subaccountManagerPermissions
        break
    }

    res.json({
      success: true,
      data: {
        profileId: profile._id,
        profileType: profile.type,
        permissions: profile.permissions || {},
        availablePermissions,
        permissionLabels,
        permissionGroups
      }
    })
  } catch (error: any) {
    console.error('Error getting permissions:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener permisos'
    })
  }
}

/**
 * PUT /api/v1/profiles/:profileId/permissions
 * Update permissions for a profile
 */
export async function updateProfilePermissions(req: Request, res: Response) {
  try {
    const { profileId } = req.params
    const { permissions } = req.body
    const requestingProfile = (req as any).userProfile

    if (!requestingProfile) {
      return res.status(401).json({
        success: false,
        message: 'Perfil de usuario no disponible'
      })
    }

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Se requieren los permisos a actualizar'
      })
    }

    const profile = await userProfilesService.updatePermissions(
      { profileId, permissions },
      requestingProfile
    )

    res.json({
      success: true,
      message: 'Permisos actualizados exitosamente',
      data: profile
    })
  } catch (error: any) {
    console.error('Error updating permissions:', error)
    res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar permisos'
    })
  }
}

/**
 * POST /api/v1/profiles/:profileId/permissions/set-all
 * Set all permissions to true or false
 */
export async function setAllPermissions(req: Request, res: Response) {
  try {
    const { profileId } = req.params
    const { value } = req.body
    const requestingProfile = (req as any).userProfile

    if (!requestingProfile) {
      return res.status(401).json({
        success: false,
        message: 'Perfil de usuario no disponible'
      })
    }

    if (typeof value !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un valor booleano'
      })
    }

    const profile = await userProfilesService.setAllPermissions(profileId, value, requestingProfile)

    res.json({
      success: true,
      message: value ? 'Todos los permisos activados' : 'Todos los permisos desactivados',
      data: profile
    })
  } catch (error: any) {
    console.error('Error setting all permissions:', error)
    res.status(400).json({
      success: false,
      message: error.message || 'Error al configurar permisos'
    })
  }
}

// =============================================================================
// SETTINGS
// =============================================================================

/**
 * PUT /api/v1/profiles/:profileId/settings
 * Update profile settings
 */
export async function updateProfileSettings(req: Request, res: Response) {
  try {
    const { profileId } = req.params
    const { settings } = req.body
    const requestingProfile = (req as any).userProfile

    if (!requestingProfile) {
      return res.status(401).json({
        success: false,
        message: 'Perfil de usuario no disponible'
      })
    }

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Se requieren los ajustes a actualizar'
      })
    }

    const profile = await userProfilesService.updateSettings(profileId, settings, requestingProfile)

    res.json({
      success: true,
      message: 'Ajustes actualizados exitosamente',
      data: profile
    })
  } catch (error: any) {
    console.error('Error updating settings:', error)
    res.status(400).json({
      success: false,
      message: error.message || 'Error al actualizar ajustes'
    })
  }
}

// =============================================================================
// FAVOURITES
// =============================================================================

/**
 * POST /api/v1/profiles/:profileId/favourites
 * Add a favourite
 */
export async function addFavourite(req: Request, res: Response) {
  try {
    const { profileId } = req.params
    const { type, itemId } = req.body

    if (!type || !itemId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el tipo y el ID del elemento'
      })
    }

    if (!['beneficiaries', 'costCentres', 'accounts'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de favorito inválido'
      })
    }

    const profile = await userProfilesService.updateFavourites(profileId, type, itemId, 'add')

    res.json({
      success: true,
      message: 'Favorito agregado exitosamente',
      data: profile
    })
  } catch (error: any) {
    console.error('Error adding favourite:', error)
    res.status(400).json({
      success: false,
      message: error.message || 'Error al agregar favorito'
    })
  }
}

/**
 * DELETE /api/v1/profiles/:profileId/favourites
 * Remove a favourite
 */
export async function removeFavourite(req: Request, res: Response) {
  try {
    const { profileId } = req.params
    const { type, itemId } = req.body

    if (!type || !itemId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere el tipo y el ID del elemento'
      })
    }

    if (!['beneficiaries', 'costCentres', 'accounts'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de favorito inválido'
      })
    }

    const profile = await userProfilesService.updateFavourites(profileId, type, itemId, 'remove')

    res.json({
      success: true,
      message: 'Favorito eliminado exitosamente',
      data: profile
    })
  } catch (error: any) {
    console.error('Error removing favourite:', error)
    res.status(400).json({
      success: false,
      message: error.message || 'Error al eliminar favorito'
    })
  }
}

// =============================================================================
// METADATA
// =============================================================================

/**
 * GET /api/v1/profiles/metadata
 * Get profile types, permission definitions, etc.
 */
export async function getProfileMetadata(_req: Request, res: Response) {
  try {
    res.json({
      success: true,
      data: {
        profileTypes: Object.values(UserProfileType),
        commissionTypes: Object.values(CommissionType),
        permissions: {
          corporate: corporatePermissions,
          administrator: administratorPermissions,
          subaccountManager: subaccountManagerPermissions
        },
        permissionLabels,
        permissionGroups
      }
    })
  } catch (error: any) {
    console.error('Error getting metadata:', error)
    res.status(500).json({
      success: false,
      message: 'Error al obtener metadata'
    })
  }
}
