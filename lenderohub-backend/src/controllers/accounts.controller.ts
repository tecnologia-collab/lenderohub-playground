import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { CostCentre } from '../models/providerAccounts.model';
import { VirtualBagAccount, InternalAccount, InternalAccountTag } from '../models/accounts.model';
import { fromDinero } from '../database/mongoose-plugins';
import { FincoClient } from '../integrations/finco/client';

function getAvailableBalance(account: any): number {
  const balance = fromDinero(account.balance) ?? 0;
  const withheld = fromDinero(account.balanceWithheld) ?? 0;
  return (balance - withheld) / 100;
}

const fincoClient = new FincoClient({
  apiUrl: process.env.FINCO_API_URL || 'https://apicore.stg.finch.lat',
  clientId: process.env.FINCO_CLIENT_ID || '',
  clientSecret: process.env.FINCO_CLIENT_SECRET || '',
  apiKey: process.env.FINCO_API_KEY || '',
  environment: (process.env.FINCO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox'
});

type FincoAccountSummary = {
  id?: string;
  clabe?: string;
  available?: number;
};

async function getFincoAccountsSummary(): Promise<FincoAccountSummary[]> {
  if (!process.env.FINCO_CLIENT_ID) {
    return [];
  }

  try {
    const response = await fincoClient.getAccounts();
    const accounts = response?.data || response?.accounts || [];
    return accounts.map((account: any) => ({
      id: account.id,
      clabe: account.clabeNumber || account.clabe_number || account.clabe,
      available: Number(
        account.availableBalance ??
          account.available_balance ??
          account.balance?.available ??
          account.balance?.availableBalance ??
          account.balance?.available_balance
      )
    }));
  } catch (error: any) {
    console.warn('⚠️ Finco accounts unavailable:', error?.message || error);
    return [];
  }
}

function buildFincoLookup(accounts: FincoAccountSummary[]) {
  const byId = new Map<string, number>();
  const byClabe = new Map<string, number>();
  for (const account of accounts) {
    if (account.id && Number.isFinite(account.available ?? NaN)) {
      byId.set(account.id, account.available as number);
    }
    if (account.clabe && Number.isFinite(account.available ?? NaN)) {
      byClabe.set(account.clabe, account.available as number);
    }
  }
  return { byId, byClabe };
}

export const accountsController = {
  /**
   * GET /api/v1/accounts/transfer-sources
   * Accounts available as source for Money Out
   */
  async getTransferSources(req: AuthRequest, res: Response) {
    try {
      const clientId = req.user?.clientId?.toString();
      const profileType = req.user?.profileType;
      if (!clientId) {
        return res.status(400).json({
          success: false,
          error: 'Missing client association',
          message: 'User is not associated with a client'
        });
      }

      const baseFilter: Record<string, any> = { client: clientId, disabled: { $ne: true } };
      const shouldUseMatrizOnly = profileType === 'corporate';
      if (shouldUseMatrizOnly) {
        baseFilter.default = true;
      }

      let costCentres = await CostCentre.find(baseFilter)
        .select('_id alias fincoCentralizerInstrumentId fincoCentralizerAccountId fincoClabeNumber default')
        .lean();

      if (shouldUseMatrizOnly && costCentres.length === 0) {
        costCentres = await CostCentre.find({ client: clientId, disabled: { $ne: true } })
          .select('_id alias fincoCentralizerInstrumentId fincoCentralizerAccountId fincoClabeNumber default')
          .lean();
        if (costCentres.length > 0) {
          costCentres = [costCentres[0]];
        }
      }

      const costCentreIds = costCentres.map((cc) => cc._id);

      const [concentrationAccounts, regularAccounts, virtualBags, fincoAccounts] = await Promise.all([
        InternalAccount.find({
          costCentre: { $in: costCentreIds },
          tag: InternalAccountTag.Concentration
        }).lean(),
        InternalAccount.find({
          costCentre: { $in: costCentreIds },
          tag: InternalAccountTag.Regular
        }).lean(),
        VirtualBagAccount.find({ costCentre: { $in: costCentreIds } })
          .populate('parentAccount')
          .lean(),
        getFincoAccountsSummary()
      ]);
      const fincoLookup = buildFincoLookup(fincoAccounts);

      const concentrationSources = await Promise.all(
        concentrationAccounts.map(async (account: any) => {
          const costCentre = costCentres.find((cc) => cc._id.toString() === account.costCentre.toString());
          const fincoAccountId = account.fincoAccountId || costCentre?.fincoCentralizerAccountId;
          const clabeNumber = account.fullNumber || costCentre?.fincoClabeNumber || '';
          const fincoAvailable =
            (fincoAccountId && fincoLookup.byId.get(fincoAccountId)) ||
            (clabeNumber && fincoLookup.byClabe.get(clabeNumber)) ||
            null;
          const withheldCents = fromDinero(account.balanceWithheld) ?? 0;
          const balance = fincoAvailable != null
            ? Math.max(0, fincoAvailable - withheldCents / 100)
            : getAvailableBalance(account);

          return {
            id: account._id.toString(),
            name: costCentre ? `Concentradora · ${costCentre.alias}` : account.alias || 'Concentradora',
            type: 'concentration',
            balance,
            currency: 'MXN',
            clabeNumber,
            sourceInstrumentId: account.fincoInstrumentId || costCentre?.fincoCentralizerInstrumentId || process.env.FINCO_INSTRUMENT_ID || '',
            costCentreId: account.costCentre?.toString()
          };
        })
      );

      const regularSources = await Promise.all(
        regularAccounts.map(async (account: any) => {
          const costCentre = costCentres.find((cc) => cc._id.toString() === account.costCentre.toString());
          const clabeNumber = account.fullNumber || costCentre?.fincoClabeNumber || '';
          const fincoAvailable =
            (account.fincoAccountId && fincoLookup.byId.get(account.fincoAccountId)) ||
            (clabeNumber && fincoLookup.byClabe.get(clabeNumber)) ||
            null;
          const withheldCents = fromDinero(account.balanceWithheld) ?? 0;
          const balance = fincoAvailable != null
            ? Math.max(0, fincoAvailable - withheldCents / 100)
            : getAvailableBalance(account);

          return {
            id: account._id.toString(),
            name: account.alias || 'Subcuenta',
            type: 'subaccount',
            balance,
            currency: 'MXN',
            clabeNumber,
            sourceInstrumentId: account.fincoInstrumentId || costCentre?.fincoCentralizerInstrumentId || process.env.FINCO_INSTRUMENT_ID || '',
            costCentreId: account.costCentre?.toString()
          };
        })
      );

      const virtualBagSources = virtualBags.map((bag: any) => {
        const parentAccount = bag.parentAccount as any;
        const costCentre = costCentres.find((cc) => cc._id.toString() === bag.costCentre.toString());
        return {
          id: bag._id.toString(),
          name: bag.alias || 'Subcuenta',
          type: 'virtualBag',
          balance: getAvailableBalance(bag),
          currency: 'MXN',
          clabeNumber: parentAccount?.fullNumber || costCentre?.fincoClabeNumber || '',
          sourceInstrumentId: parentAccount?.fincoInstrumentId || costCentre?.fincoCentralizerInstrumentId || process.env.FINCO_INSTRUMENT_ID || '',
          costCentreId: bag.costCentre?.toString()
        };
      });

      const sources = [...concentrationSources, ...regularSources, ...virtualBagSources];

      return res.json({
        success: true,
        data: sources
      });
    } catch (error: any) {
      console.error('❌ Error fetching transfer sources:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch transfer sources',
        message: error.message
      });
    }
  }
};
