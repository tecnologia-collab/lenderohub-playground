import * as dinero from 'dinero.js'
import mongoose from 'mongoose'

import * as costCentresModels from './providerAccounts.model'
import * as transactionsModels from './transactions.model'

/******************************************************************************
 * Common.
 *****************************************************************************/

enum MonthlyChargeStatus {
  Attempted = 'attempted',
  Unpaid = 'unpaid',
  Paid = 'paid',
  Cancelled = 'cancelled'
}

interface IMonthlyCharge {
  costCentre: mongoose.Types.ObjectId | costCentresModels.ICostCentre | mongoose.HydratedDocument<costCentresModels.ICostCentre>
  key: string
  status: MonthlyChargeStatus
  attempts: number
  amount: dinero.Dinero | dinero.DineroObject | number
  amountVAT: dinero.Dinero | dinero.DineroObject | number
  amountTotal: dinero.Dinero | dinero.DineroObject | number
  transferDescription: string
  paymentTriggeredByTransaction?: mongoose.Types.ObjectId | transactionsModels.ITransactionTransferIn | mongoose.HydratedDocument<transactionsModels.ITransactionTransferIn>
  updatedAt: Date
  // Virtual.
  transaction: mongoose.HydratedDocument<transactionsModels.ITransactionTransferBetween>
}

type MonthlyChargeModel = mongoose.Model<IMonthlyCharge>

const monthlyChargeSchema = new mongoose.Schema<IMonthlyCharge, MonthlyChargeModel>({
  costCentre: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CostCentre',
    required: true
  },
  key: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: Object.values(MonthlyChargeStatus),
    required: true
  },
  attempts: {
    type: Number,
    required: true,
    default: 0
  },
  amount: {
    type: mongoose.Schema.Types.Money,
    required: true
  },
  amountVAT: {
    type: mongoose.Schema.Types.Money,
    required: true
  },
  amountTotal: {
    type: mongoose.Schema.Types.Money,
    required: true
  },
  transferDescription: {
    type: String,
    required: true
  },
  paymentTriggeredByTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TransactionTransferIn'
  }
}, {
  collection: 'monthlyCharges',
  timestamps: true
})

monthlyChargeSchema.virtual('transaction', {
  ref: 'TransactionTransferBetween',
  localField: '_id',
  foreignField: 'monthlyCharge',
  justOne: true
})

const MonthlyCharge = mongoose.model<IMonthlyCharge, MonthlyChargeModel>('MonthlyCharge', monthlyChargeSchema)

export {
  MonthlyChargeStatus,
  IMonthlyCharge,
  MonthlyCharge
}

