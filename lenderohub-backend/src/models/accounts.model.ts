import * as dinero from 'dinero.js'
import Dinero from 'dinero.js'
import mongoose from 'mongoose'

import * as constants from '../constants'
import * as accountMovementsModels from './accountMovements.model'
import * as beneficiariesModels from './beneficiaries.model'
import * as transactionsModels from './transactions.model'
import * as subaccountManagerAssignmentsModels from './subaccountManagerAssignments.model'
import { dayjs } from '../utils/dayjs'
import { Provider } from './shared/enums'

// Re-export Provider for convenience
export { Provider }

// Note: ICostCentre is imported via lazy reference to avoid circular dependency

function coerceDinero(value: any): dinero.Dinero {
  if (value && typeof value.getAmount === 'function') {
    return value as dinero.Dinero
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
  return Dinero({ amount: 0, precision: 2, currency: 'MXN' })
}

function toMoneyObject(value: dinero.Dinero): dinero.DineroObject {
  return {
    amount: value.getAmount(),
    precision: 2,
    currency: 'MXN'
  }
}

/******************************************************************************
 * Common.
 *****************************************************************************/

function calculateCheckDigit (accountNumber: string, hasCheckDigit = false): string {
  const constants = [3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7]
  let totalSum = 0
  let index = 0
  for (; index < accountNumber.length - (hasCheckDigit ? 1 : 0); index++) {
    totalSum += parseInt(accountNumber[index]) * constants[index] % 10
  }
  return `${(10 - (totalSum % 10)) % 10}`
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function validateCheckDigit (fullNumber: string): boolean {
  const expectedCheckDigit = calculateCheckDigit(fullNumber, true)
  return fullNumber[fullNumber.length - 1] === expectedCheckDigit
}

function maskNumber (fullNumber: string, digitsToShow = 4): string {
  const maskedLength = fullNumber.length - digitsToShow
  const maskedPart = '*'.repeat(maskedLength)
  const lastFourDigits = fullNumber.slice(maskedLength, fullNumber.length)
  return `${maskedPart}${lastFourDigits}`
}

enum AccountType {
  Internal = 'internal',
  External = 'external',
  CashBag = 'cashBag'
}

enum AccountStatus {
  Active = 'active',
  Deleted = 'deleted'
}

interface IAccount {
  // Document fields.
  type: AccountType
  status: AccountStatus
  alias: string
  createdAt?: Date
  updatedAt?: Date
}

type AccountModel = mongoose.Model<IAccount>

const accountSchema = new mongoose.Schema<IAccount, AccountModel>({
  type: {
    type: String,
    enum: Object.values(AccountType),
    required: true
  },
  status: {
    type: String,
    enum: Object.values(AccountStatus),
    required: true,
    default: AccountStatus.Active
  },
  alias: {
    type: String
  }
}, {
  collection: 'accounts',
  discriminatorKey: 'type',
  timestamps: true
})

const Account = mongoose.model<IAccount, AccountModel>('Account', accountSchema)

/******************************************************************************
 * Cost Centre Account With Balances, applicable to Internal and Cash Bag.
 *****************************************************************************/

interface ICostCentreAccountWithBalances {
  // Document fields.
  costCentre: mongoose.Types.ObjectId | mongoose.Document  // References CostCentre model
  balance: dinero.Dinero | dinero.DineroObject | number
  balanceWithheld: dinero.Dinero | dinero.DineroObject | number
  // Methods.
  movement: (params: IMovementParameters) => mongoose.HydratedDocument<accountMovementsModels.IAccountMovement>
}

/******************************************************************************
 * Internal.
 *****************************************************************************/

enum InternalAccountTag {
  Reserved = 'reserved',
  Concentration = 'concentration',
  TransferIn = 'transferIn',
  TransferOut = 'transferOut',
  TransferOutEarnings = 'transferOutEarnings',
  TransferInCommissionAgentPayment = 'transferInCommissionAgentPayment',
  VatToPayCommissionAgent = 'vatToPayCommissionAgent',
  IncomeTaxToPayCommissionAgent = 'incomeTaxToPayCommissionAgent',
  MonthlyCharges = 'monthlyCharges',
  Regular = 'regular',
  CashManagement = 'cashManagement'
}

interface IMovementParameters {
  transactedAt?: Date
  type: accountMovementsModels.AccountMovementType
  balanceDelta?: dinero.Dinero
  balanceOperator?: accountMovementsModels.AccountMovementOperation
  balanceWithheldDelta?: dinero.Dinero
  balanceWithheldOperator?: accountMovementsModels.AccountMovementOperation
  transaction?: mongoose.HydratedDocument<transactionsModels.ITransaction>
  comment?: string
}

interface IAdditionalInformationFields {
  name?: string
  rfc?: string
  postalCode?: string
}

interface IInternalAccount extends IAccount, ICostCentreAccountWithBalances {
  // Document fields - Identification
  fullNumber: string
  tag: InternalAccountTag
  isClient: boolean
  additionalInformation: IAdditionalInformationFields
  hasCashBags: boolean

  // Document fields - Provider Integration (NEW)
  provider?: Provider   // Inherited from CostCentre, but stored for query efficiency
  fincoAccountId?: string                  // UUID of this account in Finco
  fincoInstrumentId?: string               // Instrument ID for this account in Finco

  // Document fields - STP Integration (Future)
  stpCuenta?: string
  stpClabe?: string

  // Virtual fields.
  maskedNumber: string
  bankCode: string
  bankName: string
  branchCode: string
  institutionCode: string
  balanceAvailable: dinero.Dinero
  transactionsTransferOut: mongoose.HydratedDocument<transactionsModels.ITransactionTransferOut>[]
  transactionsTransferIn: mongoose.HydratedDocument<transactionsModels.ITransactionTransferIn>[]
  movements: mongoose.HydratedDocument<accountMovementsModels.IAccountMovement>[]
  subaccountManagerAssignments: mongoose.HydratedDocument<subaccountManagerAssignmentsModels.ISubaccountManagerAssignment>[]
  virtualBags: mongoose.HydratedDocument<IVirtualBagAccount>[]
  // Methods.
  getTransfersOut: (start?: Date, end?: Date) => Promise<mongoose.HydratedDocument<transactionsModels.ITransferOut>[]>
  getTransfersIn: (start?: Date, end?: Date) => Promise<mongoose.HydratedDocument<transactionsModels.ITransferIn>[]>
  getCommissionsIn: (start?: Date, end?: Date) => Promise<mongoose.HydratedDocument<transactionsModels.IVirtualGeneric>[]>
  getLatestTransfersOut: (limit: number) => Promise<mongoose.HydratedDocument<transactionsModels.ITransferOut>[]>
  getLatestTransfersIn: (limit: number) => Promise<mongoose.HydratedDocument<transactionsModels.ITransferIn>[]>
  getSum: (filter: mongoose.QueryFilter<any>, amountKey: string) => dinero.Dinero
  getSumOut: (start: Date) => dinero.Dinero
  getSumIn: (start: Date) => dinero.Dinero
  groupTotalPerDay: (filter: mongoose.QueryFilter<any>, amountKey: string) => Promise<mongoose.Aggregate<any[]>>
  getLiquidatedOutPerDay: (start: Date) => Promise<mongoose.Aggregate<any[]>>
  getLiquidatedInPerDay: (start: Date) => Promise<mongoose.Aggregate<any[]>>
  getMonthlyMovements: (month?: string) => Promise<mongoose.HydratedDocument<accountMovementsModels.IAccountMovement>[]>
}

type InternalAccountModel = mongoose.Model<IInternalAccount>

const internalAccountSchema = new mongoose.Schema<IInternalAccount, InternalAccountModel>({
  // Identification
  costCentre: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CostCentre'
  },
  balance: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: function (): dinero.DineroObject {
      return {
        amount: 0,
        precision: 2,
        currency: 'MXN'
      }
    }
  },
  balanceWithheld: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: function (): dinero.DineroObject {
      return {
        amount: 0,
        precision: 2,
        currency: 'MXN'
      }
    }
  },
  fullNumber: {
    type: String,
    required: true
  },
  tag: {
    type: String,
    enum: Object.values(InternalAccountTag)
  },
  isClient: {
    type: Boolean,
    default: false
  },
  additionalInformation: {
    name: {
      type: String
    },
    rfc: {
      type: String
    },
    postalCode: {
      type: String
    }
  },
  hasCashBags: {
    type: Boolean,
    default: false
  },

  // Provider Integration (NEW)
  provider: {
    type: String,
    enum: Object.values(Provider),
    default: Provider.Finco
  },
  fincoAccountId: {
    type: String,
    trim: true,
    sparse: true
  },
  fincoInstrumentId: {
    type: String,
    trim: true,
    sparse: true
  },

  // STP Integration (Future)
  stpCuenta: {
    type: String,
    trim: true
  },
  stpClabe: {
    type: String,
    trim: true,
    minlength: 18,
    maxlength: 18
  }
}, {
  methods: {
    movement (params: IMovementParameters): mongoose.HydratedDocument<accountMovementsModels.IAccountMovement> {
      const movementData: Record<string, any> = {
        account: this,
        transactedAt: params.transactedAt ?? dayjs().toDate(),
        type: params.type,
        transaction: params.transaction,
        balanceBefore: this.balance,
        balanceWithheldBefore: this.balanceWithheld,
        comment: params.comment
      }

      if (params.balanceDelta != null) {
        const operation: accountMovementsModels.AccountMovementOperation = params.balanceOperator ?? 'add'
        movementData.balanceOperator = operation
        movementData.balanceDelta = params.balanceDelta
        const balance = coerceDinero(this.balance)
        switch (operation) {
          case 'add':
            this.balance = toMoneyObject(balance.add(params.balanceDelta))
            break
          case 'subtract':
            this.balance = toMoneyObject(balance.subtract(params.balanceDelta))
            break
        }
        this.markModified('balance')
      }

      if (params.balanceWithheldDelta != null) {
        const operation: accountMovementsModels.AccountMovementOperation = params.balanceWithheldOperator ?? 'add'
        movementData.balanceWithheldOperator = operation
        movementData.balanceWithheldDelta = params.balanceWithheldDelta
        const balanceWithheld = coerceDinero(this.balanceWithheld)
        switch (operation) {
          case 'add':
            this.balanceWithheld = toMoneyObject(balanceWithheld.add(params.balanceWithheldDelta))
            break
          case 'subtract':
            this.balanceWithheld = toMoneyObject(balanceWithheld.subtract(params.balanceWithheldDelta))
            break
        }
        this.markModified('balanceWithheld')
      }

      return new accountMovementsModels.AccountMovement(movementData)
    },
    /* Used in transactions report */
    async getTransfersOut (start?: Date, end?: Date): Promise<mongoose.HydratedDocument<transactionsModels.ITransferOut>[]> {
      if (start === undefined) {
        start = dayjs().startOf('M').toDate()
      }
      if (end === undefined) {
        end = dayjs().toDate()
      }
      const filter = { fromAccount: this._id, transactedAt: { $gte: start, $lte: end } } as mongoose.QueryFilter<any>
      const tout: mongoose.HydratedDocument<transactionsModels.ITransferOut>[] = await transactionsModels.TransactionTransferOut.find(filter)
        .sort({ transactedAt: -1 })
        .populate({ path: 'fromAccount toAccount childrenTransactions', populate: { path: 'beneficiary toAccount fromAccount' } })
      const tbetween: mongoose.HydratedDocument<transactionsModels.ITransferOut>[] = await transactionsModels.TransactionTransferBetween.find(filter)
        .sort({ transactedAt: -1 })
        .populate('toAccount')

      return tout.concat(tbetween)
    },
    /* Used in transactions report */
    async getTransfersIn (start?: Date, end?: Date): Promise<mongoose.HydratedDocument<transactionsModels.ITransferIn>[]> {
      if (start === undefined) {
        start = dayjs().startOf('M').toDate()
      }
      if (end === undefined) {
        end = dayjs().toDate()
      }
      const filter = { toAccount: this._id, transactedAt: { $gte: start, $lte: end } } as mongoose.QueryFilter<any>
      const tin: mongoose.HydratedDocument<transactionsModels.ITransferIn>[] = await transactionsModels.TransactionTransferIn.find(filter)
        .sort({ transactedAt: -1 })
        .populate({ path: 'toAccount childrenTransactions', populate: { path: 'toAccount fromAccount' } })
      const tbetween: mongoose.HydratedDocument<transactionsModels.ITransferIn>[] = await transactionsModels.TransactionTransferBetween.find(filter)
        .sort({ transactedAt: -1 })
        .populate('toAccount fromAccount')
      return tin.concat(tbetween)
    },
    /* Used in transactions report */
    async getCommissionsIn (start?: Date, end?: Date): Promise<mongoose.HydratedDocument<transactionsModels.IVirtualGeneric>[]> {
      if (start === undefined) {
        start = dayjs().startOf('M').toDate()
      }
      if (end === undefined) {
        end = dayjs().toDate()
      }
      const filter = { toAccount: this._id, createdAt: { $gte: start, $lte: end }, parentTransaction: { $exists: true } } as mongoose.QueryFilter<any>
      const vin: mongoose.HydratedDocument<transactionsModels.IVirtualGeneric>[] = await transactionsModels.TransactionVirtualIn.find(filter)
        .sort({ transactedAt: -1 })
        .populate({ path: 'toAccount parentTransaction', populate: { path: 'toAccount' } })
      const vbetween: mongoose.HydratedDocument<transactionsModels.IVirtualGeneric>[] = await transactionsModels.TransactionVirtualBetween.find(filter)
        .sort({ transactedAt: -1 })
        .populate('toAccount fromAccount parentTransaction')
      return vin.concat(vbetween)
    },
    /* Used in latest transactions table */
    async getLatestTransfersOut (limit: number): Promise<mongoose.HydratedDocument<transactionsModels.ITransferOut>[]> {
      const filter = {
        fromAccount: this._id,
        type: { $in: [transactionsModels.TransactionType.TransferOut, transactionsModels.TransactionType.TransferBetween] }
      }
      const transactions = await transactionsModels.Transaction.find(filter).sort({ updatedAt: -1 }).limit(limit).populate([
        {
          path: 'toAccount',
          populate: {
            path: 'beneficiary',
            populate: {
              path: 'userProfile',
              populate: 'user'
            }
          }
        }
      ])
      transactions.sort((a: any, b: any) => (b.transactedAt ?? b.createdAt) - (a.transactedAt ?? a.createdAt))
      return transactions.map(x => x as mongoose.HydratedDocument<transactionsModels.ITransferOut>)
    },
    /* Used in latest transactions table */
    async getLatestTransfersIn (limit: number): Promise<mongoose.HydratedDocument<transactionsModels.ITransferIn>[]> {
      const filter = {
        toAccount: this._id,
        type: { $in: [transactionsModels.TransactionType.TransferIn, transactionsModels.TransactionType.TransferBetween, transactionsModels.TransactionType.VirtualIn, transactionsModels.TransactionType.VirtualBetween] }
      }
      const transactions = await transactionsModels.Transaction.find(filter).sort({ updatedAt: -1 }).limit(limit).populate('fromAccount')
      transactions.sort((a: any, b: any) => (b.transactedAt ?? b.createdAt) - (a.transactedAt ?? a.createdAt))
      return transactions.map(x => x as mongoose.HydratedDocument<transactionsModels.ITransferIn>)
    },
    /* Helper used by getSumOut and getSumIn */
    async getSum (filter: mongoose.QueryFilter<any>, amountKey: string): Promise<dinero.Dinero> {
      const group = {
        _id: { currency: `$${amountKey}.currency`, precision: `$${amountKey}.precision` },
        total: { $sum: `$${amountKey}.amount` }
      }
      const groups = await transactionsModels.Transaction.aggregate([{ $match: filter }, { $group: group }])
      if (groups.length > 1) {
        throw Error('Amount stored with more than one precision or currency')
      }
      if (groups.length === 0) {
        return Dinero({ amount: 0, precision: 2, currency: 'MXN' })
      }
      return Dinero({ amount: groups[0].total, precision: groups[0]._id.precision, currency: groups[0]._id.currency })
    },
    /* Used by computeBalanceWithoutDeltaPerDay which is used for balance cards in subaccount page */
    async getSumOut (start: Date): Promise<dinero.Dinero> {
      const filter = {
        fromAccount: this._id,
        liquidatedAt: { $gte: start },
        status: { $in: [transactionsModels.TransactionTransferOutStatus.Liquidated, transactionsModels.TransactionTransferBetweenStatus.Liquidated] },
        type: { $in: [transactionsModels.TransactionType.TransferOut, transactionsModels.TransactionType.TransferBetween] }
      }
      return await this.getSum(filter, 'amountTotal')
    },
    /* Used by computeBalanceWithoutDeltaPerDay which is used for balance cards in subaccount page */
    async getSumIn (start: Date): Promise<dinero.Dinero> {
      const filter = {
        toAccount: this._id,
        liquidatedAt: { $gte: start },
        status: { $in: [transactionsModels.TransactionTransferInStatus.Liquidated, transactionsModels.TransactionTransferBetweenStatus.Liquidated] },
        type: { $in: [transactionsModels.TransactionType.TransferIn, transactionsModels.TransactionType.TransferBetween] }
      }
      const transfersSum = await this.getSum(filter, 'amountTransfer')
      const filterVirtuals = {
        toAccount: this._id,
        createdAt: { $gte: start },
        type: { $in: [transactionsModels.TransactionType.VirtualIn, transactionsModels.TransactionType.VirtualBetween] }
      }
      const virtualsSum = await this.getSum(filterVirtuals, 'amountTransfer')
      return transfersSum.add(virtualsSum)
    },
    /* Helper used by getLiquidatedOutPerDay and getLiquidatedInPerDay */
    async groupTotalPerDay (filter: mongoose.QueryFilter<any>, amountKey: string): Promise<mongoose.Aggregate<any[]>> {
      const pipeline = [
        { $match: filter },
        {
          $addFields: {
            groupableDate: {
              $ifNull: ['$liquidatedAt', '$createdAt']
            }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$groupableDate' } },
            amounts: { $push: `$${amountKey}` }
          }
        }
      ]
      const transactions = await transactionsModels.Transaction.aggregate(pipeline)
      return transactions
    },
    /* Used by computeBalanceWithDeltaPerDay which is used for balance cards in homepage */
    async getLiquidatedOutPerDay (start: Date): Promise<mongoose.Aggregate<any[]>> {
      const filter = {
        fromAccount: this._id,
        liquidatedAt: { $gte: start },
        status: { $in: [transactionsModels.TransactionTransferOutStatus.Liquidated, transactionsModels.TransactionTransferBetweenStatus.Liquidated] },
        type: { $in: [transactionsModels.TransactionType.TransferOut, transactionsModels.TransactionType.TransferBetween] }
      }
      return await this.groupTotalPerDay(filter, 'amountTotal')
    },
    /* Used by computeBalanceWithDeltaPerDay which is used for balance cards in homepage */
    async getLiquidatedInPerDay (start: Date): Promise<mongoose.Aggregate<any[]>> {
      const filter = {
        toAccount: this._id,
        $or: [
          {
            liquidatedAt: { $gte: start },
            status: { $in: [transactionsModels.TransactionTransferInStatus.Liquidated, transactionsModels.TransactionTransferBetweenStatus.Liquidated] },
            type: { $in: [transactionsModels.TransactionType.TransferIn, transactionsModels.TransactionType.TransferBetween] }
          },
          {
            createdAt: { $gte: start },
            type: { $in: [transactionsModels.TransactionType.VirtualIn] }
          }
        ]
      }
      return await this.groupTotalPerDay(filter, 'amountTransfer')
    },
    /**
     * Get movements that change balance (liquidation funding refund and adjustment)
     */
    async getMonthlyMovements (month?: string): Promise<mongoose.HydratedDocument<accountMovementsModels.IAccountMovement>[]> {
      let date
      if (month === undefined) {
        date = dayjs()
      } else {
        date = dayjs(month, 'YYYY-MM', true)
        if (!date.isValid()) {
          date = dayjs()
        }
      }
      const filter = {
        account: this._id,
        type: { $in: ['funding', 'liquidation', 'refund', 'adjustment'] },
        transactedAt: { $gte: date.startOf('M').toDate(), $lte: date.endOf('M').toDate() }
      } as mongoose.QueryFilter<any>
      const movements = await accountMovementsModels.AccountMovement.find(filter).sort({ transactedAt: -1 }).populate('transaction')
      return movements
    }

  }
})

