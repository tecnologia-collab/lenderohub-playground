import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { SubaccountsService } from '../services/subaccounts/subaccounts.service'

const subaccountsService = new SubaccountsService()

export const subaccountsController = {
  /**
   * GET /api/v1/subaccounts
   */
  async getSubaccounts(req: AuthRequest, res: Response) {
    try {
      const requester = req.user
      const clientId = requester?.clientId?.toString()
      if (!requester || !clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      // Pass requester to filter by accessible cost centres
      // Include internal accounts if requested via query param
      const includeInternal = req.query.includeInternal === 'true'
      const subaccounts = await subaccountsService.getByClient(clientId, requester, { includeInternal })

      return res.json({
        success: true,
        data: subaccounts,
        total: subaccounts.length
      })
    } catch (error: any) {
      console.error('❌ Error fetching subaccounts:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch subaccounts',
        message: error.message
      })
    }
  },

  /**
   * GET /api/v1/subaccounts/:id
   */
  async getSubaccount(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      const { id } = req.params
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const subaccount = await subaccountsService.getById(id, clientId)
      if (!subaccount) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Subcuenta no encontrada'
        })
      }

      return res.json({
        success: true,
        data: subaccount
      })
    } catch (error: any) {
      console.error('❌ Error fetching subaccount:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch subaccount',
        message: error.message
      })
    }
  },

  /**
   * POST /api/v1/subaccounts
   */
  async createSubaccount(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      const requester = req.user
      if (!clientId || !requester) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const { name, costCentreId } = req.body
      if (!name || typeof name !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'name is required'
        })
      }

      const subaccount = await subaccountsService.create({
        name: name.trim(),
        costCentreId,
        requester
      })

      return res.status(201).json({
        success: true,
        data: subaccount
      })
    } catch (error: any) {
      const isForbidden = ['No tienes acceso', 'Perfil no permitido'].some((snippet) => (error.message || '').includes(snippet))
      const isBadRequest = ['Selecciona un CECO', 'No se encontró el CECO'].some((snippet) => (error.message || '').includes(snippet))
      const status = isForbidden ? 403 : isBadRequest ? 400 : 500
      console.error('❌ Error creating subaccount:', error.message)
      return res.status(status).json({
        success: false,
        error: 'Failed to create subaccount',
        message: error.message
      })
    }
  },

  /**
   * GET /api/v1/subaccounts/:id/virtual-bags
   */
  async getVirtualBags(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      const { id } = req.params
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const virtualBags = await subaccountsService.getVirtualBags(id, clientId)

      return res.json({
        success: true,
        data: virtualBags,
        total: virtualBags.length
      })
    } catch (error: any) {
      console.error('❌ Error fetching virtual bags:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch virtual bags',
        message: error.message
      })
    }
  },

  /**
   * POST /api/v1/subaccounts/:id/virtual-bags
   */
  async createVirtualBag(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      const { id } = req.params
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const { name, description, color, distributionPercentage } = req.body
      if (!name || typeof name !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'name is required'
        })
      }

      const virtualBag = await subaccountsService.createVirtualBag(id, clientId, {
        name: name.trim(),
        description,
        color,
        distributionPercentage: typeof distributionPercentage === 'number' ? distributionPercentage : undefined
      })

      return res.status(201).json({
        success: true,
        data: virtualBag,
        message: 'Bolsa virtual creada correctamente'
      })
    } catch (error: any) {
      const isForbidden = ['No tienes acceso'].some((snippet) => (error.message || '').includes(snippet))
      const isBadRequest = ['no encontrada', 'porcentaje', 'excede'].some((snippet) => (error.message || '').toLowerCase().includes(snippet))
      const status = isForbidden ? 403 : isBadRequest ? 400 : 500
      console.error('❌ Error creating virtual bag:', error.message)
      return res.status(status).json({
        success: false,
        error: 'Failed to create virtual bag',
        message: error.message
      })
    }
  },

  /**
   * POST /api/v1/subaccounts/:id/virtual-bags/transfer
   */
  async transferBetweenBags(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      const { id } = req.params
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const { fromBagId, toBagId, amount, description } = req.body
      if (!fromBagId || !toBagId || typeof amount !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'fromBagId, toBagId y amount son requeridos'
        })
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid amount',
          message: 'El monto debe ser mayor a 0'
        })
      }

      const result = await subaccountsService.transferBetweenBags(id, clientId, {
        fromBagId,
        toBagId,
        amount,
        description
      })

      return res.json({
        success: true,
        data: result,
        message: 'Transferencia realizada correctamente'
      })
    } catch (error: any) {
      const isForbidden = ['No tienes acceso'].some((snippet) => (error.message || '').includes(snippet))
      const isBadRequest = ['no encontrada', 'insuficiente'].some((snippet) => (error.message || '').toLowerCase().includes(snippet))
      const status = isForbidden ? 403 : isBadRequest ? 400 : 500
      console.error('❌ Error transferring between bags:', error.message)
      return res.status(status).json({
        success: false,
        error: 'Failed to transfer between bags',
        message: error.message
      })
    }
  },

  /**
   * PATCH /api/v1/subaccounts/:id/virtual-bags/:bagId
   */
  async updateVirtualBag(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      const { id, bagId } = req.params
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const { name, description, color, distributionPercentage } = req.body

      // At least one field must be provided
      if (name === undefined && description === undefined && color === undefined && distributionPercentage === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing fields',
          message: 'Se requiere al menos un campo para actualizar'
        })
      }

      const virtualBag = await subaccountsService.updateVirtualBag(id, bagId, clientId, {
        name: typeof name === 'string' ? name : undefined,
        description: description !== undefined ? description : undefined,
        color: color !== undefined ? color : undefined,
        distributionPercentage: typeof distributionPercentage === 'number' ? distributionPercentage : undefined
      })

      return res.json({
        success: true,
        data: virtualBag,
        message: 'Bolsa virtual actualizada correctamente'
      })
    } catch (error: any) {
      const isForbidden = ['No tienes acceso'].some((snippet) => (error.message || '').includes(snippet))
      const isBadRequest = ['no encontrada', 'porcentaje', 'excede'].some((snippet) => (error.message || '').toLowerCase().includes(snippet))
      const status = isForbidden ? 403 : isBadRequest ? 400 : 500
      console.error('❌ Error updating virtual bag:', error.message)
      return res.status(status).json({
        success: false,
        error: 'Failed to update virtual bag',
        message: error.message
      })
    }
  },

  /**
   * GET /api/v1/subaccounts/:id/transactions
   */
  async getSubaccountTransactions(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      const { id } = req.params
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const type = (req.query.type as string) || 'all'
      if (!['in', 'out', 'all'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid type',
          message: 'type debe ser "in", "out" o "all"'
        })
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1)
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))

      const result = await subaccountsService.getTransactions(id, clientId, {
        type: type as 'in' | 'out' | 'all',
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        page,
        limit
      })

      return res.json({
        success: true,
        data: result
      })
    } catch (error: any) {
      const isForbidden = ['No tienes acceso'].some((snippet) => (error.message || '').includes(snippet))
      const isNotFound = ['no encontrada'].some((snippet) => (error.message || '').toLowerCase().includes(snippet))
      const status = isForbidden ? 403 : isNotFound ? 404 : 500
      console.error('❌ Error fetching transactions:', error.message)
      return res.status(status).json({
        success: false,
        error: 'Failed to fetch transactions',
        message: error.message
      })
    }
  },

  /**
   * GET /api/v1/subaccounts/:id/assignments
   */
  async getAssignments(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      const { id } = req.params
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const assignments = await subaccountsService.getAssignments(id, clientId)

      return res.json({
        success: true,
        data: assignments,
        total: assignments.length
      })
    } catch (error: any) {
      const isForbidden = ['No tienes acceso'].some((snippet) => (error.message || '').includes(snippet))
      const isNotFound = ['no encontrada'].some((snippet) => (error.message || '').toLowerCase().includes(snippet))
      const status = isForbidden ? 403 : isNotFound ? 404 : 500
      console.error('❌ Error fetching assignments:', error.message)
      return res.status(status).json({
        success: false,
        error: 'Failed to fetch assignments',
        message: error.message
      })
    }
  },

  /**
   * POST /api/v1/subaccounts/:id/assignments
   */
  async createAssignment(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      const { id } = req.params
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const { userProfileId, permissions } = req.body
      if (!userProfileId || typeof userProfileId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'userProfileId es requerido'
        })
      }

      const assignment = await subaccountsService.createAssignment(id, clientId, {
        userProfileId,
        permissions
      })

      return res.status(201).json({
        success: true,
        data: assignment,
        message: 'Asignación creada correctamente'
      })
    } catch (error: any) {
      const isForbidden = ['No tienes acceso'].some((snippet) => (error.message || '').includes(snippet))
      const isBadRequest = ['no encontrad', 'ya tiene', 'no pertenece'].some((snippet) => (error.message || '').toLowerCase().includes(snippet))
      const status = isForbidden ? 403 : isBadRequest ? 400 : 500
      console.error('❌ Error creating assignment:', error.message)
      return res.status(status).json({
        success: false,
        error: 'Failed to create assignment',
        message: error.message
      })
    }
  },

  /**
   * DELETE /api/v1/subaccounts/:id/assignments/:assignmentId
   */
  async removeAssignment(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      const { id, assignmentId } = req.params
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      await subaccountsService.removeAssignment(id, assignmentId, clientId)

      return res.json({
        success: true,
        message: 'Asignación eliminada correctamente'
      })
    } catch (error: any) {
      const isForbidden = ['No tienes acceso'].some((snippet) => (error.message || '').includes(snippet))
      const isNotFound = ['no encontrada'].some((snippet) => (error.message || '').toLowerCase().includes(snippet))
      const status = isForbidden ? 403 : isNotFound ? 404 : 500
      console.error('❌ Error removing assignment:', error.message)
      return res.status(status).json({
        success: false,
        error: 'Failed to remove assignment',
        message: error.message
      })
    }
  }
}
