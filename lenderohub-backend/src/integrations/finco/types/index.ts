// src/integrations/finco/types/index.ts

// Actualizar la interfaz FincoConfig
export interface FincoConfig {
  apiUrl: string;
  apiKey: string;
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
}

// Tipos basados en OpenAPI de Finco

// Account types
export interface Account {
  id: string;
  account_number: string;
  clabe: string;
  balance: {
    available: number;
    pending: number;
    total: number;
  };
  currency: string;
  status: 'active' | 'inactive' | 'blocked';
  created_at: string;
  updated_at: string;
}

// Transfer types
export interface Transfer {
  id: string;
  amount: number;
  currency: string;
  concept: string;
  reference_number?: string;
  numeric_reference?: string;
  beneficiary: {
    name: string;
    clabe?: string;
    card_number?: string;
    bank_code?: string;
  };
  sender?: {
    name: string;
    clabe?: string;
    account_number?: string;
  };
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  type: 'SPEI' | 'internal' | 'card';
  tracking_key?: string;
  operation_date?: string;
  application_date?: string;
  created_at: string;
  updated_at: string;
  error?: {
    code: string;
    message: string;
  };
}

// SPEI specific transfer
export interface SPEITransfer {
  beneficiary_clabe: string;
  beneficiary_name: string;
  amount: number;
  concept: string;
  numeric_reference?: string;
  reference?: string;
}

// Webhook types
export interface WebhookEvent {
  id: string;
  type: 'transfer.received' | 'transfer.sent' | 'transfer.failed' | 'account.updated';
  data: any;
  created_at: string;
}

// Balance types
export interface Balance {
  account_id: string;
  available: number;
  pending: number;
  total: number;
  currency: string;
  last_updated: string;
}

// Beneficiary types
export interface Beneficiary {
  id: string;
  name: string;
  rfc?: string;
  clabe?: string;
  card_number?: string;
  email?: string;
  phone?: string;
  bank_code?: string;
  bank_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Response types
export interface FincoResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}