import mongoose, { Document, Schema } from 'mongoose';

export interface IActivityLog extends Document {
  userId?: mongoose.Types.ObjectId;
  action: string;
  resource: string;
  resourceId?: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  statusCode: number;
  duration: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    action: { type: String, required: true },
    resource: { type: String, required: true },
    resourceId: { type: String, required: false },
    method: { type: String, required: true, enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
    path: { type: String, required: true },
    ip: { type: String, required: true },
    userAgent: { type: String, default: '' },
    statusCode: { type: Number, required: true },
    duration: { type: Number, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: 'activity_logs',
  }
);

ActivityLogSchema.index({ userId: 1, createdAt: -1 });
ActivityLogSchema.index({ resource: 1, createdAt: -1 });
ActivityLogSchema.index({ createdAt: -1 });
// Auto-delete after 90 days
ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
export default ActivityLog;