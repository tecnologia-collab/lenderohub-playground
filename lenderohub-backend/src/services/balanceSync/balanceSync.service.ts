/**
 * Balance Sync Service
 *
 * Synchronizes account balances from Finco to local MongoDB.
 * Converts Finco balances (pesos as decimal) to Dinero format (cents integer).
 */

import { FincoClient } from '../../integrations/finco/client';
import { InternalAccount } from '../../models/accounts.model';
import { fromDinero } from '../../database/mongoose-plugins';

interface SyncResult {
  synced: number;
  errors: string[];
  details: Array<{
    accountId: string;
    fincoAccountId: string;
    previousBalanceCents: number;
    newBalanceCents: number;
    discrepancy: boolean;
  }>;
}

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

class BalanceSyncService {
  /**
   * Sync balance for a specific InternalAccount by its MongoDB _id.
   * Fetches the balance from Finco and updates the local record.
   *
   * @returns true if sync succeeded, false otherwise
   */
  async syncAccountBalance(accountId: string): Promise<boolean> {
    const fincoClient = getFincoClient();

    const account = await InternalAccount.findById(accountId);
    if (!account) {
      console.error(`[BalanceSync] Account not found: ${accountId}`);
      return false;
    }

    const fincoAccountId = (account as any).fincoAccountId;
    if (!fincoAccountId) {
      console.error(`[BalanceSync] Account ${accountId} has no fincoAccountId`);
      return false;
    }

    try {
      const fincoBalance = await fincoClient.getAccountBalance(fincoAccountId);
      const newBalanceCents = pesosToCents(fincoBalance.available);
      const previousBalanceCents = fromDinero(account.balance) ?? 0;

      if (previousBalanceCents !== newBalanceCents) {
        console.log(
          `[BalanceSync] Discrepancy for account ${accountId}: ` +
          `local=${previousBalanceCents} cents, finco=${newBalanceCents} cents ` +
          `(diff=${newBalanceCents - previousBalanceCents} cents)`
        );
      }

      // Update balance in Dinero format
      account.balance = {
        amount: newBalanceCents,
        precision: 2,
        currency: 'MXN',
      } as any;
      account.markModified('balance');
      await account.save();

      return true;
    } catch (error: any) {
      console.error(`[BalanceSync] Error syncing account ${accountId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Sync balances for ALL InternalAccounts that have a fincoAccountId.
   * Iterates through each account and updates its balance from Finco.
   *
   * @returns Summary with count of synced accounts, errors, and details per account
   */
  async syncAllBalances(): Promise<SyncResult> {
    const fincoClient = getFincoClient();
    const result: SyncResult = {
      synced: 0,
      errors: [],
      details: [],
    };

    // Find all accounts that have a fincoAccountId set (not null, not empty)
    const accounts = await InternalAccount.find({
      fincoAccountId: { $exists: true, $nin: [null, ''] },
    });

    console.log(`[BalanceSync] Found ${accounts.length} accounts with fincoAccountId`);

    for (const account of accounts) {
      const fincoAccountId = (account as any).fincoAccountId;
      const accountId = account._id.toString();

      try {
        const fincoBalance = await fincoClient.getAccountBalance(fincoAccountId);
        const newBalanceCents = pesosToCents(fincoBalance.available);
        const previousBalanceCents = fromDinero(account.balance) ?? 0;
        const discrepancy = previousBalanceCents !== newBalanceCents;

        if (discrepancy) {
          console.log(
            `[BalanceSync] Discrepancy for account ${accountId} (finco: ${fincoAccountId}): ` +
            `local=${previousBalanceCents} cents, finco=${newBalanceCents} cents ` +
            `(diff=${newBalanceCents - previousBalanceCents} cents)`
          );
        }

        // Update balance in Dinero format
        account.balance = {
          amount: newBalanceCents,
          precision: 2,
          currency: 'MXN',
        } as any;
        account.markModified('balance');
        await account.save();

        result.synced++;
        result.details.push({
          accountId,
          fincoAccountId,
          previousBalanceCents,
          newBalanceCents,
          discrepancy,
        });
      } catch (error: any) {
        const errorMsg = `Account ${accountId} (finco: ${fincoAccountId}): ${error.message}`;
        console.error(`[BalanceSync] Error: ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    console.log(
      `[BalanceSync] Sync complete: ${result.synced} synced, ${result.errors.length} errors`
    );

    return result;
  }
}

export const balanceSyncService = new BalanceSyncService();
export default balanceSyncService;
