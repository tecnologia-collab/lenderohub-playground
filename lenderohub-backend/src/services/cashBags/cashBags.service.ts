import mongoose from 'mongoose'
import * as dinero from 'dinero.js'
const Dinero = (dinero as any).default || dinero

import {
  VirtualBagAccount,
  IVirtualBagAccount,
  InternalAccount,
  InternalAccountTag,
  AccountStatus
} from '../../models/accounts.model'
import { CostCentre } from '../../models/providerAccounts.model'
import { AccountMovement } from '../../models/accountMovements.model'
import { dayjs } from '../../utils/dayjs'

// ============================================================================
// TYPES
// ============================================================================

export interface CreateVirtualBagInput {
  clientId: string
  name: string
  description?: string
  initialBalance?: number
  color?: string
  limits?: {
    dailyLimit?: number
    monthlyLimit?: number
    perTransactionLimit?: number
  }
  costCentreId?: string
}

export interface UpdateVirtualBagInput {
  name?: string
  description?: string
  color?: string
  limits?: {
    dailyLimit?: number
    monthlyLimit?: number
    perTransactionLimit?: number
  }
  isActive?: boolean
}

export interface TransferVirtualBagInput {
  clientId: string
  fromBagId: string
  toBagId: string
  amount: number
  description?: string
}

export interface VirtualBagMovementResponse {
  id: string
  bagId: string
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER_IN' | 'TRANSFER_OUT'
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string
  relatedBagId?: string
  createdAt: string
}

export interface VirtualBagResponse {
  id: string
  clientId: string
  name: string
  description?: string
  balance: number
  currency: string
  color?: string
  isActive: boolean
  assignedUsers: string[]
  limits?: {
    dailyLimit?: number
    monthlyLimit?: number
    perTransactionLimit?: number
  }
  createdAt: string
  updatedAt: string
}

// ============================================================================
// HELPERS
// ============================================================================

function toDineroFromAmount(amount: number): any {
  const amountCents = Math.round(amount * 100)
  return Dinero({ amount: amountCents, currency: 'MXN', precision: 2 })
}

function getMoneyAmount(value: any): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'object' && typeof value.amount === 'number') return value.amount
  if (typeof value.getAmount === 'function') return value.getAmount()
  return 0
}

function getAvailableBalanceCents(balance: any, withheld: any): number {
  return getMoneyAmount(balance) - getMoneyAmount(withheld)
}

