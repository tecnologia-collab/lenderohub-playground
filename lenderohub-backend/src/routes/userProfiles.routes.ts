/**
 * UserProfiles Routes
 *
 * REST API routes for managing user profiles
 */

import { Router } from 'express'

import {
  getProfilesForUser,
  getProfileById,
  createProfile,
  deactivateProfile,
  reactivateProfile,
  getProfilePermissions,
  updateProfilePermissions,
  setAllPermissions,
  updateProfileSettings,
  addFavourite,
  removeFavourite,
  getProfileMetadata
} from '../controllers/userProfiles.controller'
import { authMiddleware, loadUserProfile } from '../middlewares/auth.middleware'

const router = Router()

// All routes require authentication and profile loading
router.use(authMiddleware)
router.use(loadUserProfile)

// =============================================================================
// METADATA (no profile required)
// =============================================================================

// GET /api/v1/profiles/metadata - Get profile types, permissions, etc.
router.get('/metadata', getProfileMetadata)

// =============================================================================
// USER PROFILES
// =============================================================================

// GET /api/v1/users/:userId/profiles - Get all profiles for a user
router.get('/users/:userId/profiles', getProfilesForUser)

// POST /api/v1/users/:userId/profiles - Create a new profile for a user
router.post('/users/:userId/profiles', createProfile)

// =============================================================================
// SINGLE PROFILE OPERATIONS
// =============================================================================

// GET /api/v1/profiles/:profileId - Get a single profile
router.get('/profiles/:profileId', getProfileById)

// DELETE /api/v1/profiles/:profileId - Deactivate a profile
router.delete('/profiles/:profileId', deactivateProfile)

// POST /api/v1/profiles/:profileId/reactivate - Reactivate a profile
router.post('/profiles/:profileId/reactivate', reactivateProfile)

// =============================================================================
// PERMISSIONS
// =============================================================================

// GET /api/v1/profiles/:profileId/permissions - Get profile permissions
router.get('/profiles/:profileId/permissions', getProfilePermissions)

// PUT /api/v1/profiles/:profileId/permissions - Update profile permissions
router.put('/profiles/:profileId/permissions', updateProfilePermissions)

// POST /api/v1/profiles/:profileId/permissions/set-all - Set all permissions to true/false
router.post('/profiles/:profileId/permissions/set-all', setAllPermissions)

// =============================================================================
// SETTINGS
// =============================================================================

// PUT /api/v1/profiles/:profileId/settings - Update profile settings
router.put('/profiles/:profileId/settings', updateProfileSettings)

// =============================================================================
// FAVOURITES
// =============================================================================

// POST /api/v1/profiles/:profileId/favourites - Add a favourite
router.post('/profiles/:profileId/favourites', addFavourite)

// DELETE /api/v1/profiles/:profileId/favourites - Remove a favourite
router.delete('/profiles/:profileId/favourites', removeFavourite)

export default router
