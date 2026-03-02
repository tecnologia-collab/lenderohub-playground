import { Router } from 'express';
import { announcementsController } from '../controllers/announcements.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/',                    announcementsController.getAnnouncements);
router.get('/unread-count',        announcementsController.getUnreadCount);
router.get('/:id',                 announcementsController.getAnnouncementById);
router.post('/',                   announcementsController.createAnnouncement);
router.put('/:id',                 announcementsController.updateAnnouncement);
router.delete('/:id',              announcementsController.deleteAnnouncement);
router.put('/:id/pin',             announcementsController.pinAnnouncement);
router.put('/:id/read',            announcementsController.markAsRead);
router.get('/:id/stats',           announcementsController.getStats);

export default router;