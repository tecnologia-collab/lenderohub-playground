import * as dinero from 'dinero.js'
import mongoose from 'mongoose'

import * as commissionRequestsModels from './commissionRequests.model'
import * as transactionsModels from './transactions.model'
import * as commissionAgentBalancesModels from './commissionAgentBalances.model'

const CommissionBalanceMovementTypes = ['funding', 'request', 'rejection', 'liquidation', 'cancellation', 'refund', 'adjustment']
type CommissionBalanceMovementType = typeof CommissionBalanceMovementTypes[number]

const CommissionBalanceMovementOperations = ['add', 'subtract']
type CommissionBalanceMovementOperation = typeof CommissionBalanceMovementOperations[number]

interface ICommissionBalanceMovement {
  commissionAgentBalance: mongoose.Types.ObjectId | mongoose.HydratedDocument<commissionAgentBalancesModels.ICommissionAgentBalance>
  transactedAt: Date
  type: CommissionBalanceMovementType
  requestableAmountBefore: dinero.Dinero | dinero.DineroObject | number
  requestableAmountDelta?: dinero.Dinero | dinero.DineroObject | number
  requestableAmountOperator?: CommissionBalanceMovementOperation
  requestableAmountWithheldBefore: dinero.Dinero | dinero.DineroObject | number
  requestableAmountWithheldDelta?: dinero.Dinero | dinero.DineroObject | number
  requestableAmountWithheldOperator?: CommissionBalanceMovementOperation
  request?: mongoose.Types.ObjectId | mongoose.HydratedDocument<commissionRequestsModels.ICommissionRequest>
  transaction?: mongoose.Types.ObjectId | mongoose.HydratedDocument<transactionsModels.ITransactionTransferIn>
  comment?: string
}

type CommissionBalanceMovementModel = mongoose.Model<ICommissionBalanceMovement>

const commissionBalanceMovementSchema = new mongoose.Schema<ICommissionBalanceMovement, CommissionBalanceMovementModel>({
  commissionAgentBalance: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommissionAgentBalance',
    required: true
  },
  transactedAt: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    enum: CommissionBalanceMovementTypes,
    required: true
  },
  requestableAmountBefore: {
    type: mongoose.Schema.Types.Money,
    required: true
  },
  requestableAmountDelta: {
    type: mongoose.Schema.Types.Money,
    required: true,
    default: function (): dinero.DineroObject {
      return {
        amount: 0,
        precision: 2,
        currency: 'MXN'
      }
    }
  },
  requestableAmountOperator: {
    type: String,
    enum: CommissionBalanceMovementOperations
  },
  requestableAmountWithheldBefore: {
    type: mongoose.Schema.Types.Money,
    required: true
  },
  requestableAmountWithheldDelta: {
    type: mongoose.Schema.Types.Money,
    required: true,
    default: function (): dinero.DineroObject {
      return {
        amount: 0,
        precision: 2,
        currency: 'MXN'
      }
    }
  },
  requestableAmountWithheldOperator: {
    type: String,
    enum: CommissionBalanceMovementOperations
  },
  request: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommissionRequest'
  },
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TransactionTransferIn'
  },
  comment: {
    type: String
  }
}, {
  collection: 'commissionBalanceMovements',
  discriminatorKey: 'type',
  timestamps: true
})

const CommissionBalanceMovement = mongoose.model<ICommissionBalanceMovement, CommissionBalanceMovementModel>('CommissionBalanceMovement', commissionBalanceMovementSchema)

export {
  CommissionBalanceMovementType,
  CommissionBalanceMovementOperation,
  ICommissionBalanceMovement,
  CommissionBalanceMovement
}
