/**
 * Mass Beneficiary Import Controller
 *
 * Handles CSV upload, validation preview, confirmation, and status queries
 * for bulk beneficiary creation.
 */

import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/auth.middleware';
import MassBeneficiaryService from '../services/massBeneficiary/massBeneficiary.service';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const confirmSchema = z.object({
  id: z.string().min(1, 'id es requerido')
});

const getOneSchema = z.object({
  id: z.string().min(1, 'id es requerido')
});

const getAllSchema = z.object({
  costCentreId: z.string().min(1, 'costCentreId es requerido'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

// ============================================================================
// CONTROLLER
// ============================================================================

export const massBeneficiaryController = {

  /**
   * POST /api/v1/mass-beneficiaries/upload
   * Upload a CSV file for validation preview.
   * Expects multipart/form-data with field "file" (CSV) and "costCentreId" in body.
   */
  async upload(req: AuthRequest, res: Response) {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'Archivo requerido',
          message: 'Debes subir un archivo CSV'
        });
      }

      const costCentreId = req.body.costCentreId;
      if (!costCentreId) {
        return res.status(400).json({
          success: false,
          error: 'costCentreId requerido',
          message: 'Debes indicar el centro de costos'
        });
      }

      const userId = req.user?._id?.toString();
      const clientId = req.user?.clientId?.toString();

      if (!userId || !clientId) {
        return res.status(401).json({
          success: false,
          error: 'No autenticado',
          message: 'No se pudo determinar el usuario o cliente'
        });
      }

      const importRecord = await MassBeneficiaryService.uploadAndValidate(
        file.buffer,
        file.originalname || 'import.csv',
        costCentreId,
        clientId,
        userId
      );

      return res.status(201).json({
        success: true,
        data: importRecord,
        message: `CSV procesado: ${importRecord.validRows} filas validas, ${importRecord.invalidRows} con errores`
      });
    } catch (error: any) {
      console.error('Error uploading mass beneficiary CSV:', error.message);
      return res.status(400).json({
        success: false,
        error: 'Error al procesar CSV',
        message: error.message
      });
    }
  },

  /**
   * POST /api/v1/mass-beneficiaries/:id/confirm
   * Confirm a validated import and create all valid beneficiaries.
   */
  async confirm(req: AuthRequest, res: Response) {
    try {
      const parsed = confirmSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Parametros invalidos',
          message: parsed.error.issues.map((e: z.ZodIssue) => e.message).join(', ')
        });
      }

      const userId = req.user?._id?.toString();
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'No autenticado'
        });
      }

      const importRecord = await MassBeneficiaryService.confirm(parsed.data.id, userId);

      return res.json({
        success: true,
        data: importRecord,
        message: `Import completado: ${importRecord.successCount} creados, ${importRecord.failCount} fallidos`
      });
    } catch (error: any) {
      console.error('Error confirming mass beneficiary import:', error.message);
      const status = error.message.includes('no encontrado') ? 404 : 400;
      return res.status(status).json({
        success: false,
        error: 'Error al confirmar import',
        message: error.message
      });
    }
  },

  /**
   * GET /api/v1/mass-beneficiaries/:id
   * Get a specific import with its current status and row details.
   */
  async getOne(req: AuthRequest, res: Response) {
    try {
      const parsed = getOneSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Parametros invalidos',
          message: parsed.error.issues.map((e: z.ZodIssue) => e.message).join(', ')
        });
      }

      const importRecord = await MassBeneficiaryService.getById(parsed.data.id);

      if (!importRecord) {
        return res.status(404).json({
          success: false,
          error: 'Import no encontrado'
        });
      }

      return res.json({
        success: true,
        data: importRecord
      });
    } catch (error: any) {
      console.error('Error fetching mass beneficiary import:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Error al obtener import',
        message: error.message
      });
    }
  },

  /**
   * GET /api/v1/mass-beneficiaries
   * List all imports for a cost centre, with pagination.
   * Query params: costCentreId (required), page, limit
   */
  async getAll(req: AuthRequest, res: Response) {
    try {
      const parsed = getAllSchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Parametros invalidos',
          message: parsed.error.issues.map((e: z.ZodIssue) => e.message).join(', ')
        });
      }

      const { costCentreId, page, limit } = parsed.data;

      const result = await MassBeneficiaryService.getAll(costCentreId, page, limit);

      return res.json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          pages: result.pages,
          limit
        }
      });
    } catch (error: any) {
      console.error('Error listing mass beneficiary imports:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Error al listar imports',
        message: error.message
      });
    }
  }
};
