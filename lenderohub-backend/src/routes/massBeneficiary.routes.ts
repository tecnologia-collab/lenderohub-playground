/**
 * Mass Beneficiary Import Routes
 *
 * CSV-based bulk beneficiary creation: upload, preview, confirm.
 */

import { Router } from 'express';
import multer from 'multer';
import { massBeneficiaryController } from '../controllers/massBeneficiary.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/permissions.middleware';

const router = Router();

// CSV upload configuration
const csvStorage = multer.memoryStorage();

const csvFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const allowedTypes = new Set([
    'text/csv',
    'text/plain',
    'application/vnd.ms-excel',
    'application/csv'
  ]);

  // Also accept by extension if mimetype is not reliable
  const isCsvExtension = file.originalname?.toLowerCase().endsWith('.csv');

  if (!allowedTypes.has(file.mimetype) && !isCsvExtension) {
    cb(new Error('Formato de archivo invalido. Solo se aceptan archivos CSV.'));
    return;
  }

  cb(null, true);
};

const csvUpload = multer({
  storage: csvStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max for CSV
  fileFilter: csvFileFilter
}).single('file');

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/v1/mass-beneficiaries/upload
 * @desc    Upload a CSV file for validation preview
 * @access  Private - requires beneficiaries:create
 */
router.post(
  '/upload',
  requirePermission('beneficiaries:create'),
  csvUpload,
  massBeneficiaryController.upload
);

/**
 * @route   POST /api/v1/mass-beneficiaries/:id/confirm
 * @desc    Confirm a validated import and create beneficiaries
 * @access  Private - requires beneficiaries:create
 */
router.post(
  '/:id/confirm',
  requirePermission('beneficiaries:create'),
  massBeneficiaryController.confirm
);

/**
 * @route   GET /api/v1/mass-beneficiaries/:id
 * @desc    Get a specific import with status and row details
 * @access  Private - requires beneficiaries:create
 */
router.get(
  '/:id',
  requirePermission('beneficiaries:create'),
  massBeneficiaryController.getOne
);

/**
 * @route   GET /api/v1/mass-beneficiaries
 * @desc    List all imports for a cost centre
 * @access  Private - requires beneficiaries:create
 */
router.get(
  '/',
  requirePermission('beneficiaries:create'),
  massBeneficiaryController.getAll
);

export default router;
