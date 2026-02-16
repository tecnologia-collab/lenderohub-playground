/**
 * Transfers Routes
 * 
 * Routes for Money Out, Money In, and Internal Transfers
 */

import { Router } from 'express';
import { transfersController } from '../controllers/transfers.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permissions.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/v1/transactions/money-out
 * @desc    Create a Money Out (SPEI) transfer
 * @access  Private
 */
router.post('/money-out', requirePermission('transactions:create'), transfersController.moneyOut);

/**
 * @route   POST /api/v1/transactions/internal
 * @desc    Create an internal transfer (book-to-book) between Monato accounts
 * @access  Private
 */
router.post('/internal', requirePermission('transactions:create'), transfersController.internalTransfer);

/**
 * @route   GET /api/v1/transactions/recent
 * @desc    Get recent transactions (for dashboard)
 * @access  Private
 */
router.get('/recent', requirePermission('transactions:read'), transfersController.getRecentTransactions);

/**
 * @route   GET /api/v1/transactions/:id
 * @desc    Get a specific transaction by ID
 * @access  Private
 */
router.get('/:id', requirePermission('transactions:read'), transfersController.getTransaction);

/**
 * @route   GET /api/v1/transactions
 * @desc    List all transactions with filters
 * @access  Private
 */
router.get('/', requirePermission('transactions:read'), transfersController.getTransactions);

export default router;
