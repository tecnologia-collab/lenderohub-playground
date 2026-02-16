import { Router } from 'express'
import { authenticateToken } from '../middlewares/auth.middleware'
import { requirePermission } from '../middlewares/permissions.middleware'
import { subaccountsController } from '../controllers/subaccounts.controller'

const router = Router()

router.use(authenticateToken)

router.get('/', requirePermission('subaccounts:read'), subaccountsController.getSubaccounts)
router.post('/', requirePermission('subaccounts:create'), subaccountsController.createSubaccount)

// Single subaccount
router.get('/:id', requirePermission('subaccounts:read'), subaccountsController.getSubaccount)

// Virtual bags within a subaccount (Cash Management)
router.get('/:id/virtual-bags', requirePermission('subaccounts:read'), subaccountsController.getVirtualBags)
router.post('/:id/virtual-bags', requirePermission('subaccounts:create'), subaccountsController.createVirtualBag)
router.patch('/:id/virtual-bags/:bagId', requirePermission('subaccounts:create'), subaccountsController.updateVirtualBag)
router.post('/:id/virtual-bags/transfer', requirePermission('subaccounts:transfer'), subaccountsController.transferBetweenBags)

// Transaction history
router.get('/:id/transactions', requirePermission('subaccounts:read'), subaccountsController.getSubaccountTransactions)

// User assignments
router.get('/:id/assignments', requirePermission('subaccounts:read'), subaccountsController.getAssignments)
router.post('/:id/assignments', requirePermission('subaccounts:create'), subaccountsController.createAssignment)
router.delete('/:id/assignments/:assignmentId', requirePermission('subaccounts:create'), subaccountsController.removeAssignment)

export default router
