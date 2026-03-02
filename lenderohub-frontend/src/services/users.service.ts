/**
 * Users Service (Frontend)
 *
 * Handles user management API calls
 */

import { api } from '@/lib/api';

// ============================================
// Types
// ============================================
export type UserProfileType =
  | 'corporate'
  | 'administrator'
  | 'commissionAgent'
  | 'subaccount';

export type CommissionType =
  | 'resico'
  | 'entrepreneurialActivity'
  | 'juridicalPerson';

export interface User {
  id: string;
  _id?: string;
  email: string;
  firstName: string;
  lastName: string;
  secondLastName?: string;
  fullName: string;
  phone?: string;
  profileType: UserProfileType;
  isActive: boolean;
  twoFactorEnabled: boolean;
  readOnly?: boolean;
  clientId?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionDocumentsInput {
  identificationDocumentFile?: File;
  financialStatementFile?: File;
  proofOfAddressFile?: File;
}

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  secondLastName?: string;
  phone?: string;
  profileType: UserProfileType;
  password?: string;
  readOnly?: boolean;
  costCentreIds?: string[];
  costCentreId?: string;
  virtualBagIds?: string[];
  commissionType?: CommissionType;
  rfc?: string;
  commissionTransferOutFee?: number;
  transferInCommissionPercentage?: number;
  commissionDocuments?: CommissionDocumentsInput;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  secondLastName?: string;
  phone?: string;
  profileType?: UserProfileType;
  isActive?: boolean;
  readOnly?: boolean;
}

export interface UsersResponse {
  success: boolean;
  data: User[];
  meta: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

export interface UserResponse {
  success: boolean;
  data: User;
  message?: string;
  emailSent?: boolean;
}

export interface UserStatsResponse {
  success: boolean;
  data: {
    total: number;
    active: number;
    inactive: number;
    byRole: Record<string, number>;
  };
}

export interface RolesResponse {
  success: boolean;
  data: UserProfileType[];
}

export interface ResetPasswordResponse {
  success: boolean;
  data: {
    tempPassword: string;
    warning: string;
  };
}

export interface FindByEmailResponse {
  success: boolean;
  data: User;
}

export interface AssignRoleRequest {
  profileType: UserProfileType;
  reactivate?: boolean;
  readOnly?: boolean;
  costCentreIds?: string[];
  costCentreId?: string;
  virtualBagIds?: string[];
  commissionType?: CommissionType;
  rfc?: string;
  commissionTransferOutFee?: number;
  transferInCommissionPercentage?: number;
  commissionDocuments?: CommissionDocumentsInput;
}

export interface UserFormOptionsResponse {
  success: boolean;
  data: {
    costCentres: {
      id: string;
      alias: string;
      shortName: string;
      code: string;
    }[];
    virtualBags: {
      id: string;
      name: string;
      description?: string;
    }[];
  };
}

// ============================================
// Role Labels
// ============================================
export const ROLE_LABELS: Record<UserProfileType, string> = {
  corporate: 'Corporativo',
  administrator: 'Administrador',
  commissionAgent: 'Comisionista',
  subaccount: 'Subcuentas',
};

export const normalizeUserProfileType = (
  role?: string
): UserProfileType | null => {
  if (!role) return null;
  const value = role.replace(/[\s-_]/g, '').toLowerCase();
  if (value === 'admin' || value === 'administrator' || value === 'administrador') {
    return 'administrator';
  }
  if (value === 'corporate' || value === 'corporativo') {
    return 'corporate';
  }
  if (value === 'commissionagent' || value === 'comisionista') {
    return 'commissionAgent';
  }
  if (
    value === 'subaccount' ||
    value === 'subaccountmanager' ||
    value === 'subcuenta' ||
    value === 'subcuentas'
  ) {
    return 'subaccount';
  }
  return null;
};

export const ROLE_COLORS: Record<UserProfileType, string> = {
  corporate: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  administrator: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  commissionAgent: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  subaccount: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
};

export const COMMISSION_TYPE_LABELS: Record<CommissionType, string> = {
  resico: 'RESICO',
  entrepreneurialActivity: 'Actividad empresarial',
  juridicalPerson: 'Persona moral',
};

export const TRANSFER_IN_COMMISSION_PERCENTAGES = [
  '0.00',
  '0.50',
  '1.00',
  '1.50',
  '2.00',
  '2.50',
];

const toFormData = (data: Record<string, unknown>): FormData => {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value));
      return;
    }
    if (value instanceof File) {
      formData.append(key, value);
      return;
    }
    if (typeof value === 'object') {
      formData.append(key, JSON.stringify(value));
      return;
    }
    formData.append(key, String(value));
  });

  return formData;
};

