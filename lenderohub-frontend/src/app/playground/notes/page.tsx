'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { BulkActionBar } from '@/components/playground/bulk-action-bar';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

type Note = {
  _id: string;
  content: string;
  entityType: string;
  priority: 'low' | 'medium' | 'high';
  isResolved: boolean;
  createdBy?: { name: string; email: string };
  createdAt: string;
};

type BulkResult = { success: number; failed: number; errors: string[] };

const PRIORITY_COLORS = {
  low: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  high: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<'delete' | 'resolve' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/notes?limit=50`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setNotes(data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === notes.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(notes.map((n) => n._id)));
  };

  const handleBulkAction = async (action: 'delete' | 'resolve') => {
    setProcessing(true);
    setConfirmAction(null);
    try {
      const endpoint = action === 'delete' ? 'bulk/delete' : 'bulk/resolve';
      const res = await fetch(`${API_BASE}/v1/notes/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        setSelectedIds(new Set());
        await fetchNotes();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/notes/bulk/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: Array.from(selectedIds), format: 'csv' }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'notes-export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const isAllSelected = notes.length > 0 && selectedIds.size === notes.length;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notas</h1>
        <button
          onClick={fetchNotes}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refrescar
        </button>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={notes.length}
        isAllSelected={isAllSelected}
        onSelectAll={toggleAll}
        onClearSelection={() => setSelectedIds(new Set())}
        onDelete={() => setConfirmAction('delete')}
        onResolve={() => setConfirmAction('resolve')}
        onExport={handleExport}
      />

      {/* Result banner */}
      {result && (
        <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm">
          <span className="text-green-700 dark:text-green-400">
            ✅ {result.success} exitosos · ❌ {result.failed} fallidos
          </span>
          <button onClick={() => setResult(null)} className="text-green-500 hover:text-green-700">✕</button>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {confirmAction === 'delete' ? '¿Eliminar notas?' : '¿Resolver notas?'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {confirmAction === 'delete'
                ? `Estás a punto de eliminar ${selectedIds.size} nota(s). Esta acción no se puede deshacer.`
                : `Estás a punto de marcar ${selectedIds.size} nota(s) como resueltas.`}
            </p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {Array.from(selectedIds).map((id) => {
                const note = notes.find((n) => n._id === id);
                return (
                  <p key={id} className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    · {note?.content || id}
                  </p>
                );
              })}
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm border dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleBulkAction(confirmAction)}
                disabled={processing}
                className={`px-4 py-2 text-sm text-white rounded-md transition-colors disabled:opacity-50 ${
                  confirmAction === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {processing ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              {['Contenido', 'Tipo', 'Prioridad', 'Estado', 'Creado por'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Cargando...</td></tr>
            ) : notes.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No hay notas</td></tr>
            ) : (
              notes.map((note) => (
                <tr
                  key={note._id}
                  className={`border-b dark:border-gray-800 last:border-0 transition-colors ${
                    selectedIds.has(note._id) ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(note._id)}
                      onChange={() => toggleSelect(note._id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-xs truncate">{note.content}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{note.entityType}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[note.priority]}`}>
                      {note.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      note.isResolved
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      {note.isResolved ? 'Resuelta' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {note.createdBy?.email || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}