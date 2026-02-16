import * as dinero from 'dinero.js'
import Dinero from 'dinero.js'
import mongoose from 'mongoose'

import { dayjs } from '../../utils/dayjs'
import {
  InternalAccount,
  InternalAccountTag,
  IInternalAccount
} from '../../models/accounts.model'
import {
  CostCentre,
  ICostCentre
} from '../../models/providerAccounts.model'
import {
  MonthlyCharge,
  MonthlyChargeStatus,
  IMonthlyCharge
} from '../../models/monthlyCharges.model'
import {
  TransactionTransferBetween
} from '../../models/transactions.model'
import { CostCentreAccumulator } from '../../models/costCentreAccumulators.model'

interface MonthlyChargesResult {
  processed: number
  skipped: number
  errors: number
  details: Array<{
    costCentre: string
    chargeKey: string
    status: 'success' | 'skipped' | 'error'
    message: string
    amount?: number
  }>
}

interface ChargeDefinition {
  key: string
  amount: dinero.Dinero | dinero.DineroObject | number
  amountVAT: dinero.Dinero | dinero.DineroObject | number
  amountTotal: dinero.Dinero | dinero.DineroObject | number
  transferDescription: string
}

function toDinero(value: any): dinero.Dinero {
  if (value == null) {
    return Dinero({ amount: 0, precision: 2, currency: 'MXN' })
  }
  if (typeof value.getAmount === 'function') {
    return value as dinero.Dinero
  }
  if (typeof value === 'number') {
    return Dinero({ amount: value, precision: 2, currency: 'MXN' })
  }
  if (typeof value === 'object' && typeof value.amount === 'number') {
    return Dinero({
      amount: value.amount,
      precision: value.precision ?? 2,
      currency: value.currency ?? 'MXN'
    })
  }
  return Dinero({ amount: 0, precision: 2, currency: 'MXN' })
}

function toMoneyObject(value: dinero.Dinero): dinero.DineroObject {
  return {
    amount: value.getAmount(),
    precision: 2,
    currency: 'MXN'
  }
}