internalAccountSchema.virtual('maskedNumber').get(function (): string {
  return maskNumber(this.fullNumber, 4)
})

internalAccountSchema.virtual('bankCode').get(function (): string {
  return this.fullNumber.slice(0, 3)
})

internalAccountSchema.virtual('bankName').get(function (): string {
  return constants.bankCodeToName[this.bankCode]
})

internalAccountSchema.virtual('branchCode').get(function (): string {
  return this.fullNumber.slice(3, 6)
})

internalAccountSchema.virtual('institutionCode').get(function (): string {
  const bankCode = this.fullNumber.slice(0, 3)
  return constants.bankCodeToInstitution[bankCode]
})

internalAccountSchema.virtual('balanceAvailable').get(function (this: IInternalAccount): dinero.Dinero {
  const balance = coerceDinero(this.balance)
  const balanceWithheld = coerceDinero(this.balanceWithheld)
  return balance.subtract(balanceWithheld)
})

internalAccountSchema.virtual('transactionsTransferOut', {
  ref: 'TransactionTransferOut',
  localField: '_id',
  foreignField: 'fromAccount'
})

internalAccountSchema.virtual('transactionsTransferIn', {
  ref: 'TransactionTransferIn',
  localField: '_id',
  foreignField: 'toAccount'
})

