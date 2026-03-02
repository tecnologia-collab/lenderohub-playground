import mongoose, { Document, Schema } from 'mongoose';

export type AnnouncementPriority = 'normal' | 'important' | 'urgent';

export interface IAnnouncement extends Document {
  title: string;
  content: string;
  priority: AnnouncementPriority;
  isPinned: boolean;
  imageUrl?: string;
  expiresAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAnnouncementRead extends Document {
  announcementId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  readAt: Date;
}

// ============================================
// Announcement Schema
// ============================================

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true, maxlength: 200, trim: true },
    content: { type: String, required: true, maxlength: 10000, trim: true },
    priority: {
      type: String,
      enum: ['normal', 'important', 'urgent'],
      default: 'normal',
      required: true,
    },
    isPinned: { type: Boolean, default: false },
    imageUrl: { type: String, required: false, trim: true },
    expiresAt: { type: Date, required: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  },
  { timestamps: true, collection: 'announcements' }
);

AnnouncementSchema.index({ isPinned: -1, createdAt: -1 });
AnnouncementSchema.index({ expiresAt: 1 });
AnnouncementSchema.index({ title: 'text', content: 'text' });

export const Announcement = mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);

// ============================================
// AnnouncementRead Schema
// ============================================

const AnnouncementReadSchema = new Schema<IAnnouncementRead>(
  {
    announcementId: { type: Schema.Types.ObjectId, ref: 'Announcement', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    readAt: { type: Date, default: Date.now },
  },
  { collection: 'announcement_reads' }
);

AnnouncementReadSchema.index({ announcementId: 1, userId: 1 }, { unique: true });
AnnouncementReadSchema.index({ userId: 1, announcementId: 1 });

export const AnnouncementRead = mongoose.model<IAnnouncementRead>('AnnouncementRead', AnnouncementReadSchema);