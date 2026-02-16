/**
 * Accounts Service
 * 
 * Handles all account-related API calls:
 * - Balance queries
 * - Account movements
 * - Account details
 */

import { api } from '@/lib/api';
import type {
  Account,
  AccountBalance,
  AccountMovement,
  PaginatedResponse,
  PaginationParams,
  DashboardStats,
  DashboardOperations,
  TransferSourceAccount,
} from '@/types/api.types';

// ============================================
// Types
// ============================================
export interface GetMovementsParams extends PaginationParams {
  accountId?: string;
  type?: 'CREDIT' | 'DEBIT';
  startDate?: string;
  endDate?: string;
  // DESPUÉS de los campos existentes, AGREGAR:
[key: string]: string | number | boolean | undefined;
}

export interface BalanceHistoryPoint {
  date: string;
  balance: number;
}

// ============================================
// Service
// ============================================
export const accountsService = {
  /**
   * Get the centralized (HUB) account balance
   */
  async getHubBalance(): Promise<AccountBalance> {
    return api.get<AccountBalance>('/v1/hub/balance');
  },

  /**
   * Get all accounts for the client
   */
  async getAccounts(): Promise<Account[]> {
    const response = await api.get<{ data: Account[] }>('/v1/accounts');
    return response.data;
  },

  /**
   * Get available source accounts for transfers
   */
  async getTransferSources(): Promise<TransferSourceAccount[]> {
    const response = await api.get<{ data: TransferSourceAccount[] }>('/v1/accounts/transfer-sources');
    return response.data || [];
  },

  /**
   * Get a specific account by ID
   */
  async getAccount(accountId: string): Promise<Account> {
    return api.get<Account>(`/v1/accounts/${accountId}`);
  },

  /**
   * Get account movements with filters
   */
  async getMovements(params?: GetMovementsParams): Promise<PaginatedResponse<AccountMovement>> {
    return api.get<PaginatedResponse<AccountMovement>>('/v1/hub/movements', params as any);
  },

  /**
   * Get balance history for charts
   */
  async getBalanceHistory(days: number = 7): Promise<BalanceHistoryPoint[]> {
    return api.get<BalanceHistoryPoint[]>('/v1/hub/balance-history', { days });
  },

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    return api.get<DashboardStats>('/v1/dashboard/stats');
  },

  /**
   * Get dashboard operations metrics
   */
  async getDashboardOperations(): Promise<DashboardOperations> {
    return api.get<DashboardOperations>('/v1/dashboard/operations');
  },

  /**
   * Sync balance with Finco (manual reconciliation)
   */
  async syncBalance(): Promise<AccountBalance> {
    return api.post<AccountBalance>('/v1/hub/sync');
  },
};

// ============================================
// Mock Data (for development without backend)
// ============================================
export const mockAccountsData = {
  hubBalance: {
    accountId: 'hub-001',
    clabeNumber: '734180000018000000',
    availableBalance: 204563.99,
    pendingBalance: 25000,
    reservedBalance: 50000,
    totalBalance: 1575000,
    currency: 'MXN' as const,
    lastUpdated: new Date().toISOString(),
  },

  dashboardStats: {
    totalBalance: 1500000,
    todayIncome: 23500,
    todayExpense: 12300,
    todayIncomeChange: 8.2,
    todayExpenseChange: -3.1,
    pendingTransactions: 12,
    completedToday: 6,
    failedToday: 1,
  },

  balanceHistory: [
    { date: 'Ene 10', balance: 125000 },
    { date: 'Ene 11', balance: 142000 },
    { date: 'Ene 12', balance: 138000 },
    { date: 'Ene 13', balance: 156000 },
    { date: 'Ene 14', balance: 171000 },
    { date: 'Ene 15', balance: 168000 },
    { date: 'Ene 16', balance: 185420 },
  ],

  movements: [
    {
      id: 'mov-001',
      accountId: 'hub-001',
      type: 'CREDIT' as const,
      amount: 15000,
      balanceBefore: 1485000,
      balanceAfter: 1500000,
      description: 'Pago Cliente ABC Corp',
      reference: '20260116FINCH001',
      createdAt: new Date(Date.now() - 2 * 60000).toISOString(),
    },
    {
      id: 'mov-002',
      accountId: 'hub-001',
      type: 'DEBIT' as const,
      amount: 45000,
      balanceBefore: 1530000,
      balanceAfter: 1485000,
      description: 'Nómina Enero 2026',
      reference: '20260116FINCH002',
      createdAt: new Date(Date.now() - 60 * 60000).toISOString(),
    },
  ],
};

export default accountsService;
