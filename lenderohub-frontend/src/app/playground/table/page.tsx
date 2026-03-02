'use client';

import { DataTable } from '@/components/playground/data-table';

type User = {
  nombre: string;
  email: string;
  rol: string;
  fecha: string;
}

const USERS: User[] = [
  { nombre: 'Ana García',      email: 'ana@example.com',      rol: 'Admin',    fecha: '2024-01-15' },
  { nombre: 'Carlos López',    email: 'carlos@example.com',   rol: 'Editor',   fecha: '2024-02-03' },
  { nombre: 'María Torres',    email: 'maria@example.com',    rol: 'Viewer',   fecha: '2024-02-18' },
  { nombre: 'José Martínez',   email: 'jose@example.com',     rol: 'Editor',   fecha: '2024-03-01' },
  { nombre: 'Laura Sánchez',   email: 'laura@example.com',    rol: 'Admin',    fecha: '2024-03-12' },
  { nombre: 'Pedro Ramírez',   email: 'pedro@example.com',    rol: 'Viewer',   fecha: '2024-03-20' },
  { nombre: 'Sofía Herrera',   email: 'sofia@example.com',    rol: 'Editor',   fecha: '2024-04-05' },
  { nombre: 'Diego Flores',    email: 'diego@example.com',    rol: 'Viewer',   fecha: '2024-04-14' },
  { nombre: 'Valentina Cruz',  email: 'vale@example.com',     rol: 'Admin',    fecha: '2024-04-22' },
  { nombre: 'Andrés Morales',  email: 'andres@example.com',   rol: 'Editor',   fecha: '2024-05-03' },
  { nombre: 'Camila Jiménez',  email: 'camila@example.com',   rol: 'Viewer',   fecha: '2024-05-11' },
  { nombre: 'Luis Vargas',     email: 'luis@example.com',     rol: 'Editor',   fecha: '2024-05-19' },
  { nombre: 'Isabella Rojas',  email: 'isa@example.com',      rol: 'Viewer',   fecha: '2024-06-02' },
  { nombre: 'Mateo Castillo',  email: 'mateo@example.com',    rol: 'Admin',    fecha: '2024-06-15' },
  { nombre: 'Gabriela Núñez',  email: 'gaby@example.com',     rol: 'Editor',   fecha: '2024-06-28' },
];

const COLUMNS = [
  { key: 'nombre' as const, label: 'Nombre',  sortable: true  },
  { key: 'email'  as const, label: 'Email',   sortable: false },
  { key: 'rol'    as const, label: 'Rol',     sortable: true  },
  { key: 'fecha'  as const, label: 'Fecha',   sortable: true  },
];

export default function TablePlaygroundPage() {
  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Data Table — Demo</h1>
      <DataTable data={USERS} columns={COLUMNS} pageSize={5} />
    </div>
  );
}