# Ejercicio 3.2: Log de Actividad

## Objetivo
Crear un sistema que registre automaticamente las acciones de los usuarios (login, crear beneficiario, hacer transferencia, etc.) y una pagina para consultarlo.

## Contexto
El audit log es un requerimiento legal en fintech. Cada accion del usuario debe quedar registrada para trazabilidad. Aprenderas sobre middleware que intercepta requests.

## Archivos de Referencia
- `lenderohub-backend/src/middlewares/` — middlewares existentes
- `lenderohub-backend/src/routes/index.ts` — donde se monta middleware global
- `lenderohub-backend/src/server.ts` — configuracion del servidor Express

## Instrucciones

### Backend:
1. Modelo `activity-log.model.ts`:
   - Fields: userId, action (string), resource (string, ej: "beneficiary"), resourceId (optional), method (GET|POST|PUT|DELETE), path (string), ip (string), userAgent (string), statusCode (number), duration (ms), metadata (Mixed), createdAt
2. Middleware `activity-logger.middleware.ts`:
   - Se ejecuta en CADA request (excepto health checks)
   - Captura: usuario, metodo, path, IP, user-agent
   - Mide duracion del request (start time → response finish)
   - Guarda en MongoDB al terminar el response
3. Controller con endpoints:
   - GET /api/activity-log — listar (con filtros por userId, action, resource, fecha)
   - GET /api/activity-log/stats — estadisticas (requests por hora, top endpoints, top usuarios)

### Frontend:
4. Pagina `app/playground/activity-log/page.tsx`:
   - Tabla con columnas: Fecha, Usuario, Accion, Recurso, Status, Duracion
   - Filtros: por usuario, por recurso, por rango de fechas
   - Graficas simples: requests por hora (barchart), top endpoints (lista)

## Criterios de Aceptacion
- [ ] Cada request al API se registra automaticamente en la BD
- [ ] Health checks NO se registran
- [ ] El log incluye duracion del request en ms
- [ ] GET /api/activity-log lista con filtros y paginacion
- [ ] GET /api/activity-log/stats devuelve estadisticas agregadas
- [ ] La pagina frontend muestra el log con filtros
- [ ] Las estadisticas se visualizan (graficas o tablas)
- [ ] Sin errores de TypeScript

## Guia de AI Tool
- **Claude Code:** Perfecto para crear el middleware (toca server.ts y middlewares/). `claude "crea un middleware de activity logging que registre cada request en MongoDB"`
- **Cursor:** Mejor para la pagina frontend con graficas — usa el chat con @recharts si esta instalado.

## Hints
<details>
<summary>Hint 1: Medir duracion</summary>

```typescript
const start = Date.now();
res.on('finish', () => {
  const duration = Date.now() - start;
  // save to DB
});
```
</details>
<details>
<summary>Hint 2: Evitar health checks</summary>

```typescript
if (req.path === '/api/health' || req.path === '/api/health/detailed') return next();
```
</details>
