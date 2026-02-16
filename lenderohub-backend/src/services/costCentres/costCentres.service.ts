// src/services/costCentres/costCentres.service.ts

import mongoose from 'mongoose'
import Dinero from 'dinero.js'

import {
  CostCentre,
  ICostCentre,
  ICostCentreTransactionProfile,
  ICostCentreCommercialRules,
  ICostCentreContact,
  ICostCentreFiscalAddress
} from '../../models/providerAccounts.model'
import { Provider, RuleType } from '../../models/shared/enums'
import {
  CorporateClient,
  ICorporateClient,
  formatCostCentreCode,
  getMaxCostCentresCount
} from '../../models/clients.model'
import {
  InternalAccount,
  InternalAccountTag,
  calculateCheckDigit
} from '../../models/accounts.model'
import { FincoClient } from '../../integrations/finco/client'
import { CommissionsService } from '../commissions/commissions.service'

// ============================================================================
// TYPES
// ============================================================================

interface CreateCostCentreInput {
  clientId: string
  alias: string
  shortName: string
  provider?: Provider
  isDefault?: boolean
  // Contact & Fiscal Data
  contact?: ICostCentreContact
  rfc?: string
  fiscalAddress?: ICostCentreFiscalAddress
  // Configuration
  transactionProfile?: Partial<ICostCentreTransactionProfile>
  commercialRules?: Partial<ICostCentreCommercialRules>
  cashManagementEnabled?: boolean
  clusterId?: string
  // If true, will create the centralizer account in Finco
  createFincoAccount?: boolean
}

interface UpdateCostCentreInput {
  alias?: string
  shortName?: string
  // Contact & Fiscal Data
  contact?: ICostCentreContact
  rfc?: string
  fiscalAddress?: ICostCentreFiscalAddress
  // Configuration
  transactionProfile?: Partial<ICostCentreTransactionProfile>
  commercialRules?: Partial<ICostCentreCommercialRules>
  cashManagementEnabled?: boolean
  clusterId?: string | null
}

