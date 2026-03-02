/**
 * Beneficiary Clusters Service (Frontend)
 *
 * API client for beneficiary cluster (group) management.
 */

import { api } from '@/lib/api';

// ============================================
// Types
// ============================================

export interface BeneficiaryCluster {
  _id: string;
  name: string;
  description?: string;
  costCentreId: string;
  corporateClientId: string;
  createdBy: string;
  beneficiaries: string[]; // Finco instrument IDs
  color?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClusterRequest {
  name: string;
  description?: string;
  costCentreId: string;
  beneficiaryIds: string[];
  color?: string;
}

export interface UpdateClusterRequest {
  name?: string;
  description?: string;
  beneficiaryIds?: string[];
  color?: string;
}

// ============================================
// Preset colors (mirrors backend)
// ============================================
export const CLUSTER_PRESET_COLORS = [
  { hex: '#3B82F6', name: 'Azul' },
  { hex: '#10B981', name: 'Verde' },
  { hex: '#F59E0B', name: 'Ambar' },
  { hex: '#EF4444', name: 'Rojo' },
  { hex: '#8B5CF6', name: 'Violeta' },
  { hex: '#EC4899', name: 'Rosa' },
  { hex: '#06B6D4', name: 'Cyan' },
  { hex: '#F97316', name: 'Naranja' },
];

// ============================================
// Service
// ============================================
export const beneficiaryClustersService = {
  /**
   * List all clusters for a cost centre
   */
  async getAll(costCentreId: string, search?: string): Promise<BeneficiaryCluster[]> {
    const params: Record<string, string> = { costCentreId };
    if (search) params.search = search;

    const response = await api.get<{ data: BeneficiaryCluster[] }>(
      '/beneficiary-clusters',
      params
    );
    return response.data;
  },

  /**
   * Get a single cluster by ID
   */
  async getById(id: string): Promise<BeneficiaryCluster> {
    const response = await api.get<{ data: BeneficiaryCluster }>(
      `/beneficiary-clusters/${id}`
    );
    return response.data;
  },

  /**
   * Create a new cluster
   */
  async create(data: CreateClusterRequest): Promise<BeneficiaryCluster> {
    const response = await api.post<{ data: BeneficiaryCluster }>(
      '/beneficiary-clusters',
      data
    );
    return response.data;
  },

  /**
   * Update an existing cluster
   */
  async update(id: string, data: UpdateClusterRequest): Promise<BeneficiaryCluster> {
    const response = await api.put<{ data: BeneficiaryCluster }>(
      `/beneficiary-clusters/${id}`,
      data
    );
    return response.data;
  },

  /**
   * Soft-delete a cluster
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/beneficiary-clusters/${id}`);
  },

  /**
   * Add beneficiaries to an existing cluster
   */
  async addBeneficiaries(
    clusterId: string,
    beneficiaryIds: string[]
  ): Promise<BeneficiaryCluster> {
    const response = await api.post<{ data: BeneficiaryCluster }>(
      `/beneficiary-clusters/${clusterId}/beneficiaries`,
      { beneficiaryIds }
    );
    return response.data;
  },

  /**
   * Remove a single beneficiary from a cluster
   */
  async removeBeneficiary(
    clusterId: string,
    beneficiaryId: string
  ): Promise<BeneficiaryCluster> {
    const response = await api.delete<{ data: BeneficiaryCluster }>(
      `/beneficiary-clusters/${clusterId}/beneficiaries/${beneficiaryId}`
    );
    return response.data;
  },
};
