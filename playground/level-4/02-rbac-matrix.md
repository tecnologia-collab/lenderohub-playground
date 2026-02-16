# Ejercicio 4.2: Matriz RBAC Completa

## Objetivo
Implementar un sistema de control de acceso basado en roles (RBAC) con una matriz de permisos por recurso y accion, similar al sistema de LenderoMO.

## Contexto
RBAC es el estandar de seguridad en aplicaciones empresariales. LenderoMO usa un sistema donde cada combinacion de (rol, etapa, accion) tiene un permiso explicito. Vas a crear algo similar para el playground.

## Archivos de Referencia
- `../lenderomo-playground/lenderomo-backend/src/config/permissions.ts` — **EL modelo a seguir** (revisa la matriz stage x role)
- `../lenderomo-playground/lenderomo-backend/src/middlewares/permissions.middleware.ts` — middleware que consulta la matriz
- `lenderohub-backend/src/config/permissions.ts` — version HUB (mas simple)

## Instrucciones
1. Crea `lenderohub-backend/src/config/playground-rbac.ts`
2. Define roles: `admin`, `manager`, `operator`, `viewer`
3. Define recursos: `tickets`, `notes`, `users`, `notifications`, `activity-log`, `settings`
4. Define acciones: `create`, `read`, `update`, `delete`, `export`
5. Crea la matriz completa:
   ```
           | tickets | notes | users | notifications | activity-log | settings |
   admin   | CRUDE   | CRUDE | CRUDE | CRUDE         | RE           | CRUD     |
   manager | CRUD    | CRUD  | CR    | CRU           | RE           | R        |
   operator| CRU     | CRU   | R     | R             | R            | -        |
   viewer  | R       | R     | R     | R             | -            | -        |
   ```
   (C=create, R=read, U=update, D=delete, E=export)

6. Implementa funciones helper:
   - `hasPermission(role, resource, action): boolean`
   - `getPermissions(role): Record<string, string[]>` — todos los permisos del rol
   - `getResourcePermissions(resource): Record<string, string[]>` — que puede hacer cada rol en un recurso
7. Crea middleware `rbac.middleware.ts`:
   ```typescript
   function requireAccess(resource: string, action: string) {
     return (req, res, next) => { ... }
   }
   ```
8. Aplica a TODAS las rutas del playground (tickets, notes, notifications, etc.)
9. Crea pagina frontend `playground/rbac-test/page.tsx`:
   - Muestra la matriz completa en una tabla
   - Permite seleccionar un usuario y ver sus permisos
   - Permite probar un permiso (seleccionar rol + recurso + accion → muestra si esta permitido)

## Criterios de Aceptacion
- [ ] Matriz define 4 roles x 6 recursos x 5 acciones
- [ ] hasPermission() funciona correctamente para todas las combinaciones
- [ ] Middleware protege las rutas segun la matriz
- [ ] Pagina frontend visualiza la matriz
- [ ] Testing: loginear con viewer y verificar que POST /api/tickets devuelve 403
- [ ] Testing: loginear con admin y verificar que DELETE funciona
- [ ] Sin errores de TypeScript

## Guia de AI Tool
- **Claude Code:** Lee primero el permissions.ts de LenderoMO para entender el patron: `claude "lee ../lenderomo-playground/lenderomo-backend/src/config/permissions.ts y crea un sistema RBAC similar para el playground con 4 roles y 6 recursos"`
- **Cursor:** Util para la pagina frontend de visualizacion de la matriz.

## Hints
<details>
<summary>Hint 1: Estructura de la matriz</summary>

```typescript
type Action = 'create' | 'read' | 'update' | 'delete' | 'export';
type Resource = 'tickets' | 'notes' | ...;
type Role = 'admin' | 'manager' | ...;
const matrix: Record<Role, Record<Resource, Action[]>> = { ... };
```
</details>
<details>
<summary>Hint 2: hasPermission</summary>

```typescript
function hasPermission(role: Role, resource: Resource, action: Action): boolean {
  return matrix[role]?.[resource]?.includes(action) ?? false;
}
```
</details>
