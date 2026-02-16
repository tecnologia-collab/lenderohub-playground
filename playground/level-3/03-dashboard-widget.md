# Ejercicio 3.3: Widget de Dashboard

## Objetivo
Crear un widget interactivo para el dashboard que muestre KPIs (Key Performance Indicators) con datos reales del backend.

## Contexto
Los dashboards son la pantalla principal de toda app empresarial. Aprenderas a agregar datos en el backend y visualizarlos con graficas en el frontend.

## Archivos de Referencia
- `lenderohub-frontend/src/components/dashboard/stats-cards.tsx` — cards existentes
- `lenderohub-backend/src/controllers/hub.controller.ts` — endpoints de dashboard existentes
- `lenderohub-frontend/src/app/dashboard/` — pagina de dashboard

## Instrucciones

### Backend:
1. Endpoint `GET /api/dashboard/playground-stats`:
   - Total de notas (del ejercicio 2.2) por estado (resueltas, pendientes, por prioridad)
   - Total de usuarios activos
   - Actividad reciente (si existe el activity log del ejercicio 3.2)
   - Total de notificaciones no leidas (si existe del ejercicio 3.1)

### Frontend:
2. Componente `PlaygroundStats.tsx`:
   - **Card "Notas":** Total, pendientes vs resueltas (donut chart o barra)
   - **Card "Usuarios":** Count por tipo (corporate, administrator, subaccount)
   - **Card "Actividad":** Requests en las ultimas 24h (sparkline o mini bar chart)
   - **Card "Quick Actions":** Botones para: Crear Nota, Ver Activity Log, Ver Notificaciones
3. Integra el widget en la pagina de dashboard o en `/playground/dashboard`

## Criterios de Aceptacion
- [ ] Endpoint devuelve stats agregados correctos
- [ ] Al menos 3 cards de KPI con datos reales
- [ ] Al menos 1 grafica (donut, barra, o sparkline)
- [ ] Quick actions navegan a las paginas correctas
- [ ] Cards muestran loading state mientras cargan
- [ ] Sin errores de TypeScript

## Guia de AI Tool
- **Claude Code:** Crea el endpoint backend: `claude "agrega un endpoint de stats para el dashboard del playground"`
- **Cursor:** Ideal para crear los componentes de cards y graficas. Abre stats-cards.tsx como referencia.

## Hints
<details>
<summary>Hint 1: Agregaciones MongoDB</summary>

```typescript
const stats = await NoteModel.aggregate([
  { $group: { _id: '$priority', count: { $sum: 1 } } }
]);
```
</details>
<details>
<summary>Hint 2: Charts simples</summary>
Si recharts esta instalado: `import { PieChart, Pie, Cell } from 'recharts'`. Si no, usa divs con widths porcentuales como barras simples.
</details>
