'use client';

import { useState } from 'react';
import { AlertCard } from '@/components/ui/alert-card';

export default function AlertsPlaygroundPage() {
  const [showDismissible, setShowDismissible] = useState(true);

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Alert Card — Demo</h1>

      {/* 4 variantes estáticas */}
      <AlertCard
        variant="info"
        title="Información"
        message="Esta es una alerta informativa para el usuario."
      />

      <AlertCard
        variant="success"
        title="Éxito"
        message="La operación se completó correctamente."
      />

      <AlertCard
        variant="warning"
        title="Advertencia"
        message="Revisa los datos antes de continuar."
      />

      <AlertCard
        variant="error"
        title="Error"
        message="Ocurrió un problema al procesar la solicitud."
      />

      {/* Alerta dismissible */}
      <div className="space-y-3">
        <button
          onClick={() => setShowDismissible(true)}
          className="px-4 py-2 bg-gray-800 text-white rounded-md text-sm hover:bg-gray-700 transition-colors"
        >
          Mostrar alerta dismissible
        </button>

        {showDismissible && (
          <AlertCard
            variant="warning"
            title="Puedes cerrar esta alerta"
            message="Haz click en la X para ocultarla."
            dismissible
            onDismiss={() => setShowDismissible(false)}
          />
        )}
      </div>
    </div>
  );
}