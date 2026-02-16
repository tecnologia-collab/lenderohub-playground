# Ejercicio 0.3: Tour del Codebase

## Objetivo
Entender la arquitectura del proyecto: como se organiza el codigo, que patron sigue, y donde vive cada cosa.

## Contexto
En proyectos reales, pasaras mas tiempo leyendo codigo que escribiendolo. Saber navegar un codebase es una skill fundamental.

## Archivos de Referencia
- `lenderohub-backend/src/` (toda la estructura)
- `lenderohub-frontend/src/` (toda la estructura)

## Instrucciones
1. **Backend — Mapea la arquitectura:**
   - Abre `src/server.ts` — punto de entrada. Como arranca Express?
   - Abre `src/routes/index.ts` — como se registran las rutas?
   - Elige UNA ruta (ej: beneficiaries) y sigue el flujo completo:
     - `routes/beneficiaries.routes.ts` → que endpoints define?
     - `controllers/beneficiaries.controller.ts` → que logica tiene cada handler?
     - `models/beneficiaries.model.ts` → como se define el modelo Mongoose?
   - Abre `src/middlewares/` — que middlewares existen?
   - Abre `src/config/` — que configuraciones hay?

2. **Frontend — Mapea la arquitectura:**
   - Abre `src/app/layout.tsx` — layout principal
   - Abre `src/app/page.tsx` — pagina raiz
   - Elige UNA pagina (ej: beneficiarios) y sigue el flujo:
     - `app/beneficiarios/page.tsx` → que muestra?
     - `components/beneficiaries/` → que componentes usa?
     - `services/beneficiaries.service.ts` → como llama al API?
   - Abre `src/components/ui/` — componentes base de shadcn/ui

3. **Dibuja un diagrama** (en papel o herramienta) del flujo:
   ```
   Browser → Next.js Page → Service → API (Express) → Controller → Model → MongoDB
   ```

4. **Usa Claude Code para profundizar:**
   ```bash
   claude "dame un resumen de la arquitectura del backend en src/"
   claude "que patron de diseno usa beneficiaries.model.ts?"
   ```

## Criterios de Aceptacion
- [ ] Puedes explicar el flujo Request → Route → Controller → Model → Response
- [ ] Puedes nombrar al menos 5 modelos del backend
- [ ] Puedes explicar que es un "discriminator" de Mongoose (usado en beneficiaries)
- [ ] Puedes explicar como el frontend llama al backend (service layer)
- [ ] Tienes un diagrama (mental o escrito) de la arquitectura

## Guia de AI Tool
- **Claude Code:** Ideal para este ejercicio. Pidele que explique archivos o patrones completos.
- **Cursor:** Usa "Go to Definition" (F12) para navegar entre archivos. Usa Cmd+K para preguntas sobre archivos abiertos.

## Hints
<details>
<summary>Hint 1: Discriminators</summary>
Un discriminator de Mongoose es como herencia de clases pero para documentos MongoDB. Un modelo base (Beneficiary) se extiende con subtipos (CostCentreBeneficiary, CommissionAgentBeneficiary) que comparten la misma coleccion pero tienen campos diferentes.
</details>
<details>
<summary>Hint 2: Service Layer en Frontend</summary>
Los archivos en `services/` son funciones que encapsulan llamadas fetch/axios al API. Esto separa la logica de comunicacion HTTP de los componentes React.
</details>
