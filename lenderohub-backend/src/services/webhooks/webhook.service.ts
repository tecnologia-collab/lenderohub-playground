// src/services/webhooks/webhook.service.ts
/**
 * Servicio para procesar webhooks de Finco
 * Tipos: MONEY_IN, STATUS_UPDATE, CEP
 */

import mongoose from 'mongoose';
import {
  TransactionTransferIn,
  TransactionTransferInStatus,
  TransactionTransferOut,
  TransactionTransferOutStatus
} from '../../models/transactions.model';
import { AccountMovement } from '../../models/accountMovements.model';
import { InternalAccount } from '../../models/accounts.model';
import { virtualLedgerService } from '../ledger/virtualLedger.service';
import { emailService } from '../email';
import {
  BeneficiaryVerification,
  VerificationStatus
} from '../../models/beneficiaryVerifications.model';

// ============== TIPOS DE WEBHOOK ==============

export interface WebhookMoneyInEvent {
  id_msg: string;
  msg_name: 'MONEY_IN';
  msg_date: string;
  body: {
    id: string;
    beneficiary_account: string;
    beneficiary_name: string;
    beneficiary_rfc: string;
    payer_account: string;
    payer_name: string;
    payer_rfc: string;
    payer_institution: string;
    payer_email?: string;
    amount: string;
    transaction_date: string;
    tracking_key: string;
    payment_concept: string;
    numeric_reference: string;
    sub_category: 'SPEI_CREDIT' | 'INT_CREDIT';
    registered_at: string;
    owner_id: string;
  };
}

export interface WebhookStatusUpdateEvent {
  id_msg: string;
  msg_name: 'STATUS_UPDATE';
  msg_date: string;
  body: {
    id: string;
    tracking_key: string;
    message_type: string;
    reason?: string;
    reason_description?: string;
    status: 'INITIALIZED' | 'LIQUIDATED' | 'REFUND' | 'REJECTED';
  };
}

export interface WebhookCepEvent {
  id_msg: string;
  msg_name: 'CEP';
  msg_date: string;
  body: {
    id: string;
    tracking_key: string;
    external_reference?: string;
    payment_concept?: string;
    beneficiary_account: string;
    beneficiary_name: string;
    beneficiary_rfc?: string;
    status: 'INITIALIZED' | 'PENDING' | 'DELAYED' | 'COMPLETED' | 'FAILED';
    processed_at?: string | null;
  };
}

// ============== MODELO PARA AUDIT LOG ==============

interface IWebhookLog {
  idMsg: string;
  msgName: string;
  msgDate: string;
  payload: any;
  status: 'received' | 'processed' | 'failed' | 'duplicate';
  error?: string;
  processedAt?: Date;
  createdAt: Date;
}

const webhookLogSchema = new mongoose.Schema<IWebhookLog>({
  idMsg: { type: String, required: true, unique: true },
  msgName: { type: String, required: true },
  msgDate: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  status: {
    type: String,
    enum: ['received', 'processed', 'failed', 'duplicate'],
    default: 'received'
  },
  error: { type: String },
  processedAt: { type: Date }
}, {
  collection: 'webhookLogs',
  timestamps: true
});

export const WebhookLog = mongoose.model<IWebhookLog>('WebhookLog', webhookLogSchema);

// ============== SERVICIO ==============

export class WebhookService {
  private async resolveBeneficiaryEmail(accountId?: string, clabe?: string): Promise<string | null> {
    if (accountId) {
      const account = await InternalAccount.findById(accountId).populate('costCentre').lean();
      const costCentre = (account as any)?.costCentre;
      return costCentre?.contact?.email || null;
    }
    if (clabe) {
      const account = await InternalAccount.findOne({ fullNumber: clabe }).populate('costCentre').lean();
      const costCentre = (account as any)?.costCentre;
      return costCentre?.contact?.email || null;
    }
    return null;
  }

  /**
   * Verifica si un webhook ya fue procesado (idempotencia)
   */
  async isDuplicate(idMsg: string): Promise<boolean> {
    const existing = await WebhookLog.findOne({ idMsg });
    return !!existing;
  }

  /**
   * Registra un webhook recibido
   */
  async logWebhook(event: WebhookMoneyInEvent | WebhookStatusUpdateEvent | WebhookCepEvent): Promise<IWebhookLog> {
    const log = new WebhookLog({
      idMsg: event.id_msg,
      msgName: event.msg_name,
      msgDate: event.msg_date,
      payload: event,
      status: 'received'
    });
    await log.save();
    return log;
  }

  /**
   * Actualiza el estado del log
   */
  async updateLogStatus(idMsg: string, status: 'processed' | 'failed' | 'duplicate', error?: string): Promise<void> {
    await WebhookLog.updateOne(
      { idMsg },
      {
        status,
        error,
        processedAt: status === 'processed' ? new Date() : undefined
      }
    );
  }

  // ============== MONEY IN ==============

