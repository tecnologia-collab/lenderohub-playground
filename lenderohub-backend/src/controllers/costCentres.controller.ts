/**
 * Cost Centres Controller
 *
 * Handles Cost Centre management for Corporate Clients
 */

import { Response } from 'express'
import { CostCentresService } from '../services/costCentres'
import { FincoClient } from '../integrations/finco/client'
import { Provider } from '../models/shared/enums'
import { AuthRequest } from '../middlewares/auth.middleware'
import { CostCentreAccumulator } from '../models/costCentreAccumulators.model'
import { dayjs } from '../utils/dayjs'

// Initialize Finco Client
const fincoClient = new FincoClient({
  apiUrl: process.env.FINCO_API_URL || 'https://apicore.stg.finch.lat',
  clientId: process.env.FINCO_CLIENT_ID || '',
  clientSecret: process.env.FINCO_CLIENT_SECRET || '',
  apiKey: process.env.FINCO_API_KEY || '',
  environment: (process.env.FINCO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox'
})

// Initialize Cost Centres Service
const costCentresService = new CostCentresService(fincoClient)

export const costCentresController = {
  /**
   * GET /api/cost-centres
   * Get all Cost Centres for the authenticated user's client
   * Query params: includeDisabled, includeAccounts
   */
  async getCostCentres(req: AuthRequest, res: Response) {
    try {
      const { includeDisabled, includeAccounts } = req.query

      // Get clientId from authenticated user
      const clientId = req.user?.clientId?.toString()

      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      console.log('📋 Fetching cost centres for client:', clientId)

      const costCentres = await costCentresService.getByClient(clientId, {
        includeDisabled: includeDisabled === 'true',
        includeAccounts: includeAccounts === 'true'
      })

      return res.json({
        success: true,
        data: costCentres,
        total: costCentres.length
      })
    } catch (error: any) {
      console.error('❌ Error fetching cost centres:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch cost centres',
        message: error.message
      })
    }
  },

  /**
   * GET /api/cost-centres/:id
   * Get a specific Cost Centre by ID
   * Query: includeAccounts, includeAll
   */
  async getCostCentre(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const { includeAccounts, includeAll } = req.query

      console.log('🔍 Fetching cost centre:', id)

      const costCentre = await costCentresService.getById(id, {
        includeAccounts: includeAccounts === 'true',
        includeAll: includeAll === 'true'
      })

      if (!costCentre) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Cost Centre not found'
        })
      }

      return res.json({
        success: true,
        data: costCentre
      })
    } catch (error: any) {
      console.error('❌ Error fetching cost centre:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch cost centre',
        message: error.message
      })
    }
  },

  /**
   * GET /api/cost-centres/:id/stats
   * Get statistics for a Cost Centre
   */
  async getCostCentreStats(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params

      console.log('📊 Fetching stats for cost centre:', id)

      const stats = await costCentresService.getStats(id)

      return res.json({
        success: true,
        data: stats
      })
    } catch (error: any) {
      console.error('❌ Error fetching cost centre stats:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch cost centre stats',
        message: error.message
      })
    }
  },

  /**
   * POST /api/cost-centres
   * Create a new Cost Centre
   */
  async createCostCentre(req: AuthRequest, res: Response) {
    try {
      const {
        alias,
        shortName,
        provider,
        isDefault,
        // Contact & Fiscal Data
        contact,
        rfc,
        fiscalAddress,
        // Configuration
        transactionProfile,
        commercialRules,
        cashManagementEnabled,
        clusterId,
        createFincoAccount
      } = req.body

      // Get clientId from authenticated user
      const clientId = req.user?.clientId?.toString()

      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      // Validate required fields
      if (!alias || !shortName) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'alias and shortName are required'
        })
      }

      // Validate provider if provided
      if (provider && !Object.values(Provider).includes(provider)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid provider',
          message: `Provider must be one of: ${Object.values(Provider).join(', ')}`
        })
      }

      console.log('➕ Creating cost centre:', { clientId, alias, shortName, provider })

      const costCentre = await costCentresService.create({
        clientId,
        alias,
        shortName,
        provider: provider || Provider.Finco,
        isDefault,
        // Contact & Fiscal Data
        contact,
        rfc,
        fiscalAddress,
        // Configuration
        transactionProfile,
        commercialRules,
        cashManagementEnabled,
        clusterId,
        createFincoAccount
      })

      return res.status(201).json({
        success: true,
        data: costCentre,
        message: 'Cost Centre created successfully'
      })
    } catch (error: any) {
      console.error('❌ Error creating cost centre:', error.message)

      // Handle specific errors
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: error.message
        })
      }

      if (error.message.includes('Maximum cost centres')) {
        return res.status(400).json({
          success: false,
          error: 'Limit reached',
          message: error.message
        })
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to create cost centre',
        message: error.message
      })
    }
  },

  /**
   * PUT /api/cost-centres/:id
   * Update a Cost Centre
   */
  async updateCostCentre(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params
      const {
        alias,
        shortName,
        // Contact & Fiscal Data
        contact,
        rfc,
        fiscalAddress,
        // Configuration
        transactionProfile,
        commercialRules,
        cashManagementEnabled,
        clusterId
      } = req.body

      console.log('✏️ Updating cost centre:', id)

      const costCentre = await costCentresService.update(id, {
        alias,
        shortName,
        // Contact & Fiscal Data
        contact,
        rfc,
        fiscalAddress,
        // Configuration
        transactionProfile,
        commercialRules,
        cashManagementEnabled,
        clusterId
      })

      if (!costCentre) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Cost Centre not found'
        })
      }

      return res.json({
        success: true,
        data: costCentre,
        message: 'Cost Centre updated successfully'
      })
    } catch (error: any) {
      console.error('❌ Error updating cost centre:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to update cost centre',
        message: error.message
      })
    }
  },

  /**
   * POST /api/cost-centres/:id/disable
   * Disable (soft delete) a Cost Centre
   */
  async disableCostCentre(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params

      console.log('🚫 Disabling cost centre:', id)

      const costCentre = await costCentresService.disable(id)

      if (!costCentre) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Cost Centre not found'
        })
      }

      return res.json({
        success: true,
        data: costCentre,
        message: 'Cost Centre disabled successfully'
      })
    } catch (error: any) {
      console.error('❌ Error disabling cost centre:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to disable cost centre',
        message: error.message
      })
    }
  },

  /**
   * POST /api/cost-centres/:id/enable
   * Re-enable a disabled Cost Centre
   */
  async enableCostCentre(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params

      console.log('✅ Enabling cost centre:', id)

      const costCentre = await costCentresService.enable(id)

      if (!costCentre) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Cost Centre not found'
        })
      }

      return res.json({
        success: true,
        data: costCentre,
        message: 'Cost Centre enabled successfully'
      })
    } catch (error: any) {
      console.error('❌ Error enabling cost centre:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to enable cost centre',
        message: error.message
      })
    }
  },

  /**
   * POST /api/cost-centres/:id/set-default
   * Set a Cost Centre as default for its client
   */
  async setAsDefault(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params

      console.log('⭐ Setting cost centre as default:', id)

      const costCentre = await costCentresService.setAsDefault(id)

      if (!costCentre) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
          message: 'Cost Centre not found'
        })
      }

      return res.json({
        success: true,
        data: costCentre,
        message: 'Cost Centre set as default successfully'
      })
    } catch (error: any) {
      console.error('❌ Error setting default cost centre:', error.message)

      if (error.message.includes('disabled')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid operation',
          message: error.message
        })
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to set default cost centre',
        message: error.message
      })
    }
  },

  /**
   * GET /api/cost-centres/:id/accumulators
   * Get current month's accumulators for a Cost Centre
   */
  async getCostCentreAccumulators(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params

      const currentPeriod = dayjs().format('YYYY-MM')

      const accumulators = await CostCentreAccumulator.find({
        costCentre: id,
        period: currentPeriod
      }).lean()

      const inAcc = accumulators.find((a) => a.type === 'in')
      const outAcc = accumulators.find((a) => a.type === 'out')

      return res.json({
        success: true,
        data: {
          period: currentPeriod,
          in: { amount: (inAcc?.amount || 0) / 100, count: inAcc?.count || 0 },
          out: { amount: (outAcc?.amount || 0) / 100, count: outAcc?.count || 0 }
        }
      })
    } catch (error: any) {
      console.error('❌ Error fetching cost centre accumulators:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch cost centre accumulators',
        message: error.message
      })
    }
  }
}
