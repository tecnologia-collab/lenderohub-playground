/**
 * Commissions Service (Frontend)
 *
 * Handles commissions dashboard, transfers, and collection data.
 */

import { api, ApiError } from "@/lib/api";
import type { PaginationParams } from "@/types/api.types";

// ============================================
// Types
// ============================================

export type CommissionAccountTag =
  | "transferIn"
  | "transferInCommissionAgentPayment"
  | "transferOut"
  | "transferOutEarnings"
  | "monthlyCharges";

export interface CommissionAccount {
  tag: CommissionAccountTag;
  alias: string;
  clabe: string;
  balance: number;
}

export interface CommissionDashboardResponse {
  accounts: CommissionAccount[];
}

export interface CommissionCostCentre {
  id?: string;
  alias: string;
  code: string;
  name: string;
  transferIn: number;
  transferInCommissionAgentPayment: number;
  transferOut: number;
  transferOutEarnings: number;
  monthlyCharges: number;
  isFavorite?: boolean;
  isFeatured?: boolean;
}

export interface CommissionTransfer {
  date: string;
  fromCostCentre: string;
  reference: string;
  concept: string;
  trackingCode: string;
  amount: number;
  status: string;
}

export interface CommissionCollectionItem {
  alias: string;
  pendingBalance: number;
  concentratorBalance: number;
  status: string;
  attempts: number;
  lastAttemptDate: string;
}

export interface CommissionTransfersResponse {
  transfers: CommissionTransfer[];
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface CommissionCollectionResponse {
  costCentres: CommissionCollectionItem[];
}

export interface GetTransfersParams extends PaginationParams {
  search?: string;
}

// ============================================
// Commission Request Types
// ============================================

export type CommissionRequestStatus = "new" | "approved" | "rejected" | "completed" | "cancelled";

export interface CommissionRequestItem {
  _id: string;
  folio: string;
  date: string;
  status: CommissionRequestStatus;
  amount: number;
  amountTransfer?: number;
  amountWithheldVAT?: number;
  withheldIncomeTax?: number;
  transactionFeeWithVAT?: number;
  commissionAgent: string;
  hasInvoicePDF: boolean;
  hasInvoiceXML: boolean;
  rejectionMessage?: string;
}

export interface CommissionRequestsResponse {
  requests: CommissionRequestItem[];
}

// ============================================
// Helpers
// ============================================

const unwrapResponse = <T>(response: any): T => {
  return "data" in response ? response.data : response;
};

// ============================================
// Service
// ============================================

export const commissionsService = {
  async getDashboard(): Promise<CommissionDashboardResponse> {
    try {
      const response = await api.get<any>("/v1/commissions/ceco/dashboard");
      return unwrapResponse<CommissionDashboardResponse>(response);
    } catch (error) {
      if (error instanceof ApiError) {
        console.error("Error fetching commissions dashboard:", error.message);
      } else {
        console.error("Error fetching commissions dashboard:", error);
      }
      throw error;
    }
  },

  async getCostCentres(): Promise<CommissionCostCentre[]> {
    try {
      const response = await api.get<any>("/v1/commissions/ceco/centres");
      const payload = unwrapResponse<{ costCentres: CommissionCostCentre[] }>(response);
      return payload.costCentres || [];
    } catch (error) {
      if (error instanceof ApiError) {
        console.error("Error fetching commission cost centres:", error.message);
      } else {
        console.error("Error fetching commission cost centres:", error);
      }
      throw error;
    }
  },

  async getTransfers(params: GetTransfersParams = {}): Promise<CommissionTransfersResponse> {
    try {
      const response = await api.get<any>("/v1/commissions/ceco/transfers", params);
      return unwrapResponse<CommissionTransfersResponse>(response);
    } catch (error) {
      if (error instanceof ApiError) {
        console.error("Error fetching commission transfers:", error.message);
      } else {
        console.error("Error fetching commission transfers:", error);
      }
      throw error;
    }
  },

  async getMonthlyChargesTransfers(params: GetTransfersParams = {}): Promise<CommissionTransfersResponse> {
    try {
      const response = await api.get<any>("/v1/commissions/ceco/monthly-charges-transfers", params);
      return unwrapResponse<CommissionTransfersResponse>(response);
    } catch (error) {
      if (error instanceof ApiError) {
        console.error("Error fetching monthly charges transfers:", error.message);
      } else {
        console.error("Error fetching monthly charges transfers:", error);
      }
      throw error;
    }
  },

  async getCollection(period: string): Promise<CommissionCollectionResponse> {
    try {
      const response = await api.get<any>("/v1/commissions/ceco/collection", { period });
      return unwrapResponse<CommissionCollectionResponse>(response);
    } catch (error) {
      if (error instanceof ApiError) {
        console.error("Error fetching collection data:", error.message);
      } else {
        console.error("Error fetching collection data:", error);
      }
      throw error;
    }
  },

  async transferToCorporate(accountTag: CommissionAccountTag, amount: number): Promise<void> {
    try {
      await api.post("/v1/commissions/ceco/transfer", { accountTag, amount });
    } catch (error) {
      if (error instanceof ApiError) {
        console.error("Error creating commission transfer:", error.message);
      } else {
        console.error("Error creating commission transfer:", error);
      }
      throw error;
    }
  },

  async collectByTag(accountTag: CommissionAccountTag): Promise<{ totalTransfers: number; totalAmount: number }> {
    try {
      const response = await api.post<any>("/v1/commissions/ceco/collect", { accountTag });
      const payload = unwrapResponse<{ totalTransfers: number; totalAmount: number }>(response);
      return payload;
    } catch (error) {
      if (error instanceof ApiError) {
        console.error("Error collecting commissions:", error.message);
      } else {
        console.error("Error collecting commissions:", error);
      }
      throw error;
    }
  },

  // ============================================
  // Commission Requests
  // ============================================

  async getCommissionRequests(params?: { status?: string; mine?: boolean }): Promise<CommissionRequestsResponse> {
    try {
      const response = await api.get<any>("/v1/commission-agents/commission-requests", params);
      return unwrapResponse<CommissionRequestsResponse>(response);
    } catch (error) {
      if (error instanceof ApiError) {
        console.error("Error fetching commission requests:", error.message);
      } else {
        console.error("Error fetching commission requests:", error);
      }
      throw error;
    }
  },

  async createCommissionRequest(data: FormData): Promise<any> {
    try {
      const response = await api.post<any>("/v1/commission-agents/commission-requests", data);
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        console.error("Error creating commission request:", error.message);
      } else {
        console.error("Error creating commission request:", error);
      }
      throw error;
    }
  },

  async approveCommissionRequest(id: string): Promise<any> {
    try {
      const response = await api.put<any>(`/v1/commission-agents/commission-requests/${id}/approve`);
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        console.error("Error approving commission request:", error.message);
      } else {
        console.error("Error approving commission request:", error);
      }
      throw error;
    }
  },

  async rejectCommissionRequest(id: string, rejectionMessage: string): Promise<any> {
    try {
      const response = await api.put<any>(`/v1/commission-agents/commission-requests/${id}/reject`, { rejectionMessage });
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        console.error("Error rejecting commission request:", error.message);
      } else {
        console.error("Error rejecting commission request:", error);
      }
      throw error;
    }
  },
};
