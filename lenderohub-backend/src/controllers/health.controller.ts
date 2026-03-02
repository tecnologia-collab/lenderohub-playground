/**
 * Health Check Controller
 *
 * Public endpoint for monitoring system health.
 * Checks database connectivity, Finco API status, and pending transactions.
 * No authentication required.
 */

import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { join } from 'path';
import { FincoClient } from '../integrations/finco/client';
import { TransactionTransferOut, TransactionTransferOutStatus } from '../models/transactions.model';

// ============================================
// Types
// ============================================

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';
type CheckStatus = 'up' | 'down' | 'unknown';

interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  checks: {
    database: {
      status: CheckStatus;
      latencyMs: number;
    };
    fincoApi: {
      status: CheckStatus;
      latencyMs: number;
    };
    pendingTransactions: {
      count: number;
      warning: boolean;
    };
    uptime: number;
  };
}

// ============================================
// Constants
// ============================================

const PENDING_TRANSACTION_WARNING_THRESHOLD = 50;
const FINCO_HEALTH_TIMEOUT_MS = 5000;

// ============================================
// Helpers
// ============================================

/**
 * Check MongoDB connection health + latency via a simple admin ping.
 */
async function checkDatabase(): Promise<{ status: CheckStatus; latencyMs: number }> {
  try {
    const readyState = mongoose.connection.readyState;
    if (readyState !== 1) {
      return { status: 'down', latencyMs: -1 };
    }

    const start = Date.now();
    // Run a lightweight command to measure latency
    await mongoose.connection.db!.admin().ping();
    const latencyMs = Date.now() - start;

    return { status: 'up', latencyMs };
  } catch {
    return { status: 'down', latencyMs: -1 };
  }
}

/**
 * Check Finco API health by hitting a lightweight endpoint (banks catalog).
 * Uses a short timeout to avoid blocking the health check.
 */
async function checkFincoApi(): Promise<{ status: CheckStatus; latencyMs: number }> {
  try {
    const clientId = process.env.FINCO_CLIENT_ID;
    if (!clientId) {
      return { status: 'unknown', latencyMs: -1 };
    }

    const fincoClient = new FincoClient({
      apiUrl: process.env.FINCO_API_URL || 'https://apicore.stg.finch.lat',
      clientId,
      clientSecret: process.env.FINCO_CLIENT_SECRET || '',
      apiKey: process.env.FINCO_API_KEY || '',
      environment: (process.env.FINCO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
    });

    const start = Date.now();

    // Use a Promise.race with a timeout to avoid long waits
    const result = await Promise.race([
      fincoClient.getBanks(1, 1), // Fetch just 1 bank to minimize payload
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Finco health check timeout')), FINCO_HEALTH_TIMEOUT_MS)
      ),
    ]);

    const latencyMs = Date.now() - start;

    if (result) {
      return { status: 'up', latencyMs };
    }
    return { status: 'down', latencyMs };
  } catch {
    return { status: 'down', latencyMs: -1 };
  }
}

/**
 * Count pending (in-flight) TransferOut transactions.
 */
async function checkPendingTransactions(): Promise<{ count: number; warning: boolean }> {
  try {
    const count = await TransactionTransferOut.countDocuments({
      status: { $in: [TransactionTransferOutStatus.New, TransactionTransferOutStatus.Sent] },
    });

    return {
      count,
      warning: count > PENDING_TRANSACTION_WARNING_THRESHOLD,
    };
  } catch {
    return { count: -1, warning: false };
  }
}

/**
 * Determine overall health status from individual checks.
 */
function determineOverallStatus(
  dbStatus: CheckStatus,
  fincoStatus: CheckStatus,
  pendingWarning: boolean
): HealthStatus {
  if (dbStatus === 'down') {
    return 'unhealthy';
  }
  if (fincoStatus === 'down' || fincoStatus === 'unknown' || pendingWarning) {
    return 'degraded';
  }
  return 'healthy';
}

// ============================================
// Controller
// ============================================

/**
 * GET /api/v1/health
 * Public health check endpoint (no authentication required).
 */
export async function getHealth(req: Request, res: Response, _next: NextFunction) {
  const [database, fincoApi, pendingTransactions] = await Promise.all([
    checkDatabase(),
    checkFincoApi(),
    checkPendingTransactions(),
  ]);

  const status = determineOverallStatus(
    database.status,
    fincoApi.status,
    pendingTransactions.warning
  );

  const result: HealthCheckResult = {
    status,
    timestamp: new Date().toISOString(),
    checks: {
      database,
      fincoApi,
      pendingTransactions,
      uptime: process.uptime(),
    },
  };

  // Return 200 for healthy/degraded, 503 for unhealthy
  const httpStatus = status === 'unhealthy' ? 503 : 200;

  res.status(httpStatus).json(result);
}

/**
 * GET /api/v1/health/detailed
 * Public detailed health check: version, uptime, MongoDB state, memory usage.
 */
export async function getDetailedHealth(_req: Request, res: Response, _next: NextFunction) {
  const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

  const dbState = mongoose.connection.readyState;
  const dbStateLabels: Record<number, string> = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  const dbStatus = dbState === 1 ? 'up' : 'down';

  let dbLatencyMs = -1;
  if (dbState === 1) {
    const start = Date.now();
    try {
      await mongoose.connection.db!.admin().ping();
      dbLatencyMs = Date.now() - start;
    } catch {
      // latency stays -1
    }
  }

  const mem = process.memoryUsage();

  res.json({
    version: pkg.version,
    uptime: {
      seconds: Math.floor(process.uptime()),
      human: formatUptime(process.uptime()),
    },
    database: {
      status: dbStatus,
      state: dbStateLabels[dbState] ?? 'unknown',
      latencyMs: dbLatencyMs,
    },
    memory: {
      rss: formatBytes(mem.rss),
      heapUsed: formatBytes(mem.heapUsed),
      heapTotal: formatBytes(mem.heapTotal),
      external: formatBytes(mem.external),
    },
    timestamp: new Date().toISOString(),
  });
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default {
  getHealth,
  getDetailedHealth,
};
