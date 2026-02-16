/**
 * Reports Controller
 *
 * Provides reporting endpoints for transactions, summaries, commissions and CSV export.
 */

import { Response, NextFunction } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'

import { AuthRequest } from '../middlewares/auth.middleware'
import { AccountMovement } from '../models/accountMovements.model'
import { InternalAccount } from '../models/accounts.model'
import { CostCentre } from '../models/providerAccounts.model'
import {
  TransactionTransferIn,
  TransactionTransferOut,
  TransactionTransferBetween,
  TransactionVirtualIn,
  TransactionVirtualInSubtype
} from '../models/transactions.model'
import { fromDinero } from '../database/mongoose-plugins'
import { dayjs } from '../utils/dayjs'

// ============================================
// Helpers
// ============================================

function moneyToNumber (value: any): number {
  const cents = fromDinero(value)
  if (cents == null) return 0
  return cents / 100
}

/** Get all InternalAccount _ids that belong to a given CostCentre */
async function getAccountIdsByCostCentre (costCentreId: string): Promise<string[]> {
  const accounts = await InternalAccount.find({ costCentre: costCentreId }).select('_id').lean()
  return accounts.map((a) => a._id.toString())
}

/** Get all InternalAccount _ids (for queries without CECO filter) */
async function getAllAccountIds (): Promise<string[]> {
  const accounts = await InternalAccount.find({}).select('_id').lean()
  return accounts.map((a) => a._id.toString())
}

/** Look up CostCentre alias by account _id. Returns a Map<accountId, alias>. */
async function buildAccountCecoAliasMap (accountIds: string[]): Promise<Map<string, string>> {
  const accounts = await InternalAccount.find({ _id: { $in: accountIds } })
    .select('_id costCentre')
    .populate('costCentre', 'alias')
    .lean()

  const map = new Map<string, string>()
  for (const acc of accounts) {
    const ceco = acc.costCentre as any
    map.set(acc._id.toString(), ceco?.alias ?? '')
  }
  return map
}

// Spanish short month names for chart grouping
const MONTH_NAMES: Record<number, string> = {
  1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr', 5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic'
}

// ============================================
// Zod Schemas
// ============================================

const transactionsQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  status: z.string().optional(),
  type: z.enum(['in', 'out', 'internal', 'all']).default('all'),
  costCentreId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})

const summaryQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  costCentreId: z.string().optional()
})

const commissionsQuerySchema = z.object({
  agentId: z.string().optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM').optional(),
  costCentreId: z.string().optional()
})

const exportQuerySchema = z.object({
  type: z.enum(['transactions', 'commissions', 'movements']),
  format: z.enum(['csv']).default('csv'),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  status: z.string().optional(),
  txType: z.enum(['in', 'out', 'internal', 'all']).default('all'),
  costCentreId: z.string().optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional()
})

// ============================================
// Normalized transaction shape
// ============================================

interface NormalizedTransaction {
  id: string
  type: string
  amount: number
  status: string
  concept: string
  counterparty: string
  createdAt: string
  costCentreAlias: string
}

function normalizeTransferOut (tx: any, cecoMap: Map<string, string>): NormalizedTransaction {
  const fromAccountId = tx.fromAccount?._id?.toString() ?? tx.fromAccount?.toString() ?? ''
  return {
    id: tx._id.toString(),
    type: 'SPEI Out',
    amount: moneyToNumber(tx.amountTotal),
    status: tx.status,
    concept: tx.description || '',
    counterparty: tx.toAccount?.alias || tx.toAccount?.fullNumber || '',
    createdAt: (tx.createdAt || tx.transactedAt)?.toISOString() ?? '',
    costCentreAlias: cecoMap.get(fromAccountId) ?? ''
  }
}

function normalizeTransferIn (tx: any, cecoMap: Map<string, string>): NormalizedTransaction {
  const toAccountId = tx.toAccount?._id?.toString() ?? tx.toAccount?.toString() ?? ''
  return {
    id: tx._id.toString(),
    type: 'SPEI In',
    amount: moneyToNumber(tx.amountTotal),
    status: tx.status,
    concept: tx.description || '',
    counterparty: tx.fromName || tx.fromAccount || '',
    createdAt: (tx.createdAt || tx.transactedAt)?.toISOString() ?? '',
    costCentreAlias: cecoMap.get(toAccountId) ?? ''
  }
}

