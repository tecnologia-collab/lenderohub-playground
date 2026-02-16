import * as dinero from 'dinero.js'
import mongoose from 'mongoose'

import * as models from './index'
import * as accountsModels from './accounts.model'
import * as commissionAgentAssignmentsModels from './commissionAgentAssignments.model'
import * as commissionRequestsModels from './commissionRequests.model'
import * as costCentresModels from './providerAccounts.model'
import * as massTransactionsModels from './massTransactions.model'
import * as monthlyChargesModel from './monthlyCharges.model'
import * as constants from '../constants'
import { dayjs } from '../utils/dayjs'
// Import ruleModel directly to avoid circular dependency issues
import { ruleModel } from './shared/enums'

/******************************************************************************
 * Common.
 *****************************************************************************/

enum TransactionType {
  TransferIn = 'transferIn',
  TransferOut = 'transferOut',
  TransferBetween = 'transferBetween',
  VirtualBetween = 'virtualBetween',
  VirtualIn = 'virtualIn'
}

interface IDistributionEntry {
  account: mongoose.Types.ObjectId | mongoose.HydratedDocument<accountsModels.IAccount>
  amount: dinero.Dinero | dinero.DineroObject | number
  distributionPercentage: number
}

const distributionEntrySchema = new mongoose.Schema({
  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true
  },
  amount: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  distributionPercentage: {
    type: Number,
    required: true,
    default: 0
  }
}, {
  _id: false
})

/******************************************************************************
 * Base model.
 *****************************************************************************/

interface ITransaction {
  type: TransactionType
  createdAt: Date
}

type TransactionModel = mongoose.Model<ITransaction>

const transactionSchema = new mongoose.Schema<ITransaction, TransactionModel>({
  type: {
    type: String,
    enum: Object.values(TransactionType),
    required: true
  }
}, {
  collection: 'transactions',
  discriminatorKey: 'type',
  timestamps: true
})

const Transaction = mongoose.model<ITransaction, TransactionModel>('Transaction', transactionSchema)

/******************************************************************************
 * Transfer In.
 *****************************************************************************/

enum TransactionTransferInStatus {
  New = 'new',
  Liquidated = 'liquidated',
  Rejected = 'rejected'
}

interface ITransactionTransferIn extends ITransaction {
  fromAccount: string
  fromName: string
  fromRfc: string
  toAccount: mongoose.Types.ObjectId | mongoose.HydratedDocument<accountsModels.IInternalAccount>
  amountDistributed: dinero.Dinero | dinero.DineroObject | number
  amountTransfer: dinero.Dinero | dinero.DineroObject | number
  amountCommission: dinero.Dinero | dinero.DineroObject | number
  amountTotal: dinero.Dinero | dinero.DineroObject | number
  distributionBreakdown: IDistributionEntry[]
  commissionBreakdown: Map<string, dinero.Dinero | dinero.DineroObject | number>
  commissionAgentAssignment?: mongoose.Types.ObjectId | mongoose.HydratedDocument<commissionAgentAssignmentsModels.ICommissionAgentAssignment>
  commercialRule?: costCentresModels.IRule
  status: string
  reference: string
  description: string
  trackingCode: string
  stpId: number
  codiNumber: string
  transactedAt: Date
  operatedAt: Date
  liquidatedAt: Date
  fincoData?: {
    transactionId?: string
    subCategory?: string
    ownerId?: string
  }
  maskedFromAccount: () => string
  // virtuals
  fromBankName: string
  processedAt?: Date
  childrenTransactions: mongoose.HydratedDocument<ITransactionVirtualIn>[]
}

type TransactionTransferInModel = mongoose.Model<ITransactionTransferIn>

const transactionTransferInSchema = new mongoose.Schema<ITransactionTransferIn, TransactionTransferInModel>({
  fromAccount: {
    type: String,
    required: true
  },
  fromName: {
    type: String,
    required: true
  },
  fromRfc: {
    type: String,
    required: true
  },
  toAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InternalAccount',
    required: true
  },
  amountDistributed: {
    type: mongoose.Schema.Types.Mixed,
    required: false,
    default: function (): dinero.DineroObject {
      return {
        amount: 0,
        precision: 2,
        currency: 'MXN'
      }
    }
  },
  amountTransfer: {
    type: mongoose.Schema.Types.Mixed,
    default: function (): dinero.DineroObject {
      return {
        amount: 0,
        precision: 2,
        currency: 'MXN'
      }
    }
  },
  amountCommission: {
    type: mongoose.Schema.Types.Mixed,
    default: function (): dinero.DineroObject {
      return {
        amount: 0,
        precision: 2,
        currency: 'MXN'
      }
    }
  },
  amountTotal: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  distributionBreakdown: [distributionEntrySchema],
  commissionBreakdown: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  commissionAgentAssignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommissionAgentAssignment'
  },
  commercialRule: ruleModel,
  status: {
    type: String,
    enum: Object.values(TransactionTransferInStatus),
    required: true,
    default: TransactionTransferInStatus.New
  },
  reference: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  trackingCode: {
    type: String,
    required: true
  },
  stpId: {
    type: Number
  },
  codiNumber: {
    type: String
  },
  transactedAt: {
    type: Date
  },
  operatedAt: {
    type: Date
  },
  liquidatedAt: {
    type: Date
  },
  fincoData: {
    transactionId: { type: String },
    subCategory: { type: String },
    ownerId: { type: String }
  }
}, {
  methods: {
    maskedFromAccount (): string {
      return accountsModels.maskNumber(this.fromAccount)
    }
  }
})

