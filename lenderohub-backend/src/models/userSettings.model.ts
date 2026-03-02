import mongoose from 'mongoose';

export interface IUserSettings extends mongoose.Document {
  user: mongoose.Types.ObjectId;
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  preferences: Map<string, any>;
  lastModifiedBy?: mongoose.Types.ObjectId;
}

const userSettingsSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notifications: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: false }
  },
  preferences: { type: Map, of: mongoose.Schema.Types.Mixed },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export const UserSettings = mongoose.model<IUserSettings>('UserSettings', userSettingsSchema);

// Extended settings interfaces
export interface ICorporateSettings extends IUserSettings {
  companyName?: string;
}

export interface IAdministratorSettings extends IUserSettings {
  adminLevel?: number;
}

export interface ISubaccountManagerSettings extends IUserSettings {
  managedAccounts?: mongoose.Types.ObjectId[];
}

export interface ICommissionAgentSettings extends IUserSettings {
  commissionRate?: number;
}

// Settings subdocument schemas (for embedding in other models)
const baseSettingsSchema = {
  notifications: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: false }
  },
  preferences: { type: Map, of: mongoose.Schema.Types.Mixed }
};

export const corporateSettings = {
  ...baseSettingsSchema,
  companyName: { type: String }
};

export const administratorSettings = {
  ...baseSettingsSchema,
  adminLevel: { type: Number }
};

export const subaccountManagerSettings = {
  ...baseSettingsSchema,
  managedAccounts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Account' }]
};

export const commissionAgentSettings = {
  ...baseSettingsSchema,
  commissionRate: { type: Number }
};
