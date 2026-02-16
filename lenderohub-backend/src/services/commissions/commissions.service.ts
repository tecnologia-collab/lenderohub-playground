import * as dinero from 'dinero.js'
import Dinero from 'dinero.js'
import mongoose from 'mongoose'

import { dayjs } from '../../utils/dayjs'
import {
  InternalAccount,
  InternalAccountTag,
  calculateCheckDigit,
  IInternalAccount,
  ExternalAccount
} from '../../models/accounts.model'
import { CommissionAgentAssignment } from '../../models/commissionAgentAssignments.model'
import { CommissionAgentBalance } from '../../models/commissionAgentBalances.model'
import { CostCentreAccumulator } from '../../models/costCentreAccumulators.model'
import { MonthlyChargeStatus } from '../../models/monthlyCharges.model'
import {
  CostCentre,
  ICostCentre,
  RuleType
} from '../../models/providerAccounts.model'
import { CorporateClient } from '../../models/clients.model'
import {
  ITransactionTransferIn,
  TransactionVirtualIn,
  TransactionVirtualInSubtype
} from '../../models/transactions.model'

interface CommissionBreakdown {
  transferIn?: dinero.Dinero
  transferInCommissionAgentPayment?: dinero.Dinero
}

interface ApplyTransferInCommissionParams {
  session: mongoose.ClientSession
  transaction: mongoose.HydratedDocument<ITransactionTransferIn>
  toAccount: mongoose.HydratedDocument<IInternalAccount>
}

const REQUIRED_COMMISSION_ACCOUNTS = [
  { tag: InternalAccountTag.TransferIn, alias: 'SPEI IN COMISION CECO' },
  { tag: InternalAccountTag.TransferInCommissionAgentPayment, alias: 'SPEI IN PAGO COMISIONISTA' },
  { tag: InternalAccountTag.TransferOut, alias: 'SPEI OUT PAGOS' },
  { tag: InternalAccountTag.TransferOutEarnings, alias: 'SPEI OUT GANANCIA' },
  { tag: InternalAccountTag.VatToPayCommissionAgent, alias: 'IVA POR PAGAR COMISIONISTA' },
  { tag: InternalAccountTag.IncomeTaxToPayCommissionAgent, alias: 'ISR POR PAGAR COMISIONISTA' },
  { tag: InternalAccountTag.MonthlyCharges, alias: 'CUOTAS MENSUALES' }
]

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

