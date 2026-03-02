'use client';

import { Pin, AlertTriangle, AlertCircle, Clock, Eye } from 'lucide-react';
import { Announcement } from '@/services/announcements.service';

interface AnnouncementCardProps {
  announcement: Announcement;
  onClick: () => void;
  onPin?: () => void;
  onDelete?: () => void;
  isAdmin?: boolean;
}

const PRIORITY_STYLES = {
  normal:    { border: 'border-gray-200 dark:border-gray-700', badge: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400', icon: null },
  important: { border: 'border-yellow-300 dark:border-yellow-700', badge: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400', icon: AlertCircle },
  urgent:    { border: 'border-red-400 dark:border-red-700', badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', icon: AlertTriangle },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 60) return `hace ${mins} min`;
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${days}d`;
}

export function AnnouncementCard({ announcement, onClick, onPin, onDelete, isAdmin }: AnnouncementCardProps) {
  const style = PRIORITY_STYLES[announcement.priority];
  const Icon = style.icon;

  return (
    <div
      onClick={onClick}
      className={`relative border-2 ${style.border} rounded-xl p-5 cursor-pointer hover:shadow-md transition-all bg-white dark:bg-gray-900 ${
        !announcement.isRead ? 'ring-2 ring-blue-200 dark:ring-blue-800' : ''
      }`}
    >
      {/* Pinned indicator */}
      {announcement.isPinned && (
        <div className="absolute top-3 right-3 text-blue-500">
          <Pin className="w-4 h-4 fill-current" />
        </div>
      )}

      {/* Unread dot */}
      {!announcement.isRead && (
        <span className="absolute top-3 left-3 w-2 h-2 bg-blue-500 rounded-full" />
      )}

      <div className="space-y-2 mt-1">
        <div className="flex items-center gap-2 flex-wrap">
          {Icon && <Icon className={`w-4 h-4 ${style.badge.includes('red') ? 'text-red-500' : 'text-yellow-500'}`} />}
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.badge}`}>
            {announcement.priority}
          </span>
          {announcement.imageUrl && (
            <span className="text-xs text-gray-400">📎 imagen</span>
          )}
        </div>

        <h3 className="font-semibold text-gray-900 dark:text-gray-100 leading-snug">
          {announcement.title}
        </h3>

        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
          {announcement.content.replace(/[#*`]/g, '')}
        </p>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(announcement.createdAt)}
            </span>
            {announcement.expiresAt && (
              <span className="flex items-center gap-1 text-orange-400">
                <Clock className="w-3 h-3" />
                Expira {new Date(announcement.expiresAt).toLocaleDateString('es-MX')}
              </span>
            )}
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={onPin}
                className={`text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                  announcement.isPinned ? 'text-blue-500' : 'text-gray-400'
                }`}
              >
                {announcement.isPinned ? 'Desfijar' : 'Fijar'}
              </button>
              <button
                onClick={onDelete}
                className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Eliminar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}