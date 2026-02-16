/**
 * API Hooks
 * 
 * React hooks for data fetching with:
 * - Loading states
 * - Error handling
 * - Auto-refresh
 * - Optimistic updates
 */

"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { env } from '@/config/env';
import {
  accountsService,
  transfersService,
  toDisplayTransaction,
  beneficiariesService,
  virtualBagsService,
  subaccountsService,
  mockAccountsData,
  mockTransactionsData,
  mockVirtualBagsData,
  mockBeneficiariesData,
} from '@/services';
import type {
  AccountBalance,
  DashboardStats,
  DashboardOperations,
  TransactionDisplay,
  Beneficiary,
  VirtualBag,
  VirtualBagsStats,
  Subaccount,
  SubaccountVirtualBag,
} from '@/types/api.types';
import type { BalanceHistoryPoint } from '@/services/accounts.service';

// ============================================
// Generic Hook Types
// ============================================
interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

interface UseApiOptions {
  refreshInterval?: number;
  enabled?: boolean;
}

// ============================================
// Generic useApi Hook
// ============================================
function useApi<T>(
  fetcher: () => Promise<T>,
  options: UseApiOptions = {}
): UseApiState<T> {
  const { refreshInterval, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [fetcher, enabled]);

  useEffect(() => {
    fetchData();

    if (refreshInterval && enabled) {
      intervalRef.current = setInterval(fetchData, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, refreshInterval, enabled]);

  return { data, isLoading, error, refetch: fetchData };
}

// ============================================
// Account Hooks
// ============================================

/**
 * Hook for HUB balance
 */
export function useHubBalance(options?: UseApiOptions): UseApiState<AccountBalance> {
  const fetcher = useCallback(async () => {
    if (env.enableMockData) {
      return mockAccountsData.hubBalance;
    }
    return accountsService.getHubBalance();
  }, []);

  return useApi(fetcher, { refreshInterval: 30000, ...options });
}

/**
 * Hook for dashboard stats
 */
export function useDashboardStats(options?: UseApiOptions): UseApiState<DashboardStats> {
  const fetcher = useCallback(async () => {
    if (env.enableMockData) {
      return mockAccountsData.dashboardStats;
    }
    return accountsService.getDashboardStats();
  }, []);

  return useApi(fetcher, { refreshInterval: 60000, ...options });
}

/**
 * Hook for balance history (charts)
 */
export function useBalanceHistory(days: number = 7, options?: UseApiOptions): UseApiState<BalanceHistoryPoint[]> {
  const fetcher = useCallback(async () => {
    if (env.enableMockData) {
      return mockAccountsData.balanceHistory;
    }
    return accountsService.getBalanceHistory(days);
  }, [days]);

  return useApi(fetcher, options);
}

// ============================================
// Transaction Hooks
// ============================================

/**
 * Hook for recent transactions
 */
export function useRecentTransactions(limit: number = 10, options?: UseApiOptions): UseApiState<any[]> {
  const fetcher = useCallback(async () => {
    if (env.enableMockData) {
      return mockTransactionsData.slice(0, limit);
    }
    const response = await transfersService.getRecentTransactions(limit);
    return response.map((tx) => toDisplayTransaction(tx));
  }, [limit]);

  return useApi(fetcher, { refreshInterval: 30000, ...options });
}

/**
 * Hook for daily transaction stats
 */
export function useDailyStats(options?: UseApiOptions) {
  const fetcher = useCallback(async () => {
    if (env.enableMockData) {
      return {
        pending: 12,
        completed: 6,
        cancelled: 1,
        returned: 1,
        rejected: 1,
      };
    }
    return transfersService.getTransactionStats();
  }, []);

  return useApi(fetcher, { refreshInterval: 60000, ...options });
}

// ============================================
// Beneficiary Hooks
// ============================================

/**
 * Hook for beneficiaries list
 */
export function useBeneficiaries(options?: UseApiOptions): UseApiState<Beneficiary[]> {
  const fetcher = useCallback(async () => {
    if (env.enableMockData) {
      return mockBeneficiariesData;
    }
    return beneficiariesService.getBeneficiaries();
  }, []);

  return useApi(fetcher, options);
}

/**
 * Hook for frequent beneficiaries
 */
export function useFrequentBeneficiaries(limit: number = 5, options?: UseApiOptions): UseApiState<Beneficiary[]> {
  const fetcher = useCallback(async () => {
    if (env.enableMockData) {
      return mockBeneficiariesData.slice(0, limit);
    }
    const all = await beneficiariesService.getBeneficiaries();
    return all.slice(0, limit);
  }, [limit]);

  return useApi(fetcher, options);
}

// ============================================
// Virtual Bag Hooks
// ============================================

/**
 * Hook for virtual bags
 */
export function useVirtualBags(options?: UseApiOptions): UseApiState<VirtualBag[]> {
  const fetcher = useCallback(async () => {
    if (env.enableMockData) {
      return mockVirtualBagsData;
    }
    return virtualBagsService.getVirtualBags();
  }, []);

  return useApi(fetcher, { refreshInterval: 60000, ...options });
}

/**
 * Hook for a single cash bag
 */
export function useVirtualBag(bagId: string, options?: UseApiOptions): UseApiState<VirtualBag | null> {
  const fetcher = useCallback(async () => {
    if (env.enableMockData) {
      return mockVirtualBagsData.find(b => b.id === bagId) || null;
    }
    return virtualBagsService.getVirtualBag(bagId);
  }, [bagId]);

  return useApi(fetcher, options);
}

/**
 * Hook for virtual bag stats
 */
export function useVirtualBagsStats(options?: UseApiOptions): UseApiState<VirtualBagsStats> {
  const fetcher = useCallback(async () => {
    if (env.enableMockData) {
      return { monthlyTransfers: 0 };
    }
    return virtualBagsService.getStats();
  }, []);

  return useApi(fetcher, { refreshInterval: 60000, ...options });
}

// ============================================
// Subaccounts (Finco) Hooks
// ============================================
export interface UseSubaccountsOptions extends UseApiOptions {
  includeInternal?: boolean;
}

export function useSubaccounts(options?: UseSubaccountsOptions): UseApiState<Subaccount[]> {
  const includeInternal = options?.includeInternal ?? false;

  const fetcher = useCallback(async () => {
    return subaccountsService.getSubaccounts({ includeInternal });
  }, [includeInternal]);

  return useApi(fetcher, { refreshInterval: 60000, ...options });
}

/**
 * Hook for a single subaccount
 */
export function useSubaccount(id: string, options?: UseApiOptions): UseApiState<Subaccount | null> {
  const fetcher = useCallback(async () => {
    if (!id) return null;
    return subaccountsService.getSubaccount(id);
  }, [id]);

  return useApi(fetcher, { refreshInterval: 60000, ...options });
}

/**
 * Hook for virtual bags within a subaccount
 */
export function useSubaccountVirtualBags(subaccountId: string, options?: UseApiOptions): UseApiState<SubaccountVirtualBag[]> {
  const fetcher = useCallback(async () => {
    if (!subaccountId) return [];
    return subaccountsService.getVirtualBags(subaccountId);
  }, [subaccountId]);

  return useApi(fetcher, { refreshInterval: 30000, ...options });
}

// ============================================
// Combined Dashboard Hook
// ============================================

export interface DashboardData {
  balance: AccountBalance | null;
  stats: DashboardStats | null;
  recentTransactions: TransactionDisplay[];
  virtualBags: VirtualBag[];
  balanceHistory: BalanceHistoryPoint[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook that combines all dashboard data
 */
export function useDashboard(): DashboardData {
  const balance = useHubBalance();
  const stats = useDashboardStats();
  const transactions = useRecentTransactions(5);
  const virtualBags = useVirtualBags();
  const history = useBalanceHistory(7);

  const isLoading = balance.isLoading || stats.isLoading || transactions.isLoading || virtualBags.isLoading;
  const error = balance.error || stats.error || transactions.error || virtualBags.error;

  const refetch = useCallback(async () => {
    await Promise.all([
      balance.refetch(),
      stats.refetch(),
      transactions.refetch(),
      virtualBags.refetch(),
      history.refetch(),
    ]);
  }, [balance, stats, transactions, virtualBags, history]);

  return {
    balance: balance.data,
    stats: stats.data,
    recentTransactions: (transactions.data || []) as TransactionDisplay[],
    virtualBags: virtualBags.data || [],
    balanceHistory: history.data || [],
    isLoading,
    error,
    refetch,
  };
}

// ============================================
// Dashboard Operations Hook
// ============================================

export function useDashboardOperations(options?: UseApiOptions): UseApiState<DashboardOperations> {
  const fetcher = useCallback(async () => {
    if (env.enableMockData) {
      return {
        monthlyOperationsByCountry: [],
        nationalMetrics: [],
      };
    }
    return accountsService.getDashboardOperations();
  }, []);

  return useApi(fetcher, { refreshInterval: 60000, ...options });
}

// ============================================
// Mutation Hooks
// ============================================

interface UseMutationState<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<TData>;
  data: TData | null;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
}

/**
 * Generic mutation hook
 */
export function useMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>
): UseMutationState<TData, TVariables> {
  const [data, setData] = useState<TData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (variables: TVariables): Promise<TData> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await mutationFn(variables);
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [mutationFn]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { mutate, data, isLoading, error, reset };
}

/**
 * Hook for Money Out transfers
 */
export function useMoneyOut() {
  return useMutation(transfersService.moneyOut);
}

// TODO: Implement internalTransfer in transfersService
// export function useInternalTransfer() {
//   return useMutation(transfersService.internalTransfer);
// }

/**
 * Hook for virtual bag transfers
 */
export function useVirtualBagTransfer() {
  return useMutation(virtualBagsService.transfer);
}

/**
 * Hook for creating beneficiaries
 */
export function useCreateBeneficiary() {
  return useMutation(beneficiariesService.createBeneficiary);
}

// TODO: Implement validateBeneficiary in beneficiariesService
// export function useValidateBeneficiary() {
//   return useMutation(beneficiariesService.validateBeneficiary);
// }
