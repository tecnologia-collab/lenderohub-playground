import mongoose from 'mongoose';

export interface IUserEvent extends mongoose.Document {
  user: mongoose.Types.ObjectId;
  eventType: string;
  eventBy?: mongoose.Types.ObjectId;
  description?: string;
  metadata?: any;
}

const userEventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventType: { type: String, required: true },
  eventBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  description: String,
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

export const UserEvent = mongoose.model<IUserEvent>('UserEvent', userEventSchema);
export const PasswordRequestUserEvent = UserEvent;
export const BlockedUserEvent = UserEvent;
