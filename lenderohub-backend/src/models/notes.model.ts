import mongoose, { Document, Schema, Model } from 'mongoose';

// ============================================
// Types
// ============================================

export type NoteEntityType = 'user' | 'beneficiary' | 'transfer' | 'general';
export type NotePriority = 'low' | 'medium' | 'high';

export interface INote extends Document {
  content: string;
  entityType: NoteEntityType;
  entityId?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  priority: NotePriority;
  isResolved: boolean;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  // Virtual
  isOverdue: boolean;
  // Method
  resolve(userId: mongoose.Types.ObjectId): Promise<INote>;
}

interface INoteModel extends Model<INote> {}

// ============================================
// Schema
// ============================================

const NoteSchema = new Schema<INote>(
  {
    content: {
      type: String,
      required: [true, 'El contenido de la nota es requerido'],
      maxlength: [2000, 'El contenido no puede superar 2000 caracteres'],
      trim: true,
    },
    entityType: {
      type: String,
      required: [true, 'El tipo de entidad es requerido'],
      enum: {
        values: ['user', 'beneficiary', 'transfer', 'general'],
        message: 'entityType debe ser: user, beneficiary, transfer, o general',
      },
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El creador de la nota es requerido'],
    },
    priority: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high'],
        message: 'priority debe ser: low, medium, o high',
      },
      default: 'medium',
    },
    isResolved: {
      type: Boolean,
      default: false,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    resolvedAt: {
      type: Date,
      required: false,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ============================================
// Indices
// ============================================

NoteSchema.index({ entityType: 1, entityId: 1 });
NoteSchema.index({ content: 'text', tags: 'text' });

// ============================================
// Virtuals
// ============================================

NoteSchema.virtual('isOverdue').get(function (this: INote) {
  if (this.isResolved) return false;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return this.createdAt < sevenDaysAgo;
});

// ============================================
// Methods
// ============================================

NoteSchema.methods.resolve = async function (
  this: INote,
  userId: mongoose.Types.ObjectId
): Promise<INote> {
  this.isResolved = true;
  this.resolvedBy = userId;
  this.resolvedAt = new Date();
  return this.save();
};

// ============================================
// Model
// ============================================

export const Note = mongoose.model<INote, INoteModel>('Note', NoteSchema);
export default Note;