export class MonthlyChargesService {
  /**
   * Execute monthly charges collection for all active cost centres
   */
  async executeMonthlyCharges(): Promise<MonthlyChargesResult> {
    const result: MonthlyChargesResult = {
      processed: 0,
      skipped: 0,
      errors: 0,
      details: []
    }

    const currentPeriod = dayjs().format('YYYY-MM')

    try {
      // Find all active cost centres that have monthly charges configured
      const costCentres = await CostCentre.find({
        disabled: false
      }).populate('monthlyCharges')

      for (const costCentre of costCentres) {
        try {
          // Check for commercial rules with monthlyFee
          const monthlyFeeRule = costCentre.commercialRules?.monthlyFee

          if (!monthlyFeeRule || !monthlyFeeRule.amount) {
            result.skipped++
            result.details.push({
              costCentre: costCentre.alias,
              chargeKey: 'monthlyFee',
              status: 'skipped',
              message: 'No monthly fee configured'
            })
            continue
          }

          // Check if already charged this month
          const existingAccumulator = await CostCentreAccumulator.findOne({
            costCentre: costCentre._id,
            type: 'monthlyCharge',
            period: currentPeriod
          })

          if (existingAccumulator && existingAccumulator.count > 0) {
            result.skipped++
            result.details.push({
              costCentre: costCentre.alias,
              chargeKey: 'monthlyFee',
              status: 'skipped',
              message: `Already charged for period ${currentPeriod}`
            })
            continue
          }

          // Process the charge
          await this.processMonthlyCharge(costCentre, monthlyFeeRule)

          result.processed++
          result.details.push({
            costCentre: costCentre.alias,
            chargeKey: 'monthlyFee',
            status: 'success',
            message: 'Monthly charge applied successfully',
            amount: toDinero(monthlyFeeRule.amount).getAmount()
          })
        } catch (error: any) {
          result.errors++
          result.details.push({
            costCentre: costCentre.alias,
            chargeKey: 'monthlyFee',
            status: 'error',
            message: error.message || 'Unknown error'
          })
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to execute monthly charges: ${error.message}`)
    }

    return result
  }

  /**
   * Process monthly charge for a single cost centre
   */
  private async processMonthlyCharge(
    costCentre: mongoose.HydratedDocument<ICostCentre>,
    monthlyFeeRule: any
  ): Promise<void> {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      const currentPeriod = dayjs().format('YYYY-MM')
      const now = dayjs().toDate()

      // Find the concentration account (fromAccount)
      const concentrationAccount = await InternalAccount.findOne({
        costCentre: costCentre._id,
        tag: InternalAccountTag.Concentration
      }).session(session)

      if (!concentrationAccount) {
        throw new Error(`Concentration account not found for cost centre ${costCentre.alias}`)
      }

      // Find the monthlyCharges internal account (toAccount)
      const monthlyChargesAccount = await InternalAccount.findOne({
        costCentre: costCentre._id,
        tag: InternalAccountTag.MonthlyCharges
      }).session(session)

      if (!monthlyChargesAccount) {
        throw new Error(`Monthly charges account not found for cost centre ${costCentre.alias}`)
      }

      // Calculate amounts
      const amountWithoutVAT = toDinero(monthlyFeeRule.amount)
      const amountVAT = amountWithoutVAT.multiply(16).divide(100)
      const amountTotal = amountWithoutVAT.add(amountVAT)

      // Check if concentration account has sufficient balance
      const concentrationBalance = toDinero(concentrationAccount.balance)
      if (concentrationBalance.lessThan(amountTotal)) {
        // Create unpaid monthly charge record
        const monthlyCharge = new MonthlyCharge({
          costCentre: costCentre._id,
          key: `${currentPeriod}-monthlyFee`,
          status: MonthlyChargeStatus.Unpaid,
          attempts: 1,
          amount: toMoneyObject(amountWithoutVAT),
          amountVAT: toMoneyObject(amountVAT),
          amountTotal: toMoneyObject(amountTotal),
          transferDescription: `Cuota mensual ${currentPeriod}`
        })
        await monthlyCharge.save({ session })

        // Still increment accumulator to mark as attempted
        await CostCentreAccumulator.findOneAndUpdate(
          {
            costCentre: costCentre._id,
            type: 'monthlyCharge',
            period: currentPeriod
          },
          {
            $inc: {
              amount: 0, // No amount charged yet
              count: 1
            }
          },
          { upsert: true, session }
        )

        throw new Error(`Insufficient balance: ${concentrationBalance.toFormat()} < ${amountTotal.toFormat()}`)
      }

      // Create the monthly charge record
      const monthlyCharge = new MonthlyCharge({
        costCentre: costCentre._id,
        key: `${currentPeriod}-monthlyFee`,
        status: MonthlyChargeStatus.Paid,
        attempts: 1,
        amount: toMoneyObject(amountWithoutVAT),
        amountVAT: toMoneyObject(amountVAT),
        amountTotal: toMoneyObject(amountTotal),
        transferDescription: `Cuota mensual ${currentPeriod}`
      })
      await monthlyCharge.save({ session })

      // Create TransactionTransferBetween
      const balanceAvailableBefore = concentrationBalance.subtract(
        toDinero(concentrationAccount.balanceWithheld)
      )

      const transaction = new TransactionTransferBetween({
        fromAccount: concentrationAccount._id,
        toAccount: monthlyChargesAccount._id,
        addVAT: true,
        balanceAvailableBefore: toMoneyObject(balanceAvailableBefore),
        amount: toMoneyObject(amountWithoutVAT),
        amountVAT: toMoneyObject(amountVAT),
        amountDistributed: toMoneyObject(Dinero({ amount: 0, precision: 2, currency: 'MXN' })),
        amountTransfer: toMoneyObject(amountTotal),
        amountCommission: toMoneyObject(Dinero({ amount: 0, precision: 2, currency: 'MXN' })),
        amountTotal: toMoneyObject(amountTotal),
        distributionBreakdown: [],
        status: 'liquidated',
        reference: `MONTHLY-${currentPeriod}`,
        description: `Cuota mensual ${currentPeriod}`,
        transactedAt: now,
        liquidatedAt: now,
        monthlyCharge: monthlyCharge._id
      })
      await transaction.save({ session })

      // Create account movements
      const movementFrom = concentrationAccount.movement({
        transactedAt: now,
        type: 'liquidation',
        balanceDelta: amountTotal,
        balanceOperator: 'subtract',
        transaction
      })

      const movementTo = monthlyChargesAccount.movement({
        transactedAt: now,
        type: 'liquidation',
        balanceDelta: amountTotal,
        balanceOperator: 'add',
        transaction
      })

      await movementFrom.save({ session })
      await movementTo.save({ session })

      // Save updated accounts
      await concentrationAccount.save({ session })
      await monthlyChargesAccount.save({ session })

      // Update accumulator
      await CostCentreAccumulator.findOneAndUpdate(
        {
          costCentre: costCentre._id,
          type: 'monthlyCharge',
          period: currentPeriod
        },
        {
          $inc: {
            amount: amountTotal.getAmount(),
            count: 1
          }
        },
        { upsert: true, session }
      )

      await session.commitTransaction()
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }

  /**
   * Get the last execution status
   */
  async getLastExecutionStatus(): Promise<{
    lastExecutionPeriod: string | null
    chargesProcessed: number
    totalAmount: number
  }> {
    const currentPeriod = dayjs().format('YYYY-MM')

    const accumulators = await CostCentreAccumulator.find({
      type: 'monthlyCharge',
      period: currentPeriod
    })

    const totalAmount = accumulators.reduce((sum, acc) => sum + acc.amount, 0)
    const chargesProcessed = accumulators.reduce((sum, acc) => sum + acc.count, 0)

    return {
      lastExecutionPeriod: chargesProcessed > 0 ? currentPeriod : null,
      chargesProcessed,
      totalAmount
    }
  }
}

export const monthlyChargesService = new MonthlyChargesService()
