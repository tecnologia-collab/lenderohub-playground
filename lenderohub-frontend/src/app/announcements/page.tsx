'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { announcementsService, Announcement } from '@/services/announcements.service';
import { AnnouncementCard } from '@/components/announcements/AnnouncementCard';
import { AnnouncementForm } from '@/components/announcements/AnnouncementForm';

export default function AnnouncementsPage() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // For demo purposes — in real app this would come from user context
  const isAdmin = true;

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const [res, count] = await Promise.all([
        announcementsService.getAnnouncements({ search, priority, unreadOnly }),
        announcementsService.getUnreadCount(),
      ]);
      setAnnouncements(res.data);
      setUnreadCount(count);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, priority, unreadOnly]);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  const handlePin = async (id: string) => {
    await announcementsService.pin(id);
    fetchAnnouncements();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este anuncio?')) return;
    await announcementsService.delete(id);
    fetchAnnouncements();
  };

  const handleClick = async (announcement: Announcement) => {
    if (!announcement.isRead) {
      await announcementsService.markAsRead(announcement._id);
    }
    router.push(`/announcements/${announcement._id}`);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Anuncios</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-0.5">{unreadCount} nuevos anuncios</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAnnouncements} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nuevo anuncio
            </button>
          )}
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl p-6 w-full max-w-2xl shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Nuevo Anuncio</h2>
            <AnnouncementForm
              onSuccess={() => { setShowForm(false); fetchAnnouncements(); }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar anuncios..."
            className="w-full pl-9 pr-4 py-2 text-sm border dark:border-gray-600 rounded-md bg-transparent dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="px-3 py-2 text-sm border dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las prioridades</option>
          <option value="normal">Normal</option>
          <option value="important">Importante</option>
          <option value="urgent">Urgente</option>
        </select>
        <button
          onClick={() => setUnreadOnly(!unreadOnly)}
          className={`px-3 py-2 text-sm rounded-md border transition-colors ${
            unreadOnly
              ? 'bg-blue-600 text-white border-blue-600'
              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          Solo no leídos
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="py-16 text-center text-gray-500 dark:text-gray-400">
          <p className="text-lg">No hay anuncios</p>
          <p className="text-sm mt-1">Los anuncios aparecerán aquí cuando sean publicados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <AnnouncementCard
              key={a._id}
              announcement={a}
              onClick={() => handleClick(a)}
              onPin={() => handlePin(a._id)}
              onDelete={() => handleDelete(a._id)}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}