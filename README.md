# LenderoHUB Playground

Copia sanitizada de LenderoHUB para aprendizaje de desarrollo full-stack. Incluye ejercicios progresivos (niveles 0-5) para aprender Express + Next.js + MongoDB con herramientas AI (Claude Code + Cursor).

## Quick Start

### Requisitos
- Node.js 18+
- MongoDB Community Server (o Docker: `docker run -d -p 27017:27017 --name mongodb mongo:7`)
- Git

### Setup

```bash
# 1. Clonar
git clone https://github.com/LenderoCapital/lenderohub-playground.git
cd lenderohub-playground

# 2. Backend
cd lenderohub-backend
cp .env.local.example .env.local
npm install
npm run seed:playground

# 3. Frontend (nueva terminal)
cd lenderohub-frontend
cp .env.local.example .env.local
npm install

# 4. Iniciar (cada uno en su terminal)
cd lenderohub-backend && npm run dev    # Puerto 3000
cd lenderohub-frontend && npm run dev   # Puerto 3001
```

### Verificar

- Backend health: http://localhost:3000/api/health
- Frontend: http://localhost:3001
- Login: `admin@playground.local` / `playground123`

### Usuarios seed

| Email | Password | Rol |
|-------|----------|-----|
| admin@playground.local | playground123 | corporate |
| manager@playground.local | playground123 | administrator |
| viewer@playground.local | playground123 | subaccount |

### Mock Finco API

La API mock de Finco esta disponible en `http://localhost:3000/api/mock-finco/`:
- `GET /instruments` — lista beneficiarios mock
- `POST /transfers` — crear transferencia mock
- `GET /accounts/:id/balance` — balance mock (500,000 MXN)

## Ejercicios

Los ejercicios estan en `playground/`. Empieza por `playground/level-0/01-environment-setup.md`.

Ver `playground/README.md` para la guia completa y `playground/PROGRESS.md` para trackear tu avance.

## Stack Tecnologico

| Componente | Tecnologia |
|-----------|-----------|
| Backend | Express + TypeScript + Mongoose |
| Frontend | Next.js (App Router) + Tailwind + shadcn/ui |
| Base de datos | MongoDB |
| Auth | JWT (access + refresh tokens) |
| Validacion | Zod, express-validator |
