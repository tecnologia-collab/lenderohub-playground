/**
 * Reconciliation Routes
 *
 * POST /reconciliation/run   - Execute reconciliation (admin/corporate)
 * GET  /reconciliation/last  - Get last reconciliation report (admin/corporate)
 */

import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permissions.middleware';
import { runReconciliation, getLastReconciliation } from '../controllers/reconciliation.controller';

const router = Router();

// All reconciliation routes require authentication + cost_centres:read
router.use(authenticateToken);

router.post('/run', requirePermission('cost_centres:read'), runReconciliation);
router.get('/last', requirePermission('cost_centres:read'), getLastReconciliation);

export default router;
