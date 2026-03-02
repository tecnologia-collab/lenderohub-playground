/**
 * Subaccounts Service (Finco accounts)
 */
import { api } from '@/lib/api';
import type { Subaccount, SubaccountVirtualBag, CreateSubaccountVirtualBagRequest, SubaccountVirtualBagTransferRequest, SubaccountTransactionsResponse, SubaccountAssignment } from '@/types/api.types';

export interface CreateSubaccountRequest {
  name: string;
  costCentreId?: string;
}

export interface VirtualBagTransferResult {
  fromBag: SubaccountVirtualBag;
  toBag: SubaccountVirtualBag;
}

export interface GetSubaccountsOptions {
  includeInternal?: boolean;
}

export const subaccountsService = {
  async getSubaccounts(options?: GetSubaccountsOptions): Promise<Subaccount[]> {
    const params = new URLSearchParams();
    if (options?.includeInternal) {
      params.set('includeInternal', 'true');
    }
    const queryString = params.toString();
    const url = queryString ? `/subaccounts?${queryString}` : '/subaccounts';
    const response = await api.get<{ data: Subaccount[] }>(url);
    return response.data;
  },

  async getSubaccount(id: string): Promise<Subaccount> {
    const response = await api.get<{ data: Subaccount }>(`/subaccounts/${id}`);
    return response.data;
  },

  async createSubaccount(payload: CreateSubaccountRequest): Promise<Subaccount> {
    const response = await api.post<{ data: Subaccount }>('/subaccounts', payload);
    return response.data;
  },

  // Virtual Bags within a subaccount
  async getVirtualBags(subaccountId: string): Promise<SubaccountVirtualBag[]> {
    const response = await api.get<{ data: SubaccountVirtualBag[] }>(`/subaccounts/${subaccountId}/virtual-bags`);
    return response.data;
  },

  async createVirtualBag(subaccountId: string, payload: CreateSubaccountVirtualBagRequest): Promise<SubaccountVirtualBag> {
    const response = await api.post<{ data: SubaccountVirtualBag }>(`/subaccounts/${subaccountId}/virtual-bags`, payload);
    return response.data;
  },

  async transferBetweenBags(subaccountId: string, payload: SubaccountVirtualBagTransferRequest): Promise<VirtualBagTransferResult> {
    const response = await api.post<{ data: VirtualBagTransferResult }>(`/subaccounts/${subaccountId}/virtual-bags/transfer`, payload);
    return response.data;
  },

  async updateVirtualBag(subaccountId: string, bagId: string, data: { name?: string; description?: string; color?: string; distributionPercentage?: number }): Promise<SubaccountVirtualBag> {
    const response = await api.patch<{ data: SubaccountVirtualBag }>(`/subaccounts/${subaccountId}/virtual-bags/${bagId}`, data);
    return response.data;
  },

  async getTransactions(subaccountId: string, params?: { type?: 'in' | 'out' | 'all'; startDate?: string; endDate?: string; page?: number; limit?: number }): Promise<SubaccountTransactionsResponse> {
    const queryParams: Record<string, string | number | boolean | undefined> = {};
    if (params?.type) queryParams.type = params.type;
    if (params?.startDate) queryParams.startDate = params.startDate;
    if (params?.endDate) queryParams.endDate = params.endDate;
    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;
    const response = await api.get<{ data: SubaccountTransactionsResponse }>(`/subaccounts/${subaccountId}/transactions`, queryParams);
    return response.data;
  },

  async getAssignments(subaccountId: string): Promise<SubaccountAssignment[]> {
    const response = await api.get<{ data: SubaccountAssignment[] }>(`/subaccounts/${subaccountId}/assignments`);
    return response.data;
  },

  async createAssignment(subaccountId: string, data: { userProfileId: string; permissions?: { transferFrom?: boolean; transferTo?: boolean } }): Promise<SubaccountAssignment> {
    const response = await api.post<{ data: SubaccountAssignment }>(`/subaccounts/${subaccountId}/assignments`, data);
    return response.data;
  },

  async removeAssignment(subaccountId: string, assignmentId: string): Promise<void> {
    await api.delete(`/subaccounts/${subaccountId}/assignments/${assignmentId}`);
  },
};
