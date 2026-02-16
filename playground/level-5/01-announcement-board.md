# Ejercicio 5.1: Tablero de Anuncios (Capstone Project)

## Objetivo
Disenar e implementar un feature completo desde cero: un tablero de anuncios interno donde admins publican anuncios y todos los usuarios los ven. Este ejercicio integra TODO lo aprendido en levels 0-4.

## Contexto
Este es tu proyecto final. No hay instrucciones paso-a-paso — solo requisitos. Tu decides la arquitectura, los modelos, los componentes, y la implementacion. Usa TODO lo que aprendiste.

## Requisitos Funcionales

### Admin puede:
- Crear un anuncio con: titulo, contenido (rich text o markdown), prioridad (normal, importante, urgente), fecha de expiracion opcional, y archivos adjuntos (imagen URL)
- Editar anuncios existentes
- Eliminar anuncios
- Fijar un anuncio en la parte superior (pin)
- Ver estadisticas: cuantos usuarios leyeron cada anuncio

### Todos los usuarios pueden:
- Ver la lista de anuncios (mas recientes primero, pinned en top)
- Ver el detalle de un anuncio (renderizado de markdown)
- Marcar un anuncio como "leido" (similar a notificaciones)
- Filtrar por: todos, no leidos, importantes/urgentes
- Buscar por texto en titulo o contenido

### Sistema debe:
- Mostrar badge de "nuevos anuncios" en la navegacion (como el NotificationBell)
- Anuncios expirados se ocultan automaticamente
- Los anuncios urgentes se muestran con estilo diferente (borde rojo, icono)
- Responsive: funciona en mobile y desktop

## Requisitos Tecnicos
- **Modelo:** Mongoose schema con validaciones completas
- **API:** CRUD completo + endpoints para pin, read-tracking, stats
- **Permisos:** Usar el RBAC del ejercicio 4.2 — solo admin crea, todos leen
- **Frontend:** Pagina de lista, pagina de detalle, componente de creacion/edicion
- **TypeScript:** 0 errores en typecheck
- **Patron:** Seguir los patrones del codebase existente (service layer, controller pattern, etc.)

## Criterios de Aceptacion
- [ ] Admin puede crear, editar, eliminar, y fijar anuncios
- [ ] Usuarios ven lista de anuncios ordenada (pinned first, then by date)
- [ ] Markdown se renderiza correctamente en el detalle
- [ ] Read tracking funciona (badge de no leidos)
- [ ] Filtros y busqueda funcionan
- [ ] Anuncios expirados no se muestran
- [ ] Urgentes tienen estilo diferenciado
- [ ] RBAC protege las rutas correctamente
- [ ] La pagina es responsive
- [ ] 0 errores TypeScript en backend y frontend
- [ ] Codigo sigue los patrones del codebase

## Guia de AI Tool
Este es el momento de demostrar tu workflow. Usa la combinacion de Claude Code + Cursor que mas te funcione:

1. **Planificacion:** Usa Claude Code para generar un plan de implementacion
2. **Backend:** Claude Code para modelo + controller + routes (multi-archivo)
3. **Frontend:** Cursor para componentes + paginas (mejor para UI)
4. **Review:** Claude Code para revisar el codigo completo al final
5. **Testing:** Claude Code para ejecutar los endpoints con curl

## Hints
<details>
<summary>Hint 1: Estructura sugerida</summary>
Backend:

- `models/announcements.model.ts`
- `controllers/announcements.controller.ts`
- `routes/announcements.routes.ts`

Frontend:

- `app/announcements/page.tsx` (lista)
- `app/announcements/[id]/page.tsx` (detalle)
- `app/announcements/new/page.tsx` (crear — admin)
- `components/announcements/AnnouncementCard.tsx`
- `components/announcements/AnnouncementForm.tsx`
- `services/announcements.service.ts`
</details>
<details>
<summary>Hint 2: Read tracking</summary>
Crea una coleccion separada `announcement-reads` con { announcementId, userId, readAt }. Para contar no leidos: total announcements - reads del usuario. Para stats: count distinct users en reads por announcement.
</details>
<details>
<summary>Hint 3: Markdown rendering</summary>
El frontend ya tiene react-markdown instalado. Usalo:

```typescript
import ReactMarkdown from 'react-markdown'
```

```jsx
<ReactMarkdown>{content}</ReactMarkdown>
```
</details>