  /**
   * Procesa webhook MONEY_IN
   * Crea transacción de entrada y actualiza balance usando VirtualLedgerService
   */
  async processMoneyIn(event: WebhookMoneyInEvent): Promise<{
    success: boolean;
    transactionId?: string;
    accountId?: string;
    message: string;
  }> {
    const { body } = event;

    console.log('💰 Procesando MONEY_IN:', {
      amount: body.amount,
      from: body.payer_name,
      to: body.beneficiary_account,
      trackingKey: body.tracking_key
    });

    try {
      // 1. Verificar idempotencia
      if (await this.isDuplicate(event.id_msg)) {
        console.log('⚠️ Webhook duplicado:', event.id_msg);
        return { success: true, message: 'Webhook already processed (duplicate)' };
      }

      // 2. Registrar webhook
      await this.logWebhook(event);

      // 3. Procesar depósito usando VirtualLedgerService
      const result = await virtualLedgerService.processDeposit(event);

      // 4. Marcar webhook como procesado o fallido
      if (result.success) {
        await this.updateLogStatus(event.id_msg, 'processed');
      } else {
        await this.updateLogStatus(event.id_msg, 'failed', result.message);
      }

      if (result.success) {
        // TODO: Create in-app notification for account owner (transfer_received)
        // Requires: account -> costCentre -> client -> users lookup
        // notificationsService.create({ userId, type: NotificationType.TransferReceived, ... })

        const payerEmail = (body as any).payer_email as string | undefined;
        const beneficiaryEmail = await this.resolveBeneficiaryEmail(result.accountId, body.beneficiary_account);
        const amountFormatted = `${Number(body.amount).toFixed(2)} MXN`;

        await Promise.all([
          payerEmail
            ? emailService.sendMoneyInNotification({
                to: payerEmail,
                role: 'ordenante',
                trackingKey: body.tracking_key,
                amount: amountFormatted,
                payerName: body.payer_name,
                beneficiaryAccount: body.beneficiary_account
              })
            : Promise.resolve(true),
          beneficiaryEmail
            ? emailService.sendMoneyInNotification({
                to: beneficiaryEmail,
                role: 'beneficiario',
                trackingKey: body.tracking_key,
                amount: amountFormatted,
                payerName: body.payer_name,
                beneficiaryAccount: body.beneficiary_account
              })
            : Promise.resolve(true)
        ]);
      }

      return {
        success: result.success,
        transactionId: result.transactionId,
        accountId: result.accountId,
        message: result.message
      };

    } catch (error: any) {
      console.error('❌ Error procesando MONEY_IN:', error);
      await this.updateLogStatus(event.id_msg, 'failed', error.message);
      throw error;
    }
  }

  // ============== STATUS UPDATE ==============

  /**
   * Procesa webhook STATUS_UPDATE
   * Actualiza estado de transacción Money Out usando VirtualLedgerService
   */
  async processStatusUpdate(event: WebhookStatusUpdateEvent): Promise<{
    success: boolean;
    transactionId?: string;
    message: string;
  }> {
    const { body } = event;

    console.log('🔄 Procesando STATUS_UPDATE:', {
      transactionId: body.id,
      trackingKey: body.tracking_key,
      status: body.status,
      reason: body.reason_description
    });

    try {
      // 1. Verificar idempotencia
      if (await this.isDuplicate(event.id_msg)) {
        console.log('⚠️ Webhook duplicado:', event.id_msg);
        return { success: true, message: 'Webhook already processed (duplicate)' };
      }

      // 2. Registrar webhook
      await this.logWebhook(event);

      // 3. Procesar status update usando VirtualLedgerService
      const result = await virtualLedgerService.processStatusUpdate(event);

      // 4. Marcar webhook como procesado o fallido
      if (result.success) {
        await this.updateLogStatus(event.id_msg, 'processed');
      } else {
        // Si no encontró la transacción, lo marcamos como procesado (no es error crítico)
        await this.updateLogStatus(event.id_msg, 'processed');
      }

      return {
        success: result.success,
        transactionId: result.transactionId,
        message: result.message
      };

    } catch (error: any) {
      console.error('❌ Error procesando STATUS_UPDATE:', error);
      await this.updateLogStatus(event.id_msg, 'failed', error.message);
      throw error;
    }
  }

  // ============== CEP ==============