transactionTransferInSchema.virtual('fromBankName').get(function (): string {
  return constants.bankCodeToName[this.fromAccount.slice(0, 3)]
})

transactionTransferInSchema.virtual('processedAt').get(function (): Date | undefined {
  switch (this.status) {
    case TransactionTransferInStatus.Liquidated:
      return this.liquidatedAt
  }
  return undefined
})

transactionTransferInSchema.virtual('childrenTransactions', {
  ref: 'TransactionVirtualIn',
  localField: '_id',
  foreignField: 'parentTransaction'
})

const TransactionTransferIn = Transaction.discriminator(
  'TransactionTransferIn',
  transactionTransferInSchema,
  TransactionType.TransferIn
)

/******************************************************************************
 * Virtual Transfer In.
 *****************************************************************************/

enum TransactionVirtualInSubtype {
  Commission = 'commission',
  VirtualBagAccountDistribution = 'cashBagAccountDistribution'
}

interface ITransactionVirtualIn extends ITransaction {
  subtype: TransactionVirtualInSubtype
  fromAccount: string
  toAccount: mongoose.Types.ObjectId | mongoose.HydratedDocument<accountsModels.IInternalAccount> | mongoose.HydratedDocument<accountsModels.IVirtualBagAccount>
  amountTransfer: dinero.Dinero | dinero.DineroObject | number
  parentTransaction?: mongoose.Types.ObjectId | mongoose.HydratedDocument<ITransaction> | undefined
}

type TransactionVirtualInModel = mongoose.Model<ITransactionVirtualIn>

const transactionVirtualInSchema = new mongoose.Schema<ITransactionVirtualIn, TransactionVirtualInModel>({
  subtype: {
    type: String,
    enum: TransactionVirtualInSubtype,
    required: false,
    default: TransactionVirtualInSubtype.Commission
  },
  fromAccount: {
    type: String,
    required: true
  },
  toAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true
  },
  amountTransfer: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  parentTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  }
})

const TransactionVirtualIn = Transaction.discriminator(
  'TransactionVirtualIn',
  transactionVirtualInSchema,
  TransactionType.VirtualIn
)

/******************************************************************************
 * Transfer Out.
 *****************************************************************************/

enum TransactionTransferOutStatus {
  New = 'new',
  Sent = 'sent',
  Liquidated = 'liquidated',
  Cancelled = 'cancelled',
  Refunded = 'refunded',
  Failed = 'failed'
}

interface ITransactionTransferOut extends ITransaction {
  // Fields.
  fromAccount: mongoose.Types.ObjectId | mongoose.HydratedDocument<accountsModels.IInternalAccount> | mongoose.HydratedDocument<accountsModels.IVirtualBagAccount>
  toAccount: mongoose.Types.ObjectId | mongoose.HydratedDocument<accountsModels.IAccount>
  addVAT: boolean
  balanceAvailableBefore: dinero.Dinero | dinero.DineroObject | number
  amount: dinero.Dinero | dinero.DineroObject | number
  amountVAT: dinero.Dinero | dinero.DineroObject | number
  amountTransfer: dinero.Dinero | dinero.DineroObject | number
  amountCommission: dinero.Dinero | dinero.DineroObject | number
  amountTotal: dinero.Dinero | dinero.DineroObject | number
  commissionBreakdown: Map<string, dinero.Dinero | dinero.DineroObject | number>
  commercialRule: costCentresModels.IRule
  status: TransactionTransferOutStatus
  executionDate: string
  beneficiaryEmail: string
  notificationEmail: string
  reference: string
  description: string
  submitterUserProfile: mongoose.Types.ObjectId | mongoose.HydratedDocument<any>
  trackingCode: string
  stpId: number
  transactedAt: Date
  operatedAt: Date
  liquidatedAt: Date
  cancelledAt: Date
  refundedAt: Date
  commissionRequest: mongoose.Types.ObjectId | mongoose.HydratedDocument<commissionRequestsModels.ICommissionRequest>
  massTransaction: mongoose.Types.ObjectId | massTransactionsModels.IMassTransaction | mongoose.HydratedDocument<massTransactionsModels.IMassTransaction>
  massTransactionIndex: number
  location: models.ILocation | undefined
  isMonthlyCharge: boolean
  failureReason?: string
  cepUrl?: string
  fincoData?: {
    transactionId?: string
    trackingKey?: string
    status?: string
  }
  // Virtuals.
  processedAt?: Date
  childrenTransactions: mongoose.HydratedDocument<ITransactionVirtualBetween>[]
  // Methods.
  generateTrackingCode: () => Promise<void>
}

