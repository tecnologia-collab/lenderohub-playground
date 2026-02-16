/**
 * Virtual Bags Service (Bolsas virtuales)
 * 
 * Handles all virtual bag operations:
 * - CRUD operations
 * - Balance management
 * - Inter-bag transfers
 */

import { api } from '@/lib/api';
import type {
  VirtualBag,
  CreateVirtualBagRequest,
  VirtualBagTransferRequest,
  PaginatedResponse,
  PaginationParams,
  VirtualBagsStats,
} from '@/types/api.types';

// ============================================
// Types
// ============================================
export interface GetVirtualBagsParams extends PaginationParams {
  isActive?: boolean;
  [key: string]: string | number | boolean | undefined;
}

export interface VirtualBagTransferResult {
  success: boolean;
  fromBag?: VirtualBag;
  toBag?: VirtualBag;
  error?: string;
}

export interface VirtualBagMovement {
  id: string;
  bagId: string;
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER_IN' | 'TRANSFER_OUT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  relatedBagId?: string;
  createdAt: string;
}

// ============================================
// Service
// ============================================
export const virtualBagsService = {
  /**
   * Get all virtual bags
   */
  async getVirtualBags(params?: GetVirtualBagsParams): Promise<VirtualBag[]> {
    const response = await api.get<{ data: VirtualBag[] }>('/v1/virtual-bags', params);
    return response.data;
  },

  /**
   * Get a single virtual bag by ID
   */
  async getVirtualBag(bagId: string): Promise<VirtualBag> {
    const response = await api.get<{ data: VirtualBag }>(`/v1/virtual-bags/${bagId}`);
    return response.data;
  },

  /**
   * Create a new virtual bag
   */
  async createVirtualBag(data: CreateVirtualBagRequest): Promise<VirtualBag> {
    const response = await api.post<{ data: VirtualBag }>('/v1/virtual-bags', data);
    return response.data;
  },

  /**
   * Update a virtual bag
   */
  async updateVirtualBag(bagId: string, data: Partial<CreateVirtualBagRequest>): Promise<VirtualBag> {
    const response = await api.patch<{ data: VirtualBag }>(`/v1/virtual-bags/${bagId}`, data);
    return response.data;
  },

  /**
   * Delete (deactivate) a virtual bag
   */
  async deleteVirtualBag(bagId: string): Promise<void> {
    await api.delete(`/v1/virtual-bags/${bagId}`);
  },

  /**
   * Transfer funds between virtual bags
   */
  async transfer(request: VirtualBagTransferRequest): Promise<VirtualBagTransferResult> {
    try {
      const response = await api.post<{ fromBag: VirtualBag; toBag: VirtualBag }>(
        '/v1/virtual-bags/transfer',
        request
      );
      return {
        success: true,
        fromBag: response.fromBag,
        toBag: response.toBag,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as { message?: string }).message || 'Transfer failed',
      };
    }
  },

  /**
   * Get movements for a specific virtual bag
   */
  async getMovements(bagId: string, params?: PaginationParams): Promise<PaginatedResponse<VirtualBagMovement>> {
    const response = await api.get<{ data: VirtualBagMovement[] }>(`/v1/virtual-bags/${bagId}/movements`, params);
    return {
      data: response.data,
      currentPage: 1,
      perPage: response.data.length,
      totalItems: response.data.length,
      totalPages: 1
    };
  },

  /**
   * Assign users to a virtual bag
   */
  async assignUsers(bagId: string, userIds: string[]): Promise<VirtualBag> {
    const response = await api.post<{ data: VirtualBag }>(`/v1/virtual-bags/${bagId}/users`, { userIds });
    return response.data;
  },

  /**
   * Remove users from a virtual bag
   */
  async removeUsers(bagId: string, userIds: string[]): Promise<VirtualBag> {
    const response = await api.post<{ data: VirtualBag }>(`/v1/virtual-bags/${bagId}/users/remove`, { userIds });
    return response.data;
  },

  /**
   * Get total balance across all virtual bags
   */
  async getTotalBalance(): Promise<{ total: number; currency: string }> {
    const response = await api.get<{ data: { total: number; currency: string } }>('/v1/virtual-bags/total-balance');
    return response.data;
  },

  /**
   * Get virtual bag stats
   */
  async getStats(): Promise<VirtualBagsStats> {
    const response = await api.get<{ data: VirtualBagsStats }>('/v1/virtual-bags/stats');
    return response.data;
  },
};

// ============================================
// Mock Data (for development without backend)
// ============================================
export const mockVirtualBagsData: VirtualBag[] = [
  {
    id: 'bag-001',
    clientId: 'client-001',
    name: 'Operaciones',
    description: 'Bolsa principal para operaciones diarias',
    balance: 85420,
    currency: 'MXN',
    color: '#10b981',
    isActive: true,
    assignedUsers: ['user-001', 'user-002'],
    limits: {
      dailyLimit: 500000,
      perTransactionLimit: 100000,
    },
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-16T10:00:00Z',
  },
  {
    id: 'bag-002',
    clientId: 'client-001',
    name: 'Nómina',
    description: 'Fondos reservados para nómina',
    balance: 45000,
    currency: 'MXN',
    color: '#06b6d4',
    isActive: true,
    assignedUsers: ['user-001'],
    limits: {
      monthlyLimit: 2000000,
    },
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'bag-003',
    clientId: 'client-001',
    name: 'Proveedores',
    description: 'Pagos a proveedores',
    balance: 35000,
    currency: 'MXN',
    color: '#8b5cf6',
    isActive: true,
    assignedUsers: ['user-002'],
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-14T10:00:00Z',
  },
  {
    id: 'bag-004',
    clientId: 'client-001',
    name: 'Reserva',
    description: 'Fondos de reserva',
    balance: 20000,
    currency: 'MXN',
    color: '#f59e0b',
    isActive: true,
    assignedUsers: ['user-001'],
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-10T10:00:00Z',
  },
];

export default virtualBagsService;
