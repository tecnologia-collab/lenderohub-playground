/**
 * Mass Transfer Controller
 *
 * Handles CSV upload, confirmation, and querying of mass transfer-out batches.
 */

import { Response } from 'express'
import { z } from 'zod'
import { AuthRequest } from '../middlewares/auth.middleware'
import { getMassTransferService } from '../services/massTransfer/massTransfer.service'
import { CostCentre } from '../models/providerAccounts.model'

// ============================================================================
// Zod Schemas
// ============================================================================

const confirmSchema = z.object({
  id: z.string().min(1, 'ID del lote es requerido')
})

const getOneSchema = z.object({
  id: z.string().min(1, 'ID del lote es requerido')
})

const getAllSchema = z.object({
  costCentreId: z.string().min(1, 'costCentreId es requerido'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
})

// ============================================================================
// Controller
// ============================================================================

export const massTransferController = {

  /**
   * POST /api/v1/mass-transfers/upload
   * Upload a CSV file for mass transfer-out. Requires 'file' field (multer)
   * and 'costCentreId' in the body.
   */
  async upload(req: AuthRequest, res: Response) {
    try {
      const file = req.file
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere un archivo CSV'
        })
      }

      const costCentreId = req.body.costCentreId
      if (!costCentreId) {
        return res.status(400).json({
          success: false,
          error: 'costCentreId es requerido'
        })
      }

      // Resolve corporateClientId from user or cost centre
      let corporateClientId = req.user?.clientId?.toString()
      if (!corporateClientId) {
        const cc = await CostCentre.findById(costCentreId).select('client')
        corporateClientId = cc?.client?.toString()
      }
      if (!corporateClientId) {
        return res.status(400).json({
          success: false,
          error: 'No se pudo determinar el cliente corporativo'
        })
      }

      const userId = req.user?._id?.toString()
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Usuario no autenticado'
        })
      }

      const service = getMassTransferService()
      const result = await service.uploadAndValidate(
        file.buffer,
        file.originalname,
        costCentreId,
        corporateClientId,
        userId
      )

      return res.status(201).json({
        success: true,
        data: {
          id: result.massTransferOut._id,
          status: result.massTransferOut.status,
          fileName: result.massTransferOut.fileName,
          summary: result.summary,
          rows: result.massTransferOut.rows
        },
        message: `CSV procesado: ${result.summary.validRows} filas validas, ${result.summary.invalidRows} filas con errores`
      })
    } catch (error: any) {
      console.error('Error uploading mass transfer CSV:', error.message)
      return res.status(error.status || 400).json({
        success: false,
        error: 'Error al procesar el archivo CSV',
        message: error.message
      })
    }
  },

  /**
   * POST /api/v1/mass-transfers/:id/confirm
   * Confirm and execute a mass transfer batch.
   */
  async confirm(req: AuthRequest, res: Response) {
    try {
      const parsed = confirmSchema.safeParse(req.params)
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Parametros invalidos',
          details: parsed.error.issues
        })
      }

      const userId = req.user?._id?.toString()
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Usuario no autenticado'
        })
      }

      const service = getMassTransferService()
      const batch = await service.confirm(parsed.data.id, userId)

      return res.status(200).json({
        success: true,
        data: {
          id: batch._id,
          status: batch.status,
          totalRows: batch.totalRows,
          validRows: batch.validRows,
          successCount: batch.successCount,
          failCount: batch.failCount,
          rows: batch.rows
        },
        message: `Lote procesado: ${batch.successCount} exitosas, ${batch.failCount} fallidas`
      })
    } catch (error: any) {
      console.error('Error confirming mass transfer:', error.message)
      return res.status(error.status || 400).json({
        success: false,
        error: 'Error al confirmar el lote de transferencias',
        message: error.message
      })
    }
  },

  /**
   * GET /api/v1/mass-transfers/:id
   * Get a single mass transfer batch with all rows.
   */
  async getOne(req: AuthRequest, res: Response) {
    try {
      const parsed = getOneSchema.safeParse(req.params)
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Parametros invalidos',
          details: parsed.error.issues
        })
      }

      const service = getMassTransferService()
      const batch = await service.getById(parsed.data.id)

      return res.status(200).json({
        success: true,
        data: batch
      })
    } catch (error: any) {
      console.error('Error fetching mass transfer:', error.message)
      return res.status(error.status || 404).json({
        success: false,
        error: 'Error al obtener el lote de transferencias',
        message: error.message
      })
    }
  },

  /**
   * GET /api/v1/mass-transfers
   * List mass transfer batches for a cost centre with pagination.
   * Query params: costCentreId (required), page, limit
   */
  async getAll(req: AuthRequest, res: Response) {
    try {
      const parsed = getAllSchema.safeParse(req.query)
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'Parametros invalidos',
          details: parsed.error.issues
        })
      }

      const { costCentreId, page, limit } = parsed.data

      const service = getMassTransferService()
      const result = await service.getAll(costCentreId, page, limit)

      return res.status(200).json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          pages: result.pages,
          limit
        }
      })
    } catch (error: any) {
      console.error('Error listing mass transfers:', error.message)
      return res.status(error.status || 500).json({
        success: false,
        error: 'Error al listar los lotes de transferencias',
        message: error.message
      })
    }
  }
}