function normalizeTransferBetween (tx: any, cecoMap: Map<string, string>): NormalizedTransaction {
  const fromAccountId = tx.fromAccount?._id?.toString() ?? tx.fromAccount?.toString() ?? ''
  return {
    id: tx._id.toString(),
    type: 'Internal',
    amount: moneyToNumber(tx.amountTotal),
    status: tx.status,
    concept: tx.description || '',
    counterparty: tx.toAccount?.alias || '',
    createdAt: (tx.createdAt || tx.transactedAt)?.toISOString() ?? '',
    costCentreAlias: cecoMap.get(fromAccountId) ?? ''
  }
}

// ============================================
// Controller
// ============================================

/**
 * GET /api/v1/reports/transactions
 * Query all transactions with filters.
 */
async function getTransactions (req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = transactionsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid query parameters', errors: parsed.error.flatten() })
      return
    }

    const { type, status, costCentreId, page, limit } = parsed.data
    const from = parsed.data.from ? new Date(parsed.data.from) : dayjs().startOf('month').toDate()
    const to = parsed.data.to ? new Date(parsed.data.to) : dayjs().toDate()

    // Determine account scope
    let accountIds: string[] | null = null
    if (costCentreId) {
      accountIds = await getAccountIdsByCostCentre(costCentreId)
      if (accountIds.length === 0) {
        res.json({ data: [], total: 0, page, limit, hasMore: false })
        return
      }
    }

    // Build per-discriminator filters
    const dateFilter = { createdAt: { $gte: from, $lte: to } }

    const buildFilter = (accountField: string): Record<string, any> => {
      const f: Record<string, any> = { ...dateFilter }
      if (accountIds) f[accountField] = { $in: accountIds.map(id => new mongoose.Types.ObjectId(id)) }
      if (status) f.status = status
      return f
    }

    // Fetch transactions by type
    let outTxs: any[] = []
    let inTxs: any[] = []
    let betweenTxs: any[] = []

    const promises: Promise<void>[] = []

    if (type === 'out' || type === 'all') {
      promises.push(
        TransactionTransferOut.find(buildFilter('fromAccount'))
          .sort({ createdAt: -1 })
          .populate('fromAccount', '_id costCentre')
          .populate('toAccount', 'alias fullNumber')
          .lean()
          .then(docs => { outTxs = docs })
      )
    }
    if (type === 'in' || type === 'all') {
      promises.push(
        TransactionTransferIn.find(buildFilter('toAccount'))
          .sort({ createdAt: -1 })
          .populate('toAccount', '_id costCentre')
          .lean()
          .then(docs => { inTxs = docs })
      )
    }
    if (type === 'internal' || type === 'all') {
      promises.push(
        TransactionTransferBetween.find(buildFilter('fromAccount'))
          .sort({ createdAt: -1 })
          .populate('fromAccount', '_id costCentre')
          .populate('toAccount', 'alias')
          .lean()
          .then(docs => { betweenTxs = docs })
      )
    }

    await Promise.all(promises)

    // Collect all referenced account IDs to build CECO alias map
    const allAccountIds = new Set<string>()
    for (const tx of outTxs) {
      const id = tx.fromAccount?._id?.toString() ?? tx.fromAccount?.toString()
      if (id) allAccountIds.add(id)
    }
    for (const tx of inTxs) {
      const id = tx.toAccount?._id?.toString() ?? tx.toAccount?.toString()
      if (id) allAccountIds.add(id)
    }
    for (const tx of betweenTxs) {
      const id = tx.fromAccount?._id?.toString() ?? tx.fromAccount?.toString()
      if (id) allAccountIds.add(id)
    }

    const cecoMap = await buildAccountCecoAliasMap(Array.from(allAccountIds))

    // Normalize and combine
    const allItems: NormalizedTransaction[] = [
      ...outTxs.map(tx => normalizeTransferOut(tx, cecoMap)),
      ...inTxs.map(tx => normalizeTransferIn(tx, cecoMap)),
      ...betweenTxs.map(tx => normalizeTransferBetween(tx, cecoMap))
    ]

    // Sort by createdAt desc
    allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Paginate
    const total = allItems.length
    const start = (page - 1) * limit
    const paginatedItems = allItems.slice(start, start + limit)

    res.json({
      data: paginatedItems,
      total,
      page,
      limit,
      hasMore: start + limit < total
    })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/v1/reports/summary
 * Get summary stats for a period (feeds charts).
 */
