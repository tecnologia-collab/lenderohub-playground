import { Router } from 'express'

import { commissionAgentsController } from '../controllers/commissionAgents.controller'
import { authenticateToken } from '../middlewares/auth.middleware'
import { requirePermission } from '../middlewares/permissions.middleware'
import { commissionRequestUpload } from '../middlewares/upload.middleware'

const router = Router()

router.use(authenticateToken)

router.post('/commission-requests', requirePermission('transactions:create'), commissionRequestUpload, commissionAgentsController.createCommissionRequest)
router.get('/commission-requests', requirePermission('transactions:read'), commissionAgentsController.getCommissionRequests)
router.put('/commission-requests/:id/approve', requirePermission('transactions:create'), commissionAgentsController.approveCommissionRequest)
router.put('/commission-requests/:id/reject', requirePermission('transactions:create'), commissionAgentsController.rejectCommissionRequest)

export default router
