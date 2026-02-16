import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permissions.middleware';
import { getAuditLogs } from '../controllers/auditLogs.controller';

const router = Router();

// GET /api/v1/audit-logs - Query audit logs (admins only)
router.get(
  '/audit-logs',
  authenticateToken,
  requirePermission('users:read'),
  getAuditLogs
);

export default router;