export class CommissionsService {
  async ensureCommissionAccounts (costCentre: ICostCentre, session?: mongoose.ClientSession): Promise<void> {
    const isValidFullNumber = (value?: string): boolean => {
      return typeof value === 'string' && /^\d{18}$/.test(value)
    }

    const fincoClabe = costCentre.fincoClabeNumber
    const hasValidFincoClabe = isValidFullNumber(fincoClabe)
    const bankCode = hasValidFincoClabe ? fincoClabe!.slice(0, 3) : (process.env.BANK_CODE || '646')
    const branchCode = hasValidFincoClabe ? fincoClabe!.slice(3, 6) : (process.env.BRANCH_CODE || '180')
    const expectedPrefix = `${bankCode}${branchCode}`
    const matchesExpectedPrefix = (value?: string): boolean => {
      return typeof value === 'string' && value.startsWith(expectedPrefix)
    }

    const costCentreId = costCentre._id
    if (hasValidFincoClabe) {
      const concentrationQuery = InternalAccount.findOne({
        costCentre: costCentreId,
        tag: InternalAccountTag.Concentration
      })
      if (session) {
        concentrationQuery.session(session)
      }
      const concentrationAccount = await concentrationQuery
      if (concentrationAccount && concentrationAccount.fullNumber !== fincoClabe) {
        concentrationAccount.fullNumber = fincoClabe as string
        concentrationAccount.markModified('fullNumber')
        await concentrationAccount.save({ session })
      }
    }
    const existingQuery = InternalAccount.find({
      costCentre: costCentreId,
      tag: { $in: REQUIRED_COMMISSION_ACCOUNTS.map((item) => item.tag) }
    })
    if (session) {
      existingQuery.session(session)
    }
    const existing = await existingQuery

    const existingTags = new Set(existing.map((account) => account.tag))
    const missing = REQUIRED_COMMISSION_ACCOUNTS.filter((item) => !existingTags.has(item.tag))

    const clientQuery = CorporateClient.findById(costCentre.client)
    if (session) {
      clientQuery.session(session)
    }
    const client = await clientQuery
    if (!client) {
      throw new Error('Client not found for cost centre')
    }

    let nextAccountCode = Number.isFinite(costCentre.nextAccountCode)
      ? costCentre.nextAccountCode
      : 0
    const costCentreCode = costCentre.code.replace(client.prefix, '')

    const internalQuery = InternalAccount.find({ fullNumber: { $exists: true } }).select('fullNumber')
    const externalQuery = ExternalAccount.find({ fullNumber: { $exists: true } }).select('fullNumber')
    if (session) {
      internalQuery.session(session)
      externalQuery.session(session)
    }
    const [internalNumbers, externalNumbers] = await Promise.all([internalQuery, externalQuery])
    const existingFullNumbers = new Set(
      [...internalNumbers, ...externalNumbers]
        .map((doc: any) => doc.fullNumber)
        .filter(Boolean)
    )

    const accountsToCreate: mongoose.HydratedDocument<IInternalAccount>[] = []

    const generateUniqueFullNumber = (): string => {
      let fullNumber = ''
      let attempts = 0

      while (!fullNumber) {
        const accountCode = `${nextAccountCode}`.padStart(4, '0')
        const numberWithoutCheck = `${bankCode}${branchCode}${client.prefix.padEnd(4, '0')}${costCentreCode}${accountCode}`
        const sanitizedNumber = numberWithoutCheck.replace(/[^0-9]/g, '0')
        const paddedNumber = sanitizedNumber.slice(0, 17).padEnd(17, '0')
        const checkDigit = calculateCheckDigit(paddedNumber)
        const candidate = `${paddedNumber}${checkDigit}`
        nextAccountCode += 1

        if (!existingFullNumbers.has(candidate)) {
          fullNumber = candidate
          existingFullNumbers.add(candidate)
        }

        attempts += 1
        if (attempts > 10000) {
          throw new Error('No fue posible generar una CLABE única para cuentas de comisión')
        }
      }

      return fullNumber
    }

    for (const account of existing) {
      if (!isValidFullNumber(account.fullNumber) || !matchesExpectedPrefix(account.fullNumber)) {
        const fullNumber = generateUniqueFullNumber()
        account.fullNumber = fullNumber
        account.markModified('fullNumber')
        await account.save({ session })
      }
    }

    if (missing.length === 0) {
      const updateQuery = CostCentre.updateOne(
        { _id: costCentreId },
        { $set: { nextAccountCode } }
      )
      if (session) {
        updateQuery.session(session)
      }
      await updateQuery
      return
    }

    for (const item of missing) {
      let fullNumber = ''
      let attempts = 0

      while (!fullNumber) {
        const accountCode = `${nextAccountCode}`.padStart(4, '0')
        const numberWithoutCheck = `${bankCode}${branchCode}${client.prefix.padEnd(4, '0')}${costCentreCode}${accountCode}`
        const sanitizedNumber = numberWithoutCheck.replace(/[^0-9]/g, '0')
        const paddedNumber = sanitizedNumber.slice(0, 17).padEnd(17, '0')
        const checkDigit = calculateCheckDigit(paddedNumber)
        const candidate = `${paddedNumber}${checkDigit}`
        nextAccountCode += 1

        if (!existingFullNumbers.has(candidate)) {
          fullNumber = candidate
          existingFullNumbers.add(candidate)
        }

        attempts += 1
        if (attempts > 10000) {
          throw new Error('No fue posible generar una CLABE única para cuentas de comisión')
        }
      }

      accountsToCreate.push(new InternalAccount({
        costCentre: costCentreId,
        fullNumber,
        tag: item.tag,
        alias: item.alias,
        isClient: false,
        hasCashBags: false,
        provider: costCentre.provider,
        balance: Dinero({ amount: 0, precision: 2, currency: 'MXN' }),
        balanceWithheld: Dinero({ amount: 0, precision: 2, currency: 'MXN' })
      }))
    }

    for (const account of accountsToCreate) {
      await account.save({ session })
    }

    const updateQuery = CostCentre.updateOne(
      { _id: costCentreId },
      { $set: { nextAccountCode } }
    )
    if (session) {
      updateQuery.session(session)
    }
    await updateQuery
  }

  async calculateTransferInCommission (
    amountTotal: dinero.Dinero,
    costCentre: ICostCentre,
    hasUnpaidMonthlyCharges: boolean
  ): Promise<{ breakdown: CommissionBreakdown; amountCommission: dinero.Dinero; assignmentId?: mongoose.Types.ObjectId | null; commercialRule?: any }> {
    const commercialRule = costCentre.commercialRules?.in
    if (!commercialRule || commercialRule.type === RuleType.NotApplicable) {
      return { breakdown: {}, amountCommission: Dinero({ amount: 0, precision: 2, currency: 'MXN' }) }
    }

    let amountCommissionWithoutVAT: dinero.Dinero
    if (commercialRule.type === RuleType.Fixed) {
      amountCommissionWithoutVAT = toDinero(commercialRule.amount)
    } else {
      if (commercialRule.value == null) {
        return { breakdown: {}, amountCommission: Dinero({ amount: 0, precision: 2, currency: 'MXN' }) }
      }
      amountCommissionWithoutVAT = amountTotal.multiply(commercialRule.value).divide(100)
    }

    const amountCommissionVAT = amountCommissionWithoutVAT.multiply(16).divide(100)
    const amountCommission = amountCommissionWithoutVAT.add(amountCommissionVAT)

    if (amountCommission.greaterThan(amountTotal)) {
      return { breakdown: {}, amountCommission: Dinero({ amount: 0, precision: 2, currency: 'MXN' }) }
    }

    const breakdown: CommissionBreakdown = {}

    const commissionAgentAssignment = await CommissionAgentAssignment.findOne({
      costCentre: costCentre._id,
      isEnabled: true
    })

    if (!commissionAgentAssignment || hasUnpaidMonthlyCharges) {
      breakdown.transferIn = amountCommission
      return { breakdown, amountCommission, assignmentId: commissionAgentAssignment?._id ?? null, commercialRule }
    }

    const agentPortion = amountCommissionWithoutVAT
      .multiply(commissionAgentAssignment.transferInCommissionPercentage)
      .divide(100)

    if (!agentPortion.isZero()) {
      breakdown.transferInCommissionAgentPayment = agentPortion
    }

    const cecoPortionWithVAT = amountCommissionWithoutVAT
      .subtract(agentPortion)
      .add(amountCommissionVAT)

    if (!cecoPortionWithVAT.isZero()) {
      breakdown.transferIn = cecoPortionWithVAT
    }

    return { breakdown, amountCommission, assignmentId: commissionAgentAssignment._id, commercialRule }
  }

