/**
 * Users Routes
 *
 * /api/users/*
 */

import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permissions.middleware';
import { commissionAgentUpload } from '../middlewares/upload.middleware';
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  updateMe,
  deactivateUser,
  reactivateUser,
  reset2FA,
  resetPassword,
  getUserStats,
  getCreatableRolesForUser,
  findUserByEmail,
  assignRole,
  getUserFormOptions,
} from '../controllers/users.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// Routes
// ============================================

// GET /api/users/stats - Get user statistics
router.get('/stats', requirePermission('users:read'), getUserStats);

// GET /api/users/roles - Get roles the current user can create
router.get('/roles', requirePermission('users:create'), getCreatableRolesForUser);

// GET /api/users/form-options - Form options for creation
router.get('/form-options', requirePermission('users:create'), getUserFormOptions);

// PUT /api/users/me - Update own profile (no permission required, just auth)
router.put('/me', updateMe);

// GET /api/users - List all users
router.get('/', requirePermission('users:read'), getUsers);

// POST /api/users - Create a new user
router.post('/', requirePermission('users:create'), commissionAgentUpload, createUser);

// POST /api/users/find-by-email - Find user for onboarding
router.post('/find-by-email', requirePermission('users:create'), findUserByEmail);

// GET /api/users/:id - Get a single user
router.get('/:id', requirePermission('users:read'), getUser);

// PUT /api/users/:id - Update a user
router.put('/:id', requirePermission('users:update'), updateUser);

// POST /api/users/:id/assign-role - Assign role to existing user
router.post('/:id/assign-role', requirePermission('users:update'), commissionAgentUpload, assignRole);

// POST /api/users/:id/deactivate - Deactivate a user
router.post('/:id/deactivate', requirePermission('users:delete'), deactivateUser);

// POST /api/users/:id/reactivate - Reactivate a user
router.post('/:id/reactivate', requirePermission('users:update'), reactivateUser);

// POST /api/users/:id/reset-2fa - Reset user's 2FA
router.post('/:id/reset-2fa', requirePermission('users:update'), reset2FA);

// POST /api/users/:id/reset-password - Reset user's password
router.post('/:id/reset-password', requirePermission('users:update'), resetPassword);

export default router;
