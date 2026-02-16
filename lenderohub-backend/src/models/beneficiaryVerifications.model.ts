// src/models/beneficiaryVerifications.model.ts
/**
 * BeneficiaryVerification model
 *
 * Tracks penny validation (account verification) state for Finco instruments.
 * Each record links a Finco instrument ID to its verification status,
 * the Finco transaction ID from the penny validation call,
 * and any CEP data returned via webhook.
 */

import mongoose from 'mongoose'

export enum VerificationStatus {
  None = 'none',
  Pending = 'pending',
  Delayed = 'delayed',
  Verified = 'verified',
  Failed = 'failed'
}

export interface IBeneficiaryVerification extends mongoose.Document {
  /** Finco instrument UUID (destination_instrument_id) */
  instrumentId: string
  /** Finco transaction UUID returned from POST /v1/transactions/penny_validation */
  transactionId: string
  /** Finco tracking ID (e.g. 20250820FINCHXXXXQ6RPX4) */
  trackingId?: string
  /** Current verification status */
  status: VerificationStatus
  /** Verified beneficiary name returned by CEP */
  beneficiaryName?: string
  /** Verified beneficiary RFC returned by CEP */
  beneficiaryRfc?: string
  /** Verified beneficiary CLABE returned by CEP */
  beneficiaryAccount?: string
  /** CEP URL from Banxico */
  cepUrl?: string
  /** CEP validation UUID */
  validationId?: string
  /** When the CEP was processed */
  processedAt?: Date
  /** Who initiated the verification (user ID) */
  initiatedBy?: mongoose.Types.ObjectId
  /** Timestamps */
  createdAt: Date
  updatedAt: Date
}

const beneficiaryVerificationSchema = new mongoose.Schema<IBeneficiaryVerification>({
  instrumentId: {
    type: String,
    required: true,
    index: true
  },
  transactionId: {
    type: String,
    required: true,
    index: true
  },
  trackingId: {
    type: String,
    index: true
  },
  status: {
    type: String,
    enum: Object.values(VerificationStatus),
    required: true,
    default: VerificationStatus.Pending
  },
  beneficiaryName: { type: String },
  beneficiaryRfc: { type: String },
  beneficiaryAccount: { type: String },
  cepUrl: { type: String },
  validationId: { type: String },
  processedAt: { type: Date },
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  collection: 'beneficiaryVerifications',
  timestamps: true
})

// Compound index: latest verification per instrument
beneficiaryVerificationSchema.index({ instrumentId: 1, createdAt: -1 })
// Index for CEP webhook lookup by transactionId
beneficiaryVerificationSchema.index({ transactionId: 1 }, { unique: true })

export const BeneficiaryVerification = mongoose.model<IBeneficiaryVerification>(
  'BeneficiaryVerification',
  beneficiaryVerificationSchema
)
