import { Router } from 'express'
import { virtualBagsController } from '../controllers/cashBags.controller'
import { authenticateToken } from '../middlewares/auth.middleware'
import { requirePermission } from '../middlewares/permissions.middleware'

const router = Router()

// All routes require authentication
router.use(authenticateToken)

// ============================================================================
// VIRTUAL BAGS ROUTES
// ============================================================================

router.get('/', requirePermission('subaccounts:read'), virtualBagsController.getVirtualBags)
router.post('/', requirePermission('subaccounts:create'), virtualBagsController.createVirtualBag)
router.get('/stats', requirePermission('subaccounts:read'), virtualBagsController.getStats)
router.get('/total-balance', requirePermission('subaccounts:read'), virtualBagsController.getTotalBalance)
router.post('/transfer', requirePermission('subaccounts:transfer'), virtualBagsController.transfer)
router.get('/:id', requirePermission('subaccounts:read'), virtualBagsController.getVirtualBag)
router.patch('/:id', requirePermission('subaccounts:update'), virtualBagsController.updateVirtualBag)
router.delete('/:id', requirePermission('subaccounts:update'), virtualBagsController.deleteVirtualBag)
router.get('/:id/movements', requirePermission('subaccounts:read'), virtualBagsController.getMovements)
router.post('/:id/users', requirePermission('subaccounts:update'), virtualBagsController.assignUsers)
router.post('/:id/users/remove', requirePermission('subaccounts:update'), virtualBagsController.removeUsers)

export default router
