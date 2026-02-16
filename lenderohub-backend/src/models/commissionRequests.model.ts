import * as dinero from 'dinero.js'
import Dinero from 'dinero.js'
import mongoose from 'mongoose'

import * as commissionAgentBalancesModels from './commissionAgentBalances.model'
import * as beneficiariesModels from './beneficiaries.model'
import * as usersModels from './user.model'
import * as transactionsModels from './transactions.model'
import * as uploadsModels from './uploads.model'

enum CommissionRequestStatus {
  New = 'new',
  Approved = 'approved',
  Rejected = 'rejected',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Refunded = 'refunded'
}

interface ICommissionRequest {
  createdAt: Date
  // Document fields.
  userProfile: mongoose.Types.ObjectId | mongoose.HydratedDocument<usersModels.IUser>
  beneficiary: mongoose.Types.ObjectId | mongoose.HydratedDocument<beneficiariesModels.ICommissionAgentBeneficiary>
  status: CommissionRequestStatus
  amount: dinero.Dinero | dinero.DineroObject | number
  amountTransfer: dinero.Dinero | dinero.DineroObject | number
  amountWithheldVAT: dinero.Dinero | dinero.DineroObject | number
  withheldIncomeTax: dinero.Dinero | dinero.DineroObject | number
  transactionFeeWithVAT: dinero.Dinero | dinero.DineroObject | number
  amountEarnings: dinero.Dinero | dinero.DineroObject | number
  invoicePDF: mongoose.Types.ObjectId | mongoose.HydratedDocument<uploadsModels.IUpload>
  invoiceXML: mongoose.Types.ObjectId | mongoose.HydratedDocument<uploadsModels.IUpload>
  rejectionMessage?: string
  commissionAgentBalance: mongoose.Types.ObjectId | mongoose.HydratedDocument<commissionAgentBalancesModels.ICommissionAgentBalance>
  transaction?: mongoose.Types.ObjectId | mongoose.HydratedDocument<transactionsModels.ITransactionTransferOut>
  // Virtual fields.
  amountTotal: dinero.Dinero
}

type CommissionRequestModel = mongoose.Model<ICommissionRequest>

const commissionRequestSchema = new mongoose.Schema<ICommissionRequest, CommissionRequestModel>({
  createdAt: {
    type: Date
  },
  userProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserProfile'
  },
  beneficiary: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommissionAgentBeneficiary'
  },
  status: {
    type: String,
    enum: Object.values(CommissionRequestStatus),
    required: true,
    default: CommissionRequestStatus.New
  },
  amount: {
    type: mongoose.Schema.Types.Money,
    required: true
  },
  amountTransfer: {
    type: mongoose.Schema.Types.Money,
    required: true
  },
  amountWithheldVAT: {
    type: mongoose.Schema.Types.Money
  },
  withheldIncomeTax: {
    type: mongoose.Schema.Types.Money
  },
  transactionFeeWithVAT: {
    type: mongoose.Schema.Types.Money,
    required: true
  },
  amountEarnings: {
    type: mongoose.Schema.Types.Money,
    required: true
  },
  invoicePDF: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Upload'
  },
  invoiceXML: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Upload'
  },
  rejectionMessage: {
    type: String
  },
  commissionAgentBalance: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommissionAgentBalance'
  }
}, {
  collection: 'commissionRequests',
  discriminatorKey: 'type',
  timestamps: true
})

commissionRequestSchema.virtual('amountTotal').get(function (this: ICommissionRequest): dinero.Dinero {
  const amountTransfer = this.amountTransfer as dinero.Dinero ?? Dinero({ amount: 0, precision: 2, currency: 'MXN' })
  const amountWithheldVAT = this.amountWithheldVAT as dinero.Dinero ?? Dinero({ amount: 0, precision: 2, currency: 'MXN' })
  const withheldIncomeTax = this.withheldIncomeTax as dinero.Dinero ?? Dinero({ amount: 0, precision: 2, currency: 'MXN' })
  const transactionFeeWithVAT = this.transactionFeeWithVAT as dinero.Dinero ?? Dinero({ amount: 0, precision: 2, currency: 'MXN' })
  const amountEarnings = this.amountEarnings as dinero.Dinero ?? Dinero({ amount: 0, precision: 2, currency: 'MXN' })
  return amountTransfer.add(amountWithheldVAT).add(withheldIncomeTax).add(transactionFeeWithVAT).add(amountEarnings)
})

commissionRequestSchema.virtual('transaction', {
  ref: 'TransactionTransferOut',
  localField: '_id',
  foreignField: 'commissionRequest',
  justOne: true
})

const CommissionRequest = mongoose.model<ICommissionRequest, CommissionRequestModel>('CommissionRequest', commissionRequestSchema)

export {
  CommissionRequestStatus,
  ICommissionRequest,
  CommissionRequest
}
