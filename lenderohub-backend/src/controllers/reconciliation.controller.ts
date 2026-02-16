/**
 * Reconciliation Controller
 *
 * Endpoints for running balance reconciliation between local DB and Finco API,
 * and retrieving the last reconciliation report.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { reconciliationService } from '../services/reconciliation/reconciliation.service';

// ============================================
// Validation
// ============================================

const runReconciliationSchema = z.object({
  thresholdCents: z.number().int().min(0).optional().default(100),
});

// ============================================
// Controller Functions
// ============================================

/**
 * POST /api/v1/reconciliation/run
 * Execute a reconciliation check comparing local balances with Finco API.
 * Requires authentication + cost_centres:read permission (admin/corporate only).
 */
export async function runReconciliation(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = runReconciliationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada invalidos',
        errors: parsed.error.issues,
      });
    }

    const { thresholdCents } = parsed.data;

    const report = await reconciliationService.run(thresholdCents);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/reconciliation/last
 * Get the last reconciliation report (stored in memory).
 * Requires authentication + cost_centres:read permission.
 */
export async function getLastReconciliation(req: Request, res: Response, next: NextFunction) {
  try {
    const report = reconciliationService.getLastReport();

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'No se ha ejecutado ninguna reconciliacion aun. Usa POST /reconciliation/run para ejecutar una.',
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  runReconciliation,
  getLastReconciliation,
};
