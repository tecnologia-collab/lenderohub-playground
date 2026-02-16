/**
 * Reports Service
 *
 * Handles all report-related API calls:
 * - Transaction reports with filters
 * - Summary (flow, charts)
 * - Commissions
 * - CSV/PDF exports
 */

import { api } from '@/lib/api';

// ============================================
// Types
// ============================================

export interface ReportTransaction {
  id: string;
  type: 'transfer_in' | 'transfer_out' | 'internal';
  amount: number;
  status: string;
  concept: string;
  counterparty: string;
  createdAt: string;
  costCentreAlias?: string;
}

export interface ReportTransactionsResponse {
  data: ReportTransaction[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ReportSummary {
  totalIncome: number;
  totalExpense: number;
  netFlow: number;
  totalTransactions: number;
  monthlyData: { month: string; ingresos: number; egresos: number }[];
  transactionsByType: { name: string; value: number; color: string }[];
}

export interface ReportCommission {
  agentName: string;
  agentId: string;
  totalCommission: number;
  transactionCount: number;
  period: string;
}

export interface ReportCommissionsResponse {
  data: ReportCommission[];
  total: number;
}

export interface ReportTransactionsParams {
  from?: string;
  to?: string;
  status?: string;
  type?: string;
  costCentreId?: string;
  page?: number;
  limit?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface ReportSummaryParams {
  from?: string;
  to?: string;
  costCentreId?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface ReportCommissionsParams {
  agentId?: string;
  period?: string;
  costCentreId?: string;
  [key: string]: string | number | boolean | undefined;
}

// ============================================
// Service
// ============================================

export const reportsService = {
  /**
   * Get transactions with filters and pagination
   */
  async getTransactions(params?: ReportTransactionsParams): Promise<ReportTransactionsResponse> {
    return api.get<ReportTransactionsResponse>('/v1/reports/transactions', params);
  },

  /**
   * Get summary data (totals + chart data)
   */
  async getSummary(params?: ReportSummaryParams): Promise<ReportSummary> {
    return api.get<ReportSummary>('/v1/reports/summary', params);
  },

  /**
   * Get commissions report
   */
  async getCommissions(params?: ReportCommissionsParams): Promise<ReportCommissionsResponse> {
    return api.get<ReportCommissionsResponse>('/v1/reports/commissions', params);
  },

  /**
   * Build the full export URL for downloading CSV/PDF reports.
   * Opens in a new tab so the browser handles the download.
   */
  getExportUrl(
    type: string,
    format: string,
    params?: Record<string, string>
  ): string {
    const searchParams = new URLSearchParams({ type, format, ...params });
    return `/v1/reports/export?${searchParams.toString()}`;
  },
};
