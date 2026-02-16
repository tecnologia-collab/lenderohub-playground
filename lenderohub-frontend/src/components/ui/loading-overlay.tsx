'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingOverlayProps {
  /** Whether the overlay is visible */
  isLoading: boolean;
  /** Optional message to display below the spinner */
  message?: string;
  /** Whether to use a full-screen overlay (for pages without layout) */
  fullScreen?: boolean;
  /** Additional className for the overlay */
  className?: string;
}

/**
 * A loading overlay that appears on top of content.
 * The content remains visible (with reduced opacity) while loading.
 *
 * Usage:
 * ```tsx
 * <div className="relative">
 *   <LoadingOverlay isLoading={loading} message="Cargando datos..." />
 *   <YourContent />
 * </div>
 * ```
 */
export function LoadingOverlay({
  isLoading,
  message,
  fullScreen = false,
  className
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div
      className={cn(
        'absolute inset-0 z-50 flex items-center justify-center',
        'bg-background/80 backdrop-blur-sm',
        fullScreen && 'fixed',
        className
      )}
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
  );
}

/**
 * A wrapper component that adds loading overlay functionality.
 * Renders children and overlays loading state when active.
 *
 * Usage:
 * ```tsx
 * <LoadingContainer isLoading={loading} message="Cargando...">
 *   <YourContent />
 * </LoadingContainer>
 * ```
 */
export function LoadingContainer({
  isLoading,
  message,
  children,
  className,
  minHeight = '200px',
}: LoadingOverlayProps & {
  children: React.ReactNode;
  minHeight?: string;
}) {
  return (
    <div className={cn('relative', className)} style={{ minHeight: isLoading ? minHeight : undefined }}>
      <LoadingOverlay isLoading={isLoading} message={message} />
      <div className={cn(isLoading && 'opacity-50 pointer-events-none transition-opacity')}>
        {children}
      </div>
    </div>
  );
}
