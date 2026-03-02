# Ejercicio 0.4: Claude Code vs Cursor — Cuando Usar Cada Uno

## Objetivo
Experimentar con ambas herramientas AI en tareas concretas para entender sus fortalezas y debilidades.

## Contexto
Las herramientas AI son como instrumentos: cada una es mejor para ciertas tareas. Saber elegir la correcta te hace 3-5x mas productivo que usar siempre la misma.

## Archivos de Referencia
- Cualquier archivo del proyecto (usaras ambas herramientas para explorar)

## Instrucciones

### Parte A: Tareas con Claude Code (terminal)
Ejecuta cada tarea y anota el resultado y tu opinion:

1. **Exploracion amplia:**
   ```bash
   claude "lista todos los modelos de Mongoose en el backend y dime que campos tiene cada uno"
   ```

2. **Debugging:**
   ```bash
   claude "si el endpoint POST /api/beneficiaries devuelve 403, cuales son las posibles causas?"
   ```

3. **Generacion de codigo:**
   ```bash
   claude "crea un endpoint GET /api/health/detailed que devuelva: version del package.json, uptime del proceso, estado de conexion a MongoDB, y memoria usada"
   ```

4. **Refactoring multi-archivo:**
   ```bash
   claude "agrega un campo 'lastModifiedBy' a todos los modelos que no lo tengan"
   ```

### Parte B: Tareas con Cursor (IDE)
Abre el proyecto en Cursor y prueba:

1. **Autocompletado contextual:** Abre un controller y empieza a escribir una nueva funcion. Observa las sugerencias.
2. **Edicion inline:** Selecciona una funcion, presiona Cmd+K, y pide "agrega manejo de errores try/catch"
3. **Chat con contexto:** Abre un archivo y pregunta en el chat de Cursor "que hace esta funcion?"
4. **Multi-archivo con @:** En el chat, escribe "@beneficiaries.model.ts @beneficiaries.controller.ts explica como se relacionan"

### Parte C: Comparacion
Llena esta tabla:

| Tarea | Claude Code | Cursor | Mejor para... |
|-------|------------|--------|---------------|
| Explorar codebase | |Cursor 
| Editar un archivo | |Claude Code 
| Crear archivo nuevo |Claude Code 
| Debugging | |Cursor
| Refactoring multi-archivo | |Claude Code 
| Autocompletado al escribir | |Cursor 

## Criterios de Aceptacion
- [ ] Completaste al menos 3 tareas con Claude Code
- [ ] Completaste al menos 3 tareas con Cursor
- [ ] Tienes la tabla comparativa llena con tus observaciones
- [ ] Puedes explicar en que es mejor cada herramienta

## Guia de AI Tool
Este ejercicio ES sobre las herramientas AI, asi que usa ambas libremente.

## Hints
<details>
<summary>Hint 1: Claude Code Strengths</summary>
Claude Code es mejor para: explorar codebases grandes, cambios multi-archivo, debugging, tareas que requieren leer muchos archivos, operaciones de terminal/git.
</details>
<details>
<summary>Hint 2: Cursor Strengths</summary>
Cursor es mejor para: edicion inline, autocompletado mientras escribes, preguntas sobre el archivo abierto, cambios pequenos y precisos, review visual de cambios.
</details>
