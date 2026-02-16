# Ejercicio 1.1: Componente de Alerta Estatica

## Objetivo
Crear un componente React reutilizable que muestre alertas/notificaciones con diferentes estados (info, success, warning, error).

## Contexto
Los componentes de alerta son fundamentales en cualquier app. Este ejercicio te ensena a crear componentes con props tipados, variantes de estilo, y composicion.

## Archivos de Referencia
- `lenderohub-frontend/src/components/dashboard/stats-cards.tsx` — ejemplo de componente con variantes
- `lenderohub-frontend/src/components/ui/` — componentes base de shadcn/ui (card, badge)
- `lenderohub-frontend/tailwind.config.ts` — configuracion de colores

## Instrucciones
1. Crea el archivo `lenderohub-frontend/src/components/ui/alert-card.tsx`
2. Define una interface `AlertCardProps` con:
   - `variant`: 'info' | 'success' | 'warning' | 'error'
   - `title`: string
   - `message`: string
   - `dismissible?`: boolean (optional, default false)
   - `onDismiss?`: () => void
3. Implementa el componente con:
   - Colores diferentes por variante (usa Tailwind)
   - Iconos por variante (usa lucide-react: Info, CheckCircle, AlertTriangle, XCircle)
   - Boton de cerrar si `dismissible` es true
   - Animacion de entrada (CSS transition o Tailwind animate)
4. Crea una pagina demo: `lenderohub-frontend/src/app/playground/alerts/page.tsx`
5. En la pagina demo, muestra las 4 variantes del componente
6. Agrega un boton que muestre/oculte una alerta dismissible

## Criterios de Aceptacion
- [ ] Componente renderiza las 4 variantes con colores distintos
- [ ] Cada variante tiene su icono correcto
- [ ] El prop `dismissible` muestra/oculta el boton de cerrar
- [ ] `onDismiss` se llama al hacer click en cerrar
- [ ] La pagina demo en `/playground/alerts` muestra todos los casos
- [ ] No hay errores de TypeScript (`npm run typecheck`)

## Guia de AI Tool
- **Cursor:** Ideal para este ejercicio. Abre stats-cards.tsx como referencia, luego usa Cmd+K para generar el componente nuevo con "crea un AlertCard component siguiendo el patron de este archivo".
- **Claude Code:** Util si quieres que genere todo el componente de golpe: `claude "crea un componente AlertCard en src/components/ui/alert-card.tsx con variantes info/success/warning/error"`

## Hints
<details>
<summary>Hint 1: Colores por variante</summary>
Usa un objeto map: `const variantStyles = { info: 'bg-blue-50 border-blue-200 text-blue-800', success: 'bg-green-50 ...', ... }`
</details>
<details>
<summary>Hint 2: Iconos de lucide-react</summary>
`import { Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'`
Luego usa un map: `const variantIcons = { info: Info, success: CheckCircle, ... }`
</details>
