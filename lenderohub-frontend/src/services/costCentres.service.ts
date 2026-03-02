/**
 * Cost Centres Service (Frontend)
 *
 * Manages Cost Centres (Centros de Costos) via LenderoHUB backend API
 */

import { api, ApiError } from '@/lib/api';

// ============================================
// Types
// ============================================

export interface ContactInfo {
  name?: string;
  lastname?: string;
  secondLastname?: string;
  email?: string;
  phoneNumber?: string;
  phoneNumber2?: string;
  phoneNumbers?: string[];
}

export interface FiscalAddress {
  street?: string;
  exteriorNumber?: string;
  interiorNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface TransactionProfile {
  limitIn: MoneyValue;
  opsIn: number;
  limitOut: MoneyValue;
  opsOut: number;
}

export interface MoneyObject {
  amount: number;
  precision?: number;
  currency?: string;
}

export type MoneyValue = number | MoneyObject;

export interface CostCentreCluster {
  id?: string;
  _id?: string;
  name?: string;
}

export interface CommercialRuleFixed {
  type: 'fixed';
  amount: MoneyValue;
}

export interface CommercialRulePercentage {
  type: 'percentage';
  value: number;
}

export interface CommercialRuleNA {
  type: 'na';
}

export type CommercialRule = CommercialRuleFixed | CommercialRulePercentage | CommercialRuleNA;

export interface CommercialRules {
  in?: CommercialRule;
  out?: CommercialRule;
  monthlyFee?: CommercialRule;
  minimumBalanceNewAccounts?: MoneyValue;
  transactionFee?: MoneyValue;
  maxCashBagsPerSubaccount?: number;
}

export interface CostCentre {
  id: string;
  code: string;
  alias: string;
  shortName: string;
  provider: 'finco' | 'stp';
  clientId: string;
  default: boolean;
  disabled: boolean;

  // Finco Integration
  fincoCustomerId?: string;
  fincoCentralizerAccountId?: string;
  fincoClabeNumber?: string;

  // Contact & Fiscal Data
  contact?: ContactInfo;
  rfc?: string;
  fiscalAddress?: FiscalAddress;

  // Configuration
  transactionProfile?: TransactionProfile;
  commercialRules?: CommercialRules;
  cashManagementEnabled?: boolean;
  cluster?: string | CostCentreCluster;

  // Stats (from backend)
  accountsCount?: number;
  totalBalance?: number;

  // Populated relations (when includeAll=true)
  accounts?: Array<{
    _id: string;
    tag: string;
    alias: string;
    fullNumber?: string;
    balance?: MoneyValue;
    balanceWithheld?: MoneyValue;
  }>;
  commissionAgentAssignments?: Array<{
    _id: string;
    isEnabled: boolean;
    transferInCommissionPercentage: number;
    userProfile?: { fullName?: string; email?: string };
  }>;
  monthlyCharges?: Array<{
    _id: string;
    period: string;
    amount?: MoneyValue;
    status: string;
    createdAt: string;
  }>;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface CostCentreStats {
  totalAccounts: number;
  activeAccounts: number;
  totalBalance: number;
  totalIn: number;
  totalOut: number;
}

export interface CostCentreAccumulators {
  period: string;
  in: { amount: number; count: number };
  out: { amount: number; count: number };
}

export interface CreateCostCentreRequest {
  // Identificación básica
  alias: string;
  shortName: string;
  provider?: 'finco' | 'stp';
  createFincoCustomer?: boolean;

  // Datos de contacto
  contact?: ContactInfo;

  // Datos fiscales
  rfc?: string;
  fiscalAddress?: FiscalAddress;

  // Perfil de transacciones
  transactionProfile?: TransactionProfile;

