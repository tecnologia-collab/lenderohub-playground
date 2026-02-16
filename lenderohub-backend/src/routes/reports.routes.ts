import { Router } from 'express'

import { reportsController } from '../controllers/reports.controller'
import { authenticateToken } from '../middlewares/auth.middleware'
import { requirePermission } from '../middlewares/permissions.middleware'

const router = Router()

router.use(authenticateToken)

router.get('/transactions', requirePermission('transactions:read'), reportsController.getTransactions)
router.get('/summary', requirePermission('transactions:read'), reportsController.getSummary)
router.get('/commissions', requirePermission('transactions:read'), reportsController.getCommissions)
router.get('/export', requirePermission('transactions:read'), reportsController.exportReport)

export default router
