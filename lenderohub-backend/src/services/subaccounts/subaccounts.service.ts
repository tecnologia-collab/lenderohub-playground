import mongoose from 'mongoose'
import Dinero from 'dinero.js'

import { InternalAccount, InternalAccountTag, VirtualBagAccount, AccountStatus } from '../../models/accounts.model'
import { CostCentre } from '../../models/providerAccounts.model'
import { FincoClient } from '../../integrations/finco/client'
import { AdminCostCentreAssignment } from '../../models/adminCostCentreAssignments.model'
import { AccountMovement } from '../../models/accountMovements.model'
import { IUser } from '../../models/user.model'
import { SubaccountManagerAssignment } from '../../models/subaccountManagerAssignments.model'
import {
  TransactionTransferOut,
  TransactionTransferIn,
  TransactionVirtualIn,
  TransactionTransferOutStatus,
  TransactionTransferInStatus
} from '../../models/transactions.model'

export type SubaccountCategory = 'client' | 'internal'

export interface SubaccountResponse {
  id: string
  costCentreId: string
  costCentreAlias?: string
  name: string
  tag: string
  category: SubaccountCategory
  clabeNumber?: string
  balance: number
  currency: string
  fincoAccountId?: string
  fincoInstrumentId?: string
  hasVirtualBags: boolean
  virtualBagsCount?: number
  distributedPercentage?: number
}

// Tags for client accounts (visible to users)
const CLIENT_ACCOUNT_TAGS = [
  InternalAccountTag.Concentration,
  InternalAccountTag.Regular
]

// Tags for internal/commission accounts
const INTERNAL_ACCOUNT_TAGS = [
  InternalAccountTag.TransferIn,
  InternalAccountTag.TransferOut,
  InternalAccountTag.TransferOutEarnings,
  InternalAccountTag.TransferInCommissionAgentPayment,
  InternalAccountTag.MonthlyCharges
]

// Human-readable names for internal accounts
const INTERNAL_ACCOUNT_NAMES: Record<string, string> = {
  [InternalAccountTag.TransferIn]: 'SPEI IN COMISION CECO',
  [InternalAccountTag.TransferOut]: 'SPEI OUT PAGOS',
  [InternalAccountTag.TransferOutEarnings]: 'SPEI OUT GANANCIA',
  [InternalAccountTag.TransferInCommissionAgentPayment]: 'SPEI IN PAGO COMISIONISTA',
  [InternalAccountTag.MonthlyCharges]: 'CUOTAS MENSUALES'
}

