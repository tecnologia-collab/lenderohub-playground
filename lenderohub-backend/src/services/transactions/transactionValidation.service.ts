// src/services/transactions/transactionValidation.service.ts
//
// Service for validating transfer-out limits and calculating fees.
// Uses Dinero.js for all money arithmetic; never raw floats.

import Dinero from 'dinero.js'
import { DineroObject } from 'dinero.js'

import { CostCentre, ICostCentre } from '../../models/providerAccounts.model'
import { CostCentreAccumulator, ICostCentreAccumulator } from '../../models/costCentreAccumulators.model'
import { RuleType, IRule } from '../../models/shared/enums'
import { dayjs } from '../../utils/dayjs'

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult {
  valid: boolean
  reason?: string
}

export interface FeeBreakdown {
  /** The original SPEI transfer amount (what the beneficiary receives) */
  transferAmount: DineroObject
  /** Transaction fee (flat per-operation fee, e.g. $4.50 MXN) */
  transactionFee: DineroObject
  /** Commercial rule fee (fixed or percentage on transfer amount) */
  commercialFee: DineroObject
  /** Sum of transactionFee + commercialFee */
  totalFees: DineroObject
  /** 16 % IVA on totalFees */
  amountVAT: DineroObject
  /** Grand total: transferAmount + totalFees + amountVAT */
  amountTotal: DineroObject
  /** The commercial rule that was applied */
  commercialRule: IRule
}

// ============================================================================
// HELPERS
// ============================================================================

const ZERO = Dinero({ amount: 0, precision: 2, currency: 'MXN' })
const IVA_RATE = 16 // percent

/**
 * Safely coerce a stored Money / DineroObject / number into a Dinero instance.
 */
function coerceDinero(value: any): Dinero.Dinero {
  if (value && typeof value.getAmount === 'function') {
    return value as Dinero.Dinero
  }
  if (typeof value === 'number') {
    return Dinero({ amount: value, precision: 2, currency: 'MXN' })
  }
  if (value && typeof value === 'object' && typeof value.amount === 'number') {
    return Dinero({
      amount: value.amount,
      precision: value.precision ?? 2,
      currency: value.currency ?? 'MXN'
    })
  }
  return ZERO
}

function toDineroObject(d: Dinero.Dinero): DineroObject {
  return {
    amount: d.getAmount(),
    precision: 2,
    currency: 'MXN'
  }
}

/**
 * Return the current period string in YYYY-MM format (CDMX timezone).
 */
function currentPeriod(): string {
  return dayjs().format('YYYY-MM')
}

// ============================================================================
// SERVICE
// ============================================================================

export class TransactionValidationService {

  // --------------------------------------------------------------------------
  // Accumulator helpers
  // --------------------------------------------------------------------------

  /**
   * Get (or create) the monthly accumulator for a given CostCentre + direction.
   * Uses findOneAndUpdate with upsert so it is safe under concurrent requests.
   */
  async getOrCreateMonthlyAccumulator(
    costCentreId: string,
    type: 'in' | 'out'
  ): Promise<ICostCentreAccumulator> {
    const period = currentPeriod()

    const accumulator = await CostCentreAccumulator.findOneAndUpdate(
      { costCentre: costCentreId, type, period },
      { $setOnInsert: { costCentre: costCentreId, type, period, amount: 0, count: 0 } },
      { upsert: true, new: true }
    )

    return accumulator
  }

  /**
   * Increment the accumulator after a successful transfer.
   */
  async incrementAccumulator(
    costCentreId: string,
    type: 'in' | 'out',
    amountInCents: number
  ): Promise<void> {
    const period = currentPeriod()

    await CostCentreAccumulator.findOneAndUpdate(
      { costCentre: costCentreId, type, period },
      { $inc: { amount: amountInCents, count: 1 } },
      { upsert: true, new: true }
    )
  }

