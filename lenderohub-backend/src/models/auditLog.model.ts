import mongoose from 'mongoose';

export enum AuditAction {
  // Auth
  Login = 'auth.login',
  LoginFailed = 'auth.login_failed',
  Logout = 'auth.logout',
  PasswordChanged = 'auth.password_changed',
  PasswordReset = 'auth.password_reset',
  ProfileSwitched = 'auth.profile_switched',

  // Transfers
  TransferOutCreated = 'transfer.out_created',
  TransferOutApproved = 'transfer.out_approved',
  TransferInReceived = 'transfer.in_received',
  InternalTransferCreated = 'transfer.internal_created',

  // Commissions
  CommissionRequestCreated = 'commission.request_created',
  CommissionRequestApproved = 'commission.request_approved',
  CommissionRequestRejected = 'commission.request_rejected',

  // Users
  UserCreated = 'user.created',
  UserDeactivated = 'user.deactivated',
  UserUpdated = 'user.updated',
  PermissionsChanged = 'user.permissions_changed',

  // Cost Centres
  CostCentreCreated = 'cost_centre.created',
  CostCentreUpdated = 'cost_centre.updated',

  // Beneficiaries
  BeneficiaryCreated = 'beneficiary.created',
  BeneficiaryDeleted = 'beneficiary.deleted',
}

export interface IAuditLog {
  action: AuditAction;
  userId?: mongoose.Types.ObjectId;
  userEmail?: string;
  targetId?: string;
  targetType?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

const auditLogSchema = new mongoose.Schema<IAuditLog>({
  action: { type: String, enum: Object.values(AuditAction), required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  userEmail: { type: String },
  targetId: { type: String },
  targetType: { type: String },
  details: { type: mongoose.Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now, index: true }
}, {
  collection: 'auditLogs',
  timestamps: false // we use our own timestamp field
});

// TTL index - auto-delete after 1 year
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Compound index for common queries
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
