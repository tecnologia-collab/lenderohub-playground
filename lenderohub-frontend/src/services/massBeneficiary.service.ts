/**
 * Mass Beneficiary Import Service (Frontend)
 *
 * Handles CSV upload, validation preview, confirmation,
 * and polling for import completion.
 */

import { api } from '@/lib/api';

// ============================================
// Types
// ============================================
export interface MassBeneficiaryRow {
  rowNumber: number;
  name: string;
  alias: string;
  clabeNumber: string;
  rfc: string;
  email: string;
  status: 'valid' | 'invalid' | 'created' | 'failed';
  errorMessage?: string;
  beneficiaryId?: string;
}

export interface MassBeneficiaryImport {
  _id: string;
  costCentreId: string;
  status:
    | 'pending_review'
    | 'confirmed'
    | 'processing'
    | 'completed'
    | 'partially_completed'
    | 'failed';
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  successCount: number;
  failCount: number;
  rows: MassBeneficiaryRow[];
  createdAt: string;
}

// ============================================
// Service
// ============================================
export const massBeneficiaryService = {
  /**
   * Upload a CSV file for validation
   */
  async upload(file: File, costCentreId: string): Promise<MassBeneficiaryImport> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('costCentreId', costCentreId);

    const response = await api.post<{ data: MassBeneficiaryImport }>(
      '/mass-beneficiaries/upload',
      formData
    );
    return response.data;
  },

  /**
   * Confirm an import (start creating beneficiaries)
   */
  async confirm(id: string): Promise<MassBeneficiaryImport> {
    const response = await api.post<{ data: MassBeneficiaryImport }>(
      `/mass-beneficiaries/${id}/confirm`
    );
    return response.data;
  },

  /**
   * Get a specific import by ID (used for polling)
   */
  async getById(id: string): Promise<MassBeneficiaryImport> {
    const response = await api.get<{ data: MassBeneficiaryImport }>(
      `/mass-beneficiaries/${id}`
    );
    return response.data;
  },

  /**
   * Get all imports for a cost centre
   */
  async getAll(
    costCentreId: string,
    page = 1,
    limit = 20
  ): Promise<{ data: MassBeneficiaryImport[]; total: number }> {
    const response = await api.get<{
      data: MassBeneficiaryImport[];
      total: number;
    }>('/mass-beneficiaries', { costCentreId, page, limit });
    return response;
  },
};
