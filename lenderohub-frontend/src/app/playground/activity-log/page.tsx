'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

type LogEntry = {
  _id: string;
  userId?: { name: string; email: string };
  action: string;
  resource: string;
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  createdAt: string;
};

type Stats = {
  requestsByHour: { _id: number; count: number }[];
  topEndpoints: { _id: string; count: number; avgDuration: number }[];
  statusBreakdown: { _id: number; count: number }[];
};

function statusColor(code: number) {
  if (code < 300) return 'text-green-500';
  if (code < 400) return 'text-blue-500';
  if (code < 500) return 'text-yellow-500';
  return 'text-red-500';
}

function methodColor(method: string) {
  switch (method) {
    case 'GET': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
    case 'POST': return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400';
    case 'PUT': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400';
    case 'DELETE': return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
    default: return 'bg-gray-100 dark:bg-gray-800 text-gray-600';
  }
}

function timeStr(dateStr: string) {
  return new Date(dateStr).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [resource, setResource] = useState('');
  const [method, setMethod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (resource) params.set('resource', resource);
      if (method) params.set('method', method);
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const [logsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/v1/activity-log?${params}`, { credentials: 'include' }),
        fetch(`${API_BASE}/v1/activity-log/stats`, { credentials: 'include' }),
      ]);

      const logsData = await logsRes.json();
      const statsData = await statsRes.json();

      if (logsData.success) { setLogs(logsData.data); setTotal(logsData.total); }
      if (statsData.success) setStats(statsData.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, resource, method, from, to]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / 15);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Activity Log</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Registro de actividad del sistema</p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refrescar
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Endpoints */}
          <div className="border dark:border-gray-700 rounded-lg p-4 space-y-3 bg-white dark:bg-gray-900">
            <h2 className="font-semibold text-sm text-gray-600 dark:text-gray-300 uppercase tracking-wide">Top Endpoints (24h)</h2>
            <div className="space-y-2">
              {stats.topEndpoints.slice(0, 5).map((ep, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300 font-mono text-xs truncate max-w-[200px]">{ep._id}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-xs">{Math.round(ep.avgDuration)}ms</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{ep.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="border dark:border-gray-700 rounded-lg p-4 space-y-3 bg-white dark:bg-gray-900">
            <h2 className="font-semibold text-sm text-gray-600 dark:text-gray-300 uppercase tracking-wide">Status Codes (24h)</h2>
            <div className="space-y-2">
              {stats.statusBreakdown.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className={`font-mono font-semibold ${statusColor(s._id)}`}>{s._id}</span>
                  <span className="text-gray-600 dark:text-gray-400">{s.count} requests</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Recurso (ej: beneficiaries)"
            value={resource}
            onChange={(e) => { setResource(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border dark:border-gray-600 rounded-md bg-transparent dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={method}
            onChange={(e) => { setMethod(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los métodos</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border dark:border-gray-600 rounded-md bg-transparent dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border dark:border-gray-600 rounded-md bg-transparent dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="border dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
            <tr>
              {['Fecha', 'Usuario', 'Método', 'Recurso', 'Path', 'Status', 'Duración'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 text-xs uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Cargando...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No hay registros</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log._id} className="border-b dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{timeStr(log.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">
                    {log.userId?.email || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${methodColor(log.method)}`}>{log.method}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs">{log.resource}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs truncate max-w-[200px]">{log.path}</td>
                  <td className={`px-4 py-3 font-semibold text-xs ${statusColor(log.statusCode)}`}>{log.statusCode}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{log.duration}ms</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>{total} registros totales</span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="px-3 py-1 border dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Anterior
          </button>
          <span className="px-3 py-1">Página {page} de {totalPages || 1}</span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1 border dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}