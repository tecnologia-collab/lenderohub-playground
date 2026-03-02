'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pin, AlertTriangle, AlertCircle, Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { announcementsService, Announcement } from '@/services/announcements.service';
import { AnnouncementForm } from '@/components/announcements/AnnouncementForm';

export default function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ readCount: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const isAdmin = true;

  useEffect(() => {
    const load = async () => {
      try {
        const data = await announcementsService.getById(id);
        setAnnouncement(data);
        if (!data.isRead) await announcementsService.markAsRead(id);
        if (isAdmin) {
          const s = await announcementsService.getStats(id);
          setStats(s);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return (
    <div className="max-w-3xl mx-auto p-6 space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
  );

  if (!announcement) return (
    <div className="max-w-3xl mx-auto p-6 text-center text-gray-500">Anuncio no encontrado</div>
  );

  const priorityBorder = {
    normal: 'border-gray-200 dark:border-gray-700',
    important: 'border-yellow-300 dark:border-yellow-700',
    urgent: 'border-red-400 dark:border-red-700',
  }[announcement.priority];

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a anuncios
      </button>

      {editing ? (
        <div className="border dark:border-gray-700 rounded-xl p-6 bg-white dark:bg-gray-900">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Editar Anuncio</h2>
          <AnnouncementForm
            initial={announcement}
            onSuccess={(updated) => { setAnnouncement(updated); setEditing(false); }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className={`border-2 ${priorityBorder} rounded-xl p-6 bg-white dark:bg-gray-900 space-y-4`}>
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {announcement.isPinned && <Pin className="w-4 h-4 text-blue-500 fill-current" />}
                {announcement.priority === 'urgent' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                {announcement.priority === 'important' && <AlertCircle className="w-4 h-4 text-yellow-500" />}
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  announcement.priority === 'urgent' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                  announcement.priority === 'important' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                  'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>
                  {announcement.priority}
                </span>
                {stats && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Eye className="w-3 h-3" />
                    {stats.readCount} lecturas
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{announcement.title}</h1>
              <p className="text-xs text-gray-400">
                Por {announcement.createdBy?.name || 'Admin'} · {new Date(announcement.createdAt).toLocaleString('es-MX')}
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setEditing(true)}
                className="px-3 py-1.5 text-xs border dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400"
              >
                Editar
              </button>
            )}
          </div>

          {/* Image */}
          {announcement.imageUrl && (
            <img
              src={announcement.imageUrl}
              alt={announcement.title}
              className="w-full rounded-lg object-cover max-h-64"
            />
          )}

          {/* Content */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{announcement.content}</ReactMarkdown>
          </div>

          {/* Expiry */}
          {announcement.expiresAt && (
            <p className="text-xs text-orange-500 dark:text-orange-400">
              ⏱ Expira el {new Date(announcement.expiresAt).toLocaleDateString('es-MX')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}