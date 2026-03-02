'use client';

import { useState, useEffect, useCallback } from 'react';
import { playgroundService } from '@/services/playground.service';
import { RefreshCw } from 'lucide-react';

type LoadState<T> = {
  data: T | null;
  loading: boolean;
  error: string;
};

function useLoadState<T>(fetcher: () => Promise<T>) {
    const [state, setState] = useState<LoadState<T>>({ data: null, loading: true, error: '' });
  
    const load = useCallback(async () => {
      setState((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const data = await fetcher();
        setState({ data, loading: false, error: '' });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Error desconocido';
        setState({ data: null, loading: false, error: message });
      }
    }, [fetcher]);
  
    useEffect(() => {
      load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
  
    return { ...state, retry: load };
  }

function Skeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-red-500">❌ {message}</p>
      <button
        onClick={onRetry}
        className="text-xs px-3 py-1 border border-red-400 text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >
        Reintentar
      </button>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border dark:border-gray-700 rounded-lg p-5 space-y-3 bg-white dark:bg-gray-900">
      <h2 className="font-semibold text-gray-700 dark:text-gray-300 text-sm uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </div>
  );
}

const formatMXN = (amount: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

export default function ApiDemoPage() {
  const healthFetcher = useCallback(() => playgroundService.getHealthStatus(), []);
  const balanceFetcher = useCallback(() => playgroundService.getMockBalance(), []);
  const instrumentsFetcher = useCallback(() => playgroundService.getMockInstruments(), []);

  const health = useLoadState(healthFetcher);
  const balance = useLoadState(balanceFetcher);
  const instruments = useLoadState(instrumentsFetcher);

  const refreshAll = () => {
    health.retry();
    balance.retry();
    instruments.retry();
  };

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">API Demo</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Datos en tiempo real del backend
          </p>
        </div>
        <button
          onClick={refreshAll}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refrescar Todo
        </button>
      </div>

      {/* Card 1: Health */}
      <Card title="API Status">
        {health.loading && <Skeleton />}
        {health.error && <ErrorState message={health.error} onRetry={health.retry} />}
        {health.data && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
            <span className="text-green-600 dark:text-green-400 font-medium">Backend conectado</span>
            <span className="text-xs text-gray-400 ml-2">
              {(health.data as Record<string, unknown>).status as string}
            </span>
          </div>
        )}
      </Card>

      {/* Card 2: Balance */}
      <Card title="Balance Cuenta Mock">
        {balance.loading && <Skeleton />}
        {balance.error && <ErrorState message={balance.error} onRetry={balance.retry} />}
        {balance.data && (
          <div className="space-y-1">
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {formatMXN(
                ((balance.data as Record<string, unknown>).balance as number) ??
                ((balance.data as Record<string, unknown>).available as number) ?? 0
              )}
            </p>
            <p className="text-xs text-gray-400">MXN · Cuenta mock-001</p>
          </div>
        )}
      </Card>

      {/* Card 3: Instrumentos */}
      <Card title="Instrumentos / Beneficiarios">
        {instruments.loading && <Skeleton />}
        {instruments.error && <ErrorState message={instruments.error} onRetry={instruments.retry} />}
        {instruments.data && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                <th className="pb-2 font-medium">Nombre</th>
                <th className="pb-2 font-medium">CLABE</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(
                (instruments.data as Record<string, unknown>).data as Record<string, unknown>[] ??
                instruments.data as Record<string, unknown>[]
              ).map((inst, i) => (
                <tr key={i} className="border-b dark:border-gray-800 last:border-0">
                  <td className="py-2 text-gray-800 dark:text-gray-200">
                    {inst.alias as string ?? inst.name as string ?? '—'}
                  </td>
                  <td className="py-2 text-gray-500 font-mono text-xs">
                    {(inst.instrumentDetail as Record<string, unknown>)?.clabeNumber as string ??
                     inst.clabe as string ?? '—'}
                  </td>
                  <td className="py-2">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      {inst.status as string ?? 'active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}