internalAccountSchema.virtual('movements', {
  ref: 'AccountMovement',
  localField: '_id',
  foreignField: 'account'
})

internalAccountSchema.virtual('subaccountManagerAssignments', {
  ref: 'SubaccountManagerAssignment',
  localField: '_id',
  foreignField: 'account',
  match: () => ({ isActive: true })
})

internalAccountSchema.virtual('virtualBags', {
  ref: 'VirtualBagAccount',
  localField: '_id',
  foreignField: 'parentAccount',
  options: {
    sort: { _id: 1 }
  }
})

// Indexes for InternalAccount
internalAccountSchema.index({ fullNumber: 1 }, { unique: true })
internalAccountSchema.index({ costCentre: 1, tag: 1 })
internalAccountSchema.index({ provider: 1 })
internalAccountSchema.index({ fincoAccountId: 1 }, { sparse: true })
internalAccountSchema.index({ fincoInstrumentId: 1 }, { sparse: true })

const InternalAccount = Account.discriminator(
  'InternalAccount',
  internalAccountSchema,
  AccountType.Internal
)

/******************************************************************************
 * External.
 *****************************************************************************/

enum ExternalAccountType {
  StandardizedBankCode = 'standardizedBankCode',
  DebitAccountNumber = 'debitAccountNumber',
  MobilePhoneNumber = 'mobilePhoneNumber'
}

