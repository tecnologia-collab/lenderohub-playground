// src/routes/costCentres.routes.ts

import { Router } from 'express'
import { costCentresController, constanciaUpload } from '../controllers/costCentres.controller'
import { authenticateToken } from '../middlewares/auth.middleware'
import { requirePermission } from '../middlewares/permissions.middleware'

const router = Router()

// All routes require authentication
router.use(authenticateToken)

// ============================================================================
// COST CENTRES ROUTES
// ============================================================================

/**
 * GET /api/cost-centres
 * Get all cost centres for the authenticated user's client
 * Query: includeDisabled, includeAccounts
 * Note: clientId is obtained from the authenticated user
 */
router.get('/', requirePermission('cost_centres:read'), costCentresController.getCostCentres)

/**
 * POST /api/cost-centres
 * Create a new cost centre
 * Body: alias, shortName, provider?, isDefault?, transactionProfile?,
 *       commercialRules?, cashManagementEnabled?, clusterId?, createFincoAccount?,
 *       contact?, rfc?, fiscalAddress?
 * Note: clientId is obtained from the authenticated user
 */
router.post('/', requirePermission('cost_centres:create'), costCentresController.createCostCentre)

/**
 * POST /api/cost-centres/parse-constancia
 * Parse a Constancia de Situación Fiscal PDF and extract fiscal data
 */
router.post('/parse-constancia', authenticateToken, constanciaUpload.single('file'), costCentresController.parseConstancia)

/**
 * GET /api/cost-centres/:id
 * Get a specific cost centre
 * Query: includeAccounts
 */
router.get('/:id', requirePermission('cost_centres:read'), costCentresController.getCostCentre)

/**
 * GET /api/cost-centres/:id/stats
 * Get statistics for a cost centre
 */
router.get('/:id/stats', requirePermission('cost_centres:read'), costCentresController.getCostCentreStats)

/**
 * GET /api/cost-centres/:id/accumulators
 * Get current month's accumulators for a cost centre
 */
router.get('/:id/accumulators', requirePermission('cost_centres:read'), costCentresController.getCostCentreAccumulators)

/**
 * PUT /api/cost-centres/:id
 * Update a cost centre
 * Body: alias?, shortName?, transactionProfile?, commercialRules?,
 *       cashManagementEnabled?, clusterId?
 */
router.put('/:id', requirePermission('cost_centres:update'), costCentresController.updateCostCentre)

/**
 * POST /api/cost-centres/:id/disable
 * Disable (soft delete) a cost centre
 */
router.post('/:id/disable', requirePermission('cost_centres:manage'), costCentresController.disableCostCentre)

/**
 * POST /api/cost-centres/:id/enable
 * Re-enable a disabled cost centre
 */
router.post('/:id/enable', requirePermission('cost_centres:manage'), costCentresController.enableCostCentre)

/**
 * POST /api/cost-centres/:id/set-default
 * Set a cost centre as default for its client
 */
router.post('/:id/set-default', requirePermission('cost_centres:manage'), costCentresController.setAsDefault)

export default router
