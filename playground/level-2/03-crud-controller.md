# Ejercicio 2.3: Controller CRUD Completo

## Objetivo
Crear un controller con las 5 operaciones CRUD (Create, Read, ReadAll, Update, Delete) para el modelo de Notas del ejercicio anterior.

## Contexto
Los controllers conectan las rutas HTTP con la logica de negocio. Un buen controller maneja validacion de input, errores, y respuestas consistentes.

## Archivos de Referencia
- `lenderohub-backend/src/controllers/beneficiaries.controller.ts` — ejemplo de controller CRUD
- `lenderohub-backend/src/routes/beneficiaries.routes.ts` — como se conectan rutas a controllers

## Instrucciones
1. Crea `lenderohub-backend/src/controllers/notes.controller.ts`
2. Implementa 5 handlers:

   **a) createNote (POST /api/notes)**
   - Recibe: content, entityType, entityId, priority, tags
   - Valida campos requeridos
   - Asigna createdBy del usuario autenticado (req.user)
   - Devuelve 201 con la nota creada

   **b) getNotes (GET /api/notes)**
   - Soporta query params: ?entityType=user&priority=high&isResolved=false
   - Soporta paginacion: ?page=1&limit=10
   - Soporta busqueda: ?search=texto
   - Ordena por createdAt descendente
   - Devuelve { data: notes[], total, page, totalPages }

   **c) getNoteById (GET /api/notes/:id)**
   - Busca por ID, popula createdBy (nombre y email)
   - Si no existe: 404

   **d) updateNote (PUT /api/notes/:id)**
   - Solo el creador puede editar (verificar createdBy === req.user)
   - Campos actualizables: content, priority, tags
   - No se puede cambiar entityType ni entityId

   **e) deleteNote (DELETE /api/notes/:id)**
   - Soft delete: cambia un campo isDeleted a true (o similar)
   - Solo el creador o admin puede borrar

3. Crea `lenderohub-backend/src/routes/notes.routes.ts`
   - Define las 5 rutas con middleware de autenticacion
   - Registra en routes/index.ts bajo `/notes`

## Criterios de Aceptacion
- [ ] POST /api/notes crea una nota y devuelve 201
- [ ] GET /api/notes lista notas con filtros y paginacion
- [ ] GET /api/notes/:id devuelve una nota con creador populado
- [ ] PUT /api/notes/:id actualiza solo si eres el creador
- [ ] DELETE /api/notes/:id hace soft-delete
- [ ] Errores devuelven mensajes claros (400, 403, 404)
- [ ] Todas las rutas requieren autenticacion
- [ ] Sin errores de TypeScript

## Guia de AI Tool
- **Claude Code:** Mejor opcion — puede crear el controller, las rutas, y registrarlas en index.ts en una sola operacion: `claude "crea un CRUD completo para el modelo Note: controller, routes, y registralo en routes/index.ts"`
- **Cursor:** Util para editar archivos individuales. Abre beneficiaries.controller.ts como referencia y pide "crea un controller similar para el modelo Note".

## Hints
<details>
<summary>Hint 1: Paginacion</summary>

```typescript
const page = parseInt(req.query.page as string) || 1;
const limit = parseInt(req.query.limit as string) || 10;
const skip = (page - 1) * limit;
const [data, total] = await Promise.all([
  NoteModel.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
  NoteModel.countDocuments(filter)
]);
```
</details>
<details>
<summary>Hint 2: Verificar ownership</summary>

```typescript
if (note.createdBy.toString() !== req.user._id.toString()) {
  return res.status(403).json({ error: 'Solo el creador puede editar esta nota' });
}
```
</details>
