// src/database/mongoose-plugins.ts
import mongoose from 'mongoose';
import * as dineroLib from 'dinero.js';
const Dinero = (dineroLib as any).default || dineroLib;

// Esquema Money como subdocumento para mongoose 7+
export const MoneySchemaDefinition = {
  amount: { type: Number, required: true, default: 0 },
  precision: { type: Number, required: true, default: 2 },
  currency: { type: String, required: true, default: 'MXN' }
};

// Crear el schema de Money como subdocumento embebido
export const MoneySchema = new mongoose.Schema(MoneySchemaDefinition, { _id: false });

// En mongoose 7+, no se puede registrar un SchemaType personalizado simplemente asignando
// Schema.Types.Money = algo. En su lugar, usamos Mixed y confiamos en la validación del schema.
// Registrar como Mixed para que mongoose lo acepte como tipo válido
(mongoose.Schema.Types as any).Money = mongoose.Schema.Types.Mixed;

// Helper para convertir de centavos a Dinero
export function toDinero(cents: number | null | undefined): any {
  if (cents == null) return null;
  return Dinero({ amount: cents, currency: 'MXN', precision: 2 });
}

// Helper para convertir de objeto Money o Dinero a centavos
export function fromDinero(value: any): number | null {
  if (value == null) return null;
  // Si ya es un número, retornarlo
  if (typeof value === 'number') return value;
  // Si es un objeto Dinero con getAmount
  if (value && typeof value.getAmount === 'function') {
    return value.getAmount();
  }
  // Si es un objeto con campo amount (MoneyObject)
  if (value && typeof value === 'object' && 'amount' in value) {
    return value.amount;
  }
  return null;
}

// Plugin para agregar métodos de dinero a los documentos
export function moneyPlugin(schema: mongoose.Schema) {
  schema.method('getMoney', function(field: string): any {
    const value = this.get(field);
    if (value && typeof value === 'object' && 'amount' in value) {
      return toDinero(value.amount);
    }
    return toDinero(value);
  });

  schema.method('setMoney', function(field: string, value: any) {
    if (value && typeof value.getAmount === 'function') {
      this.set(field, { amount: value.getAmount(), precision: 2, currency: 'MXN' });
    } else if (typeof value === 'number') {
      this.set(field, { amount: value, precision: 2, currency: 'MXN' });
    } else {
      this.set(field, value);
    }
  });
}
