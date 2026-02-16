/**
 * Reconciliation Service
 *
 * Compares local balances (MongoDB) with Finco API balances and reports discrepancies.
 * Reuses the FincoClient from integrations/finco/client to avoid duplicating API calls.
 */

import { FincoClient } from '../../integrations/finco/client';
import { InternalAccount } from '../../models/accounts.model';
import { fromDinero } from '../../database/mongoose-plugins';

// ============================================
// Types
// ============================================

export interface ReconciliationAccountEntry {
  accountId: string;
  alias: string;
  fincoAccountId: string;
  localBalanceCents: number;
  fincoBalanceCents: number;
  differenceCents: number;
  isDiscrepant: boolean;
}

export interface ReconciliationReport {
  accounts: ReconciliationAccountEntry[];
  totalAccounts: number;
  discrepancies: number;
  lastRun: string;
  thresholdCents: number;
  errors: string[];
}

// ============================================
// Module-level state (last report in memory)
// ============================================

let lastReport: ReconciliationReport | null = null;

// ============================================
// Helpers
// ============================================

function getFincoClient(): FincoClient {
  return new FincoClient({
    apiUrl: process.env.FINCO_API_URL || 'https://apicore.stg.finch.lat',
    clientId: process.env.FINCO_CLIENT_ID || '',
    clientSecret: process.env.FINCO_CLIENT_SECRET || '',
    apiKey: process.env.FINCO_API_KEY || '',
    environment: (process.env.FINCO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
  });
}

/**
 * Convert a Finco balance (pesos as decimal, e.g. 1000.50) to cents (integer, e.g. 100050).
 * Uses Math.round to avoid floating-point precision issues.
 */
function pesosToCents(pesos: number): number {
  return Math.round(pesos * 100);
}

// ============================================
// Service
// ============================================

class ReconciliationService {
  /**
   * Run a full reconciliation: compare local MongoDB balances with Finco API balances.
   *
   * @param thresholdCents - Minimum difference (in centavos) to flag as discrepancy. Default: 100 ($1.00 MXN)
   * @returns ReconciliationReport with per-account details and summary
   */
  async run(thresholdCents: number = 100): Promise<ReconciliationReport> {
    const fincoClient = getFincoClient();

    const report: ReconciliationReport = {
      accounts: [],
      totalAccounts: 0,
      discrepancies: 0,
      lastRun: new Date().toISOString(),
      thresholdCents,
      errors: [],
    };

    // Find all InternalAccounts that have a fincoAccountId set
    const accounts = await InternalAccount.find({
      fincoAccountId: { $exists: true, $nin: [null, ''] },
    });

    report.totalAccounts = accounts.length;
    console.log(`[Reconciliation] Found ${accounts.length} accounts with fincoAccountId`);

    for (const account of accounts) {
      const fincoAccountId = (account as any).fincoAccountId as string;
      const accountId = account._id.toString();
      const alias = account.alias || accountId;

      try {
        // Fetch balance from Finco (reuses same pattern as balanceSync)
        const fincoBalance = await fincoClient.getAccountBalance(fincoAccountId);
        const fincoBalanceCents = pesosToCents(fincoBalance.available);
        const localBalanceCents = fromDinero(account.balance) ?? 0;
        const differenceCents = Math.abs(localBalanceCents - fincoBalanceCents);
        const isDiscrepant = differenceCents > thresholdCents;

        if (isDiscrepant) {
          console.log(
            `[Reconciliation] DISCREPANCY for account ${accountId} (${alias}): ` +
            `local=${localBalanceCents} cents, finco=${fincoBalanceCents} cents, ` +
            `diff=${differenceCents} cents (threshold=${thresholdCents})`
          );
        }

        report.accounts.push({
          accountId,
          alias,
          fincoAccountId,
          localBalanceCents,
          fincoBalanceCents,
          differenceCents,
          isDiscrepant,
        });

        if (isDiscrepant) {
          report.discrepancies++;
        }
      } catch (error: any) {
        const errorMsg = `Account ${accountId} (${alias}, finco: ${fincoAccountId}): ${error.message}`;
        console.error(`[Reconciliation] Error: ${errorMsg}`);
        report.errors.push(errorMsg);
      }
    }

    console.log(
      `[Reconciliation] Complete: ${report.totalAccounts} accounts checked, ` +
      `${report.discrepancies} discrepancies, ${report.errors.length} errors`
    );

    // Store as last report
    lastReport = report;

    return report;
  }

  /**
   * Get the last reconciliation report (stored in memory).
   * Returns null if no reconciliation has been run yet.
   */
  getLastReport(): ReconciliationReport | null {
    return lastReport;
  }
}

export const reconciliationService = new ReconciliationService();
export default reconciliationService;