  /**
   * Procesa webhook CEP (Comprobante Electronico de Pago)
   * Updates BeneficiaryVerification record based on CEP status.
   *
   * CEP statuses from Finco:
   *   INITIALIZED (transient, treat as PENDING)
   *   PENDING - waiting for CEP retrieval
   *   DELAYED - taking longer than expected, retries continue
   *   COMPLETED - CEP available, beneficiary verified
   *   FAILED - CEP unavailable or permanently failed
   */
  async processCep(event: WebhookCepEvent): Promise<{
    success: boolean;
    message: string;
  }> {
    const { body } = event;

    console.log('📄 Procesando CEP:', {
      transactionId: body.id,
      trackingKey: body.tracking_key,
      status: body.status,
      beneficiary: body.beneficiary_name,
      beneficiaryAccount: body.beneficiary_account
    });

    try {
      // 1. Verificar idempotencia
      if (await this.isDuplicate(event.id_msg)) {
        console.log('⚠️ Webhook duplicado:', event.id_msg);
        return { success: true, message: 'Webhook already processed (duplicate)' };
      }

      // 2. Registrar webhook
      await this.logWebhook(event);

      // 3. Find the BeneficiaryVerification record by transactionId or trackingKey
      const verification = await BeneficiaryVerification.findOne({
        $or: [
          { transactionId: body.id },
          { trackingId: body.tracking_key }
        ]
      });

      if (!verification) {
        // Also check legacy: TransactionTransferOut for backwards compat
        const legacyTransaction = await TransactionTransferOut.findOne({
          $or: [
            { trackingCode: body.tracking_key },
            { 'fincoData.transactionId': body.id }
          ]
        });

        if (!legacyTransaction) {
          console.warn('⚠️ No verification record or transaction found for CEP:', body.id, body.tracking_key);
          await this.updateLogStatus(event.id_msg, 'processed');
          return { success: true, message: 'No verification record found for this CEP' };
        }

        // Legacy path -- just log it
        console.log('ℹ️ CEP matched a legacy transaction (not penny validation):', legacyTransaction._id);
        await this.updateLogStatus(event.id_msg, 'processed');
        return { success: true, message: `CEP for legacy transaction: ${body.status}` };
      }

      // 4. Map Finco CEP status to our VerificationStatus
      let newStatus: VerificationStatus;
      switch (body.status) {
        case 'COMPLETED':
          newStatus = VerificationStatus.Verified;
          break;
        case 'FAILED':
          newStatus = VerificationStatus.Failed;
          break;
        case 'DELAYED':
          newStatus = VerificationStatus.Delayed;
          break;
        case 'INITIALIZED':
        case 'PENDING':
        default:
          newStatus = VerificationStatus.Pending;
          break;
      }

      // 5. Update BeneficiaryVerification record
      const updateData: Record<string, any> = {
        status: newStatus
      };

      // Always update beneficiary info if provided
      if (body.beneficiary_name) {
        updateData.beneficiaryName = body.beneficiary_name;
      }
      if (body.beneficiary_rfc) {
        updateData.beneficiaryRfc = body.beneficiary_rfc;
      }
      if (body.beneficiary_account) {
        updateData.beneficiaryAccount = body.beneficiary_account;
      }
      if (body.tracking_key && !verification.trackingId) {
        updateData.trackingId = body.tracking_key;
      }

      // Set processedAt for terminal states
      if (body.status === 'COMPLETED' || body.status === 'FAILED') {
        updateData.processedAt = body.processed_at ? new Date(body.processed_at) : new Date();
      }

      await BeneficiaryVerification.updateOne(
        { _id: verification._id },
        { $set: updateData }
      );

      if (body.status === 'COMPLETED') {
        console.log('✅ Penny validation COMPLETED - beneficiary verified:', {
          instrumentId: verification.instrumentId,
          name: body.beneficiary_name,
          account: body.beneficiary_account
        });
      } else if (body.status === 'FAILED') {
        console.log('❌ Penny validation FAILED for instrument:', verification.instrumentId);
      } else {
        console.log(`ℹ️ CEP status ${body.status} for instrument:`, verification.instrumentId);
      }

      // 6. Marcar webhook como procesado
      await this.updateLogStatus(event.id_msg, 'processed');

      return {
        success: true,
        message: `CEP processed: ${body.status} for instrument ${verification.instrumentId}`
      };

    } catch (error: any) {
      console.error('❌ Error procesando CEP:', error);
      await this.updateLogStatus(event.id_msg, 'failed', error.message);
      throw error;
    }
  }

  // ============== UTILIDADES ==============

  /**
   * Obtiene logs de webhooks recientes
   */
  async getRecentLogs(limit: number = 50): Promise<IWebhookLog[]> {
    return WebhookLog.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Obtiene estadísticas de webhooks
   */
  async getStats(): Promise<{
    total: number;
    processed: number;
    failed: number;
    duplicates: number;
    byType: Record<string, number>;
  }> {
    const [stats, byType] = await Promise.all([
      WebhookLog.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      WebhookLog.aggregate([
        {
          $group: {
            _id: '$msgName',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const statusCounts = stats.reduce((acc, s) => {
      acc[s._id] = s.count;
      return acc;
    }, {} as Record<string, number>);

    const typeCounts = byType.reduce((acc, t) => {
      acc[t._id] = t.count;
      return acc;
    }, {} as Record<string, number>);

    const values = Object.values(statusCounts) as number[];
    return {
      total: values.reduce((a, b) => a + b, 0),
      processed: statusCounts.processed || 0,
      failed: statusCounts.failed || 0,
      duplicates: statusCounts.duplicate || 0,
      byType: typeCounts
    };
  }
}

// Singleton export
export const webhookService = new WebhookService();
