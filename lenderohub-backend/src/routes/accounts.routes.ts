import { Router } from 'express';
import { accountsController } from '../controllers/accounts.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permissions.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/transfer-sources', requirePermission('transactions:create'), accountsController.getTransferSources);

export default router;
