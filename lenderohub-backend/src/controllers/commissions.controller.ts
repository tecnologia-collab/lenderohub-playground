import mongoose from 'mongoose'
import Dinero from 'dinero.js'
import { Response } from 'express'

import { AuthRequest } from '../middlewares/auth.middleware'
import { dayjs } from '../utils/dayjs'
import { CostCentre } from '../models/providerAccounts.model'
import { InternalAccount, InternalAccountTag } from '../models/accounts.model'
import {
  TransactionTransferBetween,
  TransactionTransferBetweenStatus,
  TransactionTransferOut,
  TransactionTransferOutStatus
} from '../models/transactions.model'
import { MonthlyCharge, MonthlyChargeStatus } from '../models/monthlyCharges.model'
import { commissionsService } from '../services/commissions/commissions.service'

const COMMISSION_TAGS = [
  InternalAccountTag.TransferIn,
  InternalAccountTag.TransferInCommissionAgentPayment,
  InternalAccountTag.TransferOut,
  InternalAccountTag.TransferOutEarnings,
  InternalAccountTag.MonthlyCharges
]

function getMoneyAmount(value: any): number {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (typeof value.getAmount === 'function') return value.getAmount()
  if (typeof value === 'object' && typeof value.amount === 'number') return value.amount
  return 0
}