  async applyTransferInCommission (params: ApplyTransferInCommissionParams): Promise<void> {
    const { session, transaction, toAccount } = params

    await toAccount.populate({
      path: 'costCentre',
      populate: [
        { path: 'monthlyCharges', match: { status: MonthlyChargeStatus.Unpaid } }
      ]
    })

    const costCentre = toAccount.costCentre as mongoose.HydratedDocument<ICostCentre>
    await this.ensureCommissionAccounts(costCentre, session)

    const hasUnpaidMonthlyCharges = costCentre.hasUnpaidMonthlyCharges()
    const amountTotal = toDinero(transaction.amountTotal)

    const { breakdown, amountCommission, assignmentId, commercialRule } = await this.calculateTransferInCommission(
      amountTotal,
      costCentre,
      hasUnpaidMonthlyCharges
    )

    const commissionBreakdown = new Map<string, dinero.DineroObject>()
    const internalAccounts = await InternalAccount.find({
      costCentre: costCentre._id,
      tag: { $in: Object.keys(breakdown) }
    }).session(session)

    const movements = []
    const virtualTransactions = []

    for (const [tag, amount] of Object.entries(breakdown)) {
      const toCommissionAccount = internalAccounts.find((account) => account.tag === tag)
      if (!toCommissionAccount || !amount) {
        continue
      }

      const virtualTransaction = new TransactionVirtualIn({
        subtype: TransactionVirtualInSubtype.Commission,
        fromAccount: transaction.fromAccount,
        toAccount: toCommissionAccount,
        amountTransfer: amount,
        parentTransaction: transaction
      })

      virtualTransactions.push(virtualTransaction)

      movements.push(toCommissionAccount.movement({
        type: 'funding',
        balanceDelta: amount,
        transaction
      }))

      commissionBreakdown.set(tag, toMoneyObject(amount))
    }

    const amountTransfer = amountTotal.subtract(amountCommission)
    if (!amountTransfer.isZero()) {
      movements.push(toAccount.movement({
        type: 'funding',
        balanceDelta: amountTransfer,
        transaction
      }))
    }

    transaction.amountCommission = toMoneyObject(amountCommission)
    transaction.amountTransfer = toMoneyObject(amountTransfer)
    transaction.commissionBreakdown = commissionBreakdown
    if (assignmentId) {
      transaction.commissionAgentAssignment = assignmentId
    }
    if (commercialRule) {
      transaction.commercialRule = commercialRule
    }

    await transaction.save({ session })

    for (const virtualTransaction of virtualTransactions) {
      await virtualTransaction.save({ session })
    }

    for (const movement of movements) {
      await movement.save({ session })
    }

    for (const account of [toAccount, ...internalAccounts]) {
      await account.save({ session })
    }

    const agentAmount = breakdown.transferInCommissionAgentPayment
    if (agentAmount && assignmentId) {
      const assignment = await CommissionAgentAssignment.findById(assignmentId).session(session)
      if (assignment) {
        const keyForThisMonth = dayjs(transaction.createdAt).format('YYYY-MM')
        let agentBalance = await CommissionAgentBalance.findOne({
          commissionAgentUserProfile: assignment.userProfile,
          key: keyForThisMonth
        }).session(session)

        if (!agentBalance) {
          agentBalance = new CommissionAgentBalance({
            commissionAgentUserProfile: assignment.userProfile,
            key: keyForThisMonth,
            requestableAmount: 0,
            requestableAmountWithheld: 0
          })
        }

        const commissionMovement = agentBalance.movement({
          type: 'funding',
          requestableAmountDelta: agentAmount,
          transaction
        })

        await agentBalance.save({ session })
        commissionMovement.transaction = transaction
        await commissionMovement.save({ session })
      }
    }

    // Increment IN accumulator for the CostCentre
    const accumulatorPeriod = dayjs(transaction.createdAt).format('YYYY-MM')
    await CostCentreAccumulator.findOneAndUpdate(
      {
        costCentre: costCentre._id,
        type: 'in',
        period: accumulatorPeriod
      },
      {
        $inc: {
          amount: amountTotal.getAmount(),
          count: 1
        }
      },
      { upsert: true, session }
    )
  }
}

export const commissionsService = new CommissionsService()
