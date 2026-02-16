import * as dinero from 'dinero.js'
import Dinero from 'dinero.js'
import mongoose from 'mongoose'

import * as commissionBalanceMovementsModels from './commissionBalanceMovements.model'
import * as transactionsModels from './transactions.model'
import type { ICommissionAgentUserProfile } from './userProfiles.model'
import { dayjs } from '../utils/dayjs'

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

// =============================================================================
// INTERFACES
// =============================================================================

export interface ICommissionAgentBalance extends mongoose.Document {
  commissionAgentUserProfile: mongoose.Types.ObjectId | mongoose.HydratedDocument<ICommissionAgentUserProfile>
  key: string  // Format: YYYY-MM
  requestableAmount: dinero.Dinero | dinero.DineroObject | number
  requestableAmountWithheld: dinero.Dinero | dinero.DineroObject | number
  createdAt: Date
  updatedAt: Date
  // Virtual fields
  requestableAmountAvailable: dinero.Dinero
  movements: mongoose.HydratedDocument<commissionBalanceMovementsModels.ICommissionBalanceMovement>[]
  // Methods
  movement(params: IMovementParameters): mongoose.HydratedDocument<commissionBalanceMovementsModels.ICommissionBalanceMovement>
}

interface IMovementParameters {
  transactedAt?: Date
  type: commissionBalanceMovementsModels.CommissionBalanceMovementType
  requestableAmountDelta?: dinero.Dinero
  requestableAmountOperator?: commissionBalanceMovementsModels.CommissionBalanceMovementOperation
  requestableAmountWithheldDelta?: dinero.Dinero
  requestableAmountWithheldOperator?: commissionBalanceMovementsModels.CommissionBalanceMovementOperation
  comment?: string
  transaction?: mongoose.HydratedDocument<transactionsModels.ITransaction>
}

// =============================================================================
// MODEL
// =============================================================================

type CommissionAgentBalanceModel = mongoose.Model<ICommissionAgentBalance>

const commissionAgentBalanceSchema = new mongoose.Schema<ICommissionAgentBalance, CommissionAgentBalanceModel>({
  commissionAgentUserProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommissionAgentUserProfile',
    required: true
  },
  key: {
    type: String,
    required: true
  },
  requestableAmount: {
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
  requestableAmountWithheld: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: function (): dinero.DineroObject {
      return {
        amount: 0,
        precision: 2,
        currency: 'MXN'
      }
    }
  }
}, {
  collection: 'commissionAgentBalances',
  timestamps: true,
  methods: {
    movement(params: IMovementParameters): mongoose.HydratedDocument<commissionBalanceMovementsModels.ICommissionBalanceMovement> {
      const movementData: Record<string, any> = {
        commissionAgentBalance: this,
        transactedAt: params.transactedAt ?? dayjs().toDate(),
        type: params.type,
        requestableAmountBefore: this.requestableAmount,
        requestableAmountWithheldBefore: this.requestableAmountWithheld,
        comment: params.comment,
        transaction: params.transaction
      }

      if (params.requestableAmountDelta != null) {
        const operation: commissionBalanceMovementsModels.CommissionBalanceMovementOperation = params.requestableAmountOperator ?? 'add'
        movementData.requestableAmountOperator = operation
        movementData.requestableAmountDelta = params.requestableAmountDelta
        const requestableAmount = coerceDinero(this.requestableAmount)
        switch (operation) {
          case 'add':
            this.requestableAmount = toMoneyObject(requestableAmount.add(params.requestableAmountDelta))
            break
          case 'subtract':
            this.requestableAmount = toMoneyObject(requestableAmount.subtract(params.requestableAmountDelta))
            break
        }
        this.markModified('requestableAmount')
      }

      if (params.requestableAmountWithheldDelta != null) {
        const operation: commissionBalanceMovementsModels.CommissionBalanceMovementOperation = params.requestableAmountWithheldOperator ?? 'add'
        movementData.requestableAmountWithheldOperator = operation
        movementData.requestableAmountWithheldDelta = params.requestableAmountWithheldDelta
        const requestableAmountWithheld = coerceDinero(this.requestableAmountWithheld)
        switch (operation) {
          case 'add':
            this.requestableAmountWithheld = toMoneyObject(requestableAmountWithheld.add(params.requestableAmountWithheldDelta))
            break
          case 'subtract':
            this.requestableAmountWithheld = toMoneyObject(requestableAmountWithheld.subtract(params.requestableAmountWithheldDelta))
            break
        }
        this.markModified('requestableAmountWithheld')
      }

      return new commissionBalanceMovementsModels.CommissionBalanceMovement(movementData)
    }
  }
})

// Virtuals
commissionAgentBalanceSchema.virtual('requestableAmountAvailable').get(function (): dinero.Dinero {
  const requestableAmount = coerceDinero(this.requestableAmount)
  const requestableAmountWithheld = coerceDinero(this.requestableAmountWithheld)
  return requestableAmount.subtract(requestableAmountWithheld)
})

commissionAgentBalanceSchema.virtual('movements', {
  ref: 'CommissionBalanceMovement',
  localField: '_id',
  foreignField: 'commissionAgentBalance'
})

// Indexes
commissionAgentBalanceSchema.index({ commissionAgentUserProfile: 1, key: 1 }, { unique: true })

export const CommissionAgentBalance = mongoose.model<ICommissionAgentBalance, CommissionAgentBalanceModel>(
  'CommissionAgentBalance',
  commissionAgentBalanceSchema
)
