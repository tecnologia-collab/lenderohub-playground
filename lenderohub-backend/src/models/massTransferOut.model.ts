import mongoose from 'mongoose'

/******************************************************************************
 * Mass Transfer Out - Row
 *****************************************************************************/

enum MassTransferRowStatus {
  Valid = 'valid',
  Invalid = 'invalid',
  Pending = 'pending',
  Sent = 'sent',
  Completed = 'completed',
  Failed = 'failed'
}

interface IMassTransferRow {
  rowNumber: number
  beneficiaryClabe: string
  beneficiaryName: string
  amount: number              // in centavos
  concept: string
  reference: string           // external_reference, max 7 digits
  status: MassTransferRowStatus
  errorMessage?: string
  transactionId?: mongoose.Types.ObjectId
}

const massTransferRowSchema = new mongoose.Schema<IMassTransferRow>({
  rowNumber: {
    type: Number,
    required: true
  },
  beneficiaryClabe: {
    type: String,
    required: true
  },
  beneficiaryName: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  concept: {
    type: String,
    required: true
  },
  reference: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: Object.values(MassTransferRowStatus),
    required: true,
    default: MassTransferRowStatus.Pending
  },
  errorMessage: {
    type: String
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TransactionTransferOut'
  }
}, {
  _id: false
})

/******************************************************************************
 * Mass Transfer Out - Batch
 *****************************************************************************/

enum MassTransferOutStatus {
  PendingReview = 'pending_review',
  Confirmed = 'confirmed',
  Processing = 'processing',
  Completed = 'completed',
  PartiallyCompleted = 'partially_completed',
  Failed = 'failed'
}

interface IMassTransferOut extends mongoose.Document {
  corporateClientId: mongoose.Types.ObjectId
  costCentreId: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  status: MassTransferOutStatus
  fileName: string
  totalRows: number
  validRows: number
  invalidRows: number
  totalAmount: number        // in centavos
  successCount: number
  failCount: number
  rows: IMassTransferRow[]
  createdAt: Date
  updatedAt: Date
}

type MassTransferOutModel = mongoose.Model<IMassTransferOut>

const massTransferOutSchema = new mongoose.Schema<IMassTransferOut, MassTransferOutModel>({
  corporateClientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  costCentreId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CostCentre',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: Object.values(MassTransferOutStatus),
    required: true,
    default: MassTransferOutStatus.PendingReview
  },
  fileName: {
    type: String,
    required: true
  },
  totalRows: {
    type: Number,
    required: true,
    default: 0
  },
  validRows: {
    type: Number,
    required: true,
    default: 0
  },
  invalidRows: {
    type: Number,
    required: true,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    default: 0
  },
  successCount: {
    type: Number,
    required: true,
    default: 0
  },
  failCount: {
    type: Number,
    required: true,
    default: 0
  },
  rows: [massTransferRowSchema]
}, {
  timestamps: true
})

// Indexes
massTransferOutSchema.index({ costCentreId: 1, createdAt: -1 })
massTransferOutSchema.index({ userId: 1, createdAt: -1 })
massTransferOutSchema.index({ status: 1 })

const MassTransferOut = mongoose.model<IMassTransferOut, MassTransferOutModel>(
  'MassTransferOut',
  massTransferOutSchema
)

export {
  MassTransferRowStatus,
  IMassTransferRow,
  MassTransferOutStatus,
  IMassTransferOut,
  MassTransferOut
}
