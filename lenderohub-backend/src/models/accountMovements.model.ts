import * as dinero from 'dinero.js'
import mongoose from 'mongoose'

import * as accountsModels from './accounts.model'
import * as transactionsModels from './transactions.model'

const AccountMovementTypes = ['capture', 'liquidation', 'cancellation', 'refund', 'funding', 'adjustment']
type AccountMovementType = typeof AccountMovementTypes[number]

const AccountMovementOperations = ['add', 'subtract']
type AccountMovementOperation = typeof AccountMovementOperations[number]

interface IAccountMovement {
  createdAt: Date
  account: mongoose.Types.ObjectId | mongoose.HydratedDocument<accountsModels.IInternalAccount> | mongoose.HydratedDocument<accountsModels.IVirtualBagAccount>
  transactedAt: Date
  type: AccountMovementType
  balanceBefore: dinero.Dinero | dinero.DineroObject | number
  balanceDelta?: dinero.Dinero | dinero.DineroObject | number
  balanceOperator?: AccountMovementOperation
  balanceWithheldBefore: dinero.Dinero | dinero.DineroObject | number
  balanceWithheldDelta?: dinero.Dinero | dinero.DineroObject | number
  balanceWithheldOperator?: AccountMovementOperation
  transaction?: mongoose.Types.ObjectId | mongoose.HydratedDocument<transactionsModels.ITransactionTransferOut> | mongoose.HydratedDocument<transactionsModels.ITransactionTransferIn> | mongoose.HydratedDocument<transactionsModels.ITransactionTransferBetween>
  comment: string
}

type AccountMovementModel = mongoose.Model<IAccountMovement>

const accountMovementSchema = new mongoose.Schema<IAccountMovement, AccountMovementModel>({
  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InternalAccount',
    required: true
  },
  transactedAt: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    enum: AccountMovementTypes,
    required: true
  },
  balanceBefore: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  balanceDelta: {
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
  balanceOperator: {
    type: String,
    enum: AccountMovementOperations
  },
  balanceWithheldBefore: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  balanceWithheldDelta: {
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
  balanceWithheldOperator: {
    type: String,
    enum: AccountMovementOperations
  },
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  comment: {
    type: String
  }
}, {
  collection: 'accountMovements',
  discriminatorKey: 'type',
  timestamps: true
})

const AccountMovement = mongoose.model<IAccountMovement, AccountMovementModel>('AccountMovement', accountMovementSchema)

export {
  AccountMovementType,
  AccountMovementOperation,
  IAccountMovement,
  AccountMovement
}