async function getSummary (req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = summaryQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid query parameters', errors: parsed.error.flatten() })
      return
    }

    const { costCentreId } = parsed.data
    const from = parsed.data.from ? new Date(parsed.data.from) : dayjs().startOf('month').toDate()
    const to = parsed.data.to ? new Date(parsed.data.to) : dayjs().toDate()

    // Determine account scope
    let accountIds: string[]
    if (costCentreId) {
      accountIds = await getAccountIdsByCostCentre(costCentreId)
    } else {
      accountIds = await getAllAccountIds()
    }

    if (accountIds.length === 0) {
      res.json({
        totalIncome: 0,
        totalExpense: 0,
        netFlow: 0,
        totalTransactions: 0,
        monthlyData: [],
        transactionsByType: []
      })
      return
    }

    const objectIds = accountIds.map(id => new mongoose.Types.ObjectId(id))

    // Aggregation: group by month and operator
    const monthlyAgg = await AccountMovement.aggregate([
      {
        $match: {
          account: { $in: objectIds },
          transactedAt: { $gte: from, $lte: to }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: '$transactedAt' },
            year: { $year: '$transactedAt' },
            operator: '$balanceOperator'
          },
          totalCents: { $sum: '$balanceDelta.amount' },
          count: { $sum: 1 }
        }
      }
    ])

    // Compute totals and build monthly chart data
    let totalIncomeCents = 0
    let totalExpenseCents = 0
    let totalTransactions = 0

    // Map: "YYYY-MM" -> { ingresos, egresos }
    const monthMap = new Map<string, { ingresos: number; egresos: number }>()

    for (const row of monthlyAgg) {
      const key = `${row._id.year}-${String(row._id.month).padStart(2, '0')}`
      if (!monthMap.has(key)) {
        monthMap.set(key, { ingresos: 0, egresos: 0 })
      }
      const entry = monthMap.get(key)!
      const amountPesos = (row.totalCents ?? 0) / 100
      totalTransactions += row.count

      if (row._id.operator === 'add') {
        totalIncomeCents += row.totalCents ?? 0
        entry.ingresos += amountPesos
      } else if (row._id.operator === 'subtract') {
        totalExpenseCents += row.totalCents ?? 0
        entry.egresos += amountPesos
      }
    }

    // Sort monthly entries chronologically
    const sortedKeys = Array.from(monthMap.keys()).sort()
    const monthlyData = sortedKeys.map(key => {
      const [, monthStr] = key.split('-')
      const monthNum = parseInt(monthStr, 10)
      const entry = monthMap.get(key)!
      return {
        month: MONTH_NAMES[monthNum] || monthStr,
        ingresos: Math.round(entry.ingresos * 100) / 100,
        egresos: Math.round(entry.egresos * 100) / 100
      }
    })

    // Count transactions by type
    const dateFilter = { createdAt: { $gte: from, $lte: to } }
    const [speiInCount, speiOutCount, internalCount] = await Promise.all([
      TransactionTransferIn.countDocuments({ ...dateFilter, toAccount: { $in: objectIds } }),
      TransactionTransferOut.countDocuments({ ...dateFilter, fromAccount: { $in: objectIds } }),
      TransactionTransferBetween.countDocuments({ ...dateFilter, fromAccount: { $in: objectIds } })
    ])

    const totalIncome = Math.round((totalIncomeCents / 100) * 100) / 100
    const totalExpense = Math.round((totalExpenseCents / 100) * 100) / 100

    res.json({
      totalIncome,
      totalExpense,
      netFlow: Math.round((totalIncome - totalExpense) * 100) / 100,
      totalTransactions,
      monthlyData,
      transactionsByType: [
        { type: 'SPEI In', count: speiInCount },
        { type: 'SPEI Out', count: speiOutCount },
        { type: 'Internal', count: internalCount }
      ]
    })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/v1/reports/commissions
 * Get commissions summary for a period.
 */