  // Reglas comerciales
  commercialRules?: CommercialRules;
}

export interface UpdateCostCentreRequest {
  alias?: string;
  shortName?: string;
  contact?: ContactInfo;
  rfc?: string;
  fiscalAddress?: FiscalAddress;
  transactionProfile?: TransactionProfile;
  commercialRules?: CommercialRules;
}

// ============================================
// Service
// ============================================
export const costCentresService = {
  /**
   * Get all cost centres
   */
  async getCostCentres(): Promise<CostCentre[]> {
    try {
      const response = await api.get<{ data: any[] }>('/cost-centres');

      return response.data.map(cc => ({
        id: cc._id || cc.id,
        code: cc.code,
        alias: cc.alias,
        shortName: cc.shortName,
        provider: cc.provider || 'finco',
        clientId: cc.client,
        default: cc.default || false,
        disabled: cc.disabled || false,
        fincoCustomerId: cc.fincoCustomerId,
        fincoCentralizerAccountId: cc.fincoCentralizerAccountId,
        fincoClabeNumber: cc.fincoClabeNumber,
        contact: cc.contact,
        rfc: cc.rfc,
        fiscalAddress: cc.fiscalAddress,
        transactionProfile: cc.transactionProfile,
        commercialRules: cc.commercialRules,
        cashManagementEnabled: cc.cashManagementEnabled,
        cluster: cc.cluster,
        accountsCount: cc.accountsCount || 0,
        totalBalance: cc.totalBalance || 0,
        createdAt: cc.createdAt,
        updatedAt: cc.updatedAt,
      }));
    } catch (error) {
      if (error instanceof ApiError) {
        console.error('Error fetching cost centres:', error.message, { status: error.status, code: error.code });
      } else {
        console.error('Error fetching cost centres:', error);
      }
      throw error;
    }
  },

  /**
   * Get a specific cost centre by ID
   */
  async getCostCentre(id: string): Promise<CostCentre> {
    try {
      const response = await api.get<{ data: any }>(`/cost-centres/${id}?includeAll=true`);
      const cc = response.data;

      return {
        id: cc._id || cc.id,
        code: cc.code,
        alias: cc.alias,
        shortName: cc.shortName,
        provider: cc.provider || 'finco',
        clientId: cc.client,
        default: cc.default || false,
        disabled: cc.disabled || false,
        fincoCustomerId: cc.fincoCustomerId,
        fincoCentralizerAccountId: cc.fincoCentralizerAccountId,
        fincoClabeNumber: cc.fincoClabeNumber,
        contact: cc.contact,
        rfc: cc.rfc,
        fiscalAddress: cc.fiscalAddress,
        transactionProfile: cc.transactionProfile,
        commercialRules: cc.commercialRules,
        cashManagementEnabled: cc.cashManagementEnabled,
        cluster: cc.cluster,
        accountsCount: cc.accountsCount || 0,
        totalBalance: cc.totalBalance || 0,
        accounts: cc.accounts,
        commissionAgentAssignments: cc.commissionAgentAssignments,
        monthlyCharges: cc.monthlyCharges,
        createdAt: cc.createdAt,
        updatedAt: cc.updatedAt,
      };
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : String(error);
      console.error('Error fetching cost centre:', msg);
      throw error;
    }
  },

  /**
   * Get cost centre stats
   */
  async getCostCentreStats(id: string): Promise<CostCentreStats> {
    try {
      const response = await api.get<{ data: CostCentreStats }>(`/cost-centres/${id}/stats`);
      return response.data;
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : String(error);
      console.error('Error fetching cost centre stats:', msg);
      throw error;
    }
  },

  /**
   * Get cost centre accumulators (monthly totals)
   */
  async getCostCentreAccumulators(id: string): Promise<CostCentreAccumulators> {
    try {
      const response = await api.get<{ data: CostCentreAccumulators }>(`/cost-centres/${id}/accumulators`);
      return response.data;
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : String(error);
      console.error('Error fetching cost centre accumulators:', msg);
      throw error;
    }
  },

  /**
   * Create a new cost centre
   */
  async createCostCentre(data: CreateCostCentreRequest): Promise<CostCentre> {
    try {
      const response = await api.post<{ data: any }>('/cost-centres', data);
      const cc = response.data;

      return {
        id: cc._id || cc.id,
        code: cc.code,
        alias: cc.alias,
        shortName: cc.shortName,
        provider: cc.provider || 'finco',
        clientId: cc.client,
        default: cc.default || false,
        disabled: cc.disabled || false,
        fincoCustomerId: cc.fincoCustomerId,
        fincoCentralizerAccountId: cc.fincoCentralizerAccountId,
        fincoClabeNumber: cc.fincoClabeNumber,
        createdAt: cc.createdAt,
        updatedAt: cc.updatedAt,
      };
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : String(error);
      console.error('Error creating cost centre:', msg);
      throw error;
    }
  },

  /**
   * Update a cost centre
   */
  async updateCostCentre(id: string, data: UpdateCostCentreRequest): Promise<CostCentre> {
    try {
      const response = await api.put<{ data: any }>(`/cost-centres/${id}`, data);
      const cc = response.data;

      return {
        id: cc._id || cc.id,
        code: cc.code,
        alias: cc.alias,
        shortName: cc.shortName,
        provider: cc.provider || 'finco',
        clientId: cc.client,
        default: cc.default || false,
        disabled: cc.disabled || false,
        fincoCustomerId: cc.fincoCustomerId,
        fincoCentralizerAccountId: cc.fincoCentralizerAccountId,
        fincoClabeNumber: cc.fincoClabeNumber,
        createdAt: cc.createdAt,
        updatedAt: cc.updatedAt,
      };
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : String(error);
      console.error('Error updating cost centre:', msg);
      throw error;
    }
  },

  /**
   * Disable a cost centre
   */
  async disableCostCentre(id: string): Promise<CostCentre> {
    try {
      const response = await api.post<{ data: any }>(`/cost-centres/${id}/disable`);
      const cc = response.data;

      return {
        id: cc._id || cc.id,
        code: cc.code,
        alias: cc.alias,
        shortName: cc.shortName,
        provider: cc.provider || 'finco',
        clientId: cc.client,
        default: cc.default || false,
        disabled: true,
        fincoCustomerId: cc.fincoCustomerId,
        fincoCentralizerAccountId: cc.fincoCentralizerAccountId,
        fincoClabeNumber: cc.fincoClabeNumber,
        createdAt: cc.createdAt,
        updatedAt: cc.updatedAt,
      };
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : String(error);
      console.error('Error disabling cost centre:', msg);
      throw error;
    }
  },

  /**
   * Enable a cost centre
   */
  async enableCostCentre(id: string): Promise<CostCentre> {
    try {
      const response = await api.post<{ data: any }>(`/cost-centres/${id}/enable`);
      const cc = response.data;

      return {
        id: cc._id || cc.id,
        code: cc.code,
        alias: cc.alias,
        shortName: cc.shortName,
        provider: cc.provider || 'finco',
        clientId: cc.client,
        default: cc.default || false,
        disabled: false,
        fincoCustomerId: cc.fincoCustomerId,
        fincoCentralizerAccountId: cc.fincoCentralizerAccountId,
        fincoClabeNumber: cc.fincoClabeNumber,
        createdAt: cc.createdAt,
        updatedAt: cc.updatedAt,
      };
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : String(error);
      console.error('Error enabling cost centre:', msg);
      throw error;
    }
  },

  /**
   * Set a cost centre as default
   */
  async setDefaultCostCentre(id: string): Promise<CostCentre> {
    try {
      const response = await api.post<{ data: any }>(`/cost-centres/${id}/set-default`);
      const cc = response.data;

      return {
        id: cc._id || cc.id,
        code: cc.code,
        alias: cc.alias,
        shortName: cc.shortName,
        provider: cc.provider || 'finco',
        clientId: cc.client,
        default: true,
        disabled: cc.disabled || false,
        fincoCustomerId: cc.fincoCustomerId,
        fincoCentralizerAccountId: cc.fincoCentralizerAccountId,
        fincoClabeNumber: cc.fincoClabeNumber,
        createdAt: cc.createdAt,
        updatedAt: cc.updatedAt,
      };
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : String(error);
      console.error('Error setting default cost centre:', msg);
      throw error;
    }
  },

  /**
   * Parse Constancia de Situación Fiscal PDF and extract fiscal data
   */
  async parseConstancia(formData: FormData): Promise<{ data: {
    rfc: string;
    contactName: string;
    contactLastname: string;
    contactSecondLastname: string;
    fiscalStreet: string;
    fiscalExteriorNumber: string;
    fiscalNeighborhood: string;
    fiscalCity: string;
    fiscalState: string;
    fiscalPostalCode: string;
  }}> {
    return api.post('/cost-centres/parse-constancia', formData);
  },

  /**
   * Format provider name for display
   */
  getProviderLabel(provider: string): string {
    const providerMap: Record<string, string> = {
      'finco': 'Finco',
      'stp': 'STP',
    };
    return providerMap[provider] || provider;
  },
};
