'use client';

import { useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

type Action = 'create' | 'read' | 'update' | 'delete' | 'export';
type Resource = 'tickets' | 'notes' | 'users' | 'notifications' | 'activity-log' | 'settings';
type Role = 'admin' | 'manager' | 'operator' | 'viewer';

const ROLES: Role[] = ['admin', 'manager', 'operator', 'viewer'];
const RESOURCES: Resource[] = ['tickets', 'notes', 'users', 'notifications', 'activity-log', 'settings'];
const ACTIONS: Action[] = ['create', 'read', 'update', 'delete', 'export'];

const matrix: Record<Role, Record<Resource, Action[]>> = {
  admin: {
    'tickets':       ['create', 'read', 'update', 'delete', 'export'],
    'notes':         ['create', 'read', 'update', 'delete', 'export'],
    'users':         ['create', 'read', 'update', 'delete', 'export'],
    'notifications': ['create', 'read', 'update', 'delete', 'export'],
    'activity-log':  ['read', 'export'],
    'settings':      ['create', 'read', 'update', 'delete'],
  },
  manager: {
    'tickets':       ['create', 'read', 'update', 'delete'],
    'notes':         ['create', 'read', 'update', 'delete'],
    'users':         ['create', 'read'],
    'notifications': ['create', 'read', 'update'],
    'activity-log':  ['read', 'export'],
    'settings':      ['read'],
  },
  operator: {
    'tickets':       ['create', 'read', 'update'],
    'notes':         ['create', 'read', 'update'],
    'users':         ['read'],
    'notifications': ['read'],
    'activity-log':  ['read'],
    'settings':      [],
  },
  viewer: {
    'tickets':       ['read'],
    'notes':         ['read'],
    'users':         ['read'],
    'notifications': ['read'],
    'activity-log':  [],
    'settings':      [],
  },
};

function hasPermission(role: Role, resource: Resource, action: Action): boolean {
  return matrix[role]?.[resource]?.includes(action) ?? false;
}

const ACTION_LABELS: Record<Action, string> = {
  create: 'C', read: 'R', update: 'U', delete: 'D', export: 'E',
};

const ROLE_COLORS: Record<Role, string> = {
  admin:    'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  manager:  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  operator: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  viewer:   'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
};

export default function RbacTestPage() {
  const [selectedRole, setSelectedRole] = useState<Role>('admin');
  const [testRole, setTestRole] = useState<Role>('viewer');
  const [testResource, setTestResource] = useState<Resource>('tickets');
  const [testAction, setTestAction] = useState<Action>('create');

  const testResult = hasPermission(testRole, testResource, testAction);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">RBAC Matrix — Test</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Visualización y prueba del sistema de permisos
        </p>
      </div>

      {/* Matriz completa */}
      <div className="border dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
        <div className="px-4 py-3 border-b dark:border-gray-700">
          <h2 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Matriz de Permisos Completa</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Recurso</th>
                {ROLES.map((role) => (
                  <th key={role} className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${ROLE_COLORS[role]}`}>
                      {role}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RESOURCES.map((resource) => (
                <tr key={resource} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{resource}</td>
                  {ROLES.map((role) => {
                    const perms = matrix[role][resource];
                    return (
                      <td key={role} className="px-4 py-3 text-center">
                        <span className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {perms.length > 0
                            ? perms.map((a) => ACTION_LABELS[a]).join('')
                            : <span className="text-gray-300 dark:text-gray-600">—</span>
                          }
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t dark:border-gray-700 text-xs text-gray-400">
          C=create · R=read · U=update · D=delete · E=export
        </div>
      </div>

      {/* Permisos por rol */}
      <div className="border dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-900 space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Permisos del rol:</h2>
          <div className="flex gap-2">
            {ROLES.map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  selectedRole === role
                    ? ROLE_COLORS[role] + ' ring-2 ring-offset-1 ring-current'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {RESOURCES.map((resource) => {
            const perms = matrix[selectedRole][resource];
            return (
              <div key={resource} className="border dark:border-gray-700 rounded p-3 space-y-2">
                <p className="font-mono text-xs font-semibold text-gray-600 dark:text-gray-400">{resource}</p>
                <div className="flex flex-wrap gap-1">
                  {ACTIONS.map((action) => {
                    const allowed = perms.includes(action);
                    return (
                      <span
                        key={action}
                        className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          allowed
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 line-through'
                        }`}
                      >
                        {action}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tester */}
      <div className="border dark:border-gray-700 rounded-lg p-5 bg-white dark:bg-gray-900 space-y-4">
        <h2 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Probar Permiso</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Rol</label>
            <select
              value={testRole}
              onChange={(e) => setTestRole(e.target.value as Role)}
              className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Recurso</label>
            <select
              value={testResource}
              onChange={(e) => setTestResource(e.target.value as Resource)}
              className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {RESOURCES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Acción</label>
            <select
              value={testAction}
              onChange={(e) => setTestAction(e.target.value as Action)}
              className="w-full px-3 py-2 text-sm border dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <div className={`flex items-center gap-3 p-4 rounded-lg ${
          testResult
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}>
          {testResult
            ? <CheckCircle className="w-6 h-6 text-green-500" />
            : <XCircle className="w-6 h-6 text-red-500" />
          }
          <div>
            <p className={`font-semibold text-sm ${testResult ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
              {testResult ? '✅ Permitido' : '❌ Denegado'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {testRole} → {testAction} en {testResource}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}