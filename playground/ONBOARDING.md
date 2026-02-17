# Onboarding — Guia de Inicio para el Intern

Bienvenido al programa de training full-stack de LenderoCapital. Esta guia te lleva paso a paso desde cero hasta tener el entorno listo para empezar los ejercicios.

## Paso 1: Cuentas y Accesos

Antes de instalar nada, necesitas estas cuentas:

| Cuenta | URL | Nota |
|--------|-----|------|
| **GitHub** | github.com | Necesitas una cuenta. Compartes tu username para recibir invitacion a los repos. |
| **Anthropic** | console.anthropic.com | Para usar Claude Code. Pide tu API key al equipo o crea cuenta. |
| **Cursor** | cursor.com | IDE con AI. Descarga la version gratuita. |

**Accion:** Envia tu **username de GitHub** al equipo para que te inviten a los repositorios.

## Paso 2: Instalaciones

Instala en este orden:

### 2.1 Node.js (v18 o superior)
- Descarga: https://nodejs.org (version LTS)
- Verifica: `node --version` (debe mostrar v18+)

### 2.2 Git
- Windows: https://git-scm.com/download/win
- Mac: `xcode-select --install` o https://git-scm.com/download/mac
- Verifica: `git --version`

### 2.3 MongoDB
**Opcion A — Docker (recomendado):**
```bash
# Instala Docker Desktop: https://www.docker.com/products/docker-desktop
docker run -d -p 27017:27017 --name mongodb mongo:7
```

**Opcion B — Instalacion directa:**
- Descarga: https://www.mongodb.com/try/download/community
- Sigue las instrucciones de instalacion para tu OS
- Verifica: `mongosh` (debe conectarse a localhost:27017)

### 2.4 VS Code + Extensiones
- Descarga: https://code.visualstudio.com
- Extensiones recomendadas (instalar desde VS Code):
  - **ESLint** — linting de JavaScript/TypeScript
  - **Prettier** — formateo de codigo
  - **Tailwind CSS IntelliSense** — autocomplete para clases Tailwind
  - **MongoDB for VS Code** — explorar la base de datos

### 2.5 Claude Code CLI
```bash
npm install -g @anthropic-ai/claude-code
```
Configura tu API key:
```bash
claude  # La primera vez te pide la API key
```
Verifica: `claude --version`

### 2.6 Cursor IDE
- Descarga: https://cursor.com
- Instala y abre el proyecto desde Cursor

## Paso 3: Clonar Repositorios

Necesitas 2 repos (el segundo es solo referencia para ejercicios avanzados):

```bash
# Repo principal de trabajo
git clone https://github.com/LenderoCapital/lenderohub-playground.git

# Repo de referencia (para ejercicio L4.2)
git clone https://github.com/LenderoCapital/lenderomo-playground.git
```

> Si git clone falla con "repository not found", significa que aun no te han dado acceso. Contacta al equipo con tu username de GitHub.

## Paso 4: Setup del Proyecto

### 4.1 Backend
```bash
cd lenderohub-playground/lenderohub-backend
cp .env.local.example .env.local
npm install
npm run seed:playground
```

Si `seed:playground` falla con error de MongoDB, verifica que MongoDB esta corriendo:
- Docker: `docker ps` (debe mostrar el container "mongodb")
- Local: `mongosh` (debe conectarse)

### 4.2 Frontend
```bash
cd lenderohub-playground/lenderohub-frontend
cp .env.local.example .env.local
npm install
```

## Paso 5: Verificar que Todo Funciona

Abre **2 terminales**:

**Terminal 1 (Backend):**
```bash
cd lenderohub-playground/lenderohub-backend
npm run dev
```
Debe mostrar: "Servidor listo para desarrollo!" en puerto 3000.

**Terminal 2 (Frontend):**
```bash
cd lenderohub-playground/lenderohub-frontend
npm run dev
```
Debe mostrar: "Ready" en puerto 3001.

### Checklist de verificacion

- [ ] `http://localhost:3000/api/health` responde `{"status":"ok"}`
- [ ] `http://localhost:3001` carga la pagina de login
- [ ] Login con `admin@playground.local` / `playground123` funciona
- [ ] `claude --version` responde con un numero de version
- [ ] Cursor abre el proyecto sin errores

**Si todo esta bien, ya puedes empezar con el ejercicio 0.1** en `playground/level-0/01-environment-setup.md`.

## Paso 6: Empezar los Ejercicios

1. Lee `playground/README.md` para la estructura general
2. Lee `playground/AI-WORKFLOW.md` para la guia de herramientas AI
3. Abre `playground/PROGRESS.md` — aqui trackeas tu avance
4. Empieza con `playground/level-0/01-environment-setup.md`

## Estructura del Proyecto

```
lenderohub-playground/
├── lenderohub-backend/      # API Express + TypeScript
│   ├── src/
│   │   ├── server.ts        # Punto de entrada
│   │   ├── routes/           # Definicion de endpoints
│   │   ├── controllers/      # Logica de negocio
│   │   ├── models/           # Modelos Mongoose (MongoDB)
│   │   ├── middlewares/       # Auth, permisos, etc.
│   │   └── services/         # Servicios compartidos
│   └── .env.local.example    # Variables de entorno
├── lenderohub-frontend/     # Next.js + Tailwind + shadcn/ui
│   ├── src/
│   │   ├── app/              # Paginas (App Router)
│   │   ├── components/       # Componentes React
│   │   ├── services/         # Llamadas al API
│   │   └── lib/              # Utilidades
│   └── .env.local.example
└── playground/              # Ejercicios y guias
    ├── README.md             # Guia general
    ├── PROGRESS.md           # Tu tracker de avance
    ├── AI-WORKFLOW.md        # Guia Claude Code vs Cursor
    ├── ONBOARDING.md         # Este archivo
    └── level-0/ ... level-5/ # 19 ejercicios progresivos
```

## Usuarios de Prueba

| Email | Password | Rol | Permisos |
|-------|----------|-----|----------|
| admin@playground.local | playground123 | corporate | Acceso total |
| manager@playground.local | playground123 | administrator | Gestion |
| viewer@playground.local | playground123 | subaccount | Solo lectura |

## Problemas Comunes

| Problema | Solucion |
|----------|----------|
| `npm install` falla con ERESOLVE | `npm install --legacy-peer-deps` |
| MongoDB connection refused | Verificar que MongoDB esta corriendo (`docker ps` o `mongosh`) |
| Puerto 3000 ocupado | `lsof -i :3000` (Mac/Linux) o `netstat -ano \| findstr :3000` (Windows) |
| `git clone` repository not found | No tienes acceso aun. Envia tu GitHub username al equipo. |
| `claude` command not found | `npm install -g @anthropic-ai/claude-code` |
| Login no funciona | Ejecuta `npm run seed:playground` en el backend |

## Contacto

Si te atoras en algo que no puedes resolver con Claude Code o Cursor, contacta al equipo.
