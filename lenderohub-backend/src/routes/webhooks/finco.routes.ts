// src/routes/webhooks/finco.routes.ts
/**
 * Rutas de webhooks de Finco
 * Endpoints: /api/webhooks/finco/*
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permissions.middleware';
import {
  webhookService,
  WebhookMoneyInEvent,
  WebhookStatusUpdateEvent,
  WebhookCepEvent
} from '../../services/webhooks/webhook.service';

const router = Router();

// Token para validar que el webhook viene de Finco
const WEBHOOK_TOKEN = process.env.FINCO_WEBHOOK_TOKEN || 'lenderohub-webhook-2026';

/**
 * Middleware para validar webhook
 */
const validateWebhook = (req: Request, res: Response, next: Function) => {
  const token = req.headers['x-webhook-token'] || req.headers['authorization']?.replace('Bearer ', '') || req.query.token;

  // En desarrollo, permitir sin token
  if (process.env.NODE_ENV === 'development') {
    console.log('🔓 Webhook en modo desarrollo (sin validación de token)');
    return next();
  }

  if (token !== WEBHOOK_TOKEN) {
    console.warn('⚠️ Webhook rechazado: token inválido');
    return res.status(401).json({ error: 'Invalid token' });
  }

  next();
};

/**
 * POST /api/webhooks/finco/money-in
 * Recibe notificaciones de depósitos entrantes (SPEI/Internal)
 */
router.post('/money-in', validateWebhook, async (req: Request, res: Response) => {
  try {
    const event = req.body as WebhookMoneyInEvent;

    console.log('═══════════════════════════════════════════════');
    console.log('💰 WEBHOOK MONEY_IN recibido');
    console.log('═══════════════════════════════════════════════');
    console.log('   ID:', event.id_msg);
    console.log('   Fecha:', event.msg_date);
    console.log('   Monto:', event.body?.amount, 'MXN');
    console.log('   De:', event.body?.payer_name);
    console.log('   A:', event.body?.beneficiary_account);
    console.log('   Tracking:', event.body?.tracking_key);
    console.log('═══════════════════════════════════════════════');

    const result = await webhookService.processMoneyIn(event);

    // Responder según el resultado
    // 200/201: Aceptado
    // 422: Rechazado (Finco hará refund automático)
    res.status(201).json({
      received: true,
      type: 'money-in',
      ...result
    });

  } catch (error: any) {
    console.error('❌ Error en webhook money-in:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/webhooks/finco/status-update
 * Recibe actualizaciones de estado de transacciones Money Out
 * Estados: INITIALIZED, LIQUIDATED, REFUND, REJECTED
 */
router.post('/status-update', validateWebhook, async (req: Request, res: Response) => {
  try {
    const event = req.body as WebhookStatusUpdateEvent;

    console.log('═══════════════════════════════════════════════');
    console.log('🔄 WEBHOOK STATUS_UPDATE recibido');
    console.log('═══════════════════════════════════════════════');
    console.log('   ID:', event.id_msg);
    console.log('   Fecha:', event.msg_date);
    console.log('   Transaction:', event.body?.id);
    console.log('   Tracking:', event.body?.tracking_key);
    console.log('   Status:', event.body?.status);
    console.log('   Reason:', event.body?.reason_description || 'N/A');
    console.log('═══════════════════════════════════════════════');

    const result = await webhookService.processStatusUpdate(event);

    res.status(200).json({
      received: true,
      type: 'status-update',
      ...result
    });

  } catch (error: any) {
    console.error('❌ Error en webhook status-update:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/webhooks/finco/cep
 * Recibe el Comprobante Electrónico de Pago (Penny Validation)
 * Estados: PENDING, DELAYED, COMPLETED, FAILED
 */
router.post('/cep', validateWebhook, async (req: Request, res: Response) => {
  try {
    // Finco CEP webhook may arrive wrapped: { client_id, payload: {...}, webhook_type }
    // or unwrapped directly as WebhookCepEvent (depends on configuration).
    // Handle both formats gracefully.
    let event: WebhookCepEvent;
    if (req.body.payload && req.body.webhook_type === 'CEP') {
      // Wrapped format from Finco
      event = req.body.payload as WebhookCepEvent;
    } else {
      event = req.body as WebhookCepEvent;
    }

    console.log('═══════════════════════════════════════════════');
    console.log('📄 WEBHOOK CEP recibido');
    console.log('═══════════════════════════════════════════════');
    console.log('   ID:', event.id_msg);
    console.log('   Fecha:', event.msg_date);
    console.log('   Transaction:', event.body?.id);
    console.log('   Tracking:', event.body?.tracking_key);
    console.log('   Status:', event.body?.status);
    console.log('   Beneficiary:', event.body?.beneficiary_name);
    console.log('   Account:', event.body?.beneficiary_account);
    console.log('═══════════════════════════════════════════════');

    const result = await webhookService.processCep(event);

    res.status(200).json({
      received: true,
      type: 'cep',
      ...result
    });

  } catch (error: any) {
    console.error('❌ Error en webhook cep:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/webhooks/finco/health
 * Health check
 */
router.get('/health', authenticateToken, requirePermission('transactions:read'), (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'finco-webhooks',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /money-in',
      'POST /status-update',
      'POST /cep'
    ]
  });
});

/**
 * GET /api/webhooks/finco/logs
 * Obtener logs de webhooks recientes (para debugging)
 */
router.get('/logs', authenticateToken, requirePermission('transactions:read'), async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await webhookService.getRecentLogs(limit);

    res.status(200).json({
      count: logs.length,
      logs
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/webhooks/finco/stats
 * Obtener estadísticas de webhooks
 */
router.get('/stats', authenticateToken, requirePermission('transactions:read'), async (req: Request, res: Response) => {
  try {
    const stats = await webhookService.getStats();
    res.status(200).json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
