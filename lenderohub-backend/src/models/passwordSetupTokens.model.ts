import { Schema, model, Document } from 'mongoose';
import crypto from 'crypto';

/**
 * Password Setup Token Model
 * 
 * Tokens para establecer contraseña de usuarios nuevos
 * - Expiran en 24 horas
 * - Solo se pueden usar una vez
 */

export interface IPasswordSetupToken extends Document {
  user: Schema.Types.ObjectId;
  token: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  
  // Métodos
  isValid(): boolean;
  markAsUsed(): Promise<void>;
}

const passwordSetupTokenSchema = new Schema<IPasswordSetupToken>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    usedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Índice compuesto para búsquedas eficientes
passwordSetupTokenSchema.index({ token: 1, expiresAt: 1 });

// TTL index para limpiar tokens expirados automáticamente (después de 7 días)
passwordSetupTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

/**
 * Verifica si el token es válido (no expirado y no usado)
 */
passwordSetupTokenSchema.methods.isValid = function (): boolean {
  return !this.usedAt && this.expiresAt > new Date();
};

/**
 * Marca el token como usado
 */
passwordSetupTokenSchema.methods.markAsUsed = async function (): Promise<void> {
  this.usedAt = new Date();
  await this.save();
};

/**
 * Genera un token único de 64 caracteres
 */
export function generateSetupToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Calcula la fecha de expiración (24 horas desde ahora)
 */
export function getSetupTokenExpiration(): Date {
  const expiration = new Date();
  expiration.setHours(expiration.getHours() + 24);
  return expiration;
}

export const PasswordSetupToken = model<IPasswordSetupToken>('PasswordSetupToken', passwordSetupTokenSchema);
