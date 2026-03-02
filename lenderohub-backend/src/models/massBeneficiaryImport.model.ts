import mongoose from 'mongoose';

// ============== Row-level interfaces ==============

export enum MassBeneficiaryRowStatus {
  Valid = 'valid',
  Invalid = 'invalid',
  Created = 'created',
  Failed = 'failed'
}

export interface IMassBeneficiaryRow {
  rowNumber: number;
  name: string;
  alias: string;
  clabeNumber: string;
  rfc: string;
  email: string;
  status: MassBeneficiaryRowStatus;
  errorMessage?: string;
  beneficiaryId?: mongoose.Types.ObjectId;
}

const massBeneficiaryRowSchema = new mongoose.Schema<IMassBeneficiaryRow>({
  rowNumber: { type: Number, required: true },
  name: { type: String, required: true },
  alias: { type: String, required: true },
  clabeNumber: { type: String, required: true },
  rfc: { type: String, default: '' },
  email: { type: String, default: '' },
  status: {
    type: String,
    enum: Object.values(MassBeneficiaryRowStatus),
    required: true,
    default: MassBeneficiaryRowStatus.Valid
  },
  errorMessage: { type: String },
  beneficiaryId: { type: mongoose.Schema.Types.ObjectId }
}, { _id: false });

// ============== Import-level interfaces ==============

export enum MassBeneficiaryImportStatus {
  PendingReview = 'pending_review',
  Confirmed = 'confirmed',
  Processing = 'processing',
  Completed = 'completed',
  PartiallyCompleted = 'partially_completed',
  Failed = 'failed'
}

export interface IMassBeneficiaryImport extends mongoose.Document {
  corporateClientId: mongoose.Types.ObjectId;
  costCentreId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  status: MassBeneficiaryImportStatus;
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  successCount: number;
  failCount: number;
  rows: IMassBeneficiaryRow[];
  lastModifiedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const massBeneficiaryImportSchema = new mongoose.Schema<IMassBeneficiaryImport>({
  corporateClientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  costCentreId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CostCentre',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: Object.values(MassBeneficiaryImportStatus),
    required: true,
    default: MassBeneficiaryImportStatus.PendingReview
  },
  fileName: {
    type: String,
    required: true
  },
  totalRows: { type: Number, required: true, default: 0 },
  validRows: { type: Number, required: true, default: 0 },
  invalidRows: { type: Number, required: true, default: 0 },
  successCount: { type: Number, required: true, default: 0 },
  failCount: { type: Number, required: true, default: 0 },
  rows: [massBeneficiaryRowSchema],
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  collection: 'massBeneficiaryImports',
  timestamps: true
});

massBeneficiaryImportSchema.index({ costCentreId: 1, createdAt: -1 });

export const MassBeneficiaryImport = mongoose.model<IMassBeneficiaryImport>(
  'MassBeneficiaryImport',
  massBeneficiaryImportSchema
);