async function getCommissions (req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = commissionsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid query parameters', errors: parsed.error.flatten() })
      return
    }

    const { agentId, costCentreId } = parsed.data
    const period = parsed.data.period ?? dayjs().format('YYYY-MM')

    const periodStart = dayjs(period, 'YYYY-MM', true).startOf('month').toDate()
    const periodEnd = dayjs(period, 'YYYY-MM', true).endOf('month').toDate()

    // Base filter: VirtualIn with commission subtype
    const filter: Record<string, any> = {
      subtype: TransactionVirtualInSubtype.Commission,
      createdAt: { $gte: periodStart, $lte: periodEnd }
    }

    // If costCentreId, limit to accounts of that CECO
    if (costCentreId) {
      const accountIds = await getAccountIdsByCostCentre(costCentreId)
      if (accountIds.length === 0) {
        res.json({ data: [], total: 0 })
        return
      }
      filter.toAccount = { $in: accountIds.map(id => new mongoose.Types.ObjectId(id)) }
    }

    // Aggregation: group by toAccount and sum amountTransfer
    const pipeline: mongoose.PipelineStage[] = [
      { $match: filter },
      {
        $group: {
          _id: '$toAccount',
          totalCents: { $sum: '$amountTransfer.amount' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'accounts',
          localField: '_id',
          foreignField: '_id',
          as: 'account'
        }
      },
      { $unwind: { path: '$account', preserveNullAndEmptyArrays: true } }
    ]

    const results = await TransactionVirtualIn.aggregate(pipeline)

    const data = results.map((row: any) => ({
      agentName: row.account?.alias || row._id?.toString() || 'Unknown',
      agentId: row._id?.toString() || '',
      totalCommission: Math.round((row.totalCents / 100) * 100) / 100,
      transactionCount: row.transactionCount,
      period
    }))

    // If agentId filter, apply post-filter
    const filtered = agentId ? data.filter((d: any) => d.agentId === agentId) : data

    const total = filtered.reduce((sum: number, d: any) => sum + d.totalCommission, 0)

    res.json({
      data: filtered,
      total: Math.round(total * 100) / 100
    })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /api/v1/reports/export
 * Export data as CSV.
 */
async function exportReport (req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = exportQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid query parameters', errors: parsed.error.flatten() })
      return
    }

    const { type, costCentreId, status, txType, period } = parsed.data
    const from = parsed.data.from ? new Date(parsed.data.from) : dayjs().startOf('month').toDate()
    const to = parsed.data.to ? new Date(parsed.data.to) : dayjs().toDate()

    let csv = ''

    if (type === 'transactions') {
      csv = await exportTransactionsCsv(from, to, status, txType, costCentreId)
    } else if (type === 'commissions') {
      csv = await exportCommissionsCsv(period ?? dayjs().format('YYYY-MM'), costCentreId)
    } else if (type === 'movements') {
      csv = await exportMovementsCsv(from, to, costCentreId)
    }

    const dateStr = dayjs().format('YYYY-MM-DD')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename=report-${type}-${dateStr}.csv`)
    res.send(csv)
  } catch (error) {
    next(error)
  }
}

// ============================================
// CSV Generators
// ============================================

function escapeCsvField (value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

async function exportTransactionsCsv (
  from: Date,
  to: Date,
  status: string | undefined,
  txType: string,
  costCentreId: string | undefined
): Promise<string> {
  let accountIds: string[] | null = null
  if (costCentreId) {
    accountIds = await getAccountIdsByCostCentre(costCentreId)
  }

  const dateFilter = { createdAt: { $gte: from, $lte: to } }

  const buildFilter = (accountField: string): Record<string, any> => {
    const f: Record<string, any> = { ...dateFilter }
    if (accountIds) f[accountField] = { $in: accountIds.map(id => new mongoose.Types.ObjectId(id)) }
    if (status) f.status = status
    return f
  }

  let outTxs: any[] = []
  let inTxs: any[] = []
  let betweenTxs: any[] = []

  const promises: Promise<void>[] = []
  if (txType === 'out' || txType === 'all') {
    promises.push(
      TransactionTransferOut.find(buildFilter('fromAccount'))
        .sort({ createdAt: -1 })
        .populate('fromAccount', '_id costCentre')
        .populate('toAccount', 'alias fullNumber')
        .lean()
        .then(docs => { outTxs = docs })
    )
  }
  if (txType === 'in' || txType === 'all') {
    promises.push(
      TransactionTransferIn.find(buildFilter('toAccount'))
        .sort({ createdAt: -1 })
        .populate('toAccount', '_id costCentre')
        .lean()
        .then(docs => { inTxs = docs })
    )
  }
  if (txType === 'internal' || txType === 'all') {
    promises.push(
      TransactionTransferBetween.find(buildFilter('fromAccount'))
        .sort({ createdAt: -1 })
        .populate('fromAccount', '_id costCentre')
        .populate('toAccount', 'alias')
        .lean()
        .then(docs => { betweenTxs = docs })
    )
  }
  await Promise.all(promises)

  const allAccountIds = new Set<string>()
  for (const tx of outTxs) {
    const id = tx.fromAccount?._id?.toString() ?? tx.fromAccount?.toString()
    if (id) allAccountIds.add(id)
  }
  for (const tx of inTxs) {
    const id = tx.toAccount?._id?.toString() ?? tx.toAccount?.toString()
    if (id) allAccountIds.add(id)
  }
  for (const tx of betweenTxs) {
    const id = tx.fromAccount?._id?.toString() ?? tx.fromAccount?.toString()
    if (id) allAccountIds.add(id)
  }
  const cecoMap = await buildAccountCecoAliasMap(Array.from(allAccountIds))

  const items: NormalizedTransaction[] = [
    ...outTxs.map(tx => normalizeTransferOut(tx, cecoMap)),
    ...inTxs.map(tx => normalizeTransferIn(tx, cecoMap)),
    ...betweenTxs.map(tx => normalizeTransferBetween(tx, cecoMap))
  ]
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const headers = ['Fecha', 'Tipo', 'Monto', 'Status', 'Concepto', 'Contraparte', 'CECO']
  const rows = items.map(item => [
    escapeCsvField(item.createdAt ? dayjs(item.createdAt).format('DD/MM/YYYY HH:mm') : ''),
    escapeCsvField(item.type),
    item.amount.toFixed(2),
    escapeCsvField(item.status),
    escapeCsvField(item.concept),
    escapeCsvField(item.counterparty),
    escapeCsvField(item.costCentreAlias)
  ].join(','))

  return [headers.join(','), ...rows].join('\n')
}

async function exportCommissionsCsv (
  period: string,
  costCentreId: string | undefined
): Promise<string> {
  const periodStart = dayjs(period, 'YYYY-MM', true).startOf('month').toDate()
  const periodEnd = dayjs(period, 'YYYY-MM', true).endOf('month').toDate()

  const filter: Record<string, any> = {
    subtype: TransactionVirtualInSubtype.Commission,
    createdAt: { $gte: periodStart, $lte: periodEnd }
  }

  if (costCentreId) {
    const accountIds = await getAccountIdsByCostCentre(costCentreId)
    if (accountIds.length > 0) {
      filter.toAccount = { $in: accountIds.map(id => new mongoose.Types.ObjectId(id)) }
    }
  }

  const txs = await TransactionVirtualIn.find(filter)
    .sort({ createdAt: -1 })
    .populate('toAccount', 'alias')
    .lean()

  const headers = ['Fecha', 'Cuenta Destino', 'Monto', 'Periodo']
  const rows = txs.map((tx: any) => [
    escapeCsvField(tx.createdAt ? dayjs(tx.createdAt).format('DD/MM/YYYY HH:mm') : ''),
    escapeCsvField(tx.toAccount?.alias || ''),
    moneyToNumber(tx.amountTransfer).toFixed(2),
    escapeCsvField(period)
  ].join(','))

  return [headers.join(','), ...rows].join('\n')
}

async function exportMovementsCsv (
  from: Date,
  to: Date,
  costCentreId: string | undefined
): Promise<string> {
  let accountIds: string[]
  if (costCentreId) {
    accountIds = await getAccountIdsByCostCentre(costCentreId)
  } else {
    accountIds = await getAllAccountIds()
  }

  if (accountIds.length === 0) {
    return 'Fecha,Tipo,Operacion,Monto,Comentario'
  }

  const objectIds = accountIds.map(id => new mongoose.Types.ObjectId(id))

  const movements = await AccountMovement.find({
    account: { $in: objectIds },
    transactedAt: { $gte: from, $lte: to }
  })
    .sort({ transactedAt: -1 })
    .lean()

  const headers = ['Fecha', 'Tipo', 'Operacion', 'Monto', 'Comentario']
  const rows = movements.map((m: any) => [
    escapeCsvField(m.transactedAt ? dayjs(m.transactedAt).format('DD/MM/YYYY HH:mm') : ''),
    escapeCsvField(m.type || ''),
    escapeCsvField(m.balanceOperator || ''),
    moneyToNumber(m.balanceDelta).toFixed(2),
    escapeCsvField(m.comment || '')
  ].join(','))

  return [headers.join(','), ...rows].join('\n')
}

// ============================================
// Export
// ============================================

export const reportsController = {
  getTransactions,
  getSummary,
  getCommissions,
  exportReport
}
