import mongoose from 'mongoose';

// ============== Enums ==============

export enum RegistrationRequestStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected'
}

export enum BusinessType {
  SA = 'SA',
  SAPI = 'SAPI',
  SC = 'SC',
  SARL = 'SARL',
  PersonaFisica = 'persona_fisica',
  Otro = 'otro'
}

// ============== Interface ==============

export interface IRegistrationRequest extends mongoose.Document {
  // Company info
  companyName: string;
  rfc: string;
  businessType: BusinessType;
  // Contact person
  firstName: string;
  lastName: string;
  secondLastName?: string;
  email: string;
  phone: string;
  // Status
  status: RegistrationRequestStatus;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewNotes?: string;
  reviewedAt?: Date;
  // Meta
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============== Schema ==============

const registrationRequestSchema = new mongoose.Schema<IRegistrationRequest>({
  // Company info
  companyName: {
    type: String,
    required: true,
    trim: true
  },
  rfc: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  businessType: {
    type: String,
    enum: Object.values(BusinessType),
    required: true
  },
  // Contact person
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  secondLastName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  // Status
  status: {
    type: String,
    enum: Object.values(RegistrationRequestStatus),
    required: true,
    default: RegistrationRequestStatus.Pending
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewNotes: {
    type: String,
    trim: true
  },
  reviewedAt: {
    type: Date
  },
  // Meta
  ipAddress: {
    type: String
  }
}, {
  collection: 'registrationRequests',
  timestamps: true
});

// ============== Indexes ==============
registrationRequestSchema.index({ email: 1 }, { unique: true });
registrationRequestSchema.index({ status: 1 });
registrationRequestSchema.index({ createdAt: -1 });

export const RegistrationRequest = mongoose.model<IRegistrationRequest>(
  'RegistrationRequest',
  registrationRequestSchema
);