function toVirtualBagResponse(bag: mongoose.HydratedDocument<IVirtualBagAccount>, clientId: string): VirtualBagResponse {
  const balanceAmount = getMoneyAmount(bag.balance)
  const currency = (bag.balance as any)?.currency || 'MXN'
  return {
    id: bag._id.toString(),
    clientId,
    name: bag.alias || '',
    description: bag.description,
    balance: balanceAmount / 100,
    currency,
    color: bag.color,
    isActive: bag.status === AccountStatus.Active,
    assignedUsers: (bag.assignedUsers || []).map((id) => id.toString()),
    limits: bag.limits,
    createdAt: bag.createdAt?.toISOString?.() || new Date().toISOString(),
    updatedAt: bag.updatedAt?.toISOString?.() || new Date().toISOString()
  }
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class VirtualBagsService {
  private async getClientCostCentres(clientId: string): Promise<mongoose.Types.ObjectId[]> {
    const costCentres = await CostCentre.find({
      client: clientId,
      disabled: { $ne: true }
    }).select('_id')

    return costCentres.map((cc) => cc._id)
  }

  private async getVirtualBagForClient(clientId: string, bagId: string): Promise<mongoose.HydratedDocument<IVirtualBagAccount> | null> {
    const bag = await VirtualBagAccount.findById(bagId)
    if (!bag) return null

    const belongsToClient = await CostCentre.exists({
      _id: bag.costCentre,
      client: clientId
    })

    if (!belongsToClient) {
      return null
    }

    return bag
  }

  /**
   * Get all virtual bags for a client
   */
  async getByClient(clientId: string, options?: { isActive?: boolean }): Promise<VirtualBagResponse[]> {
    const costCentreIds = await this.getClientCostCentres(clientId)
    const filter: any = { costCentre: { $in: costCentreIds } }

    if (options?.isActive !== undefined) {
      filter.status = options.isActive ? AccountStatus.Active : AccountStatus.Deleted
    }

    const virtualBags = await VirtualBagAccount.find(filter).sort({ createdAt: -1 })
    return virtualBags.map((bag) => toVirtualBagResponse(bag, clientId))
  }

  /**
   * Get a virtual bag by ID
   */
  async getById(clientId: string, bagId: string): Promise<VirtualBagResponse | null> {
    const bag = await this.getVirtualBagForClient(clientId, bagId)
    if (!bag) return null
    return toVirtualBagResponse(bag, clientId)
  }

  /**
   * Create a new virtual bag
   */
  async create(input: CreateVirtualBagInput): Promise<VirtualBagResponse> {
    const session = await mongoose.startSession()

    try {
      let virtualBag: mongoose.HydratedDocument<IVirtualBagAccount> | null = null

      await session.withTransaction(async () => {
        const costCentre = input.costCentreId
          ? await CostCentre.findOne({ _id: input.costCentreId, client: input.clientId, disabled: { $ne: true } }).session(session)
          : await CostCentre.findOne({ client: input.clientId, default: true, disabled: { $ne: true } }).session(session)
            || await CostCentre.findOne({ client: input.clientId, disabled: { $ne: true } }).session(session)

        if (!costCentre) {
          throw new Error('No cost centre available for this client')
        }

        const concentrationAccount = await InternalAccount.findOne({
          costCentre: costCentre._id,
          tag: InternalAccountTag.Concentration
        }).session(session)

        if (!concentrationAccount) {
          throw new Error('Concentration account not found for cost centre')
        }

        const initialBalance = input.initialBalance || 0
        const balance = toDineroFromAmount(initialBalance)

        virtualBag = new VirtualBagAccount({
          costCentre: costCentre._id,
          parentAccount: concentrationAccount._id,
          alias: input.name,
          description: input.description,
          color: input.color,
          limits: input.limits,
          assignedUsers: [],
          distributionPercentage: 0,
          balance,
          balanceWithheld: Dinero({ amount: 0, precision: 2, currency: 'MXN' })
        })

        await virtualBag.save({ session })

        if (!concentrationAccount.hasCashBags) {
          concentrationAccount.hasCashBags = true
          await concentrationAccount.save({ session })
        }
      })

      if (!virtualBag) {
        throw new Error('Failed to create virtual bag')
      }

      return toVirtualBagResponse(virtualBag, input.clientId)
    } finally {
      session.endSession()
    }
  }

  /**
   * Update a virtual bag
   */
  async update(clientId: string, bagId: string, input: UpdateVirtualBagInput): Promise<VirtualBagResponse | null> {
    const virtualBag = await this.getVirtualBagForClient(clientId, bagId)
    if (!virtualBag) return null

    if (input.name !== undefined) {
      virtualBag.alias = input.name
    }
    if (input.description !== undefined) {
      virtualBag.description = input.description
    }
    if (input.color !== undefined) {
      virtualBag.color = input.color
    }
    if (input.limits !== undefined) {
      virtualBag.limits = input.limits
    }
    if (input.isActive !== undefined) {
      virtualBag.status = input.isActive ? AccountStatus.Active : AccountStatus.Deleted
    }

    await virtualBag.save()
    return toVirtualBagResponse(virtualBag, clientId)
  }

  /**
   * Deactivate a virtual bag
   */
  async deactivate(clientId: string, bagId: string): Promise<VirtualBagResponse | null> {
    return await this.update(clientId, bagId, { isActive: false })
  }

  /**
   * Transfer funds between virtual bags
   */
  async transfer(input: TransferVirtualBagInput): Promise<{ fromBag: VirtualBagResponse; toBag: VirtualBagResponse }> {
    const session = await mongoose.startSession()

    try {
      let fromBag: mongoose.HydratedDocument<IVirtualBagAccount> | null = null
      let toBag: mongoose.HydratedDocument<IVirtualBagAccount> | null = null

      await session.withTransaction(async () => {
        fromBag = await this.getVirtualBagForClient(input.clientId, input.fromBagId)
        toBag = await this.getVirtualBagForClient(input.clientId, input.toBagId)

        if (!fromBag || !toBag) {
          throw new Error('Virtual bag not found for this client')
        }

        if (fromBag.status !== AccountStatus.Active || toBag.status !== AccountStatus.Active) {
          throw new Error('Cannot transfer with inactive virtual bags')
        }

        const amountDinero = toDineroFromAmount(input.amount)
        const availableCents = getAvailableBalanceCents(fromBag.balance, fromBag.balanceWithheld)
        const amountCents = getMoneyAmount(amountDinero)

        if (amountCents > availableCents) {
          throw new Error('INSUFFICIENT_FUNDS')
        }

        const fromMovement = fromBag.movement({
          type: 'adjustment',
          balanceDelta: amountDinero,
          balanceOperator: 'subtract',
          comment: input.description || `Transferencia a subcuenta ${toBag.alias}`
        })

        const toMovement = toBag.movement({
          type: 'adjustment',
          balanceDelta: amountDinero,
          balanceOperator: 'add',
          comment: input.description || `Transferencia desde subcuenta ${fromBag.alias}`
        })

        await fromMovement.save({ session })
        await toMovement.save({ session })
        await fromBag.save({ session })
        await toBag.save({ session })
      })

      if (!fromBag || !toBag) {
        throw new Error('Failed to transfer between virtual bags')
      }

      return {
        fromBag: toVirtualBagResponse(fromBag, input.clientId),
        toBag: toVirtualBagResponse(toBag, input.clientId)
      }
    } finally {
      session.endSession()
    }
  }

  /**
   * Get movements for a virtual bag
   */
  async getMovements(clientId: string, bagId: string): Promise<VirtualBagMovementResponse[]> {
    const virtualBag = await this.getVirtualBagForClient(clientId, bagId)
    if (!virtualBag) return []

    const movements = await AccountMovement.find({ account: virtualBag._id })
      .sort({ transactedAt: -1 })

    return movements.map((movement) => {
      const balanceBefore = getMoneyAmount(movement.balanceBefore)
      const delta = getMoneyAmount(movement.balanceDelta)
      const operator = movement.balanceOperator || 'add'
      const balanceAfter = operator === 'add' ? balanceBefore + delta : balanceBefore - delta
      const isTransfer = (movement.comment || '').toLowerCase().includes('transferencia')
      const type = isTransfer
        ? (operator === 'add' ? 'TRANSFER_IN' : 'TRANSFER_OUT')
        : (operator === 'add' ? 'CREDIT' : 'DEBIT')

      return {
        id: movement._id.toString(),
        bagId: virtualBag._id.toString(),
        type,
        amount: delta / 100,
        balanceBefore: balanceBefore / 100,
        balanceAfter: balanceAfter / 100,
        description: movement.comment || '',
        createdAt: movement.createdAt?.toISOString?.() || new Date().toISOString()
      }
    })
  }

  /**
   * Assign users to a virtual bag
   */
  async assignUsers(clientId: string, bagId: string, userIds: string[]): Promise<VirtualBagResponse | null> {
    const virtualBag = await this.getVirtualBagForClient(clientId, bagId)
    if (!virtualBag) return null

    const normalized = userIds.map((id) => new mongoose.Types.ObjectId(id))
    const existing = new Set((virtualBag.assignedUsers || []).map((id) => id.toString()))
    const merged = [
      ...(virtualBag.assignedUsers || []),
      ...normalized.filter((id) => !existing.has(id.toString()))
    ]

    virtualBag.assignedUsers = merged
    await virtualBag.save()
    return toVirtualBagResponse(virtualBag, clientId)
  }

  /**
   * Remove users from a virtual bag
   */
  async removeUsers(clientId: string, bagId: string, userIds: string[]): Promise<VirtualBagResponse | null> {
    const virtualBag = await this.getVirtualBagForClient(clientId, bagId)
    if (!virtualBag) return null

    const removeSet = new Set(userIds)
    virtualBag.assignedUsers = (virtualBag.assignedUsers || []).filter((id) => !removeSet.has(id.toString()))
    await virtualBag.save()
    return toVirtualBagResponse(virtualBag, clientId)
  }

  /**
   * Get total balance across all virtual bags
   */
  async getTotalBalance(clientId: string): Promise<{ total: number; currency: string }> {
    const costCentreIds = await this.getClientCostCentres(clientId)
    const virtualBags = await VirtualBagAccount.find({
      costCentre: { $in: costCentreIds },
      status: AccountStatus.Active
    })

    const totalCents = virtualBags.reduce((sum, bag) => sum + getMoneyAmount(bag.balance), 0)
    return { total: totalCents / 100, currency: 'MXN' }
  }

  /**
   * Get virtual bag transfer stats for current month
   */
  async getMonthlyTransferCount(clientId: string): Promise<number> {
    const costCentreIds = await this.getClientCostCentres(clientId)
    const virtualBags = await VirtualBagAccount.find({ costCentre: { $in: costCentreIds } }).select('_id')
    const virtualBagIds = virtualBags.map((bag) => bag._id)

    if (virtualBagIds.length === 0) {
      return 0
    }

    const monthStart = dayjs().startOf('month').toDate()
    const monthEnd = dayjs().endOf('month').toDate()

    const transfersCount = await AccountMovement.countDocuments({
      account: { $in: virtualBagIds },
      balanceOperator: 'subtract',
      comment: { $regex: 'transferencia', $options: 'i' },
      $or: [
        { transactedAt: { $gte: monthStart, $lte: monthEnd } },
        { createdAt: { $gte: monthStart, $lte: monthEnd } }
      ]
    })

    return transfersCount
  }
}
