'use client';

import { Trash2, CheckCircle, Download, X } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  onDelete: () => void;
  onResolve: () => void;
  onExport: () => void;
  onClearSelection: () => void;
  onSelectAll: () => void;
  totalCount: number;
  isAllSelected: boolean;
}

export function BulkActionBar({
  selectedCount,
  onDelete,
  onResolve,
  onExport,
  onClearSelection,
  onSelectAll,
  totalCount,
  isAllSelected,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <div className="flex items-center gap-3">
        <button
          onClick={onClearSelection}
          className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded transition-colors"
        >
          <X className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </button>
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          {selectedCount} de {totalCount} seleccionados
        </span>
        <button
          onClick={onSelectAll}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {isAllSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onResolve}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 rounded-md transition-colors"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Resolver
        </button>
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-md transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Eliminar
        </button>
      </div>
    </div>
  );
}