import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import { notificationsController } from '../controllers/notifications.controller';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /notifications - Get user's notifications (paginated)
router.get('/', notificationsController.getNotifications);

// GET /notifications/unread-count - Lightweight unread count for polling
router.get('/unread-count', notificationsController.getUnreadCount);

// PUT /notifications/read-all - Mark all as read (must be before /:id to avoid route conflict)
router.put('/read-all', notificationsController.markAllAsRead);

// PUT /notifications/:id/read - Mark single as read
router.put('/:id/read', notificationsController.markAsRead);

export default router;