interface IExternalAccount extends IAccount {
  // Document fields.
  fullNumber: string
  beneficiary: mongoose.Types.ObjectId | mongoose.HydratedDocument<beneficiariesModels.IBeneficiary>
  externalAccountType: string
  bankCode: string
  // Virtual fields.
  maskedNumber: string
  bankName: string
  branchCode: string
  institutionCode: string
}

type ExternalAccountModel = mongoose.Model<IExternalAccount>

const externalAccountSchema = new mongoose.Schema<IExternalAccount, ExternalAccountModel>({
  fullNumber: {
    type: String,
    required: true
  },
  beneficiary: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Beneficiary',
    required: true
  },
  externalAccountType: {
    type: String,
    enum: Object.values(ExternalAccountType),
    default: ExternalAccountType.StandardizedBankCode
  },
  bankCode: {
    type: String,
    required: true
  }
})

externalAccountSchema.virtual('maskedNumber').get(function (): string {
  return maskNumber(this.fullNumber, 4)
})

externalAccountSchema.virtual('bankName').get(function (): string {
  return constants.bankCodeToName[this.bankCode]
})

externalAccountSchema.virtual('branchCode').get(function (): string {
  if (this.externalAccountType !== ExternalAccountType.StandardizedBankCode) {
    throw new Error('The external account type does not support a branch code.')
  }
  return this.fullNumber.slice(3, 6)
})