function formatDate(date?: Date): string {
  if (!date) return ''
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

export const commissionsController = {
  async getDashboard (req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const costCentre = await CostCentre.findOne({ client: clientId, default: true, disabled: { $ne: true } })
        || await CostCentre.findOne({ client: clientId, disabled: { $ne: true } })

      if (!costCentre) {
        return res.json({ success: true, data: { accounts: [] } })
      }

      await commissionsService.ensureCommissionAccounts(costCentre)

      const accounts = await InternalAccount.find({
        costCentre: costCentre._id,
        tag: { $in: COMMISSION_TAGS }
      })

      const data = accounts.map((account) => ({
        tag: account.tag,
        alias: account.alias,
        clabe: account.fullNumber,
        balance: getMoneyAmount(account.balance) / 100
      }))

      return res.json({
        success: true,
        data: { accounts: data }
      })
    } catch (error: any) {
      console.error('❌ Error fetching commissions dashboard:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch commissions dashboard',
        message: error.message
      })
    }
  },

  async getCostCentres (req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const costCentres = await CostCentre.find({ client: clientId, disabled: { $ne: true } }).sort({ code: 1 })
      const costCentreIds = costCentres.map((cc) => cc._id)

      const accounts = await InternalAccount.find({
        costCentre: { $in: costCentreIds },
        tag: { $in: COMMISSION_TAGS }
      })

      const balancesByCostCentre = new Map<string, Record<string, number>>()

      for (const account of accounts) {
        const costCentreId = account.costCentre.toString()
        if (!balancesByCostCentre.has(costCentreId)) {
          balancesByCostCentre.set(costCentreId, {})
        }
        const record = balancesByCostCentre.get(costCentreId) as Record<string, number>
        record[account.tag] = (record[account.tag] || 0) + getMoneyAmount(account.balance)
      }

      const data = costCentres.map((cc) => {
        const balances = balancesByCostCentre.get(cc._id.toString()) || {}
        return {
          alias: cc.alias,
          code: cc.code,
          name: cc.shortName,
          transferIn: (balances[InternalAccountTag.TransferIn] || 0) / 100,
          transferInCommissionAgentPayment: (balances[InternalAccountTag.TransferInCommissionAgentPayment] || 0) / 100,
          transferOut: (balances[InternalAccountTag.TransferOut] || 0) / 100,
          transferOutEarnings: (balances[InternalAccountTag.TransferOutEarnings] || 0) / 100,
          monthlyCharges: (balances[InternalAccountTag.MonthlyCharges] || 0) / 100
        }
      })

      return res.json({
        success: true,
        data: { costCentres: data }
      })
    } catch (error: any) {
      console.error('❌ Error fetching commissions centres:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch commissions centres',
        message: error.message
      })
    }
  },

  async getTransfers (req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const page = parseInt((req.query.page as string) || '1')
      const limit = parseInt((req.query.limit as string) || '20')
      const search = (req.query.search as string || '').trim()

      const costCentres = await CostCentre.find({ client: clientId, disabled: { $ne: true } })
      const costCentreIds = costCentres.map((cc) => cc._id)

      const accounts = await InternalAccount.find({
        costCentre: { $in: costCentreIds },
        tag: { $in: COMMISSION_TAGS }
      }).select('_id')
      const accountIds = accounts.map((account) => account._id)

      const filter: any = {
        fromAccount: { $in: accountIds }
      }

      if (search) {
        filter.$or = [
          { reference: new RegExp(search, 'i') },
          { description: new RegExp(search, 'i') },
          { trackingCode: new RegExp(search, 'i') }
        ]
      }

      const transfers = await TransactionTransferOut.find(filter)
        .sort({ transactedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({
          path: 'fromAccount',
          populate: { path: 'costCentre' }
        })

      const data = transfers.map((transfer) => {
        const fromAccount = transfer.fromAccount as any
        const costCentre = fromAccount?.costCentre
        const amount = getMoneyAmount(transfer.amountTotal)
        return {
          date: formatDate(transfer.transactedAt || transfer.createdAt),
          fromCostCentre: costCentre?.alias || '',
          reference: transfer.reference,
          concept: transfer.description,
          trackingCode: transfer.trackingCode,
          amount: amount / 100,
          status: transfer.status === TransactionTransferOutStatus.Liquidated ? 'Liquidada' : transfer.status
        }
      })

      return res.json({
        success: true,
        data: { transfers: data }
      })
    } catch (error: any) {
      console.error('❌ Error fetching commissions transfers:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch commissions transfers',
        message: error.message
      })
    }
  },

  async getMonthlyChargesTransfers (req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const costCentres = await CostCentre.find({ client: clientId, disabled: { $ne: true } })
      const costCentreIds = costCentres.map((cc) => cc._id)

      const accounts = await InternalAccount.find({
        costCentre: { $in: costCentreIds }
      }).select('_id')
      const accountIds = accounts.map((account) => account._id)

      const transfers = await TransactionTransferBetween.find({
        fromAccount: { $in: accountIds },
        $or: [
          { description: /Cuota mensual/i },
          { monthlyCharge: { $exists: true } }
        ]
      })
        .sort({ transactedAt: -1, createdAt: -1 })
        .populate({
          path: 'fromAccount',
          populate: { path: 'costCentre' }
        })

      const data = transfers.map((transfer) => {
        const fromAccount = transfer.fromAccount as any
        const costCentre = fromAccount?.costCentre
        const amount = getMoneyAmount(transfer.amountTotal)
        return {
          date: formatDate(transfer.transactedAt || transfer.createdAt),
          fromCostCentre: costCentre?.alias || '',
          reference: transfer.reference,
          concept: transfer.description,
          trackingCode: transfer._id.toString(),
          amount: amount / 100,
          status: transfer.status === TransactionTransferBetweenStatus.Liquidated ? 'Liquidada' : transfer.status
        }
      })

      return res.json({
        success: true,
        data: { transfers: data }
      })
    } catch (error: any) {
      console.error('❌ Error fetching monthly charges transfers:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch monthly charges transfers',
        message: error.message
      })
    }
  },

  async getCollection (req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString()
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const period = (req.query.period as string) || dayjs().format('YYYY-MM')
      const costCentres = await CostCentre.find({ client: clientId, disabled: { $ne: true } })
      const costCentreIds = costCentres.map((cc) => cc._id)

      const monthlyCharges = await MonthlyCharge.find({
        costCentre: { $in: costCentreIds },
        key: period,
        status: MonthlyChargeStatus.Unpaid
      }).sort({ updatedAt: -1 })

      const concentrationAccounts = await InternalAccount.find({
        costCentre: { $in: costCentreIds },
        tag: InternalAccountTag.Concentration
      })

      const concentrationByCostCentre = new Map<string, number>()
      for (const account of concentrationAccounts) {
        concentrationByCostCentre.set(account.costCentre.toString(), getMoneyAmount(account.balance))
      }

      const data = monthlyCharges.map((charge) => {
        const costCentre = costCentres.find((cc) => cc._id.toString() === charge.costCentre.toString())
        return {
          alias: costCentre?.alias || '',
          pendingBalance: getMoneyAmount(charge.amountTotal) / 100,
          concentratorBalance: (concentrationByCostCentre.get(charge.costCentre.toString()) || 0) / 100,
          status: 'No pagada (CECO bloqueado)',
          attempts: charge.attempts,
          lastAttemptDate: formatDate(charge.updatedAt)
        }
      })

      return res.json({
        success: true,
        data: { costCentres: data }
      })
    } catch (error: any) {
      console.error('❌ Error fetching collection:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch collection',
        message: error.message
      })
    }
  },

  async transferToCorporate (req: AuthRequest, res: Response) {
    const session = await mongoose.startSession()
    try {
      const clientId = req.user?.clientId?.toString()
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const { accountTag, amount } = req.body
      if (!accountTag || !amount || isNaN(Number(amount))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid payload',
          message: 'accountTag y amount son requeridos'
        })
      }

      const amountCents = Math.round(parseFloat(amount) * 100)
      const amountDinero = Dinero({ amount: amountCents, precision: 2, currency: 'MXN' })

      let result: any
      await session.withTransaction(async () => {
        const costCentre = await CostCentre.findOne({ client: clientId, default: true, disabled: { $ne: true } }).session(session)
          || await CostCentre.findOne({ client: clientId, disabled: { $ne: true } }).session(session)

        if (!costCentre) {
          throw new Error('Cost centre not found')
        }

        const fromAccount = await InternalAccount.findOne({
          costCentre: costCentre._id,
          tag: accountTag
        }).session(session)

        if (!fromAccount) {
          throw new Error('Cuenta interna no encontrada')
        }

        const toAccount = await InternalAccount.findOne({
          costCentre: costCentre._id,
          tag: InternalAccountTag.Concentration
        }).session(session)

        if (!toAccount) {
          throw new Error('Cuenta concentradora no encontrada')
        }

        if (amountDinero.greaterThan(fromAccount.balanceAvailable)) {
          throw new Error('Saldo insuficiente')
        }

        const transaction = new TransactionTransferBetween({
          fromAccount,
          toAccount,
          addVAT: false,
          balanceAvailableBefore: fromAccount.balanceAvailable,
          amount: amountDinero,
          amountVAT: Dinero({ amount: 0, precision: 2, currency: 'MXN' }),
          amountDistributed: Dinero({ amount: 0, precision: 2, currency: 'MXN' }),
          amountTransfer: amountDinero,
          amountCommission: Dinero({ amount: 0, precision: 2, currency: 'MXN' }),
          amountTotal: amountDinero,
          distributionBreakdown: [],
          status: TransactionTransferBetweenStatus.Liquidated,
          reference: `${Date.now()}`.slice(-7),
          description: `Transferencia a corporativo (${accountTag})`,
          transactedAt: new Date(),
          liquidatedAt: new Date()
        })

        await transaction.save({ session })

        const fromMovement = fromAccount.movement({
          type: 'liquidation',
          balanceDelta: amountDinero,
          balanceOperator: 'subtract',
          transaction
        })

        const toMovement = toAccount.movement({
          type: 'liquidation',
          balanceDelta: amountDinero,
          balanceOperator: 'add',
          transaction
        })

        await fromMovement.save({ session })
        await toMovement.save({ session })
        await fromAccount.save({ session })
        await toAccount.save({ session })

        result = transaction
      })

      return res.status(201).json({
        success: true,
        data: result,
        message: 'Transferencia creada'
      })
    } catch (error: any) {
      console.error('❌ Error transfering commissions to corporate:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to transfer commissions',
        message: error.message
      })
    } finally {
      session.endSession()
    }
  },
  async collectByTag (req: AuthRequest, res: Response) {
    const session = await mongoose.startSession()
    try {
      const clientId = req.user?.clientId?.toString()
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        })
      }

      const { accountTag } = req.body
      if (!accountTag || !COMMISSION_TAGS.includes(accountTag)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid payload',
          message: 'accountTag es requerido'
        })
      }

      let totalAmount = 0
      let totalTransfers = 0

      await session.withTransaction(async () => {
        const costCentres = await CostCentre.find({ client: clientId, disabled: { $ne: true } }).session(session)
        if (costCentres.length === 0) {
          throw new Error('Cost centres not found')
        }

        const defaultCostCentre = costCentres.find((cc) => cc.default) || costCentres[0]
        const corporateConcentration = await InternalAccount.findOne({
          costCentre: defaultCostCentre._id,
          tag: InternalAccountTag.Concentration
        }).session(session)

        if (!corporateConcentration) {
          throw new Error('Cuenta concentradora corporativa no encontrada')
        }

        for (const costCentre of costCentres) {
          const fromAccount = await InternalAccount.findOne({
            costCentre: costCentre._id,
            tag: accountTag
          }).session(session)

          if (!fromAccount) {
            continue
          }

          const balance = getMoneyAmount(fromAccount.balance)
          const withheld = getMoneyAmount(fromAccount.balanceWithheld)
          const available = balance - withheld
          if (available <= 0) {
            continue
          }

          const amountDinero = Dinero({ amount: available, precision: 2, currency: 'MXN' })

          const transaction = new TransactionTransferBetween({
            fromAccount,
            toAccount: corporateConcentration,
            addVAT: false,
            balanceAvailableBefore: fromAccount.balanceAvailable,
            amount: amountDinero,
            amountVAT: Dinero({ amount: 0, precision: 2, currency: 'MXN' }),
            amountDistributed: Dinero({ amount: 0, precision: 2, currency: 'MXN' }),
            amountTransfer: amountDinero,
            amountCommission: Dinero({ amount: 0, precision: 2, currency: 'MXN' }),
            amountTotal: amountDinero,
            distributionBreakdown: [],
            status: TransactionTransferBetweenStatus.Liquidated,
            reference: `${Date.now()}`.slice(-7),
            description: `Cobro comisiones (${accountTag}) - ${costCentre.code}`,
            transactedAt: new Date(),
            liquidatedAt: new Date()
          })

          await transaction.save({ session })

          const fromMovement = fromAccount.movement({
            type: 'liquidation',
            balanceDelta: amountDinero,
            balanceOperator: 'subtract',
            transaction
          })

          const toMovement = corporateConcentration.movement({
            type: 'liquidation',
            balanceDelta: amountDinero,
            balanceOperator: 'add',
            transaction
          })

          await fromMovement.save({ session })
          await toMovement.save({ session })
          await fromAccount.save({ session })
          await corporateConcentration.save({ session })

          totalTransfers += 1
          totalAmount += available
        }
      })

      return res.status(201).json({
        success: true,
        data: {
          totalTransfers,
          totalAmount: totalAmount / 100
        },
        message: 'Cobro completado'
      })
    } catch (error: any) {
      console.error('❌ Error collecting commissions:', error.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to collect commissions',
        message: error.message
      })
    } finally {
      session.endSession()
    }
  }
}