export interface VirtualBagResponse {
  id: string
  subaccountId: string
  name: string
  description?: string
  balance: number
  currency: string
  color?: string
  distributionPercentage: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateVirtualBagInput {
  name: string
  description?: string
  color?: string
  distributionPercentage?: number
}

export interface TransferBetweenBagsInput {
  fromBagId: string
  toBagId: string
  amount: number
  description?: string
}

export interface CreateSubaccountInput {
  name: string
  costCentreId?: string
  requester: IUser
}

export interface UpdateVirtualBagInput {
  name?: string
  description?: string
  color?: string
  distributionPercentage?: number
}

export interface GetTransactionsOptions {
  type?: 'in' | 'out' | 'all'
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

export interface TransactionItem {
  id: string
  type: 'transfer_in' | 'transfer_out' | 'virtual_in' | 'internal'
  amount: number
  status: string
  description: string
  counterparty: string
  createdAt: string
}

export interface TransactionsResponse {
  transactions: TransactionItem[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface AssignmentResponse {
  id: string
  userProfileId: string
  userName: string
  userEmail: string
  permissions: {
    transferFrom: boolean
    transferTo: boolean
  }
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateAssignmentInput {
  userProfileId: string
  permissions?: {
    transferFrom?: boolean
    transferTo?: boolean
  }
}

type FincoAccountSummary = {
  id?: string
  clabe?: string
  available?: number
}

export class SubaccountsService {
  private fincoClient: FincoClient

  constructor(fincoClient?: FincoClient) {
    this.fincoClient = fincoClient || new FincoClient({
      apiUrl: process.env.FINCO_API_URL || 'https://apicore.stg.finch.lat',
      clientId: process.env.FINCO_CLIENT_ID || '',
      clientSecret: process.env.FINCO_CLIENT_SECRET || '',
      apiKey: process.env.FINCO_API_KEY || '',
      environment: (process.env.FINCO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox'
    })
  }

  private async getFincoAccountsSummary(): Promise<FincoAccountSummary[]> {
    if (!process.env.FINCO_CLIENT_ID) {
      return []
    }
    try {
      const response = await this.fincoClient.getAccounts()
      const accounts = response?.data || response?.accounts || []
      return accounts.map((account: any) => ({
        id: account.id,
        clabe: account.clabeNumber || account.clabe_number || account.clabe,
        available: Number(
          account.availableBalance ??
            account.available_balance ??
            account.balance?.available ??
            account.balance?.availableBalance ??
            account.balance?.available_balance
        )
      }))
    } catch (error: any) {
      console.warn('⚠️ Finco accounts unavailable:', error?.message || error)
      return []
    }
  }

  private buildFincoLookup(accounts: FincoAccountSummary[]) {
    const byId = new Map<string, number>()
    const byClabe = new Map<string, number>()
    for (const account of accounts) {
      if (account.id && Number.isFinite(account.available ?? NaN)) {
        byId.set(account.id, account.available as number)
      }
      if (account.clabe && Number.isFinite(account.available ?? NaN)) {
        byClabe.set(account.clabe, account.available as number)
      }
    }
    return { byId, byClabe }
  }

  private getMoneyAmount(value: any): number {
    if (value == null) return 0
    if (typeof value === 'number') return value
    if (typeof value.getAmount === 'function') return value.getAmount()
    if (typeof value === 'object' && typeof value.amount === 'number') return value.amount
    return 0
  }

  private async getAccessibleCostCentreIds(user: IUser): Promise<mongoose.Types.ObjectId[]> {
    if (!user.clientId) {
      return []
    }

    if (user.profileType === 'corporate') {
      // If user has a specific businessUnitId (CECO) assigned, only return that one
      if (user.businessUnitId) {
        const costCentre = await CostCentre.findOne({
          _id: user.businessUnitId,
          client: user.clientId,
          disabled: { $ne: true }
        }).select('_id')
        return costCentre ? [costCentre._id] : []
      }
      // Otherwise, return all cost centres for the client (global corporate admin)
      const costCentres = await CostCentre.find({
        client: user.clientId,
        disabled: { $ne: true }
      }).select('_id')
      return costCentres.map((cc) => cc._id)
    }

    if (user.profileType === 'administrator') {
      const assignments = await AdminCostCentreAssignment.find({
        administrator: user._id,
        isActive: true
      }).select('costCentre')
      return assignments.map((assignment) => assignment.costCentre as mongoose.Types.ObjectId)
    }

    return []
  }

  async getByClient(clientId: string, requester?: IUser, options?: { includeInternal?: boolean }): Promise<SubaccountResponse[]> {
    // If requester provided, filter by accessible cost centres
    let costCentreFilter: Record<string, any> = {
      client: clientId,
      disabled: { $ne: true }
    }

    if (requester) {
      const accessibleIds = await this.getAccessibleCostCentreIds(requester)
      if (accessibleIds.length === 0) {
        return []
      }
      costCentreFilter._id = { $in: accessibleIds }
    }

    const costCentres = await CostCentre.find(costCentreFilter)
      .select('_id alias fincoClabeNumber fincoCentralizerAccountId fincoCentralizerInstrumentId')

    if (costCentres.length === 0) {
      return []
    }

    const costCentreIds = costCentres.map((cc) => cc._id)

    // Determine which tags to include
    const tagsToInclude = [...CLIENT_ACCOUNT_TAGS]
    if (options?.includeInternal) {
      tagsToInclude.push(...INTERNAL_ACCOUNT_TAGS)
    }

    const accounts = await InternalAccount.find({
      costCentre: { $in: costCentreIds },
      tag: { $in: tagsToInclude }
    }).lean()

    const fincoAccounts = await this.getFincoAccountsSummary()
    const fincoLookup = this.buildFincoLookup(fincoAccounts)

    // Get virtual bags count for all accounts
    const accountIds = accounts.map((acc: any) => acc._id)
    const virtualBagsCounts = await VirtualBagAccount.aggregate([
      {
        $match: {
          parentAccount: { $in: accountIds },
          status: AccountStatus.Active
        }
      },
      {
        $group: {
          _id: '$parentAccount',
          count: { $sum: 1 }
        }
      }
    ])
    const virtualBagsMap = new Map<string, number>(
      virtualBagsCounts.map((item: any) => [item._id.toString(), item.count])
    )

    return accounts
      .map((account: any) => {
        const costCentre = costCentres.find((cc) => cc._id.toString() === account.costCentre.toString())
        const isClientAccount = CLIENT_ACCOUNT_TAGS.includes(account.tag)
        const isInternalAccount = INTERNAL_ACCOUNT_TAGS.includes(account.tag)

        // For client accounts, require Finco account ID
        const fincoAccountId = account.fincoAccountId || (account.tag === InternalAccountTag.Concentration ? costCentre?.fincoCentralizerAccountId : undefined)
        if (isClientAccount && !fincoAccountId) {
          return null
        }

        const clabeNumber = account.fullNumber || costCentre?.fincoClabeNumber || ''
        const fincoAvailable =
          (fincoAccountId && fincoLookup.byId.get(fincoAccountId)) ||
          (clabeNumber && fincoLookup.byClabe.get(clabeNumber)) ||
          null

        const withheldCents = this.getMoneyAmount(account.balanceWithheld)
        const balance = fincoAvailable != null
          ? Math.max(0, fincoAvailable - withheldCents / 100)
          : (this.getMoneyAmount(account.balance) - withheldCents) / 100

        // Determine category and name
        const category: SubaccountCategory = isInternalAccount ? 'internal' : 'client'
        let name = account.alias
        if (!name) {
          if (account.tag === InternalAccountTag.Concentration) {
            name = 'Concentradora'
          } else if (isInternalAccount) {
            name = INTERNAL_ACCOUNT_NAMES[account.tag] || 'Cuenta Interna'
          } else {
            name = 'Subcuenta'
          }
        }

        const virtualBagsCount = virtualBagsMap.get(account._id.toString()) || 0

        return {
          id: account._id.toString(),
          costCentreId: account.costCentre.toString(),
          costCentreAlias: costCentre?.alias,
          name,
          tag: account.tag,
          category,
          clabeNumber,
          balance,
          currency: 'MXN',
          fincoAccountId,
          fincoInstrumentId: account.fincoInstrumentId || costCentre?.fincoCentralizerInstrumentId,
          hasVirtualBags: virtualBagsCount > 0 || Boolean(account.hasCashBags),
          virtualBagsCount
        }
      })
      .filter(Boolean) as SubaccountResponse[]
  }

  async create(input: CreateSubaccountInput): Promise<SubaccountResponse> {
    const session = await mongoose.startSession()

    try {
      let created: SubaccountResponse | null = null

      await session.withTransaction(async () => {
        if (!['corporate', 'administrator'].includes(input.requester.profileType)) {
          throw new Error('Perfil no permitido para crear subcuentas')
        }

        if (!input.costCentreId) {
          throw new Error('Selecciona un CECO')
        }

        const accessibleCostCentreIds = await this.getAccessibleCostCentreIds(input.requester)
        if (!accessibleCostCentreIds.some((id) => id.toString() === input.costCentreId)) {
          throw new Error('No tienes acceso al CECO seleccionado')
        }

        const costCentreFilter: Record<string, any> = {
          _id: input.costCentreId,
          disabled: { $ne: true }
        }
        if (input.requester.clientId) {
          costCentreFilter.client = input.requester.clientId
        }

        const costCentre = await CostCentre.findOne(costCentreFilter).session(session)

        if (!costCentre) {
          throw new Error('No se encontró el CECO seleccionado')
        }

        const fincoAccount = await this.fincoClient.createPrivateAccount({})
        const fincoClabeNumber = fincoAccount?.clabeNumber || fincoAccount?.clabe_number

        const account = new InternalAccount({
          costCentre: costCentre._id,
          fullNumber: fincoClabeNumber || '',
          tag: InternalAccountTag.Regular,
          alias: input.name,
          isClient: false,
          hasCashBags: false,
          provider: costCentre.provider,
          fincoAccountId: fincoAccount?.id,
          fincoInstrumentId: fincoAccount?.instrumentId,
          balance: Dinero({ amount: 0, precision: 2, currency: 'MXN' }),
          balanceWithheld: Dinero({ amount: 0, precision: 2, currency: 'MXN' })
        })

        await account.save({ session })

        created = {
          id: account._id.toString(),
          costCentreId: costCentre._id.toString(),
          costCentreAlias: costCentre.alias,
          name: account.alias || 'Subcuenta',
          tag: account.tag,
          category: 'client' as SubaccountCategory,
          clabeNumber: account.fullNumber,
          balance: 0,
          currency: 'MXN',
          fincoAccountId: account.fincoAccountId,
          fincoInstrumentId: account.fincoInstrumentId,
          hasVirtualBags: false
        }
      })

      if (!created) {
        throw new Error('Failed to create subaccount')
      }

      return created
    } finally {
      await session.endSession()
    }
  }

  /**
   * Get a single subaccount by ID
   */
  async getById(subaccountId: string, clientId: string): Promise<SubaccountResponse | null> {
    const account = await InternalAccount.findById(subaccountId).lean()
    if (!account) return null

    const costCentre = await CostCentre.findOne({
      _id: account.costCentre,
      client: clientId,
      disabled: { $ne: true }
    }).select('_id alias fincoClabeNumber fincoCentralizerAccountId fincoCentralizerInstrumentId')

    if (!costCentre) return null

    const fincoAccounts = await this.getFincoAccountsSummary()
    const fincoLookup = this.buildFincoLookup(fincoAccounts)

    const fincoAccountId = account.fincoAccountId || (account.tag === InternalAccountTag.Concentration ? costCentre.fincoCentralizerAccountId : undefined)
    const clabeNumber = account.fullNumber || costCentre.fincoClabeNumber || ''
    const fincoAvailable =
      (fincoAccountId && fincoLookup.byId.get(fincoAccountId)) ||
      (clabeNumber && fincoLookup.byClabe.get(clabeNumber)) ||
      null

    const withheldCents = this.getMoneyAmount(account.balanceWithheld)
    const balance = fincoAvailable != null
      ? Math.max(0, fincoAvailable - withheldCents / 100)
      : (this.getMoneyAmount(account.balance) - withheldCents) / 100

    // Get virtual bags count and total percentage
    const virtualBags = await VirtualBagAccount.find({
      parentAccount: account._id,
      status: AccountStatus.Active
    }).select('distributionPercentage')

    const virtualBagsCount = virtualBags.length
    const distributedPercentage = virtualBags.reduce((sum, bag) => sum + (bag.distributionPercentage || 0), 0) / 100

    // Determine category
    const isInternalAccount = INTERNAL_ACCOUNT_TAGS.includes(account.tag as InternalAccountTag)
    const category: SubaccountCategory = isInternalAccount ? 'internal' : 'client'

    // Determine name
    let name = account.alias
    if (!name) {
      if (account.tag === InternalAccountTag.Concentration) {
        name = 'Concentradora'
      } else if (isInternalAccount) {
        name = INTERNAL_ACCOUNT_NAMES[account.tag] || 'Cuenta Interna'
      } else {
        name = 'Subcuenta'
      }
    }

    return {
      id: account._id.toString(),
      costCentreId: account.costCentre.toString(),
      costCentreAlias: costCentre.alias,
      name,
      tag: account.tag,
      category,
      clabeNumber,
      balance,
      currency: 'MXN',
      fincoAccountId,
      fincoInstrumentId: account.fincoInstrumentId || costCentre.fincoCentralizerInstrumentId,
      hasVirtualBags: Boolean(account.hasCashBags),
      virtualBagsCount,
      distributedPercentage
    }
  }

  /**
   * Get virtual bags for a subaccount
   */
  async getVirtualBags(subaccountId: string, clientId: string): Promise<VirtualBagResponse[]> {
    // Validate subaccount belongs to client
    const account = await InternalAccount.findById(subaccountId)
    if (!account) return []

    const costCentre = await CostCentre.findOne({
      _id: account.costCentre,
      client: clientId,
      disabled: { $ne: true }
    })
    if (!costCentre) return []

    const virtualBags = await VirtualBagAccount.find({
      parentAccount: subaccountId,
      status: AccountStatus.Active
    }).sort({ createdAt: -1 })

    return virtualBags.map((bag) => ({
      id: bag._id.toString(),
      subaccountId: subaccountId,
      name: bag.alias || '',
      description: bag.description,
      balance: this.getMoneyAmount(bag.balance) / 100,
      currency: 'MXN',
      color: bag.color,
      distributionPercentage: (bag.distributionPercentage || 0) / 100,
      isActive: bag.status === AccountStatus.Active,
      createdAt: bag.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: bag.updatedAt?.toISOString() || new Date().toISOString()
    }))
  }

  /**
   * Create a virtual bag within a subaccount
   */
  async createVirtualBag(
    subaccountId: string,
    clientId: string,
    input: CreateVirtualBagInput
  ): Promise<VirtualBagResponse> {
    const session = await mongoose.startSession()

    try {
      let created: VirtualBagResponse | null = null

      await session.withTransaction(async () => {
        const account = await InternalAccount.findById(subaccountId).session(session)
        if (!account) {
          throw new Error('Subcuenta no encontrada')
        }

        const costCentre = await CostCentre.findOne({
          _id: account.costCentre,
          client: clientId,
          disabled: { $ne: true }
        }).session(session)

        if (!costCentre) {
          throw new Error('No tienes acceso a esta subcuenta')
        }

        // Check distribution percentage limit
        const existingBags = await VirtualBagAccount.find({
          parentAccount: subaccountId,
          status: AccountStatus.Active
        }).session(session)

        const currentPercentage = existingBags.reduce((sum, bag) => sum + (bag.distributionPercentage || 0), 0)
        const newPercentage = (input.distributionPercentage || 0) * 100 // Convert to basis points (100% = 10000)

        if (currentPercentage + newPercentage > 10000) {
          throw new Error(`El porcentaje total excede 100%. Disponible: ${(10000 - currentPercentage) / 100}%`)
        }

        const virtualBag = new VirtualBagAccount({
          costCentre: costCentre._id,
          parentAccount: account._id,
          alias: input.name,
          description: input.description,
          color: input.color,
          distributionPercentage: newPercentage,
          status: AccountStatus.Active,
          balance: Dinero({ amount: 0, precision: 2, currency: 'MXN' }),
          balanceWithheld: Dinero({ amount: 0, precision: 2, currency: 'MXN' })
        })

        await virtualBag.save({ session })

        // Mark parent account as having cash bags
        if (!account.hasCashBags) {
          account.hasCashBags = true
          await account.save({ session })
        }

        created = {
          id: virtualBag._id.toString(),
          subaccountId: subaccountId,
          name: virtualBag.alias || '',
          description: virtualBag.description,
          balance: 0,
          currency: 'MXN',
          color: virtualBag.color,
          distributionPercentage: (virtualBag.distributionPercentage || 0) / 100,
          isActive: true,
          createdAt: virtualBag.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: virtualBag.updatedAt?.toISOString() || new Date().toISOString()
        }
      })

      if (!created) {
        throw new Error('Failed to create virtual bag')
      }

      return created
    } finally {
      await session.endSession()
    }
  }

  /**
   * Transfer funds between virtual bags within the same subaccount
   */
  async transferBetweenBags(
    subaccountId: string,
    clientId: string,
    input: TransferBetweenBagsInput
  ): Promise<{ fromBag: VirtualBagResponse; toBag: VirtualBagResponse }> {
    const session = await mongoose.startSession()

    try {
      let result: { fromBag: VirtualBagResponse; toBag: VirtualBagResponse } | null = null

      await session.withTransaction(async () => {
        // Validate subaccount access
        const account = await InternalAccount.findById(subaccountId).session(session)
        if (!account) {
          throw new Error('Subcuenta no encontrada')
        }

        const costCentre = await CostCentre.findOne({
          _id: account.costCentre,
          client: clientId,
          disabled: { $ne: true }
        }).session(session)

        if (!costCentre) {
          throw new Error('No tienes acceso a esta subcuenta')
        }

        // Get both bags and validate they belong to this subaccount
        const fromBag = await VirtualBagAccount.findOne({
          _id: input.fromBagId,
          parentAccount: subaccountId,
          status: AccountStatus.Active
        }).session(session)

        const toBag = await VirtualBagAccount.findOne({
          _id: input.toBagId,
          parentAccount: subaccountId,
          status: AccountStatus.Active
        }).session(session)

        if (!fromBag || !toBag) {
          throw new Error('Bolsa virtual no encontrada')
        }

        // Validate sufficient funds
        const amountCents = Math.round(input.amount * 100)
        const fromBalance = this.getMoneyAmount(fromBag.balance)
        const fromWithheld = this.getMoneyAmount(fromBag.balanceWithheld)
        const availableCents = fromBalance - fromWithheld

        if (amountCents > availableCents) {
          throw new Error('Saldo insuficiente')
        }

        const amountDinero = Dinero({ amount: amountCents, precision: 2, currency: 'MXN' })

        // Create movements
        const fromMovement = fromBag.movement({
          type: 'adjustment',
          balanceDelta: amountDinero,
          balanceOperator: 'subtract',
          comment: input.description || `Transferencia a bolsa ${toBag.alias}`
        })

        const toMovement = toBag.movement({
          type: 'adjustment',
          balanceDelta: amountDinero,
          balanceOperator: 'add',
          comment: input.description || `Transferencia desde bolsa ${fromBag.alias}`
        })

        await fromMovement.save({ session })
        await toMovement.save({ session })
        await fromBag.save({ session })
        await toBag.save({ session })

        result = {
          fromBag: {
            id: fromBag._id.toString(),
            subaccountId,
            name: fromBag.alias || '',
            description: fromBag.description,
            balance: this.getMoneyAmount(fromBag.balance) / 100,
            currency: 'MXN',
            color: fromBag.color,
            distributionPercentage: (fromBag.distributionPercentage || 0) / 100,
            isActive: fromBag.status === AccountStatus.Active,
            createdAt: fromBag.createdAt?.toISOString() || new Date().toISOString(),
            updatedAt: fromBag.updatedAt?.toISOString() || new Date().toISOString()
          },
          toBag: {
            id: toBag._id.toString(),
            subaccountId,
            name: toBag.alias || '',
            description: toBag.description,
            balance: this.getMoneyAmount(toBag.balance) / 100,
            currency: 'MXN',
            color: toBag.color,
            distributionPercentage: (toBag.distributionPercentage || 0) / 100,
            isActive: toBag.status === AccountStatus.Active,
            createdAt: toBag.createdAt?.toISOString() || new Date().toISOString(),
            updatedAt: toBag.updatedAt?.toISOString() || new Date().toISOString()
          }
        }
      })

      if (!result) {
        throw new Error('Failed to transfer between bags')
      }

      return result
    } finally {
      await session.endSession()
    }
  }

  /**
   * Update a virtual bag within a subaccount
   */
  async updateVirtualBag(
    subaccountId: string,
    bagId: string,
    clientId: string,
    input: UpdateVirtualBagInput
  ): Promise<VirtualBagResponse> {
    const session = await mongoose.startSession()

    try {
      let updated: VirtualBagResponse | null = null

      await session.withTransaction(async () => {
        // Validate subaccount access
        const account = await InternalAccount.findById(subaccountId).session(session)
        if (!account) {
          throw new Error('Subcuenta no encontrada')
        }

        const costCentre = await CostCentre.findOne({
          _id: account.costCentre,
          client: clientId,
          disabled: { $ne: true }
        }).session(session)

        if (!costCentre) {
          throw new Error('No tienes acceso a esta subcuenta')
        }

        // Find the virtual bag
        const virtualBag = await VirtualBagAccount.findOne({
          _id: bagId,
          parentAccount: subaccountId,
          status: AccountStatus.Active
        }).session(session)

        if (!virtualBag) {
          throw new Error('Bolsa virtual no encontrada')
        }

        // If distributionPercentage is being changed, validate total
        if (input.distributionPercentage !== undefined) {
          const newPercentageBasisPoints = input.distributionPercentage * 100

          // Get all other active bags (excluding the current one)
          const otherBags = await VirtualBagAccount.find({
            parentAccount: subaccountId,
            status: AccountStatus.Active,
            _id: { $ne: bagId }
          }).session(session)

          const otherPercentage = otherBags.reduce((sum, bag) => sum + (bag.distributionPercentage || 0), 0)

          if (otherPercentage + newPercentageBasisPoints > 10000) {
            throw new Error(`El porcentaje total excede 100%. Disponible: ${(10000 - otherPercentage) / 100}%`)
          }

          virtualBag.distributionPercentage = newPercentageBasisPoints
        }

        // Update optional fields
        if (input.name !== undefined) {
          virtualBag.alias = input.name.trim()
        }
        if (input.description !== undefined) {
          virtualBag.description = input.description
        }
        if (input.color !== undefined) {
          virtualBag.color = input.color
        }

        await virtualBag.save({ session })

        updated = {
          id: virtualBag._id.toString(),
          subaccountId,
          name: virtualBag.alias || '',
          description: virtualBag.description,
          balance: this.getMoneyAmount(virtualBag.balance) / 100,
          currency: 'MXN',
          color: virtualBag.color,
          distributionPercentage: (virtualBag.distributionPercentage || 0) / 100,
          isActive: virtualBag.status === AccountStatus.Active,
          createdAt: virtualBag.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: virtualBag.updatedAt?.toISOString() || new Date().toISOString()
        }
      })

      if (!updated) {
        throw new Error('Failed to update virtual bag')
      }

      return updated
    } finally {
      await session.endSession()
    }
  }

  /**
   * Get transaction history for a subaccount
   */
  async getTransactions(
    subaccountId: string,
    clientId: string,
    options: GetTransactionsOptions = {}
  ): Promise<TransactionsResponse> {
    const {
      type = 'all',
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = options

    // Validate subaccount access
    const account = await InternalAccount.findById(subaccountId)
    if (!account) {
      throw new Error('Subcuenta no encontrada')
    }

    const costCentre = await CostCentre.findOne({
      _id: account.costCentre,
      client: clientId,
      disabled: { $ne: true }
    })

    if (!costCentre) {
      throw new Error('No tienes acceso a esta subcuenta')
    }

    // Build date filter
    const dateFilter: Record<string, any> = {}
    if (startDate) {
      dateFilter.$gte = new Date(startDate)
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate)
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0

    const accountId = account._id

    // Collect transaction promises based on type
    const transactionItems: TransactionItem[] = []
    let totalCount = 0

    if (type === 'out' || type === 'all') {
      // TransferOut: fromAccount = accountId
      const outFilter: Record<string, any> = { fromAccount: accountId }
      if (hasDateFilter) {
        outFilter.createdAt = dateFilter
      }

      const [transfersOut, transfersOutCount] = await Promise.all([
        TransactionTransferOut.find(outFilter)
          .sort({ createdAt: -1 })
          .populate({ path: 'toAccount', populate: { path: 'beneficiary' } })
          .lean(),
        TransactionTransferOut.countDocuments(outFilter)
      ])

      for (const tx of transfersOut) {
        const txAny = tx as any
        const beneficiary = txAny.toAccount?.beneficiary
        const counterparty = beneficiary?.alias || beneficiary?.name || txAny.toAccount?.alias || 'Desconocido'

        transactionItems.push({
          id: txAny._id.toString(),
          type: 'transfer_out',
          amount: this.getMoneyAmount(txAny.amountTotal) / 100,
          status: txAny.status,
          description: txAny.description || '',
          counterparty,
          createdAt: txAny.createdAt?.toISOString() || new Date().toISOString()
        })
      }
      totalCount += transfersOutCount
    }

    if (type === 'in' || type === 'all') {
      // TransferIn: toAccount = accountId
      const inFilter: Record<string, any> = { toAccount: accountId }
      if (hasDateFilter) {
        inFilter.createdAt = dateFilter
      }

      const [transfersIn, transfersInCount] = await Promise.all([
        TransactionTransferIn.find(inFilter)
          .sort({ createdAt: -1 })
          .lean(),
        TransactionTransferIn.countDocuments(inFilter)
      ])

      for (const tx of transfersIn) {
        const txAny = tx as any
        transactionItems.push({
          id: txAny._id.toString(),
          type: 'transfer_in',
          amount: this.getMoneyAmount(txAny.amountTransfer) / 100,
          status: txAny.status,
          description: txAny.description || txAny.fromName || '',
          counterparty: txAny.fromName || 'Desconocido',
          createdAt: txAny.createdAt?.toISOString() || new Date().toISOString()
        })
      }
      totalCount += transfersInCount

      // VirtualIn: toAccount = accountId
      const virtualInFilter: Record<string, any> = { toAccount: accountId }
      if (hasDateFilter) {
        virtualInFilter.createdAt = dateFilter
      }

      const [virtualsIn, virtualsInCount] = await Promise.all([
        TransactionVirtualIn.find(virtualInFilter)
          .sort({ createdAt: -1 })
          .lean(),
        TransactionVirtualIn.countDocuments(virtualInFilter)
      ])

      for (const tx of virtualsIn) {
        const txAny = tx as any
        transactionItems.push({
          id: txAny._id.toString(),
          type: 'virtual_in',
          amount: this.getMoneyAmount(txAny.amountTransfer) / 100,
          status: 'liquidated',
          description: txAny.subtype || 'Virtual',
          counterparty: 'Sistema',
          createdAt: txAny.createdAt?.toISOString() || new Date().toISOString()
        })
      }
      totalCount += virtualsInCount
    }

    // Sort all combined results by createdAt descending
    transactionItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Paginate the combined results
    const skip = (page - 1) * limit
    const paginatedItems = transactionItems.slice(skip, skip + limit)

    return {
      transactions: paginatedItems,
      total: totalCount,
      page,
      limit,
      hasMore: skip + limit < totalCount
    }
  }

  /**
   * Get user assignments for a subaccount
   */
  async getAssignments(subaccountId: string, clientId: string): Promise<AssignmentResponse[]> {
    // Validate subaccount access
    const account = await InternalAccount.findById(subaccountId)
    if (!account) {
      throw new Error('Subcuenta no encontrada')
    }

    const costCentre = await CostCentre.findOne({
      _id: account.costCentre,
      client: clientId,
      disabled: { $ne: true }
    })

    if (!costCentre) {
      throw new Error('No tienes acceso a esta subcuenta')
    }

    const assignments = await SubaccountManagerAssignment.find({
      account: subaccountId,
      isActive: true
    }).populate({
      path: 'userProfile',
      populate: {
        path: 'user',
        select: 'firstName lastName email'
      }
    })

    return assignments.map((assignment) => {
      const profile = assignment.userProfile as any
      const user = profile?.user

      return {
        id: assignment._id.toString(),
        userProfileId: profile?._id?.toString() || '',
        userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Sin nombre',
        userEmail: user?.email || '',
        permissions: {
          transferFrom: assignment.permissions?.transferFrom ?? true,
          transferTo: assignment.permissions?.transferTo ?? true
        },
        isActive: assignment.isActive,
        createdAt: assignment.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: assignment.updatedAt?.toISOString() || new Date().toISOString()
      }
    })
  }

  /**
   * Create a user assignment for a subaccount
   */
  async createAssignment(
    subaccountId: string,
    clientId: string,
    input: CreateAssignmentInput
  ): Promise<AssignmentResponse> {
    // Validate subaccount access
    const account = await InternalAccount.findById(subaccountId)
    if (!account) {
      throw new Error('Subcuenta no encontrada')
    }

    const costCentre = await CostCentre.findOne({
      _id: account.costCentre,
      client: clientId,
      disabled: { $ne: true }
    })

    if (!costCentre) {
      throw new Error('No tienes acceso a esta subcuenta')
    }

    // Verify the user profile exists and belongs to the same client
    // Import dynamically to avoid circular deps at top level
    const { SubaccountManagerUserProfile } = await import('../../models/userProfiles.model')
    const userProfile = await SubaccountManagerUserProfile.findOne({
      _id: input.userProfileId,
      client: clientId,
      isActive: true
    }).populate({
      path: 'user',
      select: 'firstName lastName email'
    })

    if (!userProfile) {
      throw new Error('Perfil de usuario no encontrado o no pertenece al mismo cliente')
    }

    // Check if assignment already exists (even if inactive, reactivate)
    const existingAssignment = await SubaccountManagerAssignment.findOne({
      userProfile: input.userProfileId,
      account: subaccountId
    })

    let assignment: any

    if (existingAssignment) {
      if (existingAssignment.isActive) {
        throw new Error('El usuario ya tiene asignación a esta subcuenta')
      }
      // Reactivate existing assignment
      existingAssignment.isActive = true
      existingAssignment.permissions = {
        transferFrom: input.permissions?.transferFrom ?? true,
        transferTo: input.permissions?.transferTo ?? true
      }
      await existingAssignment.save()
      assignment = existingAssignment
    } else {
      assignment = await SubaccountManagerAssignment.create({
        userProfile: input.userProfileId,
        account: subaccountId,
        isActive: true,
        permissions: {
          transferFrom: input.permissions?.transferFrom ?? true,
          transferTo: input.permissions?.transferTo ?? true
        }
      })
    }

    const user = (userProfile as any).user

    return {
      id: assignment._id.toString(),
      userProfileId: input.userProfileId,
      userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Sin nombre',
      userEmail: user?.email || '',
      permissions: {
        transferFrom: assignment.permissions?.transferFrom ?? true,
        transferTo: assignment.permissions?.transferTo ?? true
      },
      isActive: true,
      createdAt: assignment.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: assignment.updatedAt?.toISOString() || new Date().toISOString()
    }
  }

  /**
   * Remove (deactivate) a user assignment for a subaccount
   */
  async removeAssignment(
    subaccountId: string,
    assignmentId: string,
    clientId: string
  ): Promise<void> {
    // Validate subaccount access
    const account = await InternalAccount.findById(subaccountId)
    if (!account) {
      throw new Error('Subcuenta no encontrada')
    }

    const costCentre = await CostCentre.findOne({
      _id: account.costCentre,
      client: clientId,
      disabled: { $ne: true }
    })

    if (!costCentre) {
      throw new Error('No tienes acceso a esta subcuenta')
    }

    const assignment = await SubaccountManagerAssignment.findOne({
      _id: assignmentId,
      account: subaccountId,
      isActive: true
    })

    if (!assignment) {
      throw new Error('Asignación no encontrada')
    }

    assignment.isActive = false
    await assignment.save()
  }
}
