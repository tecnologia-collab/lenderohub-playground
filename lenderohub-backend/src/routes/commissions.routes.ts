import { Router } from 'express'

import { commissionsController } from '../controllers/commissions.controller'
import { authenticateToken } from '../middlewares/auth.middleware'
import { requirePermission } from '../middlewares/permissions.middleware'

const router = Router()

router.use(authenticateToken)

router.get('/ceco/dashboard', requirePermission('cost_centres:read'), commissionsController.getDashboard)
router.get('/ceco/centres', requirePermission('cost_centres:read'), commissionsController.getCostCentres)
router.get('/ceco/transfers', requirePermission('transactions:read'), commissionsController.getTransfers)
router.get('/ceco/monthly-charges-transfers', requirePermission('transactions:read'), commissionsController.getMonthlyChargesTransfers)
router.get('/ceco/collection', requirePermission('cost_centres:read'), commissionsController.getCollection)
router.post('/ceco/transfer', requirePermission('transactions:create'), commissionsController.transferToCorporate)
router.post('/ceco/collect', requirePermission('transactions:create'), commissionsController.collectByTag)

export default router
