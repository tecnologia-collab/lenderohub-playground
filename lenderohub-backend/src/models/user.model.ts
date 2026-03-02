import { Schema, model, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

// Tipos de perfil según LenderoPay
export type UserProfileType = 
  | 'corporate'        // Usuario corporativo
  | 'administrator'    // Admin por CECO/BU
  | 'subaccount'       // Usuario de subcuenta
  | 'commissionAgent'; // Agente comisionista

export type CommissionType =
  | 'resico'
  | 'entrepreneurialActivity'
  | 'juridicalPerson';

export interface ICommissionDocument {
  key: string;
  url: string;
  mimeType: string;
  size: number;
  originalName: string;
}

export interface ICommissionDocuments {
  identificationDocument?: ICommissionDocument;
  financialStatement?: ICommissionDocument;
  proofOfAddress?: ICommissionDocument;
}

export interface IUser extends Document {
  // Información básica
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  secondLastName?: string;
  phone?: string;
  
  // Perfil y permisos
  profileType: UserProfileType;
  isActive: boolean;
  emailVerified: boolean;
  readOnly?: boolean;
  permissions?: string[];
  
  // 2FA (Two Factor Authentication)
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;      // Secret de TOTP (Google Authenticator)
  twoFactorBackupCodes?: string[]; // Códigos de respaldo
  
  // Relaciones
  clientId?: Schema.Types.ObjectId;  // Empresa/Cliente al que pertenece
  businessUnitId?: Schema.Types.ObjectId; // Unidad de negocio específica (opcional)

  // Datos comisionista
  commissionType?: CommissionType;
  rfc?: string;
  commissionTransferOutFee?: any;
  commissionDocuments?: ICommissionDocuments;
  
  // Refresh tokens
  refreshTokens: {
    token: string;
    expiresAt: Date;
    createdAt: Date;
  }[];
  
  // Seguridad
  tokenVersion: number;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: Schema.Types.ObjectId;
  lastModifiedBy?: Schema.Types.ObjectId;

  // Virtuals
  readonly fullName: string;
  
  // Métodos
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateRefreshToken(): string;
  addRefreshToken(token: string, expiresAt: Date): Promise<void>;
  removeRefreshToken(token: string): Promise<void>;
  clearRefreshTokens(): Promise<void>;
}

const userSchema = new Schema<IUser>(
  {
    // Información básica
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // No incluir en queries por defecto
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    secondLastName: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    
    // Perfil y permisos
    profileType: {
      type: String,
      required: true,
      enum: ['corporate', 'administrator', 'subaccount', 'commissionAgent'],
      default: 'subaccount',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    readOnly: {
      type: Boolean,
      default: false,
    },
    permissions: {
      type: [String],
      default: [],
    },
    
    // 2FA
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      select: false, // No incluir por defecto por seguridad
    },
    twoFactorBackupCodes: {
      type: [String],
      select: false,
    },
    
    // Relaciones
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
      index: true,
    },
    businessUnitId: {
      type: Schema.Types.ObjectId,
      ref: 'BusinessUnit',
    },

    // Datos comisionista
    commissionType: {
      type: String,
      enum: ['resico', 'entrepreneurialActivity', 'juridicalPerson'],
    },
    rfc: {
      type: String,
      uppercase: true,
      trim: true,
    },
    commissionTransferOutFee: {
      type: Schema.Types.Mixed,
    },
    commissionDocuments: {
      identificationDocument: {
        key: { type: String },
        url: { type: String },
        mimeType: { type: String },
        size: { type: Number },
        originalName: { type: String },
      },
      financialStatement: {
        key: { type: String },
        url: { type: String },
        mimeType: { type: String },
        size: { type: Number },
        originalName: { type: String },
      },
      proofOfAddress: {
        key: { type: String },
        url: { type: String },
        mimeType: { type: String },
        size: { type: Number },
        originalName: { type: String },
      },
    },
    
    // Refresh tokens
    refreshTokens: [
      {
        token: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    
    // Seguridad
    tokenVersion: {
      type: Number,
      default: 0,
    },
    lastLoginAt: Date,
    lastLoginIp: String,
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: Date,
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: Date,
    
    // Metadata
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    lastModifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Índices compuestos
userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ clientId: 1, profileType: 1 });

// Virtual para nombre completo
userSchema.virtual('fullName').get(function () {
  const parts = [this.firstName, this.lastName, this.secondLastName].filter(Boolean);
  return parts.join(' ');
});

// Middleware pre-save: hash password si fue modificado
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.passwordHash);
  } catch (error) {
    return false;
  }
};

// Método para generar refresh token
userSchema.methods.generateRefreshToken = function (): string {
  const { nanoid } = require('nanoid');
  return nanoid(64);
};

// Método para agregar refresh token
userSchema.methods.addRefreshToken = async function (token: string, expiresAt: Date): Promise<void> {
  this.refreshTokens.push({
    token,
    expiresAt,
    createdAt: new Date(),
  });
  
  // Limpiar tokens expirados
  this.refreshTokens = this.refreshTokens.filter((rt: any) => rt.expiresAt > new Date());
  
  await this.save();
};

// Método para remover refresh token
userSchema.methods.removeRefreshToken = async function (token: string): Promise<void> {
  this.refreshTokens = this.refreshTokens.filter((rt: any) => rt.token !== token);
  await this.save();
};

// Método para limpiar todos los refresh tokens
userSchema.methods.clearRefreshTokens = async function (): Promise<void> {
  this.refreshTokens = [];
  await this.save();
};

// Configuración de toJSON
userSchema.set('toJSON', {
  virtuals: true,
  transform: function (_doc, ret) {
    delete ret.passwordHash;
    delete ret.twoFactorSecret;
    delete ret.twoFactorBackupCodes;
    delete ret.refreshTokens;
    delete ret.__v;
    return ret;
  },
});

export const UserModel = model<IUser>('User', userSchema);
