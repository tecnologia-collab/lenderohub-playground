/**
 * Transfers Controller
 *
 * Handles Money Out (SPEI) and internal transfers
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Dinero from 'dinero.js';
import { FincoClient } from '../integrations/finco/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { VirtualBagAccount, InternalAccount, ExternalAccount, InternalAccountTag } from '../models/accounts.model';
import { CostCentre } from '../models/providerAccounts.model';
import {
  TransactionTransferIn,
  TransactionTransferInStatus,
  TransactionTransferOut,
  TransactionTransferOutStatus,
  TransactionTransferBetween
} from '../models/transactions.model';
import { emailService } from '../services/email';
import { getTransactionValidationService } from '../services/transactions/transactionValidation.service';
import { auditService, AuditAction } from '../services/audit';

// Instanciar FincoClient
const fincoClient = new FincoClient({
  apiUrl: process.env.FINCO_API_URL || 'https://apicore.stg.finch.lat',
  clientId: process.env.FINCO_CLIENT_ID || '',
  clientSecret: process.env.FINCO_CLIENT_SECRET || '',
  apiKey: process.env.FINCO_API_KEY || '',
  environment: (process.env.FINCO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox'
});

type LedgerTransfer = any;

const toMoneyAmount = (value: any): number => {
  if (value == null) return 0;
  if (typeof value === 'number') return value / 100;
  if (typeof value.amount === 'number') return value.amount / 100;
  return 0;
};

const mapTransferOutStatus = (status: string): string => {
  switch (status) {
    case TransactionTransferOutStatus.New:
      return 'INITIALIZED';
    case TransactionTransferOutStatus.Sent:
      return 'PROCESSING';
    case TransactionTransferOutStatus.Liquidated:
      return 'LIQUIDATED';
    case TransactionTransferOutStatus.Cancelled:
      return 'CANCELLED';
    case TransactionTransferOutStatus.Refunded:
      return 'REFUNDED';
    case TransactionTransferOutStatus.Failed:
      return 'FAILED';
    default:
      return 'PENDING';
  }
};

const mapTransferInStatus = (status: string): string => {
  switch (status) {
    case TransactionTransferInStatus.New:
      return 'PENDING';
    case TransactionTransferInStatus.Liquidated:
      return 'LIQUIDATED';
    case TransactionTransferInStatus.Rejected:
      return 'FAILED';
    default:
      return 'PENDING';
  }
};

const mapLedgerTransferOut = async (tx: LedgerTransfer) => {
  const toAccount = tx.toAccount as any;
  const beneficiary = toAccount?.beneficiary as any;
  const beneficiaryName = beneficiary?.name || beneficiary?.alias || toAccount?.alias || 'Beneficiario';
  const beneficiaryClabe = toAccount?.fullNumber || toAccount?.clabeNumber;

  const fromAccount = tx.fromAccount as any;
  const sourceName = fromAccount?.alias || fromAccount?.additionalInformation?.name || 'Cuenta Origen';
  const sourceClabe = fromAccount?.fullNumber || '';

  return {
    id: tx._id?.toString(),
    bankId: '',
    clientId: '',
    externalReference: tx.reference,
    trackingId: tx.trackingCode,
    description: tx.description,
    amount: toMoneyAmount(tx.amountTotal).toFixed(2),
    currency: 'MXN',
    category: 'DEBIT_TRANS',
    subCategory: 'SPEI_DEBIT',
    transactionStatus: mapTransferOutStatus(tx.status),
    audit: {
      createdAt: tx.createdAt?.toISOString?.() || tx.createdAt,
      updatedAt: tx.updatedAt?.toISOString?.() || tx.updatedAt,
      deletedAt: null,
      blockedAt: null
    },
    sourceInstrument: {
      instrumentDetail: {
        holderName: sourceName,
        clabeNumber: sourceClabe
      }
    },
    destinationInstrument: {
      instrumentDetail: {
        holderName: beneficiaryName,
        clabeNumber: beneficiaryClabe
      }
    }
  };
};

const mapLedgerTransferIn = async (tx: LedgerTransfer) => {
  const toAccount = tx.toAccount as any;
  const destinationName = toAccount?.alias || toAccount?.additionalInformation?.name || 'Cuenta Destino';
  const destinationClabe = toAccount?.fullNumber || '';

  return {
    id: tx._id?.toString(),
    bankId: '',
    clientId: '',
    externalReference: tx.reference,
    trackingId: tx.trackingCode,
    description: tx.description,
    amount: toMoneyAmount(tx.amountTotal).toFixed(2),
    currency: 'MXN',
    category: 'CREDIT_TRANS',
    subCategory: 'SPEI_CREDIT',
    transactionStatus: mapTransferInStatus(tx.status),
    audit: {
      createdAt: tx.createdAt?.toISOString?.() || tx.createdAt,
      updatedAt: tx.updatedAt?.toISOString?.() || tx.updatedAt,
      deletedAt: null,
      blockedAt: null
    },
    sourceInstrument: {
      instrumentDetail: {
        holderName: tx.fromName || 'Remitente',
        clabeNumber: tx.fromAccount || ''
      }
    },
    destinationInstrument: {
      instrumentDetail: {
        holderName: destinationName,
        clabeNumber: destinationClabe
      }
    }
  };
};

// MED-04: Helper to get accessible account IDs for subaccount users
const getAccessibleAccountIds = async (user: any): Promise<string[] | null> => {
  if (!user || user.profileType === 'corporate' || user.profileType === 'administrator') {
    return null; // null means no filter (return all)
  }
  // For subaccount users, filter by their client's costCentres
  if (user.profileType === 'subaccount' && user.clientId) {
    const costCentres = await CostCentre.find({
      client: user.clientId,
      disabled: { $ne: true }
    }).select('_id');
    const costCentreIds = costCentres.map(cc => cc._id);
    const accounts = await InternalAccount.find({
      costCentre: { $in: costCentreIds }
    }).select('_id');
    return accounts.map(a => a._id.toString());
  }
  return null;
};

const getLedgerTransactions = async (limit: number, accountIds?: string[] | null) => {
  const outFilter: any = {};
  const inFilter: any = {};
  if (accountIds) {
    outFilter.fromAccount = { $in: accountIds };
    inFilter.toAccount = { $in: accountIds };
  }

  const [outTxs, inTxs] = await Promise.all([
    TransactionTransferOut.find(outFilter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({ path: 'toAccount', populate: { path: 'beneficiary' } })
      .populate('fromAccount')
      .lean(),
    TransactionTransferIn.find(inFilter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('toAccount')
      .lean()
  ]);

  const mappedOut = await Promise.all(outTxs.map((tx) => mapLedgerTransferOut(tx)));
  const mappedIn = await Promise.all(inTxs.map((tx) => mapLedgerTransferIn(tx)));
  const merged = [...mappedOut, ...mappedIn];
  merged.sort((a: any, b: any) => new Date(b.audit?.createdAt || 0).getTime() - new Date(a.audit?.createdAt || 0).getTime());
  return merged.slice(0, limit);
};

export const transfersController = {
  /**
   * POST /api/v1/transactions/money-out
   * Create a Money Out (SPEI transfer) transaction
   */
  async moneyOut(req: AuthRequest, res: Response) {
    try {
      const { beneficiary_id, amount, description, external_reference, from_account_id, beneficiary_email } = req.body;

      console.log('Money Out Request:', {
        beneficiary_id,
        amount,
        description,
        external_reference
      });

      // ================================================================
      // 1. Input validations
      // ================================================================

      if (!beneficiary_id) {
        return res.status(400).json({
          success: false,
          error: 'beneficiary_id is required',
        });
      }

      if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({
          success: false,
          error: 'Valid amount is required',
        });
      }

      if (!description) {
        return res.status(400).json({
          success: false,
          error: 'description is required',
        });
      }

      if (description.length > 40) {
        return res.status(400).json({
          success: false,
          error: 'description must be 40 characters or less',
        });
      }

      if (!/^[a-zA-Z0-9\sñÑ]+$/.test(description)) {
        return res.status(400).json({
          success: false,
          error: 'description can only contain letters, numbers, and spaces',
        });
      }

      if (external_reference) {
        if (!/^\d+$/.test(external_reference)) {
          return res.status(400).json({
            success: false,
            error: 'external_reference must be numeric',
          });
        }
        if (external_reference.length > 7) {
          return res.status(400).json({
            success: false,
            error: 'external_reference must be 7 digits or less',
          });
        }
      }

      if (beneficiary_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(beneficiary_email)) {
        return res.status(400).json({
          success: false,
          error: 'beneficiary_email must be a valid email',
        });
      }

      // ================================================================
      // 2. Resolve source account (InternalAccount or VirtualBag parent)
      // ================================================================

      let sourceInstrumentId: string | undefined;
      let sourceClabeNumber: string | undefined;
      let sourceAccount: any = null; // hydrated InternalAccount

      if (from_account_id) {
        sourceAccount = await InternalAccount.findById(from_account_id);
        if (sourceAccount) {
          sourceInstrumentId = sourceAccount.fincoInstrumentId || process.env.FINCO_INSTRUMENT_ID || undefined;
          sourceClabeNumber = sourceAccount.fullNumber;
        } else {
          const virtualBag = await VirtualBagAccount.findById(from_account_id).populate('parentAccount');
          const parentAccount = (virtualBag as any)?.parentAccount;
          if (!virtualBag || !parentAccount) {
            return res.status(400).json({
              success: false,
              error: 'from_account_id not found',
            });
          }
          // For VirtualBags the underlying InternalAccount is the parent
          sourceAccount = await InternalAccount.findById(parentAccount._id);
          sourceInstrumentId = parentAccount.fincoInstrumentId || process.env.FINCO_INSTRUMENT_ID || undefined;
          sourceClabeNumber = parentAccount.fullNumber;
        }
      } else {
        // No from_account_id: fall back to the default CECO concentration account
        const defaultCeco = await CostCentre.findOne({ default: true, disabled: { $ne: true } });
        if (defaultCeco) {
          sourceAccount = await InternalAccount.findOne({
            costCentre: defaultCeco._id,
            tag: InternalAccountTag.Concentration
          });
          if (sourceAccount) {
            sourceInstrumentId = sourceAccount.fincoInstrumentId || process.env.FINCO_INSTRUMENT_ID || undefined;
            sourceClabeNumber = sourceAccount.fullNumber;
          }
        }
      }

      // Ensure we have a source account for limit/fee logic
      if (!sourceAccount) {
        return res.status(400).json({
          success: false,
          error: 'Could not resolve source account. Provide from_account_id or configure a default cost centre.',
        });
      }

      // Self-transfer guard
      if (sourceClabeNumber) {
        const beneficiaryInstrument = await fincoClient.getInstrument(beneficiary_id);
        const beneficiaryClabe = beneficiaryInstrument?.instrumentDetail?.clabeNumber;
        if (beneficiaryClabe && beneficiaryClabe === sourceClabeNumber) {
          return res.status(400).json({
            success: false,
            error: 'invalid_beneficiary',
            message: 'No puedes transferir a la misma cuenta ordenante'
          });
        }
      }

      // ================================================================
      // 3. Resolve CostCentre from source account
      // ================================================================

      const costCentreId = sourceAccount.costCentre?.toString();
      if (!costCentreId) {
        return res.status(400).json({
          success: false,
          error: 'Source account has no cost centre assigned',
        });
      }

      const costCentre = await CostCentre.findById(costCentreId);
      if (!costCentre) {
        return res.status(400).json({
          success: false,
          error: 'Cost centre not found',
        });
      }

      // ================================================================
      // 4. Calculate fees
      // ================================================================

      const amountInCents = Math.round(parseFloat(amount) * 100);
      const validationService = getTransactionValidationService();
      const feeBreakdown = validationService.calculateTransferOutFees(costCentre, amountInCents);

      // ================================================================
      // 5. Validate monthly limits (using amountTotal which includes fees)
      // ================================================================

      const limitsCheck = await validationService.validateTransferOutLimits(
        costCentreId,
        feeBreakdown.amountTotal.amount
      );

      if (!limitsCheck.valid) {
        return res.status(400).json({
          success: false,
          error: 'transfer_limit_exceeded',
          message: limitsCheck.reason,
        });
      }

      // ================================================================
      // 6. Check available balance
      // ================================================================

      const balanceAmount = typeof sourceAccount.balance === 'object'
        ? (sourceAccount.balance as any).amount ?? 0
        : (typeof sourceAccount.balance === 'number' ? sourceAccount.balance : 0);
      const balanceWithheldAmount = typeof sourceAccount.balanceWithheld === 'object'
        ? (sourceAccount.balanceWithheld as any).amount ?? 0
        : (typeof sourceAccount.balanceWithheld === 'number' ? sourceAccount.balanceWithheld : 0);
      const balanceAvailableCents = balanceAmount - balanceWithheldAmount;

      if (balanceAvailableCents < feeBreakdown.amountTotal.amount) {
        return res.status(400).json({
          success: false,
          error: 'insufficient_balance',
          message: 'Insufficient balance to cover transfer amount plus fees',
        });
      }

      // ================================================================
      // 7. Resolve ExternalAccount (toAccount) for the beneficiary
      // ================================================================

      // beneficiary_id is a Finco instrument ID; try to find matching ExternalAccount
      const externalAccount = await ExternalAccount.findOne({
        $or: [
          { _id: mongoose.isValidObjectId(beneficiary_id) ? beneficiary_id : undefined },
          // fallback: some external accounts store the CLABE or finco instrument id
        ].filter(Boolean)
      });
      // If no ExternalAccount exists we still proceed (Finco-only beneficiary)
      const toAccountId = externalAccount?._id ?? sourceAccount._id;

      // ================================================================
      // 8. Atomic: create transaction, send to Finco, withhold balance
      // ================================================================

      const session = await mongoose.startSession();
      let txOut: any;
      let transfer: any;

      try {
        await session.withTransaction(async () => {
          // 8a. Create TransactionTransferOut record
          const reference = external_reference || `${Date.now()}`.slice(-7);

          txOut = new TransactionTransferOut({
            fromAccount: sourceAccount._id,
            toAccount: toAccountId,
            addVAT: true,
            balanceAvailableBefore: sourceAccount.balance,
            amount: feeBreakdown.totalFees,
            amountVAT: feeBreakdown.amountVAT,
            amountTransfer: feeBreakdown.transferAmount,
            amountCommission: feeBreakdown.commercialFee,
            amountTotal: feeBreakdown.amountTotal,
            commercialRule: feeBreakdown.commercialRule,
            status: TransactionTransferOutStatus.New,
            executionDate: new Date().toISOString().split('T')[0],
            reference,
            description,
            trackingCode: '', // will be generated below
            transactedAt: new Date(),
            beneficiaryEmail: beneficiary_email || undefined,
            notificationEmail: req.user?.email || undefined,
          });

          await txOut.generateTrackingCode();
          await txOut.save({ session });

          // 8b. Send to Finco (transfer amount only, not fees)
          transfer = await fincoClient.createSPEITransfer({
            destination_instrument_id: beneficiary_id,
            amount: amountInCents,
            concept: description,
            description: description,
            reference,
            source_instrument_id: sourceInstrumentId,
          });

          // 8c. Update transaction with Finco response data
          txOut.status = TransactionTransferOutStatus.Sent;
          txOut.fincoData = {
            transactionId: transfer.id,
            trackingKey: transfer.trackingId,
            status: transfer.transactionStatus || transfer.status
          };
          await txOut.save({ session });

          // 8d. Withhold balance on source account
          const freshSource = await InternalAccount.findById(sourceAccount._id).session(session);
          if (!freshSource) {
            throw new Error('Source account disappeared during transaction');
          }

          const movement = freshSource.movement({
            type: 'funding',
            balanceWithheldDelta: Dinero({ amount: feeBreakdown.amountTotal.amount, precision: 2, currency: 'MXN' }),
            balanceWithheldOperator: 'add',
            transaction: txOut,
            comment: 'Transfer out - balance withheld'
          });
          await freshSource.save({ session });
          await movement.save({ session });

          // 8e. Increment monthly accumulator
          await validationService.incrementAccumulator(
            costCentreId,
            'out',
            feeBreakdown.amountTotal.amount
          );
        });
      } finally {
        await session.endSession();
      }

      // ================================================================
      // 9. Send email notifications (fire-and-forget, outside txn)
      // ================================================================

      const ordererEmail = req.user?.email;
      const beneficiaryEmailAddr = beneficiary_email;
      const amountFormatted = `${parseFloat(amount).toFixed(2)} MXN`;

      await Promise.all([
        ordererEmail
          ? emailService.sendMoneyOutNotification({
              to: ordererEmail,
              role: 'ordenante',
              trackingId: transfer.trackingId,
              amount: amountFormatted,
              description,
            })
          : Promise.resolve(true),
        beneficiaryEmailAddr
          ? emailService.sendMoneyOutNotification({
              to: beneficiaryEmailAddr,
              role: 'beneficiario',
              trackingId: transfer.trackingId,
              amount: amountFormatted,
              description,
            })
          : Promise.resolve(true),
      ]);

      // ================================================================
      // 10. Respond
      // ================================================================

      // Audit transfer out creation
      auditService.log({
        action: AuditAction.TransferOutCreated,
        userId: req.user?._id?.toString(),
        userEmail: req.user?.email,
        targetId: txOut._id?.toString(),
        targetType: 'TransactionTransferOut',
        details: {
          amount: parseFloat(amount),
          beneficiaryId: beneficiary_id,
          description
        },
        req
      });

      return res.status(201).json({
        success: true,
        data: {
          ...transfer,
          transactionId: txOut._id?.toString(),
          trackingCode: txOut.trackingCode,
          fees: {
            transactionFee: feeBreakdown.transactionFee.amount / 100,
            commercialFee: feeBreakdown.commercialFee.amount / 100,
            vat: feeBreakdown.amountVAT.amount / 100,
            total: feeBreakdown.amountTotal.amount / 100,
          }
        },
        message: 'Transfer created successfully',
      });
    } catch (error: any) {
      console.error('Error creating Money Out:', error.message);
      return res.status(error.status || 500).json({
        success: false,
        error: 'Failed to create transfer',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/transactions/internal
   * Create an internal transfer (book-to-book) between two Monato accounts.
   * These are instant (LIQUIDATED immediately) - no SPEI involved.
   */
  async internalTransfer(req: AuthRequest, res: Response) {
    try {
      const { from_account_id, to_account_id, amount, description, external_reference } = req.body;

      console.log('Internal Transfer Request:', {
        from_account_id,
        to_account_id,
        amount,
        description,
        external_reference
      });

      // ================================================================
      // 1. Input validations
      // ================================================================

      if (!from_account_id) {
        return res.status(400).json({
          success: false,
          error: 'from_account_id is required',
        });
      }

      if (!to_account_id) {
        return res.status(400).json({
          success: false,
          error: 'to_account_id is required',
        });
      }

      if (from_account_id === to_account_id) {
        return res.status(400).json({
          success: false,
          error: 'Source and destination accounts must be different',
        });
      }

      if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({
          success: false,
          error: 'Valid amount is required',
        });
      }

      if (parseFloat(amount) <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be greater than zero',
        });
      }

      if (!description) {
        return res.status(400).json({
          success: false,
          error: 'description is required',
        });
      }

      if (description.length > 40) {
        return res.status(400).json({
          success: false,
          error: 'description must be 40 characters or less',
        });
      }

      if (!/^[a-zA-Z0-9\sñÑ]+$/.test(description)) {
        return res.status(400).json({
          success: false,
          error: 'description can only contain letters, numbers, and spaces',
        });
      }

      if (external_reference) {
        if (!/^\d+$/.test(external_reference)) {
          return res.status(400).json({
            success: false,
            error: 'external_reference must be numeric',
          });
        }
        if (external_reference.length > 7) {
          return res.status(400).json({
            success: false,
            error: 'external_reference must be 7 digits or less',
          });
        }
      }

      // ================================================================
      // 2. Find source and destination InternalAccounts
      // ================================================================

      const sourceAccount = await InternalAccount.findById(from_account_id);
      if (!sourceAccount) {
        return res.status(404).json({
          success: false,
          error: 'Source account not found',
        });
      }

      const destAccount = await InternalAccount.findById(to_account_id);
      if (!destAccount) {
        return res.status(404).json({
          success: false,
          error: 'Destination account not found',
        });
      }

      // ================================================================
      // 3. Validate instrument IDs
      // ================================================================

      const sourceInstrumentId = sourceAccount.fincoInstrumentId || process.env.FINCO_INSTRUMENT_ID;
      const destInstrumentId = destAccount.fincoInstrumentId;

      if (!sourceInstrumentId) {
        return res.status(400).json({
          success: false,
          error: 'Source account does not have a Finco instrument ID configured',
        });
      }

      if (!destInstrumentId) {
        return res.status(400).json({
          success: false,
          error: 'Destination account does not have a Finco instrument ID configured',
        });
      }

      // ================================================================
      // 4. Check available balance on source
      // ================================================================

      const amountInCents = Math.round(parseFloat(amount) * 100);

      const balanceAmount = typeof sourceAccount.balance === 'object'
        ? (sourceAccount.balance as any).amount ?? 0
        : (typeof sourceAccount.balance === 'number' ? sourceAccount.balance : 0);
      const balanceWithheldAmount = typeof sourceAccount.balanceWithheld === 'object'
        ? (sourceAccount.balanceWithheld as any).amount ?? 0
        : (typeof sourceAccount.balanceWithheld === 'number' ? sourceAccount.balanceWithheld : 0);
      const balanceAvailableCents = balanceAmount - balanceWithheldAmount;

      if (balanceAvailableCents < amountInCents) {
        return res.status(400).json({
          success: false,
          error: 'insufficient_balance',
          message: 'Insufficient balance to cover internal transfer amount',
        });
      }

      // ================================================================
      // 5. Atomic: call Finco, create TransactionTransferBetween, update balances
      // ================================================================

      const session = await mongoose.startSession();
      let txBetween: any;
      let transfer: any;

      try {
        await session.withTransaction(async () => {
          const reference = external_reference || `${Date.now()}`.slice(-7);

          // 5a. Call Finco internal transaction
          transfer = await fincoClient.createInternalTransfer({
            source_instrument_id: sourceInstrumentId,
            destination_instrument_id: destInstrumentId,
            amount: amountInCents,
            description,
            external_reference: reference
          });

          // 5b. Create TransactionTransferBetween record
          const amountDinero = { amount: amountInCents, precision: 2, currency: 'MXN' };
          const zeroDinero = { amount: 0, precision: 2, currency: 'MXN' };

          txBetween = new TransactionTransferBetween({
            fromAccount: sourceAccount._id,
            toAccount: destAccount._id,
            addVAT: false,
            balanceAvailableBefore: sourceAccount.balance,
            amount: amountDinero,
            amountVAT: zeroDinero,
            amountDistributed: zeroDinero,
            amountTransfer: amountDinero,
            amountCommission: zeroDinero,
            amountTotal: amountDinero,
            status: 'liquidated',
            reference,
            description,
            transactedAt: new Date(),
            liquidatedAt: new Date(),
            fincoData: {
              transactionId: transfer.id,
              trackingKey: transfer.trackingId,
              status: transfer.transactionStatus
            }
          });
          await txBetween.save({ session });

          // 5c. Debit source account balance
          const freshSource = await InternalAccount.findById(sourceAccount._id).session(session);
          if (!freshSource) {
            throw new Error('Source account disappeared during transaction');
          }

          const sourceMovement = freshSource.movement({
            type: 'funding',
            balanceDelta: Dinero({ amount: amountInCents, precision: 2, currency: 'MXN' }),
            balanceOperator: 'subtract',
            transaction: txBetween,
            comment: 'Internal transfer out - balance deducted'
          });
          await freshSource.save({ session });
          await sourceMovement.save({ session });

          // 5d. Credit destination account balance
          const freshDest = await InternalAccount.findById(destAccount._id).session(session);
          if (!freshDest) {
            throw new Error('Destination account disappeared during transaction');
          }

          const destMovement = freshDest.movement({
            type: 'funding',
            balanceDelta: Dinero({ amount: amountInCents, precision: 2, currency: 'MXN' }),
            balanceOperator: 'add',
            transaction: txBetween,
            comment: 'Internal transfer in - balance credited'
          });
          await freshDest.save({ session });
          await destMovement.save({ session });
        });
      } finally {
        await session.endSession();
      }

      // ================================================================
      // 6. Respond
      // ================================================================

      return res.status(201).json({
        success: true,
        data: {
          ...transfer,
          localId: txBetween._id?.toString(),
          trackingCode: txBetween._id?.toString(),
        },
        message: 'Internal transfer completed',
      });
    } catch (error: any) {
      console.error('Error creating internal transfer:', error.message);
      return res.status(error.status || 500).json({
        success: false,
        error: 'Failed to create internal transfer',
        message: error.message,
      });
    }
  },

  /**
   * GET /api/v1/transactions/:id
   * Get transaction details
   */
  async getTransaction(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      console.log('🔍 Getting transaction:', id);

      try {
        const transaction = await fincoClient.getTransaction(id);
        return res.json({
          success: true,
          data: transaction,
        });
      } catch (fincoError: any) {
        const [outTx, inTx] = await Promise.all([
          TransactionTransferOut.findById(id)
            .populate({ path: 'toAccount', populate: { path: 'beneficiary' } })
            .populate('fromAccount'),
          TransactionTransferIn.findById(id).populate('toAccount')
        ]);

        if (outTx) {
          const mapped = await mapLedgerTransferOut(outTx);
          return res.json({ success: true, data: mapped });
        }
        if (inTx) {
          const mapped = await mapLedgerTransferIn(inTx);
          return res.json({ success: true, data: mapped });
        }

        throw fincoError;
      }
    } catch (error: any) {
      console.error('❌ Error fetching transaction:', error.message);
      return res.status(error.status || 500).json({
        success: false,
        error: 'Failed to fetch transaction',
        message: error.message,
      });
    }
  },

  /**
   * GET /api/v1/transactions
   * List transactions with filters
   */
  async getTransactions(req: AuthRequest, res: Response) {
    try {
      const params = req.query;

      console.log('📋 Getting transactions with params:', params);

      // MED-04: Get accessible account IDs for subaccount filtering
      const accountIds = await getAccessibleAccountIds(req.user);

      const transactions = await fincoClient.getTransactions(params);
      const fincoData = transactions.data || [];
      if (fincoData.length > 0) {
        return res.json({
          success: true,
          data: fincoData,
          pagination: transactions.pagination || {},
        });
      }

      const limit = parseInt(String(params.limit || params.per_page || 50), 10) || 50;
      const ledgerData = await getLedgerTransactions(limit, accountIds);
      return res.json({
        success: true,
        data: ledgerData,
        pagination: { page: 1, per_page: limit, total: ledgerData.length, total_pages: 1 }
      });
    } catch (error: any) {
      console.error('❌ Error listing transactions:', error.message);
      return res.status(error.status || 500).json({
        success: false,
        error: 'Failed to list transactions',
        message: error.message,
      });
    }
  },

  /**
   * GET /api/v1/transactions/recent
   * Get recent transactions for dashboard
   */
  async getRecentTransactions(req: AuthRequest, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      console.log('📊 Getting recent transactions, limit:', limit);

      // MED-04: Get accessible account IDs for subaccount filtering
      const accountIds = await getAccessibleAccountIds(req.user);

      const transactions = await fincoClient.getTransactions({
        per_page: limit,
        page: 1,
      });

      const fincoData = transactions.data || [];
      if (fincoData.length > 0) {
        return res.json({
          success: true,
          data: fincoData,
        });
      }

      const ledgerData = await getLedgerTransactions(limit, accountIds);
      return res.json({
        success: true,
        data: ledgerData,
      });
    } catch (error: any) {
      console.error('❌ Error fetching recent transactions:', error.message);
      return res.status(error.status || 500).json({
        success: false,
        error: 'Failed to fetch recent transactions',
        message: error.message,
      });
    }
  },
};
