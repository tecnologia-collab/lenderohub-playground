import { Router } from 'express'
import * as monthlyChargesController from '../controllers/monthlyCharges.controller'
import { authenticateToken } from '../middlewares/auth.middleware'
import { requirePermission } from '../middlewares/permissions.middleware'

const router = Router()

// All routes require authentication
router.use(authenticateToken)

/**
 * POST /api/v1/monthly-charges/execute
 * Execute monthly charges job manually
 * Permission: cost_centres:update or admin
 */
router.post(
  '/execute',
  requirePermission(['cost_centres:update']),
  monthlyChargesController.executeMonthlyCharges
)

/**
 * GET /api/v1/monthly-charges/status
 * Get status of last monthly charges execution
 * Permission: cost_centres:read
 */
router.get(
  '/status',
  requirePermission(['cost_centres:read']),
  monthlyChargesController.getMonthlyChargesStatus
)

export default router
