import mongoose from 'mongoose';

export enum NotificationType {
  TransferReceived = 'transfer_received',
  TransferSent = 'transfer_sent',
  TransferFailed = 'transfer_failed',
  CommissionApproved = 'commission_approved',
  CommissionRejected = 'commission_rejected',
  CommissionRequest = 'commission_request',
  MonthlyCharge = 'monthly_charge',
  SystemAlert = 'system_alert',
}

export interface INotification {
  user: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const notificationSchema = new mongoose.Schema<INotification>({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: Object.values(NotificationType), required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false, index: true },
  link: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, {
  collection: 'notifications',
  timestamps: true
});

// Compound index for main query: user's unread notifications sorted by date
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

// Auto-delete after 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