  // --------------------------------------------------------------------------
  // Limits validation
  // --------------------------------------------------------------------------

  /**
   * Validate that a transfer-out does not exceed the CostCentre's monthly
   * operation count or amount limit.
   *
   * @param costCentreId  Mongo _id of the CostCentre
   * @param amountTotalCents  The TOTAL debit (transfer + fees + IVA) in centavos
   */
  async validateTransferOutLimits(
    costCentreId: string,
    amountTotalCents: number
  ): Promise<ValidationResult> {
    const costCentre = await CostCentre.findById(costCentreId)
    if (!costCentre) {
      return { valid: false, reason: 'Cost centre not found' }
    }

    const profile = costCentre.transactionProfile
    if (!profile) {
      return { valid: false, reason: 'Cost centre has no transaction profile configured' }
    }

    const accumulator = await this.getOrCreateMonthlyAccumulator(costCentreId, 'out')

    // --- Operation count check ---
    const maxOps = profile.opsOut ?? 1000
    if (accumulator.count + 1 > maxOps) {
      return {
        valid: false,
        reason: `Monthly operation limit reached (${maxOps} operations)`
      }
    }

    // --- Amount check ---
    const limitOutDinero = coerceDinero(profile.limitOut)
    const limitOutCents = limitOutDinero.getAmount()
    if (accumulator.amount + amountTotalCents > limitOutCents) {
      const limitFormatted = limitOutDinero.toFormat('$0,0.00')
      return {
        valid: false,
        reason: `Monthly amount limit exceeded (limit: ${limitFormatted} MXN)`
      }
    }

    return { valid: true }
  }

  // --------------------------------------------------------------------------
  // Fee calculation
  // --------------------------------------------------------------------------

  /**
   * Calculate all fees for a transfer-out operation.
   *
   * @param costCentre     A populated CostCentre document
   * @param transferAmountInCents  The SPEI amount in centavos
   */
  calculateTransferOutFees(
    costCentre: ICostCentre,
    transferAmountInCents: number
  ): FeeBreakdown {
    const transferAmount = Dinero({ amount: transferAmountInCents, precision: 2, currency: 'MXN' })

    // 1. Transaction fee (flat)
    const transactionFee = coerceDinero(
      costCentre.commercialRules?.transactionFee
    )

    // 2. Commercial fee (from costCentre.commercialRules.out)
    const outRule: IRule = costCentre.commercialRules?.out ?? { type: RuleType.NotApplicable }
    let commercialFee: Dinero.Dinero = ZERO

    switch (outRule.type) {
      case RuleType.Fixed:
        commercialFee = coerceDinero(outRule.amount)
        break
      case RuleType.Percentage: {
        // outRule.value is stored as a percentage number, e.g. 1.5 means 1.5 %
        const pct = outRule.value ?? 0
        // Dinero percentage helper: amount * pct / 100, rounded half-even
        commercialFee = transferAmount.percentage(pct)
        break
      }
      case RuleType.NotApplicable:
      default:
        commercialFee = ZERO
        break
    }

    // 3. Total fees
    const totalFees = transactionFee.add(commercialFee)

    // 4. IVA (16 % of total fees)
    const amountVAT = totalFees.percentage(IVA_RATE)

    // 5. Grand total
    const amountTotal = transferAmount.add(totalFees).add(amountVAT)

    return {
      transferAmount: toDineroObject(transferAmount),
      transactionFee: toDineroObject(transactionFee),
      commercialFee: toDineroObject(commercialFee),
      totalFees: toDineroObject(totalFees),
      amountVAT: toDineroObject(amountVAT),
      amountTotal: toDineroObject(amountTotal),
      commercialRule: outRule
    }
  }
}

// Singleton
let instance: TransactionValidationService | null = null

export function getTransactionValidationService(): TransactionValidationService {
  if (!instance) {
    instance = new TransactionValidationService()
  }
  return instance
}

export default TransactionValidationService
