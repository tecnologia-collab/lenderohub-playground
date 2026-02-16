/**
 * API Types for LenderoHUB
 * 
 * Type definitions matching backend models and Finco API
 */

// ============================================
// Common Types
// ============================================
export type Currency = 'MXN' | 'USD';

export interface Audit {
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  blockedAt?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  currentPage: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: string | number | boolean | undefined;
}

// ============================================
// Account Types
// ============================================
export type AccountType = 'CENTRALIZING_ACCOUNT' | 'PRIVATE_ACCOUNT' | 'BUSINESS_UNIT';
export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'SUSPENDED';

export interface Account {
  id: string;
  bankId: string;
  clientId: string;
  accountNumber: string;
  clabeNumber: string;
  availableBalance: string;
  accountType: AccountType;
  accountStatus: AccountStatus;
  ownerType: 'CLIENT' | 'CUSTOMER';
  ownerId: string;
  instrumentId?: string;
  audit: Audit;
}

export interface AccountBalance {
  accountId: string;
  clabeNumber: string;
  availableBalance: number;
  pendingBalance: number;
  reservedBalance: number;
  totalBalance: number;
  currency: Currency;
  lastUpdated: string;
}

export interface TransferSourceAccount {
  id: string;
  name: string;
  type: 'concentration' | 'subaccount' | 'virtualBag';
  balance: number;
  currency: Currency;
  clabeNumber?: string;
  sourceInstrumentId: string;
  costCentreId?: string;
}

export interface AccountMovement {
  id: string;
  accountId: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  reference: string;
  transactionId?: string;
  createdAt: string;
}

// ============================================
// Transaction Types
// ============================================
export type TransactionType = 'MONEY_IN' | 'MONEY_OUT' | 'INTERNAL';
export type TransactionStatus = 
  | 'INITIALIZED' 
  | 'PENDING' 
  | 'PROCESSING' 
  | 'LIQUIDATED' 
  | 'COMPLETED'
  | 'FAILED' 
  | 'CANCELLED' 
  | 'REFUNDED';

export type TransactionCategory = 'CREDIT_TRANS' | 'DEBIT_TRANS' | 'INTER_TRANS';
export type TransactionSubCategory = 'SPEI_CREDIT' | 'SPEI_DEBIT' | 'INT_CREDIT' | 'INT_DEBIT';

export interface Transaction {
  id: string;
  bankId: string;
  clientId: string;
  externalReference: string;
  trackingId: string;
  description: string;
  amount: string;
  currency: Currency;
  category: TransactionCategory;
  subCategory: TransactionSubCategory;
  transactionStatus: TransactionStatus;
  audit: Audit;
  sourceInstrument?: Instrument;
  destinationInstrument?: Instrument;
  metadata?: TransactionMetadata;
}

export interface TransactionMetadata {
  dataCep?: {
    cepUrl: string;
    validationId: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'DELAYED';
    beneficiaryName?: string;
    beneficiaryRfc?: string;
    processedAt?: string;
  };
}

// For frontend display
export interface TransactionDisplay {
  id: string;
  type: 'in' | 'out' | 'internal';
  description: string;
  amount: number;
  currency: Currency;
  status: 'completed' | 'pending' | 'processing' | 'failed' | 'cancelled';
  date: Date;
  trackingKey?: string;
  beneficiary?: string;
}

// ============================================
// Instrument Types (Finco)
// ============================================
export type InstrumentType = 'SENDER' | 'RECEIVER' | 'SENDER_RECEIVER';

export interface Instrument {
  id: string;
  bankId: string;
  clientId: string;
  ownerId: string;
  alias: string;
  type: InstrumentType;
  rfc: string;
  customerId?: string;
  instrumentDetail: ClabeInstrumentDetail | CardInstrumentDetail;
  audit: Audit;
}

export interface ClabeInstrumentDetail {
  accountNumber: string;
  clabeNumber: string;
  holderName: string;
}

export interface CardInstrumentDetail {
  cardNumber: string;
  expirationDate?: string;
  holderName: string;
}

// ============================================
// Beneficiary Types
// ============================================
export type BeneficiaryType = 'CLABE' | 'DEBIT_CARD';
export type BeneficiaryStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING_VALIDATION';

export interface Beneficiary {
  id: string;
  clientId: string;
  alias: string;
  type?: BeneficiaryType;
  holderName?: string;
  rfc?: string;
  bankId?: string;
  bankName?: string;
  // CLABE details
  clabeNumber?: string;
  // Card details
  cardNumber?: string;
  // Finco instrument reference
  instrumentId?: string;
  status: BeneficiaryStatus;
  // Validation
  isValidated?: boolean;
  validatedAt?: string;
  // Audit
  createdAt?: string;
  updatedAt?: string;
  // Transformed fields (from beneficiariesService)
  name?: string;
  clabe?: string;
  bank?: string;
  instrument?: any;
  audit?: any;
}

export interface CreateBeneficiaryRequest {
  alias: string;
  type: BeneficiaryType;
  holderName: string;
  rfc?: string;
  bankId: string;
  clabeNumber?: string;
  cardNumber?: string;
}

// ============================================
// Transfer Types
// ============================================
export interface MoneyOutRequest {
  sourceInstrumentId: string;
  destinationInstrumentId: string;
  amount: string;
  currency: Currency;
  description: string;
  externalReference: string;
}

