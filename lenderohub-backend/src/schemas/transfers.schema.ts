// src/schemas/transfers.schema.ts
import { z } from 'zod';

// Schema base para transferencias (preparado para múltiples proveedores)
const BaseTransferSchema = z.object({
  amount: z.number().positive().int(), // En centavos
  concept: z.string().min(1).max(40),
  reference: z.string().optional(),
});

// Schema para transferencias SPEI (principal método de transferencia)
export const CreateSPEITransferSchema = z.object({
  body: BaseTransferSchema.extend({
    fromAccountId: z.string().optional(), // Cuenta origen interna
    toClabe: z.string().length(18),
    beneficiaryName: z.string().min(1).max(100),
    beneficiaryRfc: z.string().optional(),
    beneficiaryEmail: z.string().email().optional(),
  })
});

// Schema para transferencias internas (para el futuro)
export const CreateInternalTransferSchema = z.object({
  body: BaseTransferSchema.extend({
    fromAccountId: z.string(),
    toAccountId: z.string(),
    description: z.string().optional(),
  })
});

// Tipos exportados - FORMA CORRECTA
export type CreateSPEITransferDto = z.infer<typeof CreateSPEITransferSchema>['body'];
export type CreateInternalTransferDto = z.infer<typeof CreateInternalTransferSchema>['body'];

// Estado de transferencias (genérico)
export const TransferStatusSchema = z.enum([
  'pending',
  'processing', 
  'completed',
  'failed',
  'cancelled',
  'rejected'
]);

export type TransferStatus = z.infer<typeof TransferStatusSchema>;

// Schema para filtros de búsqueda
export const TransferFiltersSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    per_page: z.string().regex(/^\d+$/).transform(Number).optional(),
    status: TransferStatusSchema.optional(),
    from_date: z.string().optional(),
    to_date: z.string().optional(),
  })
});

// Tipo para filtros - FORMA CORRECTA
export type TransferFilters = z.infer<typeof TransferFiltersSchema>['query'];