/**
 * Mass Transfer Out Service
 *
 * Handles CSV upload, validation, and batch execution of transfer-out operations.
 * Uses Dinero.js for money arithmetic, csv-parse for CSV parsing,
 * and follows the existing moneyOut flow from transfers.controller.ts.
 */

import mongoose from 'mongoose'
import Dinero from 'dinero.js'
import { parse } from 'csv-parse/sync'

import {
  MassTransferOut,
  MassTransferOutStatus,
  MassTransferRowStatus,
  IMassTransferRow
} from '../../models/massTransferOut.model'
import { ExternalAccount } from '../../models/accounts.model'
import { InternalAccount, InternalAccountTag } from '../../models/accounts.model'
import { CostCentreBeneficiary, BeneficiaryStatus } from '../../models/beneficiaries.model'
import { CostCentre } from '../../models/providerAccounts.model'
import {
  TransactionTransferOut,
  TransactionTransferOutStatus
} from '../../models/transactions.model'
import { FincoClient } from '../../integrations/finco/client'
import { getTransactionValidationService } from '../transactions/transactionValidation.service'

// ============================================================================
// TYPES
// ============================================================================

interface CsvRow {
  clabe: string
  monto: string
  concepto: string
  referencia: string
}

interface UploadResult {
  massTransferOut: any
  summary: {
    totalRows: number
    validRows: number
    invalidRows: number
    totalAmountCentavos: number
    totalAmountPesos: number
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function normalizeCsvHeaders(raw: Record<string, string>): CsvRow {
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    // Remove BOM, trim whitespace, lowercase
    const cleanKey = key.replace(/^\uFEFF/, '').trim().toLowerCase()
    normalized[cleanKey] = (value || '').trim()
  }
  return {
    clabe: normalized['clabe'] || '',
    monto: normalized['monto'] || '',
    concepto: normalized['concepto'] || '',
    referencia: normalized['referencia'] || ''
  }
}

// ============================================================================
// SERVICE
// ============================================================================

class MassTransferService {

  // --------------------------------------------------------------------------
  // Upload and Validate
  // --------------------------------------------------------------------------

  /**
   * Parse a CSV buffer, validate each row, and create a MassTransferOut
   * document in 'pending_review' status.
   */
  async uploadAndValidate(
    fileBuffer: Buffer,
    fileName: string,
    costCentreId: string,
    corporateClientId: string,
    userId: string
  ): Promise<UploadResult> {
    // 1. Parse CSV
    const csvContent = fileBuffer.toString('utf-8')
    let rawRecords: Record<string, string>[]
    try {
      rawRecords = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true
      })
    } catch (err: any) {
      throw new Error(`Error al parsear el CSV: ${err.message}`)
    }

    if (rawRecords.length === 0) {
      throw new Error('El archivo CSV esta vacio')
    }

    // 2. Validate cost centre exists
    const costCentre = await CostCentre.findById(costCentreId)
    if (!costCentre) {
      throw new Error('Centro de costo no encontrado')
    }

    // 3. Load all beneficiaries for this cost centre (with their external accounts)
    // Build a map: CLABE -> { beneficiary, externalAccount }
    const costCentreBeneficiaries = await CostCentreBeneficiary.find({
      costCentre: costCentreId,
      status: BeneficiaryStatus.Active
    })

    const beneficiaryIds = costCentreBeneficiaries.map(b => b._id)
    const externalAccounts = await ExternalAccount.find({
      beneficiary: { $in: beneficiaryIds }
    })

    const clabeMap = new Map<string, { beneficiaryName: string; externalAccountId: string }>()
    for (const ext of externalAccounts) {
      const beneficiary = costCentreBeneficiaries.find(
        b => b._id.toString() === (ext.beneficiary as mongoose.Types.ObjectId).toString()
      )
      if (beneficiary) {
        clabeMap.set(ext.fullNumber, {
          beneficiaryName: beneficiary.name || beneficiary.alias,
          externalAccountId: ext._id.toString()
        })
      }
    }

    // 4. Get source account balance for aggregate validation
    const sourceAccount = await InternalAccount.findOne({
      costCentre: costCentreId,
      tag: InternalAccountTag.Concentration
    })

