# Ejercicio 3.1: Sistema de Notificaciones (Full-Stack)

## Objetivo
Crear un sistema de notificaciones completo: modelo en backend, API para CRUD, y UI con badge en el header y panel desplegable.

## Contexto
Las notificaciones son un feature full-stack por excelencia. Tocan modelo, API, service, componente, y estado global. Es el ejercicio mas completo hasta ahora.

## Archivos de Referencia
- `lenderohub-backend/src/models/user.model.ts` — patron de modelo
- `lenderohub-backend/src/controllers/beneficiaries.controller.ts` — patron de controller
- `lenderohub-frontend/src/components/layout/` — donde vive el header
- `lenderohub-frontend/src/contexts/` — patron de React context

## Instrucciones

### Backend:
1. Modelo `notifications.model.ts`:
   - Fields: title, message, type (info|success|warning|error), userId (ref User), isRead (boolean), link (optional URL), createdAt
2. Controller `notifications.controller.ts`:
   - GET /api/notifications — listar del usuario actual, ordenadas por fecha desc
   - GET /api/notifications/unread-count — contar no leidas
   - PUT /api/notifications/:id/read — marcar como leida
   - PUT /api/notifications/read-all — marcar todas como leidas
   - POST /api/notifications (admin only) — crear notificacion para un usuario
3. Rutas + registro en index.ts

### Frontend:
4. Service `notifications.service.ts`:
   - Funciones para cada endpoint
5. Componente `NotificationBell.tsx`:
   - Icono de campana en el header
   - Badge rojo con contador de no leidas
   - Click abre un panel dropdown con lista de notificaciones
   - Cada notificacion muestra titulo, mensaje, tiempo relativo ("hace 5 min")
   - Click en notificacion la marca como leida
   - Boton "Marcar todas como leidas"
6. Integrar en el header/layout existente

## Criterios de Aceptacion
- [ ] Modelo de notificaciones creado con validaciones
- [ ] 5 endpoints funcionando (list, unread-count, mark-read, read-all, create)
- [ ] Badge muestra count de no leidas (se actualiza al marcar)
- [ ] Panel dropdown lista notificaciones con estilo por tipo
- [ ] Tiempo relativo funciona ("hace 2 horas", "ayer")
- [ ] "Marcar todas como leidas" limpia el badge
- [ ] Solo admin puede crear notificaciones
- [ ] Sin errores de TypeScript en backend ni frontend

## Guia de AI Tool
- **Claude Code:** Ideal para este ejercicio — puede crear backend y frontend en secuencia. `claude "crea un sistema de notificaciones completo: modelo, controller, rutas en backend, y componente NotificationBell en frontend"`
- **Cursor:** Util para pulir el UI del dropdown. Abre el componente y usa Cmd+K para ajustar estilos.

## Hints
<details>
<summary>Hint 1: Tiempo relativo</summary>
Usa la libreria `date-fns` que ya esta instalada en el frontend:

```typescript
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
formatDistanceToNow(new Date(date), { addSuffix: true, locale: es })
```
</details>
<details>
<summary>Hint 2: Badge en el header</summary>
Busca el componente Header en `components/layout/Header.tsx` y agrega el NotificationBell junto a los otros iconos del header.
</details>
