'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Trash2, Info } from 'lucide-react';

export function DevTools() {
  const [isOpen, setIsOpen] = useState(false);
  const [lastAction, setLastAction] = useState('');

  // Solo mostrar en desarrollo
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const reset2FA = () => {
    localStorage.removeItem('demo_user');
    setLastAction('2FA reseteado');
    setTimeout(() => {
      window.location.href = '/setup-2fa';
    }, 500);
  };

  const clearAll = () => {
    localStorage.clear();
    setLastAction('Todo limpiado');
    setTimeout(() => {
      window.location.href = '/login';
    }, 500);
  };

  const check2FAStatus = () => {
    const demoUser = JSON.parse(localStorage.getItem('demo_user') || '{}');
    const status = demoUser.twoFactorEnabled ? 'Configurado ✅' : 'No configurado ❌';
    setLastAction(`2FA Status: ${status}`);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full w-12 h-12 shadow-lg bg-yellow-500 hover:bg-yellow-600 text-black"
          title="Developer Tools"
        >
          🛠️
        </Button>
      )}

      {/* Panel */}
      {isOpen && (
        <Card className="w-80 p-4 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              <h3 className="font-bold text-sm">Developer Tools</h3>
            </div>
            <Button
              onClick={() => setIsOpen(false)}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
            >
              ✕
            </Button>
          </div>

          {/* Warning */}
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-yellow-900 dark:text-yellow-200">
                  Solo visible en desarrollo
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  Este panel no aparecerá en producción
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button
              onClick={check2FAStatus}
              variant="outline"
              className="w-full justify-start text-sm h-9"
              size="sm"
            >
              <Info className="w-4 h-4 mr-2" />
              Check 2FA Status
            </Button>

            <Button
              onClick={reset2FA}
              variant="outline"
              className="w-full justify-start text-sm h-9 text-blue-600 hover:text-blue-700"
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset 2FA Demo
            </Button>

            <Button
              onClick={clearAll}
              variant="outline"
              className="w-full justify-start text-sm h-9 text-red-600 hover:text-red-700"
              size="sm"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Data
            </Button>
          </div>

          {/* Last Action */}
          {lastAction && (
            <div className="mt-4 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-600 dark:text-gray-400">
              {lastAction}
            </div>
          )}

          {/* Info */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              <strong>Tip:</strong> Usa &quot;Reset 2FA&quot; para volver a probar el flujo de configuración.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