    let availableBalanceCents = 0
    if (sourceAccount) {
      const balanceAmount = typeof sourceAccount.balance === 'object'
        ? (sourceAccount.balance as any).amount ?? 0
        : (typeof sourceAccount.balance === 'number' ? sourceAccount.balance : 0)
      const balanceWithheldAmount = typeof sourceAccount.balanceWithheld === 'object'
        ? (sourceAccount.balanceWithheld as any).amount ?? 0
        : (typeof sourceAccount.balanceWithheld === 'number' ? sourceAccount.balanceWithheld : 0)
      availableBalanceCents = balanceAmount - balanceWithheldAmount
    }

    // 5. Get ops out limit
    const profile = costCentre.transactionProfile
    const maxOps = profile?.opsOut ?? 1000

    // 6. Validate each row
    const rows: IMassTransferRow[] = []
    let validRows = 0
    let invalidRows = 0
    let totalAmountCentavos = 0

    for (let i = 0; i < rawRecords.length; i++) {
      const csv = normalizeCsvHeaders(rawRecords[i])
      const rowNumber = i + 1
      const errors: string[] = []

      // CLABE validation
      if (!csv.clabe) {
        errors.push('CLABE es requerida')
      } else if (!/^\d{18}$/.test(csv.clabe)) {
        errors.push('CLABE debe ser 18 digitos')
      } else if (!clabeMap.has(csv.clabe)) {
        errors.push('CLABE no esta registrada como beneficiario de este centro de costo')
      }

      // Amount validation
      const amountPesos = parseFloat(csv.monto)
      if (!csv.monto || isNaN(amountPesos)) {
        errors.push('Monto invalido')
      } else if (amountPesos <= 0) {
        errors.push('Monto debe ser mayor a 0')
      }
      const amountCentavos = !isNaN(amountPesos) && amountPesos > 0
        ? Math.round(amountPesos * 100)
        : 0

      // Concept validation
      if (!csv.concepto) {
        errors.push('Concepto es requerido')
      } else if (csv.concepto.length > 40) {
        errors.push('Concepto no debe exceder 40 caracteres')
      }

      // Reference validation
      if (!csv.referencia) {
        errors.push('Referencia es requerida')
      } else if (!/^\d{1,7}$/.test(csv.referencia)) {
        errors.push('Referencia debe ser numerica, max 7 digitos')
      }

      const isValid = errors.length === 0
      const beneficiaryInfo = clabeMap.get(csv.clabe)

      const row: IMassTransferRow = {
        rowNumber,
        beneficiaryClabe: csv.clabe,
        beneficiaryName: beneficiaryInfo?.beneficiaryName || csv.clabe,
        amount: amountCentavos,
        concept: csv.concepto,
        reference: csv.referencia,
        status: isValid ? MassTransferRowStatus.Valid : MassTransferRowStatus.Invalid,
        errorMessage: isValid ? undefined : errors.join('; ')
      }

      rows.push(row)

      if (isValid) {
        validRows++
        totalAmountCentavos += amountCentavos
      } else {
        invalidRows++
      }
    }

    // 7. Aggregate validations (only informational at this stage, not blocking)
    // These are checked again at confirm time
    const balanceExceeded = totalAmountCentavos > availableBalanceCents
    const opsExceeded = validRows > maxOps

    if (balanceExceeded) {
      // Add a note but don't block -- the user can see the warning
      console.warn(
        `Mass transfer total ${totalAmountCentavos} exceeds available balance ${availableBalanceCents}`
      )
    }

    if (opsExceeded) {
      console.warn(
        `Mass transfer row count ${validRows} exceeds ops limit ${maxOps}`
      )
    }

    // 8. Create the MassTransferOut document
    const massTransferOut = await MassTransferOut.create({
      corporateClientId,
      costCentreId,
      userId,
      status: MassTransferOutStatus.PendingReview,
      fileName,
      totalRows: rawRecords.length,
      validRows,
      invalidRows,
      totalAmount: totalAmountCentavos,
      successCount: 0,
      failCount: 0,
      rows
    })

