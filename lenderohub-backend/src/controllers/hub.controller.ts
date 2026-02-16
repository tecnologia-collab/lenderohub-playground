/**
 * HUB Controller
 * 
 * Handles centralized account operations:
 * - Balance queries (from Finco)
 * - Movement history
 * - Dashboard stats
 */

import { Request, Response, NextFunction } from 'express';
import { FincoClient } from '../integrations/finco/client';
import { AccountMovement } from '../models/accountMovements.model';
import { InternalAccount, InternalAccountTag } from '../models/accounts.model';
import { TransactionTransferIn, TransactionTransferInStatus, TransactionTransferOut, TransactionTransferOutStatus } from '../models/transactions.model';
import { CostCentre } from '../models/providerAccounts.model';
import { fromDinero } from '../database/mongoose-plugins';
import { dayjs } from '../utils/dayjs';
import { balanceSyncService } from '../services/balanceSync/balanceSync.service';

// Initialize Finco client
const finco = new FincoClient({
  apiUrl: process.env.FINCO_API_URL || 'https://apicore.stg.finch.lat',
  clientId: process.env.FINCO_CLIENT_ID || '',
  clientSecret: process.env.FINCO_CLIENT_SECRET || '',
  apiKey: process.env.FINCO_API_KEY || '',
} as any);

// ============================================
// Types
// ============================================
interface DashboardStats {
  totalBalance: number;
  todayIncome: number;
  todayExpense: number;
  todayIncomeChange: number;
  todayExpenseChange: number;
  pendingTransactions: number;
  completedToday: number;
  failedToday: number;
}

interface BalanceHistoryPoint {
  date: string;
  balance: number;
}

// ============================================
// Helpers
// ============================================
function moneyToNumber(value: any): number {
  const cents = fromDinero(value);
  if (cents == null) return 0;
  return cents / 100;
}

async function getHubAccountIds(): Promise<string[]> {
  const hubAccounts = await InternalAccount.find({ tag: InternalAccountTag.Concentration }).select('_id');
  if (hubAccounts.length > 0) {
    return hubAccounts.map((account) => account._id.toString());
  }
  const fallbackAccounts = await InternalAccount.find({}).select('_id');
  return fallbackAccounts.map((account) => account._id.toString());
}

async function getHubTotalBalance(): Promise<number> {
  const accounts = await InternalAccount.find({ tag: InternalAccountTag.Concentration });
  const selectedAccounts = accounts.length > 0 ? accounts : await InternalAccount.find({});
  const totalCents = selectedAccounts.reduce((sum, account) => {
    const balance = fromDinero(account.balance) ?? 0;
    const withheld = fromDinero(account.balanceWithheld) ?? 0;
    return sum + (balance - withheld);
  }, 0);
  return totalCents / 100;
}

async function getAverageBalance(days: number = 30): Promise<number> {
  const totalDays = Math.max(1, days);
  const accountIds = await getHubAccountIds();
  const startDate = dayjs().startOf('day').subtract(totalDays - 1, 'day').toDate();
  const endDate = dayjs().endOf('day').toDate();

  const movements = await AccountMovement.find({
    account: { $in: accountIds },
    transactedAt: { $gte: startDate, $lte: endDate }
  }).sort({ transactedAt: 1 }).lean();

  const dailyDeltas = new Map<string, number>();
  for (const movement of movements) {
    const movementDate = dayjs(movement.transactedAt || movement.createdAt).format('YYYY-MM-DD');
    const delta = moneyToNumber(movement.balanceDelta);
    const signedDelta = movement.balanceOperator === 'subtract' ? -delta : delta;
    dailyDeltas.set(movementDate, (dailyDeltas.get(movementDate) ?? 0) + signedDelta);
  }

  let currentBalance = await getHubTotalBalance();
  let totalBalance = 0;

  for (let i = 0; i < totalDays; i++) {
    const date = dayjs().startOf('day').subtract(i, 'day');
    const key = date.format('YYYY-MM-DD');
    totalBalance += currentBalance;
    currentBalance -= dailyDeltas.get(key) ?? 0;
  }

  return Math.round((totalBalance / totalDays) * 100) / 100;
}

// ============================================
// Controller Functions
// ============================================

/**
 * GET /api/v1/hub/balance
 * Get the centralized account balance from Finco
 */
