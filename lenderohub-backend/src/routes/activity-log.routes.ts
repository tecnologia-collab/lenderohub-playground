import { Router } from 'express';
import { activityLogController } from '../controllers/activity-log.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', activityLogController.getLogs);
router.get('/stats', activityLogController.getStats);

export default router;