    return {
      massTransferOut,
      summary: {
        totalRows: rawRecords.length,
        validRows,
        invalidRows,
        totalAmountCentavos,
        totalAmountPesos: totalAmountCentavos / 100
      }
    }
  }

  // --------------------------------------------------------------------------
  // Confirm and Execute
  // --------------------------------------------------------------------------

  /**
   * Confirm a mass transfer batch and execute each valid row as a
   * TransactionTransferOut, following the moneyOut flow.
   */
  async confirm(
    massTransferId: string,
    userId: string
  ): Promise<any> {
    const batch = await MassTransferOut.findById(massTransferId)
    if (!batch) {
      throw new Error('Lote de transferencias no encontrado')
    }

    if (batch.status !== MassTransferOutStatus.PendingReview) {
      throw new Error(
        `El lote no se puede confirmar en estado '${batch.status}'. Solo se puede confirmar en estado 'pending_review'.`
      )
    }

    if (batch.validRows === 0) {
      throw new Error('No hay filas validas para procesar')
    }

    // Verify cost centre and source account
    const costCentre = await CostCentre.findById(batch.costCentreId)
    if (!costCentre) {
      throw new Error('Centro de costo no encontrado')
    }

    const sourceAccount = await InternalAccount.findOne({
      costCentre: batch.costCentreId,
      tag: InternalAccountTag.Concentration
    })
    if (!sourceAccount) {
      throw new Error('No se encontro cuenta de concentracion para el centro de costo')
    }

    const sourceInstrumentId = sourceAccount.fincoInstrumentId || process.env.FINCO_INSTRUMENT_ID || undefined

    // Build CLABE -> ExternalAccount map
    const costCentreBeneficiaries = await CostCentreBeneficiary.find({
      costCentre: batch.costCentreId,
      status: BeneficiaryStatus.Active
    })
    const beneficiaryIds = costCentreBeneficiaries.map(b => b._id)
    const externalAccounts = await ExternalAccount.find({
      beneficiary: { $in: beneficiaryIds }
    })
    const clabeToExtAccount = new Map<string, any>()
    for (const ext of externalAccounts) {
      clabeToExtAccount.set(ext.fullNumber, ext)
    }

    // Finco client
    const fincoClient = new FincoClient({
      apiUrl: process.env.FINCO_API_URL || 'https://apicore.stg.finch.lat',
      clientId: process.env.FINCO_CLIENT_ID || '',
      clientSecret: process.env.FINCO_CLIENT_SECRET || '',
      apiKey: process.env.FINCO_API_KEY || '',
      environment: (process.env.FINCO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox'
    })

    const validationService = getTransactionValidationService()

    // Update batch status to processing
    batch.status = MassTransferOutStatus.Processing
    await batch.save()

    let successCount = 0
    let failCount = 0

    // Process each valid row
    for (let i = 0; i < batch.rows.length; i++) {
      const row = batch.rows[i]

      // Skip invalid rows
      if (row.status !== MassTransferRowStatus.Valid) {
        continue
      }

      // Mark as pending
      row.status = MassTransferRowStatus.Pending

      const session = await mongoose.startSession()
      try {
        await session.withTransaction(async () => {
          // Calculate fees
          const feeBreakdown = validationService.calculateTransferOutFees(costCentre, row.amount)

          // Validate limits for this single operation
          const limitsCheck = await validationService.validateTransferOutLimits(
            batch.costCentreId.toString(),
            feeBreakdown.amountTotal.amount
          )

          if (!limitsCheck.valid) {
            throw new Error(limitsCheck.reason || 'Limite de transferencia excedido')
          }

          // Check balance
          const freshSource = await InternalAccount.findById(sourceAccount._id).session(session)
          if (!freshSource) {
            throw new Error('Cuenta fuente no encontrada')
          }

          const balanceAmount = typeof freshSource.balance === 'object'
            ? (freshSource.balance as any).amount ?? 0
            : (typeof freshSource.balance === 'number' ? freshSource.balance : 0)
          const balanceWithheldAmount = typeof freshSource.balanceWithheld === 'object'
            ? (freshSource.balanceWithheld as any).amount ?? 0
            : (typeof freshSource.balanceWithheld === 'number' ? freshSource.balanceWithheld : 0)
          const balanceAvailableCents = balanceAmount - balanceWithheldAmount

          if (balanceAvailableCents < feeBreakdown.amountTotal.amount) {
            throw new Error('Saldo insuficiente')
          }

          // Resolve external account for toAccount
          const extAccount = clabeToExtAccount.get(row.beneficiaryClabe)
          const toAccountId = extAccount?._id ?? sourceAccount._id

          // Create TransactionTransferOut
          const txOut = new TransactionTransferOut({
            fromAccount: sourceAccount._id,
            toAccount: toAccountId,
            addVAT: true,
            balanceAvailableBefore: freshSource.balance,
            amount: feeBreakdown.totalFees,
            amountVAT: feeBreakdown.amountVAT,
            amountTransfer: feeBreakdown.transferAmount,
            amountCommission: feeBreakdown.commercialFee,
            amountTotal: feeBreakdown.amountTotal,
            commercialRule: feeBreakdown.commercialRule,
            status: TransactionTransferOutStatus.New,
            executionDate: new Date().toISOString().split('T')[0],
            reference: row.reference,
            description: row.concept,
            trackingCode: '',
            transactedAt: new Date(),
            massTransaction: batch._id,
            massTransactionIndex: row.rowNumber
          })

          await txOut.generateTrackingCode()
          await txOut.save({ session })

          // Send to Finco
          // Determine destination instrument: use fincoInstrumentId from external account if available
          const destInstrumentId = extAccount?.fincoInstrumentId || extAccount?._id?.toString()
          const transfer = await fincoClient.createSPEITransfer({
            destination_instrument_id: destInstrumentId,
            amount: row.amount,
            concept: row.concept,
            description: row.concept,
            reference: row.reference,
            source_instrument_id: sourceInstrumentId
          })

          // Update transaction with Finco data
          txOut.status = TransactionTransferOutStatus.Sent
          txOut.fincoData = {
            transactionId: transfer.id,
            trackingKey: transfer.trackingId,
            status: transfer.transactionStatus || transfer.status
          }
          await txOut.save({ session })

          // Withhold balance
          const movement = freshSource.movement({
            type: 'funding',
            balanceWithheldDelta: Dinero({
              amount: feeBreakdown.amountTotal.amount,
              precision: 2,
              currency: 'MXN'
            }),
            balanceWithheldOperator: 'add',
            transaction: txOut,
            comment: `Mass transfer out row ${row.rowNumber} - balance withheld`
          })
          await freshSource.save({ session })
          await movement.save({ session })

          // Increment monthly accumulator
          await validationService.incrementAccumulator(
            batch.costCentreId.toString(),
            'out',
            feeBreakdown.amountTotal.amount
          )

          // Update row status
          row.status = MassTransferRowStatus.Sent
          row.transactionId = txOut._id
        })

        successCount++
      } catch (error: any) {
        row.status = MassTransferRowStatus.Failed
        row.errorMessage = error.message || 'Error desconocido al procesar la transferencia'
        failCount++
      } finally {
        await session.endSession()
      }
    }

    // Update batch final status
    batch.successCount = successCount
    batch.failCount = failCount

    if (successCount === 0) {
      batch.status = MassTransferOutStatus.Failed
    } else if (failCount === 0) {
      batch.status = MassTransferOutStatus.Completed
    } else {
      batch.status = MassTransferOutStatus.PartiallyCompleted
    }

    await batch.save()

    return batch
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  /**
   * Get a single mass transfer batch by ID.
   */
  async getById(massTransferId: string): Promise<any> {
    const batch = await MassTransferOut.findById(massTransferId)
    if (!batch) {
      throw new Error('Lote de transferencias no encontrado')
    }
    return batch
  }

  /**
   * List mass transfer batches for a cost centre with pagination.
   */
  async getAll(
    costCentreId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    items: any[]
    total: number
    page: number
    pages: number
  }> {
    const skip = (page - 1) * limit
    const filter = { costCentreId }

    const [items, total] = await Promise.all([
      MassTransferOut.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-rows')  // Exclude rows for list view (can be large)
        .lean(),
      MassTransferOut.countDocuments(filter)
    ])

    return {
      items,
      total,
      page,
      pages: Math.ceil(total / limit)
    }
  }
}

// Singleton
let instance: MassTransferService | null = null

export function getMassTransferService(): MassTransferService {
  if (!instance) {
    instance = new MassTransferService()
  }
  return instance
}

export default MassTransferService
