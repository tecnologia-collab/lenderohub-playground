'use client';

import { useState } from 'react';
import { announcementsService, Announcement } from '@/services/announcements.service';

interface AnnouncementFormProps {
  initial?: Partial<Announcement>;
  onSuccess: (a: Announcement) => void;
  onCancel: () => void;
}

export function AnnouncementForm({ initial, onSuccess, onCancel }: AnnouncementFormProps) {
  const [title, setTitle] = useState(initial?.title || '');
  const [content, setContent] = useState(initial?.content || '');
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>(initial?.priority || 'normal');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || '');
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ? initial.expiresAt.slice(0, 10) : '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Título y contenido son requeridos');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        priority,
        imageUrl: imageUrl.trim() || undefined,
        expiresAt: expiresAt || undefined,
      };
      const result = initial?._id
        ? await announcementsService.update(initial._id, payload)
        : await announcementsService.create(payload);
      onSuccess(result);
    } catch {
      setError('Error al guardar el anuncio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Título *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Título del anuncio"
          className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-md bg-transparent dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Contenido * (Markdown soportado)</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="Escribe el contenido en Markdown..."
          className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-md bg-transparent dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Prioridad</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
            className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="normal">Normal</option>
            <option value="important">Importante</option>
            <option value="urgent">Urgente</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Fecha de expiración</label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-md bg-transparent dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">URL de imagen (opcional)</label>
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://..."
          className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-md bg-transparent dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm border dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
        >
          {loading ? 'Guardando...' : initial?._id ? 'Actualizar' : 'Publicar'}
        </button>
      </div>
    </div>
  );
}