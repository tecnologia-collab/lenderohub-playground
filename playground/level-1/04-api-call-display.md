# Ejercicio 1.4: Llamada API y Display de Datos

## Objetivo
Crear una pagina que consume un endpoint real del backend, maneja estados de carga/error, y muestra los datos.

## Contexto
La comunicacion frontend-backend es el corazon de toda aplicacion web. Este ejercicio te ensena el patron completo: fetch data → loading state → success/error handling → render.

## Archivos de Referencia
- `lenderohub-frontend/src/services/beneficiaries.service.ts` — ejemplo de service layer
- `lenderohub-frontend/src/app/beneficiarios/page.tsx` — ejemplo de pagina que consume API
- `lenderohub-backend/src/routes/mock-finco.routes.ts` — mock API disponible

## Instrucciones
1. Crea un service: `lenderohub-frontend/src/services/playground.service.ts`
   - Funcion `getHealthStatus()` → llama a `/api/health`
   - Funcion `getMockBalance()` → llama a `/api/v1/mock-finco/accounts/mock-001/balance`
   - Funcion `getMockInstruments()` → llama a `/api/v1/mock-finco/instruments`
2. Crea la pagina: `lenderohub-frontend/src/app/playground/api-demo/page.tsx`
3. La pagina debe mostrar:
   - **Card 1:** Status del API (health check) con indicador verde/rojo
   - **Card 2:** Balance de la cuenta mock (formateado como moneda MXN)
   - **Card 3:** Lista de instrumentos/beneficiarios mock en una tabla simple
4. Implementa los 3 estados de cada card:
   - **Loading:** skeleton/spinner
   - **Success:** datos renderizados
   - **Error:** mensaje de error con boton "Reintentar"
5. Agrega un boton "Refrescar Todo" que recarga los 3 datos

## Criterios de Aceptacion
- [ ] Las 3 cards cargan datos reales del backend
- [ ] Loading state se muestra mientras se carga
- [ ] Si el backend esta caido, se muestra el estado de error con "Reintentar"
- [ ] Balance se muestra formateado como moneda ($500,000.00 MXN)
- [ ] Lista de instrumentos muestra nombre, CLABE, y status
- [ ] Boton "Refrescar Todo" recarga los datos
- [ ] Sin errores de TypeScript

## Guia de AI Tool
- **Claude Code:** `claude "crea un service layer para consumir la API mock-finco siguiendo el patron de beneficiaries.service.ts"`
- **Cursor:** Abre el service de beneficiaries como referencia y usa Cmd+K para crear el nuevo service siguiendo el mismo patron.

## Hints
<details>
<summary>Hint 1: Patron fetch con estados</summary>

```typescript
const [data, setData] = useState(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState('')

useEffect(() => {
  fetchData()
}, [])

const fetchData = async () => {
  setLoading(true); setError('')
  try { const res = await service.getData(); setData(res) }
  catch (e) { setError('Error al cargar') }
  finally { setLoading(false) }
}
```
</details>
<details>
<summary>Hint 2: Formato moneda</summary>
`new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)`
</details>
