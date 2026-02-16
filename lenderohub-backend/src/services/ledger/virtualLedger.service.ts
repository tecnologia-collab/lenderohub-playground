// src/services/ledger/virtualLedger.service.ts
/**
 * Virtual Ledger Service
 *
 * Maneja los balances internos de las cuentas:
 * - Procesa depósitos entrantes (MONEY_IN)
 * - Procesa actualizaciones de estado (STATUS_UPDATE)
 * - Actualiza balances con transacciones atómicas
 * - Crea movimientos de cuenta para auditoría
 */

import mongoose from 'mongoose';
import * as dinero from 'dinero.js';
const Dinero = dinero.default || dinero;
import { InternalAccount, IInternalAccount } from '../../models/accounts.model';
import { AccountMovement } from '../../models/accountMovements.model';
import {
  TransactionTransferIn,
  TransactionTransferInStatus,
  TransactionTransferOut,
  TransactionTransferOutStatus,
  TransactionVirtualBetween,
  TransactionVirtualBetweenSubtype
} from '../../models/transactions.model';
import { CommissionRequest, CommissionRequestStatus } from '../../models/commissionRequests.model';
import {
  WebhookMoneyInEvent,
  WebhookStatusUpdateEvent,
  webhookService
} from '../webhooks/webhook.service';
import { commissionsService } from '../commissions/commissions.service';

// ============== TIPOS ==============

export interface LedgerResult {
  success: boolean;
  transactionId?: string;
  accountId?: string;
  previousBalance?: number;
  newBalance?: number;
  message: string;
}

export interface BalanceSnapshot {
  balance: number;
  balanceWithheld: number;
  balanceAvailable: number;
  currency: string;
}

// ============== SERVICIO ==============

export class VirtualLedgerService {

