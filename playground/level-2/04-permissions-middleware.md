# Ejercicio 2.4: Middleware de Permisos

## Objetivo
Crear un middleware Express que controle acceso basado en el profileType del usuario (RBAC basico).

## Contexto
En aplicaciones empresariales, no todos los usuarios pueden hacer todo. El control de acceso por roles (RBAC) es una capa de seguridad fundamental que se implementa como middleware.

## Archivos de Referencia
- `lenderohub-backend/src/middlewares/permissions.middleware.ts` — middleware de permisos existente
- `lenderohub-backend/src/config/permissions.ts` — configuracion de permisos por rol
- `lenderohub-backend/src/models/user.model.ts` — profileType del usuario

## Instrucciones
1. Crea `lenderohub-backend/src/middlewares/playground-permissions.middleware.ts`
2. Define una matriz de permisos:
   ```typescript
   const permissionMatrix: Record<string, Record<string, boolean>> = {
     corporate: {
       'notes:create': true, 'notes:read': true, 'notes:update': true, 'notes:delete': true,
       'notes:resolve': true, 'users:read': true, 'users:manage': true,
     },
     administrator: {
       'notes:create': true, 'notes:read': true, 'notes:update': true, 'notes:delete': false,
       'notes:resolve': true, 'users:read': true, 'users:manage': false,
     },
     subaccount: {
       'notes:create': true, 'notes:read': true, 'notes:update': false, 'notes:delete': false,
       'notes:resolve': false, 'users:read': false, 'users:manage': false,
     },
   };
   ```
3. Implementa el middleware factory:
   ```typescript
   function requirePermission(permission: string) {
     return (req, res, next) => {
       // 1. Obtener profileType del usuario autenticado
       // 2. Buscar en la matriz si tiene el permiso
       // 3. Si si → next()
       // 4. Si no → 403 con mensaje descriptivo
     }
   }
   ```
4. Aplica el middleware a las rutas de notas:
   - POST /notes → requiere 'notes:create'
   - GET /notes → requiere 'notes:read'
   - PUT /notes/:id → requiere 'notes:update'
   - DELETE /notes/:id → requiere 'notes:delete'
5. Prueba con los 3 usuarios seed (cada uno tiene diferente profileType)

## Criterios de Aceptacion
- [ ] Corporate puede hacer todas las operaciones
- [ ] Administrator puede crear, leer, actualizar, pero NO borrar
- [ ] Subaccount solo puede crear y leer
- [ ] 403 devuelve mensaje claro: "No tienes permiso para notes:delete"
- [ ] El middleware es reutilizable (funciona con cualquier string de permiso)
- [ ] Sin errores de TypeScript

## Guia de AI Tool
- **Claude Code:** `claude "lee el middleware de permisos existente en middlewares/permissions.middleware.ts y crea una version simplificada para el playground con una matriz de permisos hardcoded"`
- **Cursor:** Abre permissions.middleware.ts, estudia el patron, y usa el chat para crear tu version.

## Hints
<details>
<summary>Hint 1: Middleware factory pattern</summary>
Un middleware factory es una funcion que RETORNA un middleware. Esto permite parametrizarlo:

```typescript
const requirePermission = (perm: string) => (req: Request, res: Response, next: NextFunction) => {
  // check permission
}
// Uso: router.post('/notes', requirePermission('notes:create'), controller.create)
```
</details>
<details>
<summary>Hint 2: Acceder al usuario</summary>
El usuario autenticado esta en `req.user` despues del middleware de auth. Su profileType esta en `req.user.profileType`.
</details>
