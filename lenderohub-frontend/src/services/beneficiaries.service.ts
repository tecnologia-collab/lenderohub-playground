/**
 * Beneficiaries Service (Frontend)
 * 
 * Calls LenderoHUB backend which proxies to Finco API
 */

import { api } from '@/lib/api';
import type { Beneficiary } from '@/types/api.types';

// Re-export Beneficiary type for convenience
export type { Beneficiary } from '@/types/api.types';

// ============================================
// Types
// ============================================
export interface CreateBeneficiaryRequest {
  alias: string;
  name: string;
  clabe: string;
  rfc?: string;
}

export interface UpdateBeneficiaryRequest {
  alias?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

// ============================================
// Service
// ============================================
export const beneficiariesService = {
  /**
   * Get all beneficiaries
   */
  async getBeneficiaries(): Promise<Beneficiary[]> {
    try {
      const response = await api.get<{ data: any[] }>('/v1/beneficiaries');
      
      // Transform backend response to Beneficiary format
      return response.data.map(instrument => ({
        id: instrument.id,
        clientId: instrument.clientId,
        instrumentId: instrument.id,
        alias: instrument.alias,
        name: instrument.instrumentDetail?.holderName || instrument.alias,
        clabe: instrument.instrumentDetail?.clabeNumber || instrument.instrumentDetail?.cardNumber || '',
        bank: beneficiariesService.getBankFromClabe(instrument.instrumentDetail?.clabeNumber || ''),
        rfc: instrument.rfc,
        email: undefined,
        status: instrument.audit?.deletedAt ? 'INACTIVE' : 'ACTIVE',
        instrument,
        audit: instrument.audit,
      }));
    } catch (error) {
      console.error('Error fetching beneficiaries:', error);
      throw error;
    }
  },

  /**
   * Get a specific beneficiary by ID
   */
  async getBeneficiary(id: string): Promise<Beneficiary> {
    try {
      const response = await api.get<{ data: any }>(`/v1/beneficiaries/${id}`);
      const instrument = response.data;
      
      return {
        id: instrument.id,
        clientId: instrument.clientId,
        instrumentId: instrument.id,
        alias: instrument.alias,
        name: instrument.instrumentDetail?.holderName || instrument.alias,
        clabe: instrument.instrumentDetail?.clabeNumber || instrument.instrumentDetail?.cardNumber || '',
        bank: beneficiariesService.getBankFromClabe(instrument.instrumentDetail?.clabeNumber || ''),
        rfc: instrument.rfc,
        status: instrument.audit?.deletedAt ? 'INACTIVE' : 'ACTIVE',
        instrument,
        audit: instrument.audit,
      };
    } catch (error) {
      console.error('Error fetching beneficiary:', error);
      throw error;
    }
  },

  /**
   * Create a new beneficiary
   */
  async createBeneficiary(data: CreateBeneficiaryRequest): Promise<Beneficiary> {
    try {
      const requestBody = {
        alias: data.alias,
        name: data.name,
        clabe: data.clabe,
        rfc: data.rfc || undefined,
      };

      const response = await api.post<{ data: any }>('/v1/beneficiaries', requestBody);
      const instrument = response.data;
      
      return {
        id: instrument.id,
        clientId: instrument.clientId,
        instrumentId: instrument.id,
        alias: instrument.alias,
        name: data.name,
        clabe: data.clabe,
        bank: beneficiariesService.getBankFromClabe(data.clabe),
        rfc: data.rfc,
        status: 'ACTIVE',
        instrument,
        audit: instrument.audit,
      };
    } catch (error) {
      console.error('Error creating beneficiary:', error);
      throw error;
    }
  },

  /**
   * Delete a beneficiary
   */
  async deleteBeneficiary(id: string): Promise<void> {
    try {
      await api.delete(`/v1/beneficiaries/${id}`);
    } catch (error) {
      console.error('Error deleting beneficiary:', error);
      throw error;
    }
  },

  /**
   * Validate a CLABE number
   */
  validateClabe(clabe: string): boolean {
    // CLABE must be 18 digits
    if (!/^\d{18}$/.test(clabe)) {
      return false;
    }
    return true;
  },

  /**
   * Get bank name from CLABE
   * First 3 digits identify the bank
   */
  getBankFromClabe(clabe: string): string {
    if (clabe.length < 3) return 'Desconocido';
    
    const bankCode = clabe.substring(0, 3);
    const bankMap: Record<string, string> = {
      '002': 'Banamex',
      '012': 'BBVA México',
      '014': 'Santander',
      '021': 'HSBC',
      '030': 'Bajío',
      '036': 'Inbursa',
      '042': 'Mifel',
      '044': 'Scotiabank',
      '058': 'BanRegio',
      '062': 'Afirme',
      '072': 'Banorte',
      '127': 'Azteca',
      '130': 'Barclays',
      '131': 'Compartamos',
      '132': 'Banco Famsa',
      '134': 'Multiva',
      '135': 'Actinver',
      '136': 'Walmart',
      '137': 'Bancoppel',
      '138': 'ABC Capital',
      '140': 'Consubanco',
      '143': 'CIBanco',
      '646': 'STP',
      '734': 'Finco/Monato',
    };

    return bankMap[bankCode] || 'Desconocido';
  },
};

// ============================================
// Mock Data (for development/testing)
// ============================================
export const mockBeneficiariesData: Beneficiary[] = [];

export const mockBanksData = [
  { code: '002', name: 'Banamex' },
  { code: '012', name: 'BBVA México' },
  { code: '014', name: 'Santander' },
  { code: '021', name: 'HSBC' },
  { code: '072', name: 'Banorte' },
  { code: '734', name: 'Finco/Monato' },
];