// ============================================
// Service
// ============================================
export const usersService = {
  /**
   * Get all users with optional filters
   */
  async getUsers(params?: {
    profileType?: UserProfileType;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<UsersResponse> {
    const queryParams: Record<string, string | number | boolean | undefined> = {};
    if (params?.profileType) queryParams.profileType = params.profileType;
    if (params?.isActive !== undefined) queryParams.isActive = params.isActive;
    if (params?.search) queryParams.search = params.search;
    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;

    return api.get<UsersResponse>('/users', queryParams);
  },

  /**
   * Update own profile (PUT /v1/users/me)
   */
  async updateMe(data: { firstName?: string; lastName?: string; secondLastName?: string; phone?: string }): Promise<UserResponse> {
    return api.put<UserResponse>('/users/me', data);
  },

  /**
   * Get a single user by ID
   */
  async getUser(userId: string): Promise<UserResponse> {
    return api.get<UserResponse>(`/users/${userId}`);
  },

  /**
   * Create a new user
   */
  async createUser(data: CreateUserRequest): Promise<UserResponse> {
    const { commissionDocuments, ...rest } = data;
    if (commissionDocuments) {
      const payload = {
        ...rest,
        identificationDocumentFile: commissionDocuments.identificationDocumentFile,
        financialStatementFile: commissionDocuments.financialStatementFile,
        proofOfAddressFile: commissionDocuments.proofOfAddressFile,
      };
      return api.post<UserResponse>('/users', toFormData(payload));
    }
    return api.post<UserResponse>('/users', data);
  },

  /**
   * Update a user
   */
  async updateUser(userId: string, data: UpdateUserRequest): Promise<UserResponse> {
    return api.put<UserResponse>(`/users/${userId}`, data);
  },

  /**
   * Deactivate a user
   */
  async deactivateUser(userId: string): Promise<UserResponse> {
    return api.post<UserResponse>(`/users/${userId}/deactivate`);
  },

  /**
   * Reactivate a user
   */
  async reactivateUser(userId: string): Promise<UserResponse> {
    return api.post<UserResponse>(`/users/${userId}/reactivate`);
  },

  /**
   * Reset user's 2FA
   */
  async reset2FA(userId: string): Promise<UserResponse> {
    return api.post<UserResponse>(`/users/${userId}/reset-2fa`);
  },

  /**
   * Reset user's password
   */
  async resetPassword(userId: string): Promise<ResetPasswordResponse> {
    return api.post<ResetPasswordResponse>(`/users/${userId}/reset-password`);
  },

  /**
   * Get user statistics
   */
  async getStats(): Promise<UserStatsResponse> {
    return api.get<UserStatsResponse>('/users/stats');
  },

  /**
   * Get roles the current user can create
   */
  async getCreatableRoles(): Promise<RolesResponse> {
    return api.get<RolesResponse>('/users/roles', { _ts: Date.now() });
  },

  /**
   * Find user by email (onboarding flow)
   */
  async findByEmail(email: string): Promise<FindByEmailResponse> {
    return api.post<FindByEmailResponse>('/users/find-by-email', { email });
  },

  /**
   * Assign role to existing user
   */
  async assignRole(userId: string, data: AssignRoleRequest): Promise<UserResponse> {
    const { commissionDocuments, ...rest } = data;
    if (commissionDocuments) {
      const payload = {
        ...rest,
        identificationDocumentFile: commissionDocuments.identificationDocumentFile,
        financialStatementFile: commissionDocuments.financialStatementFile,
        proofOfAddressFile: commissionDocuments.proofOfAddressFile,
      };
      return api.post<UserResponse>(`/users/${userId}/assign-role`, toFormData(payload));
    }
    return api.post<UserResponse>(`/users/${userId}/assign-role`, data);
  },

  /**
   * Get form options for user creation
   */
  async getFormOptions(costCentreId?: string): Promise<UserFormOptionsResponse> {
    const params = {
      ...(costCentreId ? { costCentreId } : {}),
      _ts: Date.now(),
    };
    return api.get<UserFormOptionsResponse>('/users/form-options', params);
  },

  /**
   * Resend setup invitation email to user
   */
  async resendInvitation(userId: string): Promise<{ success: boolean; message: string }> {
    return api.post<{ success: boolean; message: string }>('/auth/resend-setup-email', { userId });
  },

  /**
   * Get role label in Spanish
   */
  getRoleLabel(role: UserProfileType): string {
    return ROLE_LABELS[role] || role;
  },

  /**
   * Get role badge color classes
   */
  getRoleColor(role: UserProfileType): string {
    return ROLE_COLORS[role] || ROLE_COLORS.subaccount;
  },
};

export default usersService;
