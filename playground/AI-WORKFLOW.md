# AI Workflow Guide — Claude Code + Cursor

## Resumen rapido

| Tarea | Herramienta | Por que |
|-------|------------|---------|
| Explorar codebase | Claude Code | Puede leer multiples archivos y dar resumen |
| Entender un archivo | Cursor (chat) | Contexto visual del archivo abierto |
| Crear componente nuevo | Cursor (Cmd+K) | Inline generation con preview |
| Crear feature multi-archivo | Claude Code | Orquesta backend + frontend + tests |
| Debugging | Claude Code | Puede leer logs, ejecutar comandos, y rastrear |
| Refactoring | Cursor (Cmd+K) | Seleccionar codigo → transformar inline |
| Code review | Claude Code | Lee todo el diff y da feedback estructurado |
| Escribir tests | Claude Code | Genera tests basados en codigo existente |
| Git operations | Claude Code | Commits, branches, PRs desde terminal |
| Autocompletado | Cursor (Tab) | Sugerencias en tiempo real al escribir |

## Flujo recomendado

### Para un feature nuevo:
1. **Investiga** (Claude Code): "que patron usa el codebase para X?"
2. **Planea** (Claude Code): "crea un plan para implementar Y"
3. **Implementa backend** (Claude Code o Cursor)
4. **Implementa frontend** (Cursor — mejor para UI)
5. **Prueba** (Claude Code): ejecuta tests o curl commands
6. **Review** (Claude Code): "revisa mis cambios recientes"

### Para un bug fix:
1. **Diagnostica** (Claude Code): "el endpoint X devuelve 500, ayudame a debuggear"
2. **Encuentra** (Cursor): navega al archivo con Go to Definition
3. **Corrige** (Cursor): edita inline con Cmd+K
4. **Verifica** (Claude Code): ejecuta el test o curl

## Tips

- **No copies y pegues codigo de AI sin entenderlo.** Lee cada linea.
- **Si el AI genera algo incorrecto, explicale POR QUE esta mal.** Aprende de los errores.
- **Usa AI para el 80% boilerplate, escribe tu el 20% de logica critica.**
- **Siempre verifica con TypeScript:** `npm run typecheck` despues de cada cambio.
