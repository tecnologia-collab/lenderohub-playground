# Ejercicio 1.2: Tabla de Datos con Ordenamiento

## Objetivo
Crear una tabla interactiva que muestre datos, con ordenamiento por columna y paginacion basica.

## Contexto
Las tablas de datos son el componente mas comun en dashboards empresariales. Saber construir una buena tabla es una skill que usaras en TODOS los proyectos.

## Archivos de Referencia
- `lenderohub-frontend/src/app/beneficiarios/page.tsx` — pagina con tabla existente
- `lenderohub-frontend/src/components/ui/` — componentes base disponibles
- `lenderohub-frontend/src/services/beneficiaries.service.ts` — ejemplo de service layer

## Instrucciones
1. Crea el archivo `lenderohub-frontend/src/components/playground/data-table.tsx`
2. Define el tipo generico:
   ```typescript
   interface DataTableProps<T> {
     data: T[]
     columns: { key: keyof T; label: string; sortable?: boolean }[]
     pageSize?: number
   }
   ```
3. Implementa:
   - Renderizado de headers y rows basado en `columns`
   - Click en header sortable → ordena ascendente/descendente (toggle)
   - Indicador visual de direccion de sort (flecha arriba/abajo)
   - Paginacion: botones Anterior/Siguiente, indicador "Pagina X de Y"
   - Estado vacio cuando `data` es []
4. Crea la pagina demo: `lenderohub-frontend/src/app/playground/table/page.tsx`
5. En la demo, usa datos hardcodeados de usuarios ficticios (nombre, email, rol, fecha)
6. Muestra la tabla con al menos 15 filas y pageSize de 5

## Criterios de Aceptacion
- [ ] La tabla renderiza columnas y filas correctamente
- [ ] Click en header sortable cambia el orden de los datos
- [ ] Indicador visual muestra la direccion del sort actual
- [ ] Paginacion funciona (5 items por pagina, navegar entre paginas)
- [ ] Estado vacio se muestra cuando no hay datos
- [ ] Componente es generico (funciona con cualquier tipo de datos)
- [ ] Sin errores de TypeScript

## Guia de AI Tool
- **Cursor:** Abre beneficiarios/page.tsx como referencia y pide a Cursor que te ayude a extraer el patron de tabla en un componente reutilizable.
- **Claude Code:** `claude "crea un componente DataTable generico en TypeScript con sorting y paginacion"`

## Hints
<details>
<summary>Hint 1: Sorting</summary>
Usa useState para track de `sortKey` y `sortDirection`. En el render, haz `[...data].sort((a, b) => ...)` — nunca mutes el array original.
</details>
<details>
<summary>Hint 2: Paginacion</summary>
`const paginatedData = sortedData.slice((page - 1) * pageSize, page * pageSize)`. Total pages: `Math.ceil(data.length / pageSize)`
</details>
