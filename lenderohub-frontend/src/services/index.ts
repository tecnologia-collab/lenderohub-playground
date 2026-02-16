/**
 * Services Index
 *
 * Central export for all API services
 */

// Services
export { accountsService, mockAccountsData } from './accounts.service';
export { transfersService, mockTransactionsData, toDisplayTransaction } from './transfers.service';
export { beneficiariesService, mockBeneficiariesData, mockBanksData } from './beneficiaries.service';
export { virtualBagsService, mockVirtualBagsData } from './cashBags.service';
export { subaccountsService } from './subaccounts.service';
export { costCentresService } from './costCentres.service';
export { commissionsService } from './commissions.service';
export { twoFactorService } from './twoFactor.service';
export { reportsService } from './reports.service';
export { notificationsService } from './notifications.service';

// Re-export types
export type { GetMovementsParams, BalanceHistoryPoint } from './accounts.service';
export type { GetTransactionsParams, MoneyOutRequest, MoneyOutResponse } from './transfers.service';
export type { CreateBeneficiaryRequest, UpdateBeneficiaryRequest } from './beneficiaries.service';
export type { GetVirtualBagsParams, VirtualBagTransferResult, VirtualBagMovement } from './cashBags.service';
export type { CreateSubaccountRequest } from './subaccounts.service';
export type { CostCentre, CostCentreStats, CreateCostCentreRequest, UpdateCostCentreRequest } from './costCentres.service';
export type {
  CommissionAccount,
  CommissionAccountTag,
  CommissionCostCentre,
  CommissionTransfer,
  CommissionCollectionItem,
  CommissionDashboardResponse,
  CommissionTransfersResponse,
  CommissionCollectionResponse,
  GetTransfersParams,
} from './commissions.service';
export type { TwoFactorStatus, TwoFactorSetup, TwoFactorEnableResponse } from './twoFactor.service';
export type {
  ReportTransaction,
  ReportTransactionsResponse,
  ReportSummary,
  ReportCommission,
  ReportCommissionsResponse,
  ReportTransactionsParams,
  ReportSummaryParams,
  ReportCommissionsParams,
} from './reports.service';
export type { AppNotification, NotificationsResponse, UnreadCountResponse } from './notifications.service';