export interface MoneyOutResponse {
  id: string;
  trackingId: string;
  transactionStatus: TransactionStatus;
  amount: string;
  currency: Currency;
  audit: Audit;
}

export interface InternalTransferRequest {
  sourceInstrumentId: string;
  destinationInstrumentId: string;
  amount: string;
  currency: Currency;
  description: string;
  externalReference: string;
}

// ============================================
// Webhook Types (Money In)
// ============================================
export interface MoneyInWebhook {
  id_msg: string;
  msg_name: 'MONEY_IN';
  msg_date: string;
  body: MoneyInBody;
}

export interface MoneyInBody {
  id: string;
  beneficiary_account: string;
  beneficiary_name: string;
  beneficiary_rfc: string;
  payer_account: string;
  payer_name: string;
  payer_rfc: string;
  payer_institution: string;
  amount: string;
  transaction_date: string;
  tracking_key: string;
  payment_concept: string;
  numeric_reference: string;
  sub_category: 'SPEI_CREDIT' | 'INT_CREDIT';
  registered_at: string;
  owner_id: string;
}

// ============================================
// Virtual Bag (Bolsa virtual) Types
// ============================================
export interface VirtualBag {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  balance: number;
  currency: Currency;
  color?: string;
  isActive: boolean;
  assignedUsers: string[];
  limits?: {
    dailyLimit?: number;
    monthlyLimit?: number;
    perTransactionLimit?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateVirtualBagRequest {
  name: string;
  description?: string;
  initialBalance?: number;
  color?: string;
  limits?: {
    dailyLimit?: number;
    monthlyLimit?: number;
    perTransactionLimit?: number;
  };
}

export interface VirtualBagTransferRequest {
  fromBagId: string;
  toBagId: string;
  amount: number;
  description?: string;
}

export interface VirtualBagsStats {
  monthlyTransfers: number;
}

// ============================================
// Subaccounts (Finco Real Accounts)
// ============================================
export type SubaccountCategory = 'client' | 'internal';

export interface Subaccount {
  id: string;
  costCentreId: string;
  costCentreAlias?: string;
  name: string;
  tag: string;
  category: SubaccountCategory;
  clabeNumber?: string;
  balance: number;
  currency: Currency;
  fincoAccountId?: string;
  fincoInstrumentId?: string;
  hasVirtualBags: boolean;
  virtualBagsCount?: number;
  distributedPercentage?: number;
}

export interface SubaccountVirtualBag {
  id: string;
  subaccountId: string;
  name: string;
  description?: string;
  balance: number;
  currency: Currency;
  color?: string;
  distributionPercentage: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubaccountVirtualBagRequest {
  name: string;
  description?: string;
  color?: string;
  distributionPercentage?: number;
}

export interface SubaccountVirtualBagTransferRequest {
  fromBagId: string;
  toBagId: string;
  amount: number;
  description?: string;
}

export interface SubaccountTransaction {
  id: string;
  type: 'transfer_in' | 'transfer_out' | 'virtual_in' | 'internal';
  amount: number;
  status: string;
  description: string;
  counterparty?: string;
  createdAt: string;
}

export interface SubaccountTransactionsResponse {
  transactions: SubaccountTransaction[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SubaccountAssignment {
  id: string;
  userProfile: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  permissions: {
    transferFrom: boolean;
    transferTo: boolean;
  };
  isActive: boolean;
  createdAt: string;
}

// ============================================
// User Types
// ============================================
export type UserRole = 'corporate' | 'administrator' | 'subaccount' | 'commissionAgent';
export type UserStatus = 'active' | 'inactive' | 'pending' | 'blocked';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  phone?: string;
  avatarUrl?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Commission Types
// ============================================
export interface Commission {
  id: string;
  name: string;
  type: 'fixed' | 'percentage' | 'tiered';
  value: number;
  minAmount?: number;
  maxAmount?: number;
  includesVat: boolean;
  isActive: boolean;
  appliesTo: 'money_in' | 'money_out' | 'internal' | 'all';
  createdAt: string;
}

// ============================================
// Dashboard Stats Types
// ============================================
export interface DashboardStats {
  totalBalance: number;
  todayIncome: number;
  todayExpense: number;
  todayIncomeChange: number;
  todayExpenseChange: number;
  pendingTransactions: number;
  completedToday: number;
  failedToday: number;
}

export interface MonthlyCountryOperation {
  country: string;
  sent: number;
  received: number;
  inProcess: number;
  validated: string;
}

export interface NationalMetric {
  value: string | number;
  label: string;
  variant?: "default" | "success" | "primary" | "warning";
}

export interface DashboardOperations {
  monthlyOperationsByCountry: MonthlyCountryOperation[];
  nationalMetrics: NationalMetric[];
}

export interface OperationStats {
  daily: {
    pending: number;
    completed: number;
    cancelled: number;
    returned: number;
    rejected: number;
  };
  monthly: {
    total: number;
    amount: number;
  };
}

// ============================================
// Bank Types
// ============================================
export interface Bank {
  id: string;
  code: string;
  name: string;
  shortName?: string;
  isActive: boolean;
}

// ============================================
// Auth Types
// ============================================
export interface LoginRequest {
  email: string;
  password: string;
  totpCode?: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
  expiresAt: string;
}

export interface RefreshTokenResponse {
  token: string;
  expiresAt: string;
}
