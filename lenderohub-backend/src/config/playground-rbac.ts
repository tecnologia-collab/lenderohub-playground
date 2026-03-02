// ============================================
// Types
// ============================================

export type Action = 'create' | 'read' | 'update' | 'delete' | 'export';
export type Resource = 'tickets' | 'notes' | 'users' | 'notifications' | 'activity-log' | 'settings';
export type Role = 'admin' | 'manager' | 'operator' | 'viewer';

// ============================================
// Permission Matrix
// ============================================

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

// ============================================
// Helper Functions
// ============================================

export function hasPermission(role: Role, resource: Resource, action: Action): boolean {
  return matrix[role]?.[resource]?.includes(action) ?? false;
}

export function getPermissions(role: Role): Record<Resource, Action[]> {
  return matrix[role] ?? {} as Record<Resource, Action[]>;
}

export function getResourcePermissions(resource: Resource): Record<Role, Action[]> {
  const result = {} as Record<Role, Action[]>;
  for (const role of Object.keys(matrix) as Role[]) {
    result[role] = matrix[role][resource] ?? [];
  }
  return result;
}

export const ROLES = Object.keys(matrix) as Role[];
export const RESOURCES = Object.keys(matrix.admin) as Resource[];
export const ACTIONS: Action[] = ['create', 'read', 'update', 'delete', 'export'];

export default matrix;