type TransactionTransferOutModel = mongoose.Model<ITransactionTransferOut>

const transactionTransferOutSchema = new mongoose.Schema<ITransactionTransferOut, TransactionTransferOutModel>({
  fromAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true
  },
  toAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true
  },
  addVAT: {
    type: Boolean,
    required: true,
    default: true
  },
  balanceAvailableBefore: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  amount: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  amountVAT: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  amountTransfer: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  amountCommission: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  amountTotal: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  commissionBreakdown: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  commercialRule: ruleModel,
  status: {
    type: String,
    enum: Object.values(TransactionTransferOutStatus),
    required: true,
    default: TransactionTransferOutStatus.New
  },
  executionDate: {
    type: String,
    required: true
  },
  beneficiaryEmail: {
    type: String
  },
  notificationEmail: {
    type: String
  },
  reference: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  submitterUserProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserProfile'
  },
  trackingCode: {
    type: String,
    required: true
  },
  stpId: {
    type: Number
  },
  transactedAt: {
    type: Date
  },
  operatedAt: {
    type: Date
  },
  liquidatedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  refundedAt: {
    type: Date
  },
  commissionRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommissionRequest'
  },
  massTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MassTransactionTransferOut'
  },
  massTransactionIndex: {
    type: Number
  },
  location: models.locationDocument,
  isMonthlyCharge: {
    type: Boolean,
    default: false
  },
  failureReason: {
    type: String
  },
  cepUrl: {
    type: String
  },
  fincoData: {
    transactionId: { type: String },
    trackingKey: { type: String },
    status: { type: String }
  }
}, {
  methods: {
    async generateTrackingCode (): Promise<void> {
      const transactionDate = dayjs(this.transactedAt)
      const nanoid = await import('nanoid')
      if (process.env.TRACKING_CODE_ALPBHABET == null || process.env.TRACKING_CODE_LENGTH == null) {
        throw new Error('Unable to generate a tracking code.')
      }
      const generator = nanoid.customAlphabet(process.env.TRACKING_CODE_ALPBHABET, parseInt(process.env.TRACKING_CODE_LENGTH))
      const trackingCode = `${generator()}${transactionDate.year().toString(16)}${transactionDate.month().toString(16)}${transactionDate.day().toString(16).padStart(2, '0')}`
      this.trackingCode = trackingCode
    }
  }
})

transactionTransferOutSchema.virtual('processedAt').get(function (): Date | undefined {
  switch (this.status) {
    case TransactionTransferOutStatus.Liquidated:
      return this.liquidatedAt
    case TransactionTransferOutStatus.Cancelled:
      return this.cancelledAt
    case TransactionTransferOutStatus.Refunded:
      return this.refundedAt
  }
  return undefined
})

transactionTransferOutSchema.virtual('childrenTransactions', {
  ref: 'TransactionVirtualBetween',
  localField: '_id',
  foreignField: 'parentTransaction'
})

const TransactionTransferOut = Transaction.discriminator(
  'TransactionTransferOut',
  transactionTransferOutSchema,
  TransactionType.TransferOut
)

/******************************************************************************
 * Transfer Between.
 *****************************************************************************/

enum TransactionTransferBetweenStatus {
  Liquidated = 'liquidated'
}

interface ITransactionTransferBetween extends ITransaction {
  fromAccount: mongoose.Types.ObjectId | mongoose.HydratedDocument<accountsModels.IInternalAccount>
  toAccount: mongoose.Types.ObjectId | mongoose.HydratedDocument<accountsModels.IInternalAccount>
  addVAT: boolean
  balanceAvailableBefore: dinero.Dinero | dinero.DineroObject | number
  amount: dinero.Dinero | dinero.DineroObject | number
  amountVAT: dinero.Dinero | dinero.DineroObject | number
  amountDistributed: dinero.Dinero | dinero.DineroObject | number
  amountTransfer: dinero.Dinero | dinero.DineroObject | number
  amountCommission: dinero.Dinero | dinero.DineroObject | number
  amountTotal: dinero.Dinero | dinero.DineroObject | number
  distributionBreakdown: IDistributionEntry[]
  status: string
  reference: string
  description: string
  submitterUserProfile: mongoose.Types.ObjectId | mongoose.HydratedDocument<any>
  transactedAt: Date
  liquidatedAt: Date
  monthlyCharge: mongoose.Types.ObjectId | mongoose.HydratedDocument<monthlyChargesModel.IMonthlyCharge>
  fincoData?: {
    transactionId?: string
    trackingKey?: string
    status?: string
  }
  // Virtuals.
  trackingCode: string
  processedAt: Date
}

