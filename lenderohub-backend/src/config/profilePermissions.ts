/**
 * Profile Permissions Configuration
 *
 * Defines all available permissions per profile type.
 * These constants are used by:
 * - UserProfile model (schema definition)
 * - Permission validation utilities
 * - Frontend permission checks
 */

// =============================================================================
// CORPORATE PERMISSIONS (15)
// =============================================================================

export const corporatePermissions = [
  'beneficiariesNew',           // Crear beneficiarios
  'beneficiariesMassNew',       // Alta masiva de beneficiarios
  'costCentreManagement',       // Gestionar centros de costos
  'commissionRequestManagement', // Gestionar solicitudes de comisión
  'commissionTransfers',        // Transferencias de comisión
  'internalAccountManagement',  // Gestionar cuentas internas
  'reportsTransactions',        // Ver reporte de transacciones
  'reportsAccountMovements',    // Ver movimientos de cuenta
  'reportsMassTransfersOut',    // Ver reporte de pagos masivos
  'transfersOutPayment',        // Realizar pagos SPEI
  'transfersOutMassPayment',    // Realizar pagos masivos
  'transfersOutSubaccounts',    // Transferencias entre subcuentas
  'usersNew',                   // Crear usuarios
  'usersManagement',            // Gestionar usuarios
  'editSessionTTL'              // Editar tiempo de sesión
] as const

export type CorporatePermission = typeof corporatePermissions[number]

// Default values for corporate permissions
export const corporatePermissionDefaults: Record<CorporatePermission, boolean> = {
  beneficiariesNew: true,
  beneficiariesMassNew: true,
  costCentreManagement: true,
  commissionRequestManagement: true,
  commissionTransfers: true,
  internalAccountManagement: true,
  reportsTransactions: true,
  reportsAccountMovements: true,
  reportsMassTransfersOut: true,
  transfersOutPayment: true,
  transfersOutMassPayment: true,
  transfersOutSubaccounts: true,
  usersNew: true,
  usersManagement: true,
  editSessionTTL: true
}

// =============================================================================
// ADMINISTRATOR PERMISSIONS (12)
// =============================================================================

export const administratorPermissions = [
  'beneficiariesNew',           // Crear beneficiarios
  'beneficiariesMassNew',       // Alta masiva de beneficiarios
  'internalAccountManagement',  // Gestionar cuentas internas
  'transfersOutPayment',        // Realizar pagos SPEI
  'transfersOutMassPayment',    // Realizar pagos masivos
  'transfersOutSubaccounts',    // Transferencias entre subcuentas
  'usersNew',                   // Crear usuarios
  'reportsTransactions',        // Ver reporte de transacciones
  'reportsAccountMovements',    // Ver movimientos de cuenta
  'reportsMassTransfersOut',    // Ver reporte de pagos masivos
  'reportsAdministeredClients', // Ver clientes administrados
  'editSessionTTL',             // Editar tiempo de sesión
  'adminOtherAdmins'            // Administrar otros admins
] as const

export type AdministratorPermission = typeof administratorPermissions[number]

// Default values for administrator permissions
export const administratorPermissionDefaults: Record<AdministratorPermission, boolean> = {
  beneficiariesNew: true,
  beneficiariesMassNew: true,
  internalAccountManagement: true,
  transfersOutPayment: true,
  transfersOutMassPayment: true,
  transfersOutSubaccounts: true,
  usersNew: true,
  reportsTransactions: true,
  reportsAccountMovements: true,
  reportsMassTransfersOut: true,
  reportsAdministeredClients: false,  // Default false
  editSessionTTL: false,              // Default false
  adminOtherAdmins: false             // Default false
}

// =============================================================================
// SUBACCOUNT MANAGER PERMISSIONS (8)
// =============================================================================

export const subaccountManagerPermissions = [
  'beneficiariesNew',           // Crear beneficiarios
  'beneficiariesMassNew',       // Alta masiva de beneficiarios
  'transfersOutPayment',        // Realizar pagos SPEI
  'transfersOutMassPayment',    // Realizar pagos masivos
  'transfersOutSubaccounts',    // Transferencias entre subcuentas
  'reportsTransactions',        // Ver reporte de transacciones
  'reportsAccountMovements',    // Ver movimientos de cuenta
  'reportsMassTransfersOut'     // Ver reporte de pagos masivos
] as const

export type SubaccountManagerPermission = typeof subaccountManagerPermissions[number]

// Default values for subaccount manager permissions
export const subaccountManagerPermissionDefaults: Record<SubaccountManagerPermission, boolean> = {
  beneficiariesNew: true,
  beneficiariesMassNew: true,
  transfersOutPayment: true,
  transfersOutMassPayment: true,
  transfersOutSubaccounts: true,
  reportsTransactions: true,
  reportsAccountMovements: true,
  reportsMassTransfersOut: true
}

// =============================================================================
// ALL PERMISSIONS (Union type for validation)
// =============================================================================

export type Permission = CorporatePermission | AdministratorPermission | SubaccountManagerPermission

// All unique permissions across all profile types
export const allPermissions = [
  ...new Set([
    ...corporatePermissions,
    ...administratorPermissions,
    ...subaccountManagerPermissions
  ])
] as const

// =============================================================================
// PERMISSION GROUPS (for UI organization)
// =============================================================================

export const permissionGroups = {
  beneficiaries: {
    label: 'Beneficiarios',
    permissions: ['beneficiariesNew', 'beneficiariesMassNew']
  },
  transfers: {
    label: 'Transferencias',
    permissions: ['transfersOutPayment', 'transfersOutMassPayment', 'transfersOutSubaccounts', 'commissionTransfers']
  },
  reports: {
    label: 'Reportes',
    permissions: ['reportsTransactions', 'reportsAccountMovements', 'reportsMassTransfersOut', 'reportsAdministeredClients']
  },
  management: {
    label: 'Administración',
    permissions: ['costCentreManagement', 'internalAccountManagement', 'commissionRequestManagement']
  },
  users: {
    label: 'Usuarios',
    permissions: ['usersNew', 'usersManagement', 'adminOtherAdmins']
  },
  settings: {
    label: 'Configuración',
    permissions: ['editSessionTTL']
  }
} as const

// =============================================================================
// PERMISSION LABELS (for UI display)
// =============================================================================

export const permissionLabels: Record<Permission, string> = {
  beneficiariesNew: 'Crear beneficiarios',
  beneficiariesMassNew: 'Alta masiva de beneficiarios',
  costCentreManagement: 'Gestionar centros de costos',
  commissionRequestManagement: 'Gestionar solicitudes de comisión',
  commissionTransfers: 'Transferencias de comisión',
  internalAccountManagement: 'Gestionar cuentas internas',
  reportsTransactions: 'Ver reporte de transacciones',
  reportsAccountMovements: 'Ver movimientos de cuenta',
  reportsMassTransfersOut: 'Ver reporte de pagos masivos',
  reportsAdministeredClients: 'Ver clientes administrados',
  transfersOutPayment: 'Realizar pagos SPEI',
  transfersOutMassPayment: 'Realizar pagos masivos',
  transfersOutSubaccounts: 'Transferencias entre subcuentas',
  usersNew: 'Crear usuarios',
  usersManagement: 'Gestionar usuarios',
  editSessionTTL: 'Editar tiempo de sesión',
  adminOtherAdmins: 'Administrar otros administradores'
}
