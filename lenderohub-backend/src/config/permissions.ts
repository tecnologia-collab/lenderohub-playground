/**
 * Permissions System
 *
 * Based on LenderoPay pattern - granular permissions per role
 */

import { IUser, UserProfileType } from '../models/user.model';

const PROFILE_TYPE_ALIASES: Record<string, UserProfileType> = {
  // Corporate aliases
  corporate: 'corporate',
  corp: 'corporate',
  
  // Administrator aliases  
  admin: 'administrator',
  administrator: 'administrator',
  
  // Subaccount aliases
  subaccount: 'subaccount',
  subaccountmanager: 'subaccount',
  sub: 'subaccount',
  
  // Commission Agent aliases (importante: camelCase también)
  commissionagent: 'commissionAgent',
  commission_agent: 'commissionAgent',
};

function normalizeProfileType(value?: string): UserProfileType | null {
  if (!value) return null;
  const normalized = value.replace(/[\s-_]/g, '').toLowerCase();
  return PROFILE_TYPE_ALIASES[normalized] ?? null;
}

// ============================================
// Permission Types
// ============================================
export type Permission =
  // Users
  | 'users:create'           // Crear usuarios
  | 'users:read'             // Ver usuarios
  | 'users:update'           // Editar usuarios
  | 'users:delete'           // Eliminar/desactivar usuarios
  | 'users:manage_admins'    // Administrar otros admins

  // Beneficiaries
  | 'beneficiaries:create'
  | 'beneficiaries:read'
  | 'beneficiaries:update'
  | 'beneficiaries:delete'

  // Transactions
  | 'transactions:read'
  | 'transactions:create'    // Money out
  | 'transactions:cancel'

  // Cost Centres
  | 'cost_centres:create'
  | 'cost_centres:read'
  | 'cost_centres:update'
  | 'cost_centres:manage'    // Enable/disable, set default

  // Subaccounts (Cash Bags)
  | 'subaccounts:create'
  | 'subaccounts:read'
  | 'subaccounts:update'
  | 'subaccounts:transfer'   // Transferir entre bolsas

  // Reports
  | 'reports:view'
  | 'reports:export'

  // Settings
  | 'settings:read'
  | 'settings:update'
  | 'settings:billing';      // Ver/editar facturación

const PERMISSION_SET = new Set<Permission>([
  'users:create', 'users:read', 'users:update', 'users:delete', 'users:manage_admins',
  'beneficiaries:create', 'beneficiaries:read', 'beneficiaries:update', 'beneficiaries:delete',
  'transactions:read', 'transactions:create', 'transactions:cancel',
  'cost_centres:create', 'cost_centres:read', 'cost_centres:update', 'cost_centres:manage',
  'subaccounts:create', 'subaccounts:read', 'subaccounts:update', 'subaccounts:transfer',
  'reports:view', 'reports:export',
  'settings:read', 'settings:update', 'settings:billing',
]);

// ============================================
// Role Permissions Map
// ============================================
const ROLE_PERMISSIONS: Record<UserProfileType, Permission[]> = {
  // Corporate: acceso completo por defecto (LenderoPay)
  corporate: [
    'users:create', 'users:read', 'users:update', 'users:delete', 'users:manage_admins',
    'beneficiaries:create', 'beneficiaries:read', 'beneficiaries:update', 'beneficiaries:delete',
    'transactions:read', 'transactions:create', 'transactions:cancel',
    'cost_centres:create', 'cost_centres:read', 'cost_centres:update', 'cost_centres:manage',
    'subaccounts:create', 'subaccounts:read', 'subaccounts:update', 'subaccounts:transfer',
    'reports:view', 'reports:export',
    'settings:read', 'settings:update', 'settings:billing',
  ],

  // Administrator: sin billing ni admins por defecto
  administrator: [
    'users:create', 'users:read', 'users:update',
    'beneficiaries:create', 'beneficiaries:read', 'beneficiaries:update',
    'transactions:read', 'transactions:create',
    'cost_centres:read',
    'subaccounts:read', 'subaccounts:transfer',
    'reports:view', 'reports:export',
    'settings:read',
  ],

  // Subaccount: acceso limitado a subcuentas asignadas
  subaccount: [
    'beneficiaries:create', 'beneficiaries:read',
    'transactions:read', 'transactions:create',
    'subaccounts:read',
    'reports:view',
  ],

  // Commission Agent: lectura y comisiones
  commissionAgent: [
    'transactions:read',
    'reports:view',
  ],
};

