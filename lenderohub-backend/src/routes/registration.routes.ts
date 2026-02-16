/**
 * Registration Routes
 *
 * PUBLIC:
 *   POST /api/v1/register - Submit registration request (no auth)
 *
 * ADMIN (auth + users:create):
 *   GET  /api/v1/registration-requests       - List requests
 *   GET  /api/v1/registration-requests/:id   - Get single request
 *   PUT  /api/v1/registration-requests/:id/review - Approve/reject
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permissions.middleware';
import {
  submitRequest,
  getRequests,
  getRequest,
  reviewRequest
} from '../controllers/registration.controller';

const router = Router();

// ============================================
// Rate limiter for public registration endpoint
// ============================================
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // max 5 registration attempts per hour per IP
  message: {
    success: false,
    message: 'Demasiados intentos de registro. Intenta de nuevo en una hora.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// PUBLIC ROUTES (no auth)
// ============================================
router.post('/register', registrationLimiter, submitRequest);

// ============================================
// ADMIN ROUTES (auth + permission)
// ============================================
router.get(
  '/registration-requests',
  authenticateToken,
  requirePermission('users:create'),
  getRequests
);

router.get(
  '/registration-requests/:id',
  authenticateToken,
  requirePermission('users:create'),
  getRequest
);

router.put(
  '/registration-requests/:id/review',
  authenticateToken,
  requirePermission('users:create'),
  reviewRequest
);

export default router;
