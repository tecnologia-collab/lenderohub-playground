/**
 * Transfers Service
 *
 * Handles all transfer-related API calls:
 * - Money Out (SPEI) with idempotency
 * - Internal Transfers
 * - Transaction queries
 */

import { api } from '@/lib/api';
import type {
  Transaction,
  TransactionStatus,
  TransactionDisplay,
  PaginationParams,
} from '@/types/api.types';
import { v5 as uuidv5 } from 'uuid';

// ============================================
// Constants
// ============================================
// Namespace UUID for idempotency (staging)
const IDEMPOTENCY_NAMESPACE = '086fc9ec-d591-4045-bde4-3f9439506b08';

// ============================================
// Types
// ============================================
export interface GetTransactionsParams extends PaginationParams {
  status?: TransactionStatus;
  type?: 'MONEY_IN' | 'MONEY_OUT' | 'INTERNAL';
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface MoneyOutRequest {
  beneficiaryId: string;
  amount: number;
  description: string;
  externalReference?: string;
  fromAccountId?: string;
  beneficiaryEmail?: string;
}

export interface MoneyOutResponse {
  id: string;
  bankId: string;
  clientId: string;
  externalReference: string;
  trackingId: string;
  description: string;
  amount: string;
  currency: string;
  category: string;
  subCategory: string;
  transactionStatus: TransactionStatus;
  audit: {
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
    blockedAt?: string | null;
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Calculate SHA-256 hash of request body
 */
async function calculateBodyHash(data: Record<string, unknown>): Promise<string> {
  // Sort keys for consistency
  const sortedData = Object.keys(data)
    .sort()
    .reduce((obj, key) => {
      obj[key] = data[key];
      return obj;
    }, {} as Record<string, unknown>);

  const jsonString = JSON.stringify(sortedData, null, 0);
  
  // Use SubtleCrypto for hashing
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(jsonString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  
  // Convert to hex
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate idempotency key (UUID v5)
 */
async function generateIdempotencyKey(
  clientId: string,
  method: string,
  body: Record<string, unknown>
): Promise<string> {
  const bodyHash = await calculateBodyHash(body);
  const name = `${clientId}${method}${bodyHash}`;
  return uuidv5(name, IDEMPOTENCY_NAMESPACE);
}

/**
 * Transform backend transaction to display format
 */
function mapTransactionStatus(status?: string): TransactionDisplay['status'] {
  const normalized = (status || '').toUpperCase();
  switch (normalized) {
    case 'INITIALIZED':
    case 'PENDING':
      return 'pending';
    case 'PROCESSING':
      return 'processing';
    case 'LIQUIDATED':
    case 'COMPLETED':
      return 'completed';
    case 'FAILED':
      return 'failed';
    case 'CANCELLED':
    case 'REFUNDED':
    default:
      return 'cancelled';
  }
}

function parseAmount(value: any): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseFloat(value) || 0;
  if (typeof value === 'object' && typeof value.amount === 'number') {
    return value.amount / 100;
  }
  return 0;
}

export function toDisplayTransaction(tx: any): any {
  const amountRaw =
    tx.amount ??
    tx.amountTotal ??
    tx.amountTransfer ??
    tx.amount_transfer ??
    tx.amount_total;

  const dateValue =
    tx.audit?.createdAt ||
    tx.createdAt ||
    tx.created_at ||
    tx.date ||
    tx.audit?.updatedAt;

  return {
    id: tx.id || tx._id,
    type: tx.category === 'DEBIT_TRANS' ? 'out' : tx.category === 'INTER_TRANS' ? 'internal' : 'in',
    description: tx.description || 'Transferencia',
    amount: parseAmount(amountRaw),
    currency: tx.currency || 'MXN',
    status: mapTransactionStatus(tx.transactionStatus),
    date: dateValue,
    trackingKey: tx.trackingId,
    beneficiary: tx.destinationInstrument?.instrumentDetail?.holderName,
  };
}

// ============================================
// Service
// ============================================
export const transfersService = {
  /**
   * Send money out (SPEI transfer)
   * Backend handles idempotency
   */
  async moneyOut(request: MoneyOutRequest): Promise<MoneyOutResponse> {
    const requestBody = {
      beneficiary_id: request.beneficiaryId,
      amount: request.amount.toFixed(2),
      description: request.description,
      external_reference: request.externalReference || Date.now().toString().slice(-7),
      from_account_id: request.fromAccountId,
      beneficiary_email: request.beneficiaryEmail,
    };

    return api.request<MoneyOutResponse>('POST', '/transactions/money-out', {
      body: requestBody as any,
    });
  },

  /**
   * Get all transactions with filters
   */
  async getTransactions(params?: GetTransactionsParams): Promise<{
    data: Transaction[];
    pagination: {
      page?: number;
      per_page?: number;
      total?: number;
      total_pages?: number;
    };
  }> {
    const response = await api.get<{ data: Transaction[]; pagination?: any }>('/transactions', params as any);
    return {
      data: response.data || [],
      pagination: response.pagination || {},
    };
  },

  /**
   * Get recent transactions (for dashboard)
   */
  async getRecentTransactions(limit: number = 10): Promise<Transaction[]> {
    const response = await api.get<{ data: Transaction[] }>('/transactions/recent', { limit });
    return response.data || [];
  },

  /**
   * Get a specific transaction by ID
   */
  async getTransaction(transactionId: string): Promise<Transaction> {
    const response = await api.get<{ data: Transaction }>(`/transactions/${transactionId}`);
    return response.data;
  },

  /**
   * Track transaction status by tracking ID
   */
  async trackTransaction(trackingId: string): Promise<Transaction> {
    return api.get<Transaction>('/transactions/track', { trackingId });
  },

  /**
   * Cancel a pending transaction
   */
  async cancelTransaction(transactionId: string): Promise<Transaction> {
    return api.post<Transaction>(`/transactions/${transactionId}/cancel`);
  },

  /**
   * Get transaction statistics
   */
  async getTransactionStats(startDate?: string, endDate?: string): Promise<{
    total: number;
    completed: number;
    pending: number;
    failed: number;
    totalAmount: number;
  }> {
    return api.get('/transactions/stats', { startDate, endDate });
  },
};

// ============================================
// Mock Data (for development/testing)
// ============================================
export const mockTransactionsData: Transaction[] = [];

export { generateIdempotencyKey, calculateBodyHash };