const READ_ONLY_PERMISSIONS: Permission[] = [
  'users:read',
  'beneficiaries:read',
  'transactions:read',
  'cost_centres:read',
  'subaccounts:read',
  'reports:view',
  'settings:read',
];

// ============================================
// Helper Functions
// ============================================

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: UserProfileType | string): Permission[] {
  const normalized = normalizeProfileType(role);
  if (!normalized) return [];
  return ROLE_PERMISSIONS[normalized] || [];
}

export function getPermissionsForUser(user: IUser): Permission[] {
  if (user.readOnly) {
    return READ_ONLY_PERMISSIONS;
  }
  const base = getPermissionsForRole(user.profileType);
  
  // Debug: log para verificar permisos
  console.log(`🔐 getPermissionsForUser - profileType: "${user.profileType}", normalized: "${normalizeProfileType(user.profileType)}", base permissions: ${base.length}`);
  
  const extras = (user.permissions || []).filter((permission): permission is Permission =>
    PERMISSION_SET.has(permission as Permission)
  );
  return Array.from(new Set([...base, ...extras]));
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserProfileType | string, permission: Permission): boolean {
  const permissions = getPermissionsForRole(role);
  return permissions.includes(permission);
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: UserProfileType | string, permissions: Permission[]): boolean {
  const rolePermissions = getPermissionsForRole(role);
  return permissions.some(p => rolePermissions.includes(p));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: UserProfileType | string, permissions: Permission[]): boolean {
  const rolePermissions = getPermissionsForRole(role);
  return permissions.every(p => rolePermissions.includes(p));
}

export function userHasPermission(user: IUser, permission: Permission): boolean {
  const permissions = getPermissionsForUser(user);
  return permissions.includes(permission);
}

export function userHasAnyPermission(user: IUser, permissions: Permission[]): boolean {
  const rolePermissions = getPermissionsForUser(user);
  return permissions.some(p => rolePermissions.includes(p));
}

export function userHasAllPermissions(user: IUser, permissions: Permission[]): boolean {
  const rolePermissions = getPermissionsForUser(user);
  return permissions.every(p => rolePermissions.includes(p));
}

/**
 * Get roles that a user can create based on their own role
 */
export function getCreatableRoles(creatorRole: UserProfileType | string): UserProfileType[] {
  const normalized = normalizeProfileType(creatorRole);
  switch (normalized) {
    case 'corporate':
      // Corporativo puede crear todos los roles incluyendo otros corporativos (solo consulta)
      return ['corporate', 'administrator', 'subaccount', 'commissionAgent'];
    case 'administrator':
      // Administrator solo puede crear subcuentas
      return ['subaccount'];
    default:
      return [];
  }
}

export function getCreatableRolesForUser(user: IUser): UserProfileType[] {
  const baseRoles = getCreatableRoles(user.profileType);
  if (normalizeProfileType(user.profileType) === 'administrator' && userHasPermission(user, 'users:manage_admins')) {
    return Array.from(new Set([...baseRoles, 'administrator']));
  }
  return baseRoles;
}

/**
 * Check if a user can create a specific role
 */
export function canCreateRole(creatorRole: UserProfileType | string, targetRole: UserProfileType | string): boolean {
  const normalizedCreator = normalizeProfileType(creatorRole);
  const normalizedTarget = normalizeProfileType(targetRole);
  if (!normalizedCreator || !normalizedTarget) return false;

  if (normalizedCreator === 'administrator' && normalizedTarget === 'administrator') {
    return hasPermission(normalizedCreator, 'users:manage_admins');
  }

  return getCreatableRoles(normalizedCreator).includes(normalizedTarget);
}

export function canCreateRoleForUser(user: IUser, targetRole: UserProfileType | string): boolean {
  const normalizedTarget = normalizeProfileType(targetRole);
  if (!normalizedTarget) return false;
  return getCreatableRolesForUser(user).includes(normalizedTarget);
}

// ============================================
// Export
// ============================================
export const Permissions = {
  getForRole: getPermissionsForRole,
  getForUser: getPermissionsForUser,
  has: hasPermission,
  hasAny: hasAnyPermission,
  hasAll: hasAllPermissions,
  userHas: userHasPermission,
  userHasAny: userHasAnyPermission,
  userHasAll: userHasAllPermissions,
  getCreatableRoles,
  getCreatableRolesForUser,
  canCreateRole,
  canCreateRoleForUser,
};

export default Permissions;
