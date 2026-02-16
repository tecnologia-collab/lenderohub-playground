# Ejercicio 2.1: Endpoint Health Detallado

## Objetivo
Crear un nuevo endpoint GET /api/health/detailed que devuelva informacion completa del estado del servidor.

## Contexto
Los health checks detallados son esenciales para monitoreo en produccion. Van mas alla de un simple "ok" e incluyen metricas del sistema, estado de conexiones, y version de la aplicacion.

## Archivos de Referencia
- `lenderohub-backend/src/routes/index.ts` — endpoint /health existente (linea 19-25)
- `lenderohub-backend/package.json` — para obtener version
- `lenderohub-backend/src/database/` — conexion a MongoDB

## Instrucciones
1. En `lenderohub-backend/src/routes/index.ts`, agrega un nuevo endpoint:
   ```
   GET /api/health/detailed
   ```
2. El endpoint debe responder con:
   ```json
   {
     "status": "ok",
     "version": "1.0.0",
     "uptime": 12345,
     "timestamp": "2026-02-16T...",
     "memory": {
       "heapUsed": "45 MB",
       "heapTotal": "67 MB",
       "rss": "89 MB"
     },
     "mongodb": {
       "status": "connected",
       "host": "localhost",
       "name": "lenderohub-playground"
     },
     "environment": "development"
   }
   ```
3. Obtener la version de package.json (usa `require` o `fs.readFileSync`)
4. Obtener uptime de `process.uptime()` (en segundos)
5. Obtener memoria de `process.memoryUsage()` (convertir bytes a MB)
6. Obtener estado de MongoDB de `mongoose.connection` (readyState, host, name)
7. Probar con: `curl http://localhost:3000/api/health/detailed | jq`

## Criterios de Aceptacion
- [ ] GET /api/health/detailed responde 200
- [ ] Incluye version del package.json
- [ ] Incluye uptime en segundos
- [ ] Incluye uso de memoria en MB
- [ ] Incluye estado de MongoDB (connected/disconnected)
- [ ] Incluye el nombre de la base de datos
- [ ] Sin errores de TypeScript

## Guia de AI Tool
- **Claude Code:** `claude "agrega un endpoint /health/detailed al routes/index.ts que incluya version, uptime, memoria, y estado de MongoDB"` — Claude puede hacer el cambio directo.
- **Cursor:** Abre routes/index.ts, posiciona el cursor despues del health endpoint existente, y usa Cmd+K para pedir el nuevo endpoint.

## Hints
<details>
<summary>Hint 1: Mongoose connection state</summary>
`import mongoose from 'mongoose'` → `mongoose.connection.readyState` (0=disconnected, 1=connected, 2=connecting). `mongoose.connection.host` y `mongoose.connection.name` para host/db.
</details>
<details>
<summary>Hint 2: Formatear bytes a MB</summary>
`const formatMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(2) + ' MB'`
</details>