externalAccountSchema.virtual('institutionCode').get(function (): string {
  return constants.bankCodeToInstitution[this.bankCode]
})

const ExternalAccount = Account.discriminator(
  'ExternalAccount',
  externalAccountSchema,
  AccountType.External
)

/******************************************************************************
 * Cash Bag.
 *****************************************************************************/

interface IVirtualBagAccount extends IAccount, ICostCentreAccountWithBalances {
  parentAccount: mongoose.Types.ObjectId | mongoose.HydratedDocument<IInternalAccount>
  description?: string
  color?: string
  assignedUsers?: mongoose.Types.ObjectId[]
  limits?: {
    dailyLimit?: number
    monthlyLimit?: number
    perTransactionLimit?: number
  }
  distributionPercentage: number
  // Virtual fields.
  balanceAvailable: dinero.Dinero
}

type VirtualBagAccountModel = mongoose.Model<IVirtualBagAccount>

const virtualBagAccountSchema = new mongoose.Schema<IVirtualBagAccount, VirtualBagAccountModel>({
  costCentre: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CostCentre'
  },
  balance: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: function (): dinero.DineroObject {
      return {
        amount: 0,
        precision: 2,
        currency: 'MXN'
      }
    }
  },
  balanceWithheld: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: function (): dinero.DineroObject {
      return {
        amount: 0,
        precision: 2,
        currency: 'MXN'
      }
    }
  },
  parentAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InternalAccount',
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    trim: true
  },
  assignedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  limits: {
    dailyLimit: { type: Number },
    monthlyLimit: { type: Number },
    perTransactionLimit: { type: Number }
  },
  distributionPercentage: {
    type: Number,
    required: true,
    default: 0
  }
}, {
  methods: {
    movement (params: IMovementParameters): mongoose.HydratedDocument<accountMovementsModels.IAccountMovement> {
      const movementData: Record<string, any> = {
        account: this,
        transactedAt: params.transactedAt ?? dayjs().toDate(),
        type: params.type,
        transaction: params.transaction,
        balanceBefore: this.balance,
        balanceWithheldBefore: this.balanceWithheld,
        comment: params.comment
      }

      if (params.balanceDelta != null) {
        const operation: accountMovementsModels.AccountMovementOperation = params.balanceOperator ?? 'add'
        movementData.balanceOperator = operation
        movementData.balanceDelta = params.balanceDelta
        const balance = coerceDinero(this.balance)
        switch (operation) {
          case 'add':
            this.balance = toMoneyObject(balance.add(params.balanceDelta))
            break
          case 'subtract':
            this.balance = toMoneyObject(balance.subtract(params.balanceDelta))
            break
        }
        this.markModified('balance')
      }

      if (params.balanceWithheldDelta != null) {
        const operation: accountMovementsModels.AccountMovementOperation = params.balanceWithheldOperator ?? 'add'
        movementData.balanceWithheldOperator = operation
        movementData.balanceWithheldDelta = params.balanceWithheldDelta
        const balanceWithheld = coerceDinero(this.balanceWithheld)
        switch (operation) {
          case 'add':
            this.balanceWithheld = toMoneyObject(balanceWithheld.add(params.balanceWithheldDelta))
            break
          case 'subtract':
            this.balanceWithheld = toMoneyObject(balanceWithheld.subtract(params.balanceWithheldDelta))
            break
        }
        this.markModified('balanceWithheld')
      }

      return new accountMovementsModels.AccountMovement(movementData)
    }
  }
})

virtualBagAccountSchema.virtual('balanceAvailable').get(function (): dinero.Dinero {
  const balance = coerceDinero(this.balance)
  const balanceWithheld = coerceDinero(this.balanceWithheld)
  return balance.subtract(balanceWithheld)
})

const VirtualBagAccount = Account.discriminator(
  'VirtualBagAccount',
  virtualBagAccountSchema,
  AccountType.CashBag
)

export {
  calculateCheckDigit,
  maskNumber,
  AccountType,
  AccountStatus,
  IAccount,
  Account,
  InternalAccountTag,
  IAdditionalInformationFields,
  IInternalAccount,
  InternalAccount,
  ExternalAccountType,
  IExternalAccount,
  ExternalAccount,
  IVirtualBagAccount,
  VirtualBagAccount
}

