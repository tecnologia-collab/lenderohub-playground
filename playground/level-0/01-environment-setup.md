# Ejercicio 0.1: Setup del Entorno

## Objetivo
Instalar y configurar todas las herramientas necesarias para desarrollar en el playground.

## Contexto
Antes de escribir codigo, necesitas un entorno funcional. En el mundo real, un setup incorrecto es la causa #1 de perdida de tiempo en onboarding.

## Archivos de Referencia
- `README.md` (raiz del repo)
- `lenderohub-backend/.env.local.example`
- `lenderohub-frontend/.env.local.example`

## Instrucciones
1. Instalar requisitos: Node.js 18+, MongoDB Community Server (o Docker), Git
2. Instalar VS Code con extensiones: ESLint, Prettier, Tailwind CSS IntelliSense
3. Instalar Claude Code CLI: `npm install -g @anthropic-ai/claude-code`
4. Instalar Cursor IDE (cursor.com)
5. Clonar este repositorio
6. Backend setup:
   ```bash
   cd lenderohub-backend
   cp .env.local.example .env.local
   npm install
   ```
7. Frontend setup:
   ```bash
   cd lenderohub-frontend
   cp .env.local.example .env.local
   npm install
   ```
8. Verificar que MongoDB esta corriendo (`mongosh` para probar conexion)
9. Ejecutar seed: `cd lenderohub-backend && npm run seed:playground`
10. Iniciar ambos servidores (en terminales separadas): `npm run dev`

## Criterios de Aceptacion
- [ ] Node.js 18+ instalado (`node --version`)
- [ ] MongoDB corriendo localmente
- [ ] `npm run dev` inicia el backend sin errores en puerto 3000
- [ ] `npm run dev` inicia el frontend sin errores en puerto 3001
- [ ] `http://localhost:3000/api/health` responde `{"status":"ok"}`
- [ ] Login funciona con admin@playground.local / playground123
- [ ] Claude Code CLI responde a `claude --version`
- [ ] Cursor IDE abre el proyecto

## Guia de AI Tool
- **Claude Code:** Usalo para resolver errores de instalacion. Ejemplo: `claude "npm install falla con error ERESOLVE, como lo arreglo?"`
- **Cursor:** Aun no se usa en este ejercicio.

## Hints
<details>
<summary>Hint 1: MongoDB en Docker</summary>
Si no quieres instalar MongoDB directamente: `docker run -d -p 27017:27017 --name mongodb mongo:7`
</details>
<details>
<summary>Hint 2: Error de puertos</summary>
Si el puerto 3000 o 3001 esta ocupado, revisa con `lsof -i :3000` (Mac/Linux) o `netstat -ano | findstr :3000` (Windows)
</details>