export async function getHubBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const clientId = process.env.FINCO_CLIENT_ID;
    
    if (!clientId) {
      throw new Error('FINCO_CLIENT_ID not configured');
    }

    // Get accounts from Finco
    const accounts = await finco.getAccounts();
    
    // Find the centralizing account
    const centralizingAccount = accounts.data.find(
      (acc: any) => acc.accountType === 'CENTRALIZING_ACCOUNT'
    );

    if (!centralizingAccount) {
      return res.status(404).json({
        success: false,
        message: 'Centralizing account not found',
      });
    }

    // Calculate pending balance from in-flight transfer-out transactions
    const pendingOutTxs = await TransactionTransferOut.find({
      status: { $in: [TransactionTransferOutStatus.New, TransactionTransferOutStatus.Sent] }
    }).select('amountTotal').lean();

    const pendingBalanceCents = pendingOutTxs.reduce((sum, tx: any) => {
      const amt = tx.amountTotal;
      if (typeof amt === 'number') return sum + amt;
      if (amt && typeof amt.amount === 'number') return sum + amt.amount;
      return sum;
    }, 0);

    // Calculate reserved balance (sum of balanceWithheld across concentration accounts)
    const concentrationAccounts = await InternalAccount.find({ tag: InternalAccountTag.Concentration });
    const reservedBalanceCents = concentrationAccounts.reduce((sum, account) => {
      const withheld = fromDinero(account.balanceWithheld) ?? 0;
      return sum + withheld;
    }, 0);

    const availableBalance = parseFloat(centralizingAccount.availableBalance);

    // Return balance info
    res.json({
      accountId: centralizingAccount.id,
      clabeNumber: centralizingAccount.clabeNumber,
      availableBalance,
      pendingBalance: pendingBalanceCents / 100,
      reservedBalance: reservedBalanceCents / 100,
      totalBalance: availableBalance,
      currency: 'MXN',
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/hub/movements
 * Get account movements history
 */
export async function getHubMovements(req: Request, res: Response, next: NextFunction) {
  try {
    const { page = 1, limit = 20, type, startDate, endDate, accountId } = req.query;

    const accountIds = accountId ? [String(accountId)] : await getHubAccountIds();
    const filter: Record<string, any> = {
      account: { $in: accountIds }
    };

    if (type === 'CREDIT') {
      filter.balanceOperator = 'add';
    }
    if (type === 'DEBIT') {
      filter.balanceOperator = 'subtract';
    }
    if (startDate || endDate) {
      filter.transactedAt = {};
      if (startDate) {
        filter.transactedAt.$gte = new Date(String(startDate));
      }
      if (endDate) {
        filter.transactedAt.$lte = new Date(String(endDate));
      }
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const [totalItems, movements] = await Promise.all([
      AccountMovement.countDocuments(filter),
      AccountMovement.find(filter)
        .sort({ transactedAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .populate('transaction')
        .lean()
    ]);

    const data = movements.map((movement: any) => {
      const amount = moneyToNumber(movement.balanceDelta);
      const balanceBefore = moneyToNumber(movement.balanceBefore);
      const balanceAfter = movement.balanceOperator === 'subtract'
        ? balanceBefore - amount
        : balanceBefore + amount;
      const transaction = movement.transaction as any;

      return {
        id: movement._id?.toString(),
        accountId: movement.account?.toString(),
        type: movement.balanceOperator === 'subtract' ? 'DEBIT' : 'CREDIT',
        amount,
        balanceBefore,
        balanceAfter,
        description: movement.comment || transaction?.description || 'Movimiento de cuenta',
        reference: transaction?.reference || transaction?.trackingCode || '',
        transactionId: transaction?._id?.toString(),
        createdAt: (movement.transactedAt || movement.createdAt)?.toISOString()
      };
    });

    res.json({
      data,
      currentPage: pageNumber,
      perPage: limitNumber,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limitNumber)),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/hub/balance-history
 * Get balance history for charts
 */
export async function getBalanceHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { days = 7 } = req.query;
    const totalDays = Math.max(1, Number(days));
    const accountIds = await getHubAccountIds();

    const startDate = dayjs().startOf('day').subtract(totalDays - 1, 'day').toDate();
    const endDate = dayjs().endOf('day').toDate();

    const movements = await AccountMovement.find({
      account: { $in: accountIds },
      transactedAt: { $gte: startDate, $lte: endDate }
    }).sort({ transactedAt: 1 }).lean();

    const dailyDeltas = new Map<string, number>();
    for (const movement of movements) {
      const movementDate = dayjs(movement.transactedAt || movement.createdAt).format('YYYY-MM-DD');
      const delta = moneyToNumber(movement.balanceDelta);
      const signedDelta = movement.balanceOperator === 'subtract' ? -delta : delta;
      dailyDeltas.set(movementDate, (dailyDeltas.get(movementDate) ?? 0) + signedDelta);
    }

    let currentBalance = await getHubTotalBalance();
    const balancesByDay = new Map<string, number>();

    for (let i = 0; i < totalDays; i++) {
      const date = dayjs().startOf('day').subtract(i, 'day');
      const key = date.format('YYYY-MM-DD');
      balancesByDay.set(key, currentBalance);
      currentBalance -= dailyDeltas.get(key) ?? 0;
    }

    const history: BalanceHistoryPoint[] = [];
    for (let i = totalDays - 1; i >= 0; i--) {
      const date = dayjs().startOf('day').subtract(i, 'day');
      const key = date.format('YYYY-MM-DD');
      const balance = balancesByDay.get(key) ?? 0;
      history.push({
        date: date.toDate().toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }),
        balance: Math.round(balance * 100) / 100
      });
    }

    res.json(history);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/dashboard/stats
 * Get dashboard statistics
 */
export async function getDashboardStats(req: Request, res: Response, next: NextFunction) {
  try {
    const accountIds = await getHubAccountIds();
    const todayStart = dayjs().startOf('day').toDate();
    const todayEnd = dayjs().endOf('day').toDate();
    const yesterdayStart = dayjs().subtract(1, 'day').startOf('day').toDate();
    const yesterdayEnd = dayjs().subtract(1, 'day').endOf('day').toDate();

    const [totalBalance, todayMovements, yesterdayMovements, pendingOut, pendingIn, completedOut, completedIn, failedOut, failedIn] = await Promise.all([
      getHubTotalBalance(),
      AccountMovement.find({
        account: { $in: accountIds },
        transactedAt: { $gte: todayStart, $lte: todayEnd }
      }).lean(),
      AccountMovement.find({
        account: { $in: accountIds },
        transactedAt: { $gte: yesterdayStart, $lte: yesterdayEnd }
      }).lean(),
      TransactionTransferOut.countDocuments({ status: { $in: [TransactionTransferOutStatus.New, TransactionTransferOutStatus.Sent] } }),
      TransactionTransferIn.countDocuments({ status: { $in: [TransactionTransferInStatus.New] } }),
      TransactionTransferOut.countDocuments({ status: TransactionTransferOutStatus.Liquidated, createdAt: { $gte: todayStart, $lte: todayEnd } }),
      TransactionTransferIn.countDocuments({ status: TransactionTransferInStatus.Liquidated, createdAt: { $gte: todayStart, $lte: todayEnd } }),
      TransactionTransferOut.countDocuments({ status: { $in: [TransactionTransferOutStatus.Failed, TransactionTransferOutStatus.Cancelled, TransactionTransferOutStatus.Refunded] }, createdAt: { $gte: todayStart, $lte: todayEnd } }),
      TransactionTransferIn.countDocuments({ status: { $in: [TransactionTransferInStatus.Rejected] }, createdAt: { $gte: todayStart, $lte: todayEnd } })
    ]);

    const todayIncome = todayMovements.reduce((sum, movement: any) => {
      if (movement.balanceOperator !== 'add') return sum;
      return sum + moneyToNumber(movement.balanceDelta);
    }, 0);
    const todayExpense = todayMovements.reduce((sum, movement: any) => {
      if (movement.balanceOperator !== 'subtract') return sum;
      return sum + moneyToNumber(movement.balanceDelta);
    }, 0);

    const yesterdayIncome = yesterdayMovements.reduce((sum, movement: any) => {
      if (movement.balanceOperator !== 'add') return sum;
      return sum + moneyToNumber(movement.balanceDelta);
    }, 0);
    const yesterdayExpense = yesterdayMovements.reduce((sum, movement: any) => {
      if (movement.balanceOperator !== 'subtract') return sum;
      return sum + moneyToNumber(movement.balanceDelta);
    }, 0);

    const todayIncomeChange = yesterdayIncome === 0 ? 0 : ((todayIncome - yesterdayIncome) / yesterdayIncome) * 100;
    const todayExpenseChange = yesterdayExpense === 0 ? 0 : ((todayExpense - yesterdayExpense) / yesterdayExpense) * 100;

    const stats: DashboardStats = {
      totalBalance,
      todayIncome: Math.round(todayIncome * 100) / 100,
      todayExpense: Math.round(todayExpense * 100) / 100,
      todayIncomeChange: Math.round(todayIncomeChange * 10) / 10,
      todayExpenseChange: Math.round(todayExpenseChange * 10) / 10,
      pendingTransactions: pendingOut + pendingIn,
      completedToday: completedOut + completedIn,
      failedToday: failedOut + failedIn
    };

    res.json(stats);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/dashboard/operations
 * Get monthly operations and national metrics
 */
export async function getDashboardOperations(req: Request, res: Response, next: NextFunction) {
  try {
    const monthStart = dayjs().startOf('month').toDate();
    const monthEnd = dayjs().endOf('month').toDate();

    const [
      speiInCount,
      speiOutCount,
      pendingOutCount,
      liquidatedInCount,
      averageBalance,
      currentBalance,
      newCostCentres,
    ] = await Promise.all([
      TransactionTransferIn.countDocuments({ createdAt: { $gte: monthStart, $lte: monthEnd } }),
      TransactionTransferOut.countDocuments({ createdAt: { $gte: monthStart, $lte: monthEnd } }),
      TransactionTransferOut.countDocuments({ status: { $in: [TransactionTransferOutStatus.New, TransactionTransferOutStatus.Sent] } }),
      TransactionTransferIn.countDocuments({ status: TransactionTransferInStatus.Liquidated, createdAt: { $gte: monthStart, $lte: monthEnd } }),
      getAverageBalance(30),
      getHubTotalBalance(),
      CostCentre.countDocuments({ createdAt: { $gte: monthStart, $lte: monthEnd } })
    ]);

    const monthlyOperationsByCountry = [
      {
        country: 'MEXICO',
        sent: speiOutCount,
        received: speiInCount,
        inProcess: pendingOutCount,
        validated: `${liquidatedInCount}/${speiInCount}`
      }
    ];

    const nationalMetrics = [
      { value: speiInCount, label: "#SPEI IN", variant: "success" as const },
      { value: speiOutCount, label: "#SPEI OUT", variant: "default" as const },
      { value: `$${averageBalance.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`, label: "SALDO PROMEDIO", variant: "default" as const },
      { value: `$${currentBalance.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`, label: "SALDO PUNTUAL", variant: "primary" as const },
      { value: newCostCentres, label: "#CLIENTES NUEVOS", variant: "default" as const }
    ];

    res.json({
      monthlyOperationsByCountry,
      nationalMetrics
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/hub/sync
 * Sync balance with Finco (manual reconciliation)
 */
export async function syncHubBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const clientId = process.env.FINCO_CLIENT_ID;

    if (!clientId) {
      throw new Error('FINCO_CLIENT_ID not configured');
    }

    // Force refresh from Finco
    const accounts = await finco.getAccounts();

    const centralizingAccount = accounts.data.find(
      (acc: any) => acc.accountType === 'CENTRALIZING_ACCOUNT'
    );

    if (!centralizingAccount) {
      return res.status(404).json({
        success: false,
        message: 'Centralizing account not found',
      });
    }

    // Update local balance in MongoDB: find InternalAccount by fincoAccountId
    const fincoBalancePesos = parseFloat(centralizingAccount.availableBalance);
    const fincoBalanceCents = Math.round(fincoBalancePesos * 100);

    const localAccount = await InternalAccount.findOne({
      fincoAccountId: centralizingAccount.id,
    });

    let localUpdated = false;
    if (localAccount) {
      const previousBalance = fromDinero(localAccount.balance) ?? 0;
      localAccount.balance = {
        amount: fincoBalanceCents,
        precision: 2,
        currency: 'MXN',
      } as any;
      localAccount.markModified('balance');
      await localAccount.save();
      localUpdated = true;

      if (previousBalance !== fincoBalanceCents) {
        console.log(
          `[SyncHubBalance] Updated account ${localAccount._id}: ` +
          `${previousBalance} -> ${fincoBalanceCents} cents`
        );
      }
    }

    res.json({
      success: true,
      accountId: centralizingAccount.id,
      clabeNumber: centralizingAccount.clabeNumber,
      availableBalance: fincoBalancePesos,
      currency: 'MXN',
      lastUpdated: new Date().toISOString(),
      localUpdated,
      message: 'Balance synchronized successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/hub/sync-balances
 * Sync balances for ALL InternalAccounts that have a fincoAccountId
 */
export async function syncAllBalances(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await balanceSyncService.syncAllBalances();

    res.json({
      success: true,
      synced: result.synced,
      errors: result.errors,
      details: result.details,
      message: `Balance sync complete: ${result.synced} synced, ${result.errors.length} errors`,
    });
  } catch (error) {
    next(error);
  }
}

// ============================================
// Banks Cache (in-memory, 24h TTL)
// ============================================
let banksCache: { data: any[]; total: number; timestamp: number } | null = null;
const BANKS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * GET /api/v1/banks
 * Get the SPEI bank catalog from Finco (cached for 24h)
 */
export async function getBanks(req: Request, res: Response, next: NextFunction) {
  try {
    // Return cached data if still valid
    if (banksCache && Date.now() - banksCache.timestamp < BANKS_CACHE_TTL) {
      return res.json({
        success: true,
        data: banksCache.data,
        total: banksCache.total,
        cached: true,
      });
    }

    // Fetch from Finco
    const result = await finco.getBanks();
    const banks = result.banks || [];
    const total = result.total_banks || banks.length;

    // Update cache
    banksCache = {
      data: banks,
      total,
      timestamp: Date.now(),
    };

    res.json({
      success: true,
      data: banks,
      total,
      cached: false,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getHubBalance,
  getHubMovements,
  getBalanceHistory,
  getDashboardStats,
  getDashboardOperations,
  syncHubBalance,
  syncAllBalances,
  getBanks,
};
