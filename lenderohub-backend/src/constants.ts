// src/constants.ts

export const TRANSACTION_TYPES = {
  TRANSFER_IN: 'transferIn',
  TRANSFER_OUT: 'transferOut',
  TRANSFER_BETWEEN: 'transferBetween',
  COMMISSION: 'commission',
  MONTHLY_CHARGE: 'monthlyCharge'
} as const;

export const ACCOUNT_TYPES = {
  PROVIDER: 'provider',
  VIRTUAL: 'virtual',
  COMMISSION: 'commission',
  CASH_BAG: 'cashBag'
} as const;

export const USER_PROFILE_TYPES = {
  CORPORATE: 'corporate',
  ADMINISTRATOR: 'administrator',
  SUBACCOUNT: 'subaccount',
  COMMISSION_AGENT: 'commissionAgent',
  SYSTEM: 'system'
} as const;

export const PROVIDERS = {
  FINCO: 'finco',
  STP: 'stp'
} as const;

export const CURRENCIES = {
  MXN: 'MXN',
  USD: 'USD'
} as const;

export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected'
} as const;

export const COMMISSION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PAID: 'paid'
} as const;

// Default comisión SPEI OUT (LenderoPay)
export const DEFAULT_TRANSACTION_FEE = 4.5;
// Bank codes for SPEI (Mexico)
export const bankCodeToName: Record<string, string> = {
  '002': 'BANAMEX',
  '012': 'BBVA BANCOMER',
  '014': 'SANTANDER',
  '021': 'HSBC',
  '030': 'BAJIO',
  '036': 'INBURSA',
  '044': 'SCOTIABANK',
  '058': 'BANREGIO',
  '072': 'BANORTE',
  '127': 'AZTECA',
  '137': 'BANCOPPEL',
  '646': 'STP',
  '722': 'MERCADOPAGO',
  '734': 'MONATO',
}

export const bankCodeToInstitution: Record<string, string> = {
  '002': '40002',
  '012': '40012',
  '014': '40014',
  '021': '40021',
  '030': '40030',
  '036': '40036',
  '044': '40044',
  '058': '40058',
  '072': '40072',
  '127': '40127',
  '137': '40137',
  '646': '90646',
  '722': '90722',
  '734': '90734',
}
