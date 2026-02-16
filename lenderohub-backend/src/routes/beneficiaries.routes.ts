/**
 * Beneficiaries Routes
 * 
 * Routes for beneficiary (instrument) management
 */

import { Router } from 'express';
import { beneficiariesController } from '../controllers/beneficiaries.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permissions.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/v1/beneficiaries
 * @desc    Get all beneficiaries for the authenticated user
 * @access  Private
 */
router.get('/', requirePermission('beneficiaries:read'), beneficiariesController.getBeneficiaries);

/**
 * @route   GET /api/v1/beneficiaries/:id
 * @desc    Get a specific beneficiary by ID
 * @access  Private
 */
router.get('/:id', requirePermission('beneficiaries:read'), beneficiariesController.getBeneficiary);

/**
 * @route   POST /api/v1/beneficiaries
 * @desc    Create a new beneficiary (instrument)
 * @access  Private
 */
router.post('/', requirePermission('beneficiaries:create'), beneficiariesController.createBeneficiary);

/**
 * @route   POST /api/v1/beneficiaries/:id/verify
 * @desc    Initiate penny validation (account verification) for a beneficiary
 * @access  Private
 */
router.post('/:id/verify', requirePermission('beneficiaries:update'), beneficiariesController.verify);

/**
 * @route   GET /api/v1/beneficiaries/:id/verification-status
 * @desc    Get the current verification status for a beneficiary
 * @access  Private
 */
router.get('/:id/verification-status', requirePermission('beneficiaries:read'), beneficiariesController.getVerificationStatus);

/**
 * @route   DELETE /api/v1/beneficiaries/:id
 * @desc    Delete a beneficiary
 * @access  Private
 */
router.delete('/:id', requirePermission('beneficiaries:delete'), beneficiariesController.deleteBeneficiary);

export default router;
