/**
 * Beneficiary Clusters Routes
 *
 * CRUD + add/remove beneficiaries for cluster groups.
 */

import { Router } from 'express';
import { beneficiaryClustersController } from '../controllers/beneficiaryClusters.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permissions.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/v1/beneficiary-clusters/colors
 * @desc    Get preset color palette
 * @access  Private - requires beneficiaries:read
 */
router.get(
  '/colors',
  requirePermission('beneficiaries:read'),
  beneficiaryClustersController.getColors
);

/**
 * @route   GET /api/v1/beneficiary-clusters
 * @desc    List clusters for a cost centre
 * @access  Private - requires beneficiaries:read
 */
router.get(
  '/',
  requirePermission('beneficiaries:read'),
  beneficiaryClustersController.getAll
);

/**
 * @route   GET /api/v1/beneficiary-clusters/:id
 * @desc    Get a specific cluster
 * @access  Private - requires beneficiaries:read
 */
router.get(
  '/:id',
  requirePermission('beneficiaries:read'),
  beneficiaryClustersController.getById
);

/**
 * @route   POST /api/v1/beneficiary-clusters
 * @desc    Create a new cluster
 * @access  Private - requires beneficiaries:create
 */
router.post(
  '/',
  requirePermission('beneficiaries:create'),
  beneficiaryClustersController.create
);

/**
 * @route   PUT /api/v1/beneficiary-clusters/:id
 * @desc    Update a cluster
 * @access  Private - requires beneficiaries:create
 */
router.put(
  '/:id',
  requirePermission('beneficiaries:create'),
  beneficiaryClustersController.update
);

/**
 * @route   DELETE /api/v1/beneficiary-clusters/:id
 * @desc    Soft-delete a cluster
 * @access  Private - requires beneficiaries:create
 */
router.delete(
  '/:id',
  requirePermission('beneficiaries:create'),
  beneficiaryClustersController.delete
);

/**
 * @route   POST /api/v1/beneficiary-clusters/:id/beneficiaries
 * @desc    Add beneficiaries to a cluster
 * @access  Private - requires beneficiaries:create
 */
router.post(
  '/:id/beneficiaries',
  requirePermission('beneficiaries:create'),
  beneficiaryClustersController.addBeneficiaries
);

/**
 * @route   DELETE /api/v1/beneficiary-clusters/:id/beneficiaries/:bid
 * @desc    Remove a beneficiary from a cluster
 * @access  Private - requires beneficiaries:create
 */
router.delete(
  '/:id/beneficiaries/:bid',
  requirePermission('beneficiaries:create'),
  beneficiaryClustersController.removeBeneficiary
);

export default router;