// Extended type for populated cost centre (not used directly yet)
type CostCentreWithAccounts = ICostCentre & {
  concentrationAccount?: any
  accounts?: any[]
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_TRANSACTION_PROFILE: ICostCentreTransactionProfile = {
  limitIn: Dinero({ amount: 100000000, precision: 2, currency: 'MXN' }), // 1,000,000 MXN
  opsIn: 1000,
  limitOut: Dinero({ amount: 100000000, precision: 2, currency: 'MXN' }), // 1,000,000 MXN
  opsOut: 1000
}

const DEFAULT_COMMERCIAL_RULES: ICostCentreCommercialRules = {
  in: { type: RuleType.NotApplicable },
  out: { type: RuleType.NotApplicable },
  monthlyFee: { type: RuleType.NotApplicable },
  transactionFee: Dinero({ amount: 450, precision: 2, currency: 'MXN' }), // $4.50 MXN
  minimumBalanceNewAccounts: Dinero({ amount: 0, precision: 2, currency: 'MXN' }),
  maxCashBagsPerSubaccount: 4
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert a number or Money object to a Dinero-compatible Money object
 */
function toMoneyObject(value: any, defaultAmount: number = 0): { amount: number; precision: number; currency: string } {
  // If it's a number, convert to money object
  if (typeof value === 'number') {
    return { amount: value, precision: 2, currency: 'MXN' }
  }
  // If it already has amount property (Money object), return as is
  if (value && typeof value.amount === 'number') {
    return {
      amount: value.amount,
      precision: value.precision || 2,
      currency: value.currency || 'MXN'
    }
  }
  // Default
  return { amount: defaultAmount, precision: 2, currency: 'MXN' }
}

/**
 * Build a properly formatted transaction profile from input
 */
function buildTransactionProfile(input?: Partial<ICostCentreTransactionProfile>): ICostCentreTransactionProfile {
  return {
    limitIn: toMoneyObject(input?.limitIn, 100000000),
    opsIn: input?.opsIn ?? 1000,
    limitOut: toMoneyObject(input?.limitOut, 100000000),
    opsOut: input?.opsOut ?? 1000
  }
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class CostCentresService {
  private fincoClient: FincoClient | null = null

  constructor(fincoClient?: FincoClient) {
    this.fincoClient = fincoClient || null
  }

  /**
   * Create a new Cost Centre for a Corporate Client
   */
  async create(input: CreateCostCentreInput): Promise<ICostCentre> {
    const session = await mongoose.startSession()

    try {
      let costCentre: ICostCentre | null = null

      await session.withTransaction(async () => {
        // 1. Get the Corporate Client
        const client = await CorporateClient.findById(input.clientId).session(session)
        if (!client) {
          throw new Error(`Corporate client not found: ${input.clientId}`)
        }

        // 2. Check if we can create more cost centres
        const existingCount = await CostCentre.countDocuments({
          client: client._id,
          disabled: { $ne: true }
        }).session(session)

        const maxAllowed = getMaxCostCentresCount(client.maxCostCentres)
        if (existingCount >= maxAllowed) {
          throw new Error(`Maximum cost centres reached (${maxAllowed}) for client ${client.name}`)
        }

        // 3. Generate the next code
        const nextCode = existingCount + 1
        const code = formatCostCentreCode(client.prefix, nextCode, client.maxCostCentres)

        // 4. Build transaction profile (converts numbers to Money objects)
        const transactionProfile = buildTransactionProfile(input.transactionProfile)

        // 5. Merge commercial rules with defaults
        const commercialRules: ICostCentreCommercialRules = {
          ...DEFAULT_COMMERCIAL_RULES,
          ...input.commercialRules
        }

        // 6. If this is the first cost centre and isDefault not specified, make it default
        const isDefault = input.isDefault ?? (existingCount === 0)

        // 7. If isDefault is true, unset any existing default
        if (isDefault) {
          await CostCentre.updateMany(
            { client: client._id, default: true },
            { $set: { default: false } }
          ).session(session)
        }

        // 8. Create the Cost Centre
        const newCostCentre = new CostCentre({
          client: client._id,
          alias: input.alias,
          shortName: input.shortName.toUpperCase().slice(0, 10),
          code,
          provider: input.provider || Provider.Finco,
          default: isDefault,
          // Contact & Fiscal Data
          contact: input.contact || undefined,
          rfc: input.rfc || undefined,
          fiscalAddress: input.fiscalAddress || undefined,
          // Configuration
          transactionProfile,
          commercialRules,
          cashManagementEnabled: input.cashManagementEnabled ?? false,
          cluster: input.clusterId || undefined,
          nextAccountCode: 0,
          disabled: false
        })

        await newCostCentre.save({ session })

        // 9. Create the concentration account (centralizer)
        const concentrationAccount = await this.createConcentrationAccount(
          newCostCentre,
          client,
          session
        )

        // 10. If Finco integration is requested, create account in Finco
        if (input.createFincoAccount && this.fincoClient && input.provider === Provider.Finco) {
          try {
            const fincoAccount = await this.fincoClient.createPrivateAccount({
              // The Finco client will use env vars for bank_id, etc.
            })

            // Update cost centre with Finco IDs
            newCostCentre.fincoCustomerId = fincoAccount.ownerId || fincoAccount.owner_id
            newCostCentre.fincoCentralizerAccountId = fincoAccount.id
            // CLABE might be in different places depending on response
            const fincoClabeNumber = fincoAccount.clabeNumber || fincoAccount.clabe_number
            newCostCentre.fincoClabeNumber = fincoClabeNumber

            // Update internal account with Finco ID
            concentrationAccount.fincoAccountId = fincoAccount.id
            concentrationAccount.provider = Provider.Finco
            if (typeof fincoClabeNumber === 'string' && /^\d{18}$/.test(fincoClabeNumber)) {
              concentrationAccount.fullNumber = fincoClabeNumber
              concentrationAccount.markModified('fullNumber')
            }

            await newCostCentre.save({ session })
            await concentrationAccount.save({ session })
          } catch (fincoError: any) {
            console.error('Warning: Could not create Finco account:', fincoError.message)
            // Don't fail the whole operation, just log the warning
          }
        }

        // 11. Ensure commission-related internal accounts are created (LenderoPay parity)
        const commissionsService = new CommissionsService()
        await commissionsService.ensureCommissionAccounts(newCostCentre, session)

        costCentre = newCostCentre
      })

      if (!costCentre) {
        throw new Error('Failed to create cost centre')
      }

      return costCentre
    } finally {
      await session.endSession()
    }
  }

  /**
   * Create the concentration (centralizer) account for a Cost Centre
   */
  private async createConcentrationAccount(
    costCentre: ICostCentre,
    client: ICorporateClient,
    session: mongoose.ClientSession
  ): Promise<any> {
    const isValidClabe = (value?: string): boolean => {
      return typeof value === 'string' && /^\d{18}$/.test(value)
    }

    if (isValidClabe(costCentre.fincoClabeNumber)) {
      const concentrationAccount = new InternalAccount({
        costCentre: costCentre._id,
        fullNumber: costCentre.fincoClabeNumber,
        tag: InternalAccountTag.Concentration,
        alias: `Concentradora - ${costCentre.alias}`,
        isClient: false,
        hasCashBags: false,
        provider: costCentre.provider,
        balance: Dinero({ amount: 0, precision: 2, currency: 'MXN' }),
        balanceWithheld: Dinero({ amount: 0, precision: 2, currency: 'MXN' })
      })

      await concentrationAccount.save({ session })

      // Update cost centre's nextAccountCode
      costCentre.nextAccountCode = 1
      await (costCentre as any).save({ session })

      return concentrationAccount
    }

    // Generate CLABE number
    // Format: bankCode(3) + branchCode(3) + prefix(2-4) + costCode + accountCode + checkDigit
    const bankCode = process.env.BANK_CODE || '646' // Default to STP
    const branchCode = process.env.BRANCH_CODE || '180'

    // Account code is 0 for concentration account
    const accountCode = '0'.padStart(4, '0')

    // Build the number without check digit (17 chars)
    const costCentreCode = costCentre.code.replace(client.prefix, '')
    const numberWithoutCheck = `${bankCode}${branchCode}${client.prefix.padEnd(4, '0')}${costCentreCode}${accountCode}`
    const sanitizedNumber = numberWithoutCheck.replace(/[^0-9]/g, '0')

    // Ensure we have exactly 17 characters before check digit
    const paddedNumber = sanitizedNumber.slice(0, 17).padEnd(17, '0')
    const checkDigit = calculateCheckDigit(paddedNumber)
    const fullNumber = `${paddedNumber}${checkDigit}`

    const concentrationAccount = new InternalAccount({
      costCentre: costCentre._id,
      fullNumber,
      tag: InternalAccountTag.Concentration,
      alias: `Concentradora - ${costCentre.alias}`,
      isClient: false,
      hasCashBags: false,
      provider: costCentre.provider,
      balance: Dinero({ amount: 0, precision: 2, currency: 'MXN' }),
      balanceWithheld: Dinero({ amount: 0, precision: 2, currency: 'MXN' })
    })

    await concentrationAccount.save({ session })

    // Update cost centre's nextAccountCode
    costCentre.nextAccountCode = 1
    await (costCentre as any).save({ session })

    return concentrationAccount
  }

  /**
   * Get all Cost Centres for a client
   */
  async getByClient(
    clientId: string,
    options?: {
      includeDisabled?: boolean
      includeAccounts?: boolean
    }
  ): Promise<ICostCentre[]> {
    const filter: any = { client: clientId }

    if (!options?.includeDisabled) {
      filter.disabled = { $ne: true }
    }

    let query = CostCentre.find(filter).sort({ code: 1 })

    if (options?.includeAccounts) {
      query = query.populate('concentrationAccount').populate('accounts')
    }

    return query.exec()
  }

  /**
   * Get a Cost Centre by ID
   */
  async getById(
    costCentreId: string,
    options?: { includeAccounts?: boolean; includeAll?: boolean }
  ): Promise<ICostCentre | null> {
    let query = CostCentre.findById(costCentreId)

    if (options?.includeAll) {
      query = query
        .populate('concentrationAccount')
        .populate('accounts')
        .populate('accumulators')
        .populate('commissionAgentAssignments')
        .populate('monthlyCharges')
    } else if (options?.includeAccounts) {
      query = query.populate('concentrationAccount').populate('accounts')
    }

    return query.exec()
  }

  /**
   * Get a Cost Centre by code and client
   */
  async getByCode(
    clientId: string,
    code: string
  ): Promise<ICostCentre | null> {
    return CostCentre.findOne({
      client: clientId,
      code: code.toUpperCase()
    }).exec()
  }

  /**
   * Update a Cost Centre
   */
  async update(
    costCentreId: string,
    input: UpdateCostCentreInput
  ): Promise<ICostCentre | null> {
    const costCentre = await CostCentre.findById(costCentreId)
    if (!costCentre) {
      return null
    }

    // Update allowed fields
    if (input.alias !== undefined) {
      costCentre.alias = input.alias
    }
    if (input.shortName !== undefined) {
      costCentre.shortName = input.shortName.toUpperCase().slice(0, 10)
    }
    if (input.cashManagementEnabled !== undefined) {
      costCentre.cashManagementEnabled = input.cashManagementEnabled
    }
    if (input.clusterId !== undefined) {
      costCentre.cluster = input.clusterId ? new mongoose.Types.ObjectId(input.clusterId) : undefined
    }

    // Update contact (partial merge)
    if (input.contact) {
      costCentre.contact = {
        ...costCentre.contact,
        ...input.contact
      }
    }

    // Update RFC
    if (input.rfc !== undefined) {
      costCentre.rfc = input.rfc || undefined
    }

    // Update fiscal address (partial merge)
    if (input.fiscalAddress) {
      costCentre.fiscalAddress = {
        ...costCentre.fiscalAddress,
        ...input.fiscalAddress
      }
    }

    // Update transaction profile (partial, with Money conversion)
    if (input.transactionProfile) {
      const existingProfile = costCentre.transactionProfile || {}
      costCentre.transactionProfile = {
        limitIn: input.transactionProfile.limitIn !== undefined
          ? toMoneyObject(input.transactionProfile.limitIn, (existingProfile.limitIn as any)?.amount || 100000000)
          : existingProfile.limitIn,
        opsIn: input.transactionProfile.opsIn ?? existingProfile.opsIn ?? 1000,
        limitOut: input.transactionProfile.limitOut !== undefined
          ? toMoneyObject(input.transactionProfile.limitOut, (existingProfile.limitOut as any)?.amount || 100000000)
          : existingProfile.limitOut,
        opsOut: input.transactionProfile.opsOut ?? existingProfile.opsOut ?? 1000
      }
    }

    // Update commercial rules (partial)
    if (input.commercialRules) {
      costCentre.commercialRules = {
        ...costCentre.commercialRules,
        ...input.commercialRules
      }
    }

    await costCentre.save()
    return costCentre
  }

  /**
   * Soft delete (disable) a Cost Centre
   */
  async disable(costCentreId: string): Promise<ICostCentre | null> {
    const costCentre = await CostCentre.findById(costCentreId)
    if (!costCentre) {
      return null
    }

    costCentre.disabled = true
    costCentre.default = false // Can't be default if disabled

    await costCentre.save()
    return costCentre
  }

  /**
   * Re-enable a disabled Cost Centre
   */
  async enable(costCentreId: string): Promise<ICostCentre | null> {
    const costCentre = await CostCentre.findById(costCentreId)
    if (!costCentre) {
      return null
    }

    costCentre.disabled = false
    await costCentre.save()
    return costCentre
  }

  /**
   * Set a Cost Centre as default for its client
   */
  async setAsDefault(costCentreId: string): Promise<ICostCentre | null> {
    const session = await mongoose.startSession()

    try {
      let result: ICostCentre | null = null

      await session.withTransaction(async () => {
        const costCentre = await CostCentre.findById(costCentreId).session(session)
        if (!costCentre) {
          throw new Error('Cost Centre not found')
        }

        if (costCentre.disabled) {
          throw new Error('Cannot set a disabled Cost Centre as default')
        }

        // Unset any existing default
        await CostCentre.updateMany(
          { client: costCentre.client, default: true },
          { $set: { default: false } }
        ).session(session)

        // Set this one as default
        costCentre.default = true
        await costCentre.save({ session })

        result = costCentre
      })

      return result
    } finally {
      await session.endSession()
    }
  }

  /**
   * Get statistics for a Cost Centre
   */
  async getStats(costCentreId: string): Promise<{
    accountsCount: number
    activeAccountsCount: number
    totalBalance: number
    totalBalanceWithheld: number
  }> {
    const accounts = await InternalAccount.find({ costCentre: costCentreId })

    let totalBalance = 0
    let totalBalanceWithheld = 0
    let activeAccountsCount = 0

    for (const account of accounts) {
      const balance = account.balance as any
      const balanceWithheld = account.balanceWithheld as any

      if (balance?.amount) {
        totalBalance += balance.amount
      }
      if (balanceWithheld?.amount) {
        totalBalanceWithheld += balanceWithheld.amount
      }
      if (account.status === 'active') {
        activeAccountsCount++
      }
    }

    return {
      accountsCount: accounts.length,
      activeAccountsCount,
      totalBalance,
      totalBalanceWithheld
    }
  }
}

// Singleton instance for convenience
let serviceInstance: CostCentresService | null = null

export function getCostCentresService(fincoClient?: FincoClient): CostCentresService {
  if (!serviceInstance) {
    serviceInstance = new CostCentresService(fincoClient)
  }
  return serviceInstance
}

export default CostCentresService
