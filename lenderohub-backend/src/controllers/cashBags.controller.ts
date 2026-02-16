/**
 * Virtual Bags (Bolsas virtuales) Controller
 */

import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { VirtualBagsService } from '../services/cashBags'

const virtualBagsService = new VirtualBagsService()

export const virtualBagsController = {
  /**
   * GET /api/v1/virtual-bags
   */
  async getVirtualBags(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      const requesterId = req.user?._id?.toString()
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const isActive = req.query.isActive !== undefined
        ? req.query.isActive === 'true'
        : undefined

      let virtualBags = await virtualBagsService.getByClient(clientId, { isActive })

      if (req.user?.profileType === 'subaccount' && requesterId) {
        virtualBags = virtualBags.filter((bag) => bag.assignedUsers.includes(requesterId))
      }

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
   * GET /api/v1/virtual-bags/:id
   */
  async getVirtualBag(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      const requesterId = req.user?._id?.toString()
      const { id } = req.params

      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const virtualBag = await virtualBagsService.getById(clientId, id)

      if (!virtualBag) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Virtual bag not found'
        })
      }

      if (req.user?.profileType === 'subaccount' && requesterId) {
        if (!virtualBag.assignedUsers.includes(requesterId)) {
          return res.status(403).json({
            success: false,
            error: 'Not allowed',
            message: 'No tienes acceso a esta bolsa virtual'
          })
        }
      }

      return res.json({
        success: true,
        data: virtualBag
      })
    } catch (error: any) {
      console.error('❌ Error fetching virtual bag:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch virtual bag',
        message: error.message
      })
    }
  },

  /**
   * POST /api/v1/virtual-bags
   */
  async createVirtualBag(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()

      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const { name, description, initialBalance, color, limits, costCentreId } = req.body

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'name is required'
        })
      }

      const virtualBag = await virtualBagsService.create({
        clientId,
        name,
        description,
        initialBalance: typeof initialBalance === 'number' ? initialBalance : undefined,
        color,
        limits,
        costCentreId
      })

      return res.status(201).json({
        success: true,
        data: virtualBag,
        message: 'Virtual bag created successfully'
      })
    } catch (error: any) {
      console.error('❌ Error creating virtual bag:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to create virtual bag',
        message: error.message
      })
    }
  },

  /**
   * PATCH /api/v1/virtual-bags/:id
   */
  async updateVirtualBag(req: AuthRequest, res: Response) {
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

      const { name, description, color, limits, isActive } = req.body

      const virtualBag = await virtualBagsService.update(clientId, id, {
        name,
        description,
        color,
        limits,
        isActive
      })

      if (!virtualBag) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Virtual bag not found'
        })
      }

      return res.json({
        success: true,
        data: virtualBag,
        message: 'Virtual bag updated successfully'
      })
    } catch (error: any) {
      console.error('❌ Error updating virtual bag:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to update virtual bag',
        message: error.message
      })
    }
  },

  /**
   * DELETE /api/v1/virtual-bags/:id
   */
  async deleteVirtualBag(req: AuthRequest, res: Response) {
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

      const virtualBag = await virtualBagsService.deactivate(clientId, id)

      if (!virtualBag) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Virtual bag not found'
        })
      }

      return res.json({
        success: true,
        data: virtualBag,
        message: 'Virtual bag deactivated successfully'
      })
    } catch (error: any) {
      console.error('❌ Error deleting virtual bag:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to delete virtual bag',
        message: error.message
      })
    }
  },

  /**
   * POST /api/v1/virtual-bags/transfer
   */
  async transfer(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      const requesterId = req.user?._id?.toString()
      const { fromBagId, toBagId, amount, description } = req.body

      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      if (!fromBagId || !toBagId || typeof amount !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'fromBagId, toBagId and amount are required'
        })
      }

      if (req.user?.profileType === 'subaccount' && requesterId) {
        const [fromBag, toBag] = await Promise.all([
          virtualBagsService.getById(clientId, fromBagId),
          virtualBagsService.getById(clientId, toBagId)
        ])
        if (!fromBag || !toBag) {
          return res.status(404).json({
            success: false,
            error: 'Not found',
            message: 'Virtual bag not found'
          })
        }
        const canAccess = fromBag.assignedUsers.includes(requesterId) && toBag.assignedUsers.includes(requesterId)
        if (!canAccess) {
          return res.status(403).json({
            success: false,
            error: 'Not allowed',
            message: 'No tienes acceso a estas bolsas virtuales'
          })
        }
      }

      const result = await virtualBagsService.transfer({
        clientId,
        fromBagId,
        toBagId,
        amount,
        description
      })

      return res.json({
        success: true,
        fromBag: result.fromBag,
        toBag: result.toBag
      })
    } catch (error: any) {
      if (error?.message === 'INSUFFICIENT_FUNDS') {
        return res.status(400).json({
          success: false,
          error: 'Insufficient funds',
          message: 'Saldo insuficiente en la subcuenta origen'
        })
      }
      console.error('❌ Error transferring virtual bags:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to transfer between virtual bags',
        message: error.message
      })
    }
  },

  /**
   * GET /api/v1/virtual-bags/:id/movements
   */
  async getMovements(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      const requesterId = req.user?._id?.toString()
      const { id } = req.params

      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const virtualBag = await virtualBagsService.getById(clientId, id)
      if (!virtualBag) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Virtual bag not found'
        })
      }

      if (req.user?.profileType === 'subaccount' && requesterId) {
        if (!virtualBag.assignedUsers.includes(requesterId)) {
          return res.status(403).json({
            success: false,
            error: 'Not allowed',
            message: 'No tienes acceso a esta bolsa virtual'
          })
        }
      }

      const movements = await virtualBagsService.getMovements(clientId, id)

      return res.json({
        success: true,
        data: movements,
        total: movements.length
      })
    } catch (error: any) {
      console.error('❌ Error fetching movements:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch movements',
        message: error.message
      })
    }
  },

  /**
   * POST /api/v1/virtual-bags/:id/users
   */
  async assignUsers(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      const { id } = req.params
      const { userIds } = req.body

      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      if (!Array.isArray(userIds)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid payload',
          message: 'userIds must be an array'
        })
      }

      const virtualBag = await virtualBagsService.assignUsers(clientId, id, userIds)

      if (!virtualBag) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Virtual bag not found'
        })
      }

      return res.json({
        success: true,
        data: virtualBag,
        message: 'Users assigned successfully'
      })
    } catch (error: any) {
      console.error('❌ Error assigning users:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to assign users',
        message: error.message
      })
    }
  },

  /**
   * POST /api/v1/virtual-bags/:id/users/remove
   */
  async removeUsers(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      const { id } = req.params
      const { userIds } = req.body

      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      if (!Array.isArray(userIds)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid payload',
          message: 'userIds must be an array'
        })
      }

      const virtualBag = await virtualBagsService.removeUsers(clientId, id, userIds)

      if (!virtualBag) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Virtual bag not found'
        })
      }

      return res.json({
        success: true,
        data: virtualBag,
        message: 'Users removed successfully'
      })
    } catch (error: any) {
      console.error('❌ Error removing users:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to remove users',
        message: error.message
      })
    }
  },

  /**
   * GET /api/v1/virtual-bags/total-balance
   */
  async getTotalBalance(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()

      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const total = await virtualBagsService.getTotalBalance(clientId)

      return res.json({
        success: true,
        data: total
      })
    } catch (error: any) {
      console.error('❌ Error fetching total balance:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch total balance',
        message: error.message
      })
    }
  },
  /**
   * GET /api/v1/virtual-bags/stats
   */
  async getStats(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()

      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const monthlyTransfers = await virtualBagsService.getMonthlyTransferCount(clientId)

      return res.json({
        success: true,
        data: {
          monthlyTransfers
        }
      })
    } catch (error: any) {
      console.error('❌ Error fetching virtual bag stats:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch virtual bag stats',
        message: error.message
      })
    }
  }
}
