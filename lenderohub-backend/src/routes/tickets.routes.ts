import { Router } from 'express';
import { ticketsController } from '../controllers/tickets.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/', ticketsController.createTicket);
router.get('/', ticketsController.getTickets);
router.get('/:id', ticketsController.getTicketById);
router.put('/:id/status', ticketsController.updateStatus);
router.put('/:id/assign', ticketsController.assignTicket);

export default router;