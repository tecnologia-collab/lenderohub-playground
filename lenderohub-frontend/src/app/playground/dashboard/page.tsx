'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, FileText, Activity, Bell, Users } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

type PlaygroundStats = {
  notes: {
    total: number;
    resolved: number;
    pending: number;
    byPriority: { low: number; medium: number; high: number };
  };
  activity: { last24h: number };
  notifications: { unread: number };
  users: { total: number; byProfileType: Record<string, number> };
};

function StatCard({ title, children, loading }: { title: string; children: React.ReactNode; loading: boolean }) {
  return (
    <div className="border dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-900 space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h2>
      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        </div>
      ) : children}
    </div>
  );
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444'];
const PRIORITY_COLORS: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
};

export default function PlaygroundDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<PlaygroundStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/v1/dashboard/playground-stats`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setStats(data.data);
      else setError('Error al cargar estadísticas');
    } catch {
      setError('No se pudo conectar al backend');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const notesDonutData = stats ? [
    { name: 'Resueltas', value: stats.notes.resolved },
    { name: 'Pendientes', value: stats.notes.pending },
  ] : [];

  const priorityBarData = stats ? [
    { name: 'Baja', value: stats.notes.byPriority.low, fill: PRIORITY_COLORS.low },
    { name: 'Media', value: stats.notes.byPriority.medium, fill: PRIORITY_COLORS.medium },
    { name: 'Alta', value: stats.notes.byPriority.high, fill: PRIORITY_COLORS.high },
  ] : [];

  const usersBarData = stats
    ? Object.entries(stats.users.byProfileType).map(([key, value]) => ({ name: key, value }))
    : [];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Playground Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">KPIs del sistema</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refrescar
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Card Notas */}
        <StatCard title="Notas" loading={loading}>
          {stats && (
            <div className="space-y-3">
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.notes.total}</p>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={120}>
                  <PieChart>
                    <Pie data={notesDonutData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value">
                      {notesDonutData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-gray-600 dark:text-gray-400">Resueltas: {stats.notes.resolved}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-gray-600 dark:text-gray-400">Pendientes: {stats.notes.pending}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </StatCard>

        {/* Card Usuarios */}
        <StatCard title="Usuarios por Tipo" loading={loading}>
          {stats && (
            <div className="space-y-3">
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.users.total}</p>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={usersBarData} barSize={24}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis hide />
                  <Tooltip />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </StatCard>

        {/* Card Actividad */}
        <StatCard title="Actividad (últimas 24h)" loading={loading}>
          {stats && (
            <div className="space-y-2">
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.activity.last24h}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">requests al API</p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Notificaciones no leídas:</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  {stats.notifications.unread}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={60}>
                <BarChart data={priorityBarData} barSize={20}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis hide />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {priorityBarData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400">Notas por prioridad</p>
            </div>
          )}
        </StatCard>

        {/* Card Quick Actions */}
        <StatCard title="Quick Actions" loading={false}>
          <div className="space-y-2">
            <button
              onClick={() => router.push('/playground/activity-log')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
            >
              <Activity className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Ver Activity Log</p>
                <p className="text-xs text-gray-400">Registro de actividad del sistema</p>
              </div>
            </button>
            <button
              onClick={() => router.push('/playground/alerts')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
            >
              <Bell className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Ver Notificaciones</p>
                <p className="text-xs text-gray-400">Panel de notificaciones</p>
              </div>
            </button>
            <button
              onClick={() => router.push('/playground/table')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
            >
              <Users className="w-5 h-5 text-emerald-500" />
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Ver Tabla de Datos</p>
                <p className="text-xs text-gray-400">Demo de DataTable</p>
              </div>
            </button>
            <button
              onClick={() => router.push('/playground/form')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
            >
              <FileText className="w-5 h-5 text-violet-500" />
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Crear Nota</p>
                <p className="text-xs text-gray-400">Formulario de contacto demo</p>
              </div>
            </button>
          </div>
        </StatCard>
      </div>
    </div>
  );
}