  /**
   * Procesa un depósito entrante (MONEY_IN)
   * 1. Busca la cuenta destino por CLABE
   * 2. Crea TransactionTransferIn
   * 3. Actualiza el balance
   * 4. Registra el movimiento
   */
  async processDeposit(event: WebhookMoneyInEvent): Promise<LedgerResult> {
    const { body } = event;
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      console.log('💰 [VirtualLedger] Procesando depósito:', {
        amount: body.amount,
        from: body.payer_name,
        to: body.beneficiary_account,
        trackingKey: body.tracking_key
      });

      // 1. Buscar cuenta destino por CLABE (fullNumber)
      const account = await InternalAccount.findOne<IInternalAccount>({
        fullNumber: body.beneficiary_account
      }).session(session) as mongoose.HydratedDocument<IInternalAccount> | null;

      if (!account) {
        console.warn('⚠️ [VirtualLedger] Cuenta no encontrada para CLABE:', body.beneficiary_account);
        await session.abortTransaction();
        return {
          success: false,
          message: `Account not found for CLABE: ${body.beneficiary_account}`
        };
      }

      // 2. Convertir monto a centavos (Dinero.js usa centavos)
      const amountCents = Math.round(parseFloat(body.amount) * 100);

      // 3. Guardar balance anterior
      const previousBalance = (account.balance as any)?.amount || 0;

      // 4. Crear TransactionTransferIn
      const transaction = new TransactionTransferIn({
        fromAccount: body.payer_account,
        fromName: body.payer_name,
        fromRfc: body.payer_rfc || 'XAXX010101000',
        toAccount: account._id,
        amountTotal: { amount: amountCents, precision: 2, currency: 'MXN' },
        amountTransfer: { amount: amountCents, precision: 2, currency: 'MXN' },
        amountCommission: { amount: 0, precision: 2, currency: 'MXN' },
        amountDistributed: { amount: 0, precision: 2, currency: 'MXN' },
        status: TransactionTransferInStatus.Liquidated,
        reference: body.numeric_reference || '',
        description: body.payment_concept || 'Depósito SPEI',
        trackingCode: body.tracking_key,
        stpId: parseInt(body.id) || 0,
        transactedAt: new Date(body.transaction_date),
        operatedAt: new Date(body.registered_at),
        liquidatedAt: new Date(),
        fincoData: {
          transactionId: body.id,
          subCategory: body.sub_category,
          ownerId: body.owner_id
        }
      });

      await transaction.save({ session });

      // 5. Aplicar comisiones y movimientos relacionados
      await commissionsService.applyTransferInCommission({
        session,
        transaction,
        toAccount: account
      });

      // 6. Commit de la transacción
      await session.commitTransaction();

      const newBalance = (account.balance as any)?.amount || 0;

      console.log('✅ [VirtualLedger] Depósito procesado:', {
        transactionId: transaction._id.toString(),
        accountId: account._id.toString(),
        previousBalance: previousBalance / 100,
        newBalance: newBalance / 100,
        amount: amountCents / 100
      });

      return {
        success: true,
        transactionId: transaction._id.toString(),
        accountId: account._id.toString(),
        previousBalance: previousBalance / 100,
        newBalance: newBalance / 100,
        message: `Deposit processed: $${body.amount} MXN from ${body.payer_name}`
      };

    } catch (error: any) {
      await session.abortTransaction();
      console.error('❌ [VirtualLedger] Error procesando depósito:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Procesa actualización de estado de Money Out
   * Maneja: LIQUIDATED, REFUND, REJECTED
   */
  async processStatusUpdate(event: WebhookStatusUpdateEvent): Promise<LedgerResult> {
    const { body } = event;
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      console.log('🔄 [VirtualLedger] Procesando status update:', {
        transactionId: body.id,
        trackingKey: body.tracking_key,
        status: body.status
      });

      // 1. Buscar transacción por tracking_key
      const transaction = await TransactionTransferOut.findOne({
        trackingCode: body.tracking_key
      }).populate('fromAccount').session(session);

      if (!transaction) {
        console.warn('⚠️ [VirtualLedger] Transacción no encontrada:', body.tracking_key);
        await session.abortTransaction();
        return {
          success: false,
          message: `Transaction not found: ${body.tracking_key}`
        };
      }

      const oldStatus = transaction.status;

      // 2. Procesar según el nuevo estado
      switch (body.status) {
        case 'LIQUIDATED':
          await this.handleLiquidated(transaction, session);
          break;

        case 'REFUND':
          await this.handleRefund(transaction, body.reason_description, session);
          break;

        case 'REJECTED':
          await this.handleRejected(transaction, body.reason_description, session);
          break;

        case 'INITIALIZED':
          // Estado inicial, no requiere acción
          console.log('ℹ️ [VirtualLedger] Estado INITIALIZED - sin acción');
          break;

        default:
          console.warn('⚠️ [VirtualLedger] Estado desconocido:', body.status);
      }

      await session.commitTransaction();

      console.log(`✅ [VirtualLedger] Status actualizado: ${oldStatus} → ${body.status}`);

      return {
        success: true,
        transactionId: transaction._id.toString(),
        message: `Transaction ${body.tracking_key} updated: ${oldStatus} → ${body.status}`
      };

    } catch (error: any) {
      await session.abortTransaction();
      console.error('❌ [VirtualLedger] Error procesando status update:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Maneja transacción LIQUIDATED
   * La transacción ya fue enviada, solo actualizar estado y timestamp
   */
  private async handleLiquidated(
    transaction: mongoose.HydratedDocument<any>,
    session: mongoose.ClientSession
  ): Promise<void> {
    transaction.status = TransactionTransferOutStatus.Liquidated;
    transaction.liquidatedAt = new Date();
    await transaction.save({ session });

    // Liberar balance retenido
    const account = transaction.fromAccount as mongoose.HydratedDocument<IInternalAccount>;
    if (account && account.balanceWithheld) {
      const amountWithheld = (transaction.amountTotal as any)?.amount || 0;
      if (amountWithheld > 0) {
        const amountDinero = Dinero({ amount: amountWithheld, currency: 'MXN', precision: 2 });

        const movement = account.movement({
          type: 'liquidation',
          balanceWithheldDelta: amountDinero,
          balanceWithheldOperator: 'subtract',
          transaction: transaction,
          comment: `Liquidación confirmada - ${transaction.trackingCode}`
        });

        await movement.save({ session });
        await account.save({ session });
      }
    }

    if (transaction.commissionRequest) {
      const request = await CommissionRequest.findById(transaction.commissionRequest).session(session);
      if (request) {
        request.status = CommissionRequestStatus.Completed;
        await request.save({ session });
      }

      const commissionBreakdown = transaction.commissionBreakdown as Map<string, any> | undefined;
      if (commissionBreakdown && commissionBreakdown.size > 0) {
        const tags = Array.from(commissionBreakdown.keys());
        const fromAccount = transaction.fromAccount as mongoose.HydratedDocument<IInternalAccount>;
        await fromAccount.populate('costCentre');
        const costCentre = fromAccount.costCentre as any;
        const internalAccounts = await InternalAccount.find({
          costCentre: costCentre?._id,
          tag: { $in: tags }
        }).session(session);

        for (const [tag, rawAmount] of commissionBreakdown.entries()) {
          const toAccount = internalAccounts.find((internalAccount) => internalAccount.tag === tag);
          if (!toAccount) {
            continue;
          }
          const amountDinero = typeof rawAmount?.getAmount === 'function'
            ? rawAmount
            : (rawAmount && typeof rawAmount.amount === 'number')
                ? Dinero({ amount: rawAmount.amount, precision: rawAmount.precision || 2, currency: rawAmount.currency || 'MXN' })
                : Dinero({ amount: 0, precision: 2, currency: 'MXN' });

          if (amountDinero.isZero()) {
            continue;
          }

          const virtualTransaction = new TransactionVirtualBetween({
            subtype: TransactionVirtualBetweenSubtype.Commission,
            fromAccount: transaction.fromAccount,
            toAccount,
            amountTransfer: amountDinero,
            parentTransaction: transaction
          });

          const movement = toAccount.movement({
            type: 'funding',
            balanceDelta: amountDinero,
            transaction
          });

          await virtualTransaction.save({ session });
          await movement.save({ session });
          await toAccount.save({ session });
        }
      }
    }
  }

  /**
   * Maneja transacción REFUND
   * Liberar balance retenido y devolver al balance disponible
   */
  private async handleRefund(
    transaction: mongoose.HydratedDocument<any>,
    reason: string | undefined,
    session: mongoose.ClientSession
  ): Promise<void> {
    transaction.status = TransactionTransferOutStatus.Refunded;
    transaction.refundedAt = new Date();
    transaction.failureReason = reason || 'Refund by bank';
    await transaction.save({ session });

    // Devolver fondos al balance
    const account = transaction.fromAccount as mongoose.HydratedDocument<IInternalAccount>;
    if (account) {
      const amountTotal = (transaction.amountTotal as any)?.amount || 0;
      if (amountTotal > 0) {
        const amountDinero = Dinero({ amount: amountTotal, currency: 'MXN', precision: 2 });

        // 1. Liberar balance retenido
        const releaseMovement = account.movement({
          type: 'refund',
          balanceWithheldDelta: amountDinero,
          balanceWithheldOperator: 'subtract',
          transaction: transaction,
          comment: `Liberación por refund - ${reason || 'N/A'}`
        });

        // 2. Devolver al balance principal
        const refundMovement = account.movement({
          type: 'refund',
          balanceDelta: amountDinero,
          balanceOperator: 'add',
          transaction: transaction,
          comment: `Devolución de fondos - ${transaction.trackingCode}`
        });

        await releaseMovement.save({ session });
        await refundMovement.save({ session });
        await account.save({ session });

        console.log('💸 [VirtualLedger] Fondos devueltos:', {
          account: account._id.toString(),
          amount: amountTotal / 100
        });
      }
    }
  }

  /**
   * Maneja transacción REJECTED
   * Similar a refund pero con estado diferente
   */
  private async handleRejected(
    transaction: mongoose.HydratedDocument<any>,
    reason: string | undefined,
    session: mongoose.ClientSession
  ): Promise<void> {
    transaction.status = TransactionTransferOutStatus.Failed;
    transaction.failureReason = reason || 'Rejected by bank';
    await transaction.save({ session });

    // Devolver fondos al balance
    const account = transaction.fromAccount as mongoose.HydratedDocument<IInternalAccount>;
    if (account) {
      const amountTotal = (transaction.amountTotal as any)?.amount || 0;
      if (amountTotal > 0) {
        const amountDinero = Dinero({ amount: amountTotal, currency: 'MXN', precision: 2 });

        // 1. Liberar balance retenido
        const releaseMovement = account.movement({
          type: 'cancellation',
          balanceWithheldDelta: amountDinero,
          balanceWithheldOperator: 'subtract',
          transaction: transaction,
          comment: `Liberación por rechazo - ${reason || 'N/A'}`
        });

        // 2. Devolver al balance principal
        const refundMovement = account.movement({
          type: 'cancellation',
          balanceDelta: amountDinero,
          balanceOperator: 'add',
          transaction: transaction,
          comment: `Devolución por rechazo - ${transaction.trackingCode}`
        });

        await releaseMovement.save({ session });
        await refundMovement.save({ session });
        await account.save({ session });

        console.log('💸 [VirtualLedger] Fondos devueltos por rechazo:', {
          account: account._id.toString(),
          amount: amountTotal / 100
        });
      }
    }
  }

  // ============== CONSULTAS ==============

  /**
   * Obtiene el snapshot de balance de una cuenta
   */
  async getAccountBalance(accountId: string): Promise<BalanceSnapshot | null> {
    const account = await InternalAccount.findById<IInternalAccount>(accountId) as mongoose.HydratedDocument<IInternalAccount> | null;
    if (!account) return null;

    const balance = (account.balance as any)?.amount || 0;
    const balanceWithheld = (account.balanceWithheld as any)?.amount || 0;

    return {
      balance: balance / 100,
      balanceWithheld: balanceWithheld / 100,
      balanceAvailable: (balance - balanceWithheld) / 100,
      currency: 'MXN'
    };
  }

  /**
   * Obtiene el balance de una cuenta por CLABE
   */
  async getAccountBalanceByClabe(clabe: string): Promise<BalanceSnapshot | null> {
    const account = await InternalAccount.findOne<IInternalAccount>({ fullNumber: clabe }) as mongoose.HydratedDocument<IInternalAccount> | null;
    if (!account) return null;

    const balance = (account.balance as any)?.amount || 0;
    const balanceWithheld = (account.balanceWithheld as any)?.amount || 0;

    return {
      balance: balance / 100,
      balanceWithheld: balanceWithheld / 100,
      balanceAvailable: (balance - balanceWithheld) / 100,
      currency: 'MXN'
    };
  }

  /**
   * Obtiene los movimientos recientes de una cuenta
   */
  async getRecentMovements(accountId: string, limit: number = 50): Promise<any[]> {
    return AccountMovement.find({ account: accountId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('transaction')
      .lean();
  }

  /**
   * Reserva balance para una transacción saliente
   * Usado cuando se crea un Money Out
   */
  async reserveBalance(
    accountId: string,
    amountCents: number,
    transactionId: string,
    comment: string
  ): Promise<LedgerResult> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const account = await InternalAccount.findById<IInternalAccount>(accountId).session(session) as mongoose.HydratedDocument<IInternalAccount> | null;
      if (!account) {
        await session.abortTransaction();
        return { success: false, message: 'Account not found' };
      }

      // Verificar balance disponible
      const balance = (account.balance as any)?.amount || 0;
      const balanceWithheld = (account.balanceWithheld as any)?.amount || 0;
      const balanceAvailable = balance - balanceWithheld;

      if (amountCents > balanceAvailable) {
        await session.abortTransaction();
        return {
          success: false,
          message: `Insufficient balance. Available: ${balanceAvailable / 100}, Required: ${amountCents / 100}`
        };
      }

      const transaction = await TransactionTransferOut.findById(transactionId).session(session);
      const amountDinero = Dinero({ amount: amountCents, currency: 'MXN', precision: 2 });

      // Crear movimiento de captura (reserve)
      const movement = account.movement({
        type: 'capture',
        balanceWithheldDelta: amountDinero,
        balanceWithheldOperator: 'add',
        transaction: transaction || undefined,
        comment: comment
      });

      await movement.save({ session });
      await account.save({ session });
      await session.commitTransaction();

      const newBalanceWithheld = (account.balanceWithheld as any)?.amount || 0;

      return {
        success: true,
        accountId: accountId,
        previousBalance: balanceWithheld / 100,
        newBalance: newBalanceWithheld / 100,
        message: `Reserved ${amountCents / 100} MXN`
      };

    } catch (error: any) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

// Singleton export
export const virtualLedgerService = new VirtualLedgerService();
