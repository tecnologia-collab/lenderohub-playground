# Ejercicio 0.2: Primera Ejecucion

## Objetivo
Explorar la aplicacion corriendo, entender las pantallas principales y la relacion frontend-backend.

## Contexto
Antes de modificar codigo, necesitas entender que hace la aplicacion. Los mejores desarrolladores entienden el producto antes de tocar el codigo.

## Archivos de Referencia
- Abre `http://localhost:3001` en el navegador
- Backend health: `http://localhost:3000/api/health`

## Instrucciones
1. Abre el navegador en `http://localhost:3001`
2. Login con `admin@playground.local` / `playground123`
3. Navega por TODAS las secciones del menu lateral. Para cada una, anota:
   - Nombre de la seccion
   - Que datos muestra
   - Si tiene formularios, botones, o tablas
4. Abre DevTools (F12) > Network tab
5. Repite la navegacion y observa las llamadas API que hace el frontend al backend
6. Abre una terminal y haz estas llamadas directas al API:
   ```bash
   # Health check
   curl http://localhost:3000/api/health

   # Login (obtener token)
   curl -X POST http://localhost:3000/api/users/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@playground.local","password":"playground123"}'
   ```
7. Copia el token JWT del response de login
8. Usa el token para hacer una llamada autenticada:
   ```bash
   curl http://localhost:3000/api/users/me \
     -H "Authorization: Bearer TU_TOKEN_AQUI"
   ```

## Criterios de Aceptacion
- [ ] Puedes listar al menos 5 secciones del menu con su descripcion
- [ ] Identificaste al menos 3 endpoints API en Network tab
- [ ] Login via curl devuelve un token JWT
- [ ] La llamada a /api/users/me con token devuelve tu perfil

## Guia de AI Tool
- **Claude Code:** `claude "explica que endpoints tiene este backend Express"` — deja que Claude lea el codigo y te de un mapa
- **Cursor:** Abre `lenderohub-backend/src/routes/index.ts` y usa Cmd+K para preguntar "que rutas registra este archivo?"

## Hints
<details>
<summary>Hint 1: DevTools Network</summary>
Filtra por "XHR" en Network tab para ver solo las llamadas API (no los archivos estaticos)
</details>
<details>
<summary>Hint 2: JWT Token</summary>
El token viene en el campo `token` o `accessToken` del response JSON del login. Es una cadena larga que empieza con "eyJ..."
</details>
