/**
 * Mass Transfer Routes
 *
 * Routes for CSV-based mass transfer-out (dispersiones masivas).
 */

import { Router } from 'express'
import multer from 'multer'
import { massTransferController } from '../controllers/massTransfer.controller'
import { authenticateToken } from '../middlewares/auth.middleware'
import { requirePermission } from '../middlewares/permissions.middleware'

const router = Router()

// CSV upload configuration
const csvStorage = multer.memoryStorage()

const csvFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const allowedMimes = new Set([
    'text/csv',
    'text/plain',
    'application/vnd.ms-excel',
    'application/csv'
  ])
  if (!allowedMimes.has(file.mimetype)) {
    cb(new Error('Formato de archivo invalido. Se requiere un archivo CSV.'))
    return
  }
  cb(null, true)
}

const csvUpload = multer({
  storage: csvStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: csvFileFilter
})

// All routes require authentication
router.use(authenticateToken)

/**
 * @route   POST /api/v1/mass-transfers/upload
 * @desc    Upload a CSV file for mass transfer-out validation
 * @access  Private - requires transactions:create
 */
router.post(
  '/upload',
  requirePermission('transactions:create'),
  csvUpload.single('file'),
  massTransferController.upload
)

/**
 * @route   POST /api/v1/mass-transfers/:id/confirm
 * @desc    Confirm and execute a validated mass transfer batch
 * @access  Private - requires transactions:create
 */
router.post(
  '/:id/confirm',
  requirePermission('transactions:create'),
  massTransferController.confirm
)

/**
 * @route   GET /api/v1/mass-transfers/:id
 * @desc    Get a single mass transfer batch with all row details
 * @access  Private - requires transactions:create
 */
router.get(
  '/:id',
  requirePermission('transactions:create'),
  massTransferController.getOne
)

/**
 * @route   GET /api/v1/mass-transfers
 * @desc    List mass transfer batches for a cost centre (paginated)
 * @access  Private - requires transactions:create
 */
router.get(
  '/',
  requirePermission('transactions:create'),
  massTransferController.getAll
)

export default router