type TransactionTransferBetweenModel = mongoose.Model<ITransactionTransferBetween>

const transactionTransferBetweenSchema = new mongoose.Schema<ITransactionTransferBetween, TransactionTransferBetweenModel>({
  fromAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InternalAccount',
    required: true
  },
  toAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InternalAccount',
    required: true
  },
  addVAT: {
    type: Boolean,
    required: true,
    default: true
  },
  balanceAvailableBefore: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  amount: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  amountVAT: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  amountDistributed: {
    type: mongoose.Schema.Types.Mixed,
    required: false,
    default: function (): dinero.DineroObject {
      return {
        amount: 0,
        precision: 2,
        currency: 'MXN'
      }
    }
  },
  amountTransfer: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  amountCommission: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  amountTotal: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  distributionBreakdown: [distributionEntrySchema],
  status: {
    type: String,
    enum: Object.values(TransactionTransferBetweenStatus),
    required: true,
    default: TransactionTransferBetweenStatus.Liquidated
  },
  reference: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  submitterUserProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserProfile'
  },
  transactedAt: {
    type: Date
  },
  liquidatedAt: {
    type: Date
  },
  monthlyCharge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MonthlyCharge'
  },
  fincoData: {
    transactionId: { type: String },
    trackingKey: { type: String },
    status: { type: String }
  }
})

transactionTransferBetweenSchema.virtual('trackingCode').get(function (): string {
  return this._id.toString()
})

transactionTransferBetweenSchema.virtual('processedAt').get(function (): Date | undefined {
  return this.liquidatedAt
})

const TransactionTransferBetween = Transaction.discriminator(
  'TransactionTransferBetween',
  transactionTransferBetweenSchema,
  TransactionType.TransferBetween
)

/******************************************************************************
 * Virtual Transfer Between.
 *****************************************************************************/

enum TransactionVirtualBetweenSubtype {
  Commission = 'commission',
  VirtualBagAccountDistribution = 'cashBagAccountDistribution'
}

interface ITransactionVirtualBetween extends ITransaction {
  subtype: TransactionVirtualBetweenSubtype
  fromAccount: mongoose.Types.ObjectId | mongoose.HydratedDocument<accountsModels.IInternalAccount> | mongoose.HydratedDocument<accountsModels.IVirtualBagAccount>
  toAccount: mongoose.Types.ObjectId | mongoose.HydratedDocument<accountsModels.IInternalAccount>
  amountTransfer: dinero.Dinero | dinero.DineroObject | number
  parentTransaction: mongoose.Types.ObjectId | mongoose.HydratedDocument<ITransaction>
}

type TransactionVirtualBetweenModel = mongoose.Model<ITransactionVirtualBetween>

const transactionVirtualBetweenSchema = new mongoose.Schema<ITransactionVirtualBetween, TransactionVirtualBetweenModel>({
  subtype: {
    type: String,
    enum: TransactionVirtualBetweenSubtype,
    required: false,
    default: TransactionVirtualBetweenSubtype.Commission
  },
  fromAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true
  },
  toAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InternalAccount',
    required: true
  },
  amountTransfer: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  parentTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true
  }
})

const TransactionVirtualBetween = Transaction.discriminator(
  'TransactionVirtualBetween',
  transactionVirtualBetweenSchema,
  TransactionType.VirtualBetween
)

/******************************************************************************
 * Extra: type aliases, functions, &c.
 *****************************************************************************/

type ITransferOut = ITransactionTransferOut | ITransactionTransferBetween
type ITransferIn = ITransactionTransferIn | ITransactionTransferBetween
type ITransferGeneric = ITransactionTransferOut | ITransactionTransferIn | ITransactionTransferBetween
type IVirtualGeneric = ITransactionVirtualIn | ITransactionVirtualBetween

export {
  TransactionType,
  ITransaction,
  Transaction,
  TransactionTransferInStatus,
  IDistributionEntry,
  ITransactionTransferIn,
  TransactionTransferIn,
  TransactionVirtualInSubtype,
  ITransactionVirtualIn,
  TransactionVirtualIn,
  TransactionTransferOutStatus,
  ITransactionTransferOut,
  TransactionTransferOut,
  TransactionTransferBetweenStatus,
  ITransactionTransferBetween,
  TransactionTransferBetween,
  TransactionVirtualBetweenSubtype,
  ITransactionVirtualBetween,
  TransactionVirtualBetween,
  ITransferOut,
  ITransferIn,
  ITransferGeneric,
  IVirtualGeneric
}

