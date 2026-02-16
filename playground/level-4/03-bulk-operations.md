# Ejercicio 4.3: Operaciones en Bulk

## Objetivo
Implementar operaciones masivas (bulk) con seleccion multiple, confirmacion, procesamiento en lote, y feedback de progreso.

## Contexto
En apps empresariales, los usuarios necesitan operar sobre multiples registros a la vez (borrar 50 notas, exportar 100 tickets, cambiar status de 20 transferencias). Es un patron complejo que combina UI, API, y procesamiento.

## Archivos de Referencia
- `lenderohub-frontend/src/app/beneficiarios/page.tsx` — tabla con acciones
- `lenderohub-backend/src/controllers/beneficiaries.controller.ts` — controller existente

## Instrucciones

### Backend:
1. Endpoints bulk en notes controller:
   - POST /api/notes/bulk/delete — recibe array de IDs, soft-delete todos
   - POST /api/notes/bulk/resolve — recibe array de IDs, marca todos como resueltos
   - POST /api/notes/bulk/update-priority — recibe array de IDs + nueva prioridad
   - POST /api/notes/bulk/export — recibe array de IDs (o filtros), devuelve CSV/JSON

2. Cada operacion bulk debe:
   - Validar que todos los IDs existen
   - Verificar permisos para CADA registro
   - Retornar resultado detallado: { success: number, failed: number, errors: [...] }
   - Usar bulkWrite de MongoDB para eficiencia

### Frontend:
3. Componente `BulkActionBar.tsx`:
   - Aparece cuando hay items seleccionados
   - Muestra: "X items seleccionados" + botones de accion (Eliminar, Resolver, Exportar)
   - Boton "Seleccionar todos" / "Deseleccionar todos"
4. En la tabla de notas:
   - Checkbox por fila
   - Checkbox "select all" en header
   - Al seleccionar, aparece la BulkActionBar
5. Dialog de confirmacion:
   - "Estas seguro de eliminar 15 notas? Esta accion no se puede deshacer."
   - Muestra lista de los items seleccionados
6. Progress indicator:
   - Para operaciones largas, muestra barra de progreso
   - Al terminar, muestra resumen de resultados

## Criterios de Aceptacion
- [ ] Checkboxes de seleccion funcionan (individual y select-all)
- [ ] BulkActionBar aparece/desaparece segun seleccion
- [ ] Bulk delete elimina todos los seleccionados
- [ ] Bulk resolve marca todos como resueltos
- [ ] Dialog de confirmacion muestra antes de ejecutar
- [ ] Resultado muestra cuantos exitosos y cuantos fallidos
- [ ] Operacion bulk usa bulkWrite para eficiencia
- [ ] Sin errores de TypeScript

## Guia de AI Tool
- **Claude Code:** Ideal para la parte backend (bulkWrite, validaciones). `claude "agrega endpoints bulk a notes controller: delete, resolve, update-priority, export"`
- **Cursor:** Mejor para el UI de checkboxes y BulkActionBar. Mucha interaccion visual.

## Hints
<details>
<summary>Hint 1: MongoDB bulkWrite</summary>

```typescript
const ops = ids.map(id => ({
  updateOne: {
    filter: { _id: id },
    update: { $set: { isResolved: true, resolvedAt: new Date() } }
  }
}));
const result = await NoteModel.bulkWrite(ops);
// result.modifiedCount, result.matchedCount
```
</details>
<details>
<summary>Hint 2: Select all pattern</summary>

```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const toggleAll = () => {
  if (selectedIds.size === data.length) setSelectedIds(new Set());
  else setSelectedIds(new Set(data.map(d => d._id)));
};
```
</details>
