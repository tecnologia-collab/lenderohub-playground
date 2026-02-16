import { api } from '@/lib/api';
import type { ApiResponse } from '@/lib/api';

// ============================================
// Types
// ============================================
export interface MassTransferRow {
  rowNumber: number;
  beneficiaryClabe: string;
  beneficiaryName: string;
  amount: number;
  concept: string;
  reference: string;
  status: 'valid' | 'invalid' | 'pending' | 'sent' | 'completed' | 'failed';
  errorMessage?: string;
  transactionId?: string;
}

export interface MassTransfer {
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
  totalAmount: number;
  successCount: number;
  failCount: number;
  rows: MassTransferRow[];
  createdAt: string;
  updatedAt?: string;
}

// ============================================
// Service
// ============================================
export const massTransferService = {
  /**
   * Upload a CSV file for mass transfer-out validation
   */
  async upload(file: File, costCentreId: string): Promise<MassTransfer> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('costCentreId', costCentreId);
    const response = await api.post<ApiResponse<MassTransfer>>(
      '/v1/mass-transfers/upload',
      formData
    );
    return response.data;
  },

  /**
   * Confirm and execute a validated mass transfer batch
   */
  async confirm(id: string): Promise<MassTransfer> {
    const response = await api.post<ApiResponse<MassTransfer>>(
      `/v1/mass-transfers/${id}/confirm`
    );
    return response.data;
  },

  /**
   * Get a single mass transfer batch with all row details
   */
  async getById(id: string): Promise<MassTransfer> {
    const response = await api.get<ApiResponse<MassTransfer>>(
      `/v1/mass-transfers/${id}`
    );
    return response.data;
  },

  /**
   * List mass transfer batches for a cost centre (paginated)
   */
  async getAll(
    costCentreId: string,
    page = 1,
    limit = 20
  ): Promise<{ data: MassTransfer[]; total: number }> {
    const response = await api.get<{
      data: MassTransfer[];
      total: number;
    }>('/v1/mass-transfers', { costCentreId, page, limit });
    return { data: response.data || [], total: response.total || 0 };
  },
};
