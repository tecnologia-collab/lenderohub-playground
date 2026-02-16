import { Request, Response } from 'express'
import { monthlyChargesService } from '../services/monthlyCharges/monthlyCharges.service'

/**
 * Execute monthly charges job manually
 * POST /api/v1/monthly-charges/execute
 * Permission: cost_centres:write or admin
 */
export async function executeMonthlyCharges(req: Request, res: Response): Promise<void> {
  try {
    const result = await monthlyChargesService.executeMonthlyCharges()

    res.json({
      success: true,
      message: 'Monthly charges executed',
      data: result
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to execute monthly charges'
    })
  }
}

/**
 * Get status of last monthly charges execution
 * GET /api/v1/monthly-charges/status
 * Permission: cost_centres:read
 */
export async function getMonthlyChargesStatus(req: Request, res: Response): Promise<void> {
  try {
    const status = await monthlyChargesService.getLastExecutionStatus()

    res.json({
      success: true,
      data: status
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get monthly charges status'
    })
  }
}
