import mongoose, { Document, Schema, Model } from 'mongoose';

// ============================================
// Enums
// ============================================

export enum TicketStatus {
  Open = 'open',
  InProgress = 'in_progress',
  Resolved = 'resolved',
  Closed = 'closed',
}

export enum TicketPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Urgent = 'urgent',
}

export enum TicketType {
  Bug = 'bug',
  Feature = 'feature',
  Question = 'question',
}

// ============================================
// Base Interface
// ============================================

export interface ITicket extends Document {
  ticketType: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdBy: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

type TicketModel = Model<ITicket>;

// ============================================
// Base Schema
// ============================================

const ticketSchema = new Schema<ITicket, TicketModel>(
  {
    title: { type: String, required: true, maxlength: 200, trim: true },
    description: { type: String, required: true, maxlength: 5000, trim: true },
    status: {
      type: String,
      enum: Object.values(TicketStatus),
      default: TicketStatus.Open,
      required: true,
    },
    priority: {
      type: String,
      enum: Object.values(TicketPriority),
      default: TicketPriority.Medium,
      required: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  },
  {
    collection: 'tickets',
    discriminatorKey: 'ticketType',
    timestamps: true,
  }
);

ticketSchema.index({ status: 1, priority: 1 });
ticketSchema.index({ createdBy: 1, createdAt: -1 });

export const Ticket = mongoose.model<ITicket, TicketModel>('Ticket', ticketSchema);

// ============================================
// BugTicket Discriminator
// ============================================

export enum BugSeverity {
  Cosmetic = 'cosmetic',
  Minor = 'minor',
  Major = 'major',
  Critical = 'critical',
}

export interface IBugTicket extends ITicket {
  severity: BugSeverity;
  stepsToReproduce: string[];
  affectedModule: string;
  browserInfo?: string;
}

const bugSchema = new Schema<IBugTicket>({
  severity: {
    type: String,
    enum: Object.values(BugSeverity),
    required: true,
  },
  stepsToReproduce: {
    type: [String],
    required: true,
    validate: {
      validator: (v: string[]) => v.length > 0,
      message: 'stepsToReproduce debe tener al menos un paso',
    },
  },
  affectedModule: { type: String, required: true, trim: true },
  browserInfo: { type: String, required: false, trim: true },
});

export const BugTicket = Ticket.discriminator<IBugTicket>(
  'BugTicket',
  bugSchema,
  TicketType.Bug
);

// ============================================
// FeatureTicket Discriminator
// ============================================

export enum EstimatedEffort {
  Small = 'small',
  Medium = 'medium',
  Large = 'large',
}

export interface IFeatureTicket extends ITicket {
  businessJustification: string;
  estimatedEffort: EstimatedEffort;
  requestedBy?: string;
  targetRelease?: string;
}

const featureSchema = new Schema<IFeatureTicket>({
  businessJustification: { type: String, required: true, maxlength: 2000, trim: true },
  estimatedEffort: {
    type: String,
    enum: Object.values(EstimatedEffort),
    required: true,
  },
  requestedBy: { type: String, required: false, trim: true },
  targetRelease: { type: String, required: false, trim: true },
});

export const FeatureTicket = Ticket.discriminator<IFeatureTicket>(
  'FeatureTicket',
  featureSchema,
  TicketType.Feature
);

// ============================================
// QuestionTicket Discriminator
// ============================================

export interface IQuestionTicket extends ITicket {
  topic: string;
  answer?: string;
  answeredBy?: mongoose.Types.ObjectId;
  answeredAt?: Date;
}

const questionSchema = new Schema<IQuestionTicket>({
  topic: { type: String, required: true, trim: true },
  answer: { type: String, required: false, trim: true },
  answeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  answeredAt: { type: Date, required: false },
});

export const QuestionTicket = Ticket.discriminator<IQuestionTicket>(
  'QuestionTicket',
  questionSchema,
  TicketType.Question
);