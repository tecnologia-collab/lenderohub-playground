# Ejercicio 2.2: Modelo Mongoose — Notas Internas

## Objetivo
Crear un modelo Mongoose completo para "Notas Internas" (internal notes) que se puedan asociar a cualquier entidad del sistema.

## Contexto
Los modelos son la base de datos en aplicaciones Node.js/MongoDB. Un buen modelo incluye validaciones, indices, virtuals, y metodos. Este patron lo usaras en CADA feature nueva.

## Archivos de Referencia
- `lenderohub-backend/src/models/beneficiaries.model.ts` — ejemplo con discriminators
- `lenderohub-backend/src/models/user.model.ts` — ejemplo con metodos y virtuals
- `lenderohub-backend/src/models/index.ts` — donde se exportan los modelos

## Instrucciones
1. Crea `lenderohub-backend/src/models/notes.model.ts`
2. Define la interface `INote`:
   ```typescript
   interface INote {
     content: string          // Texto de la nota (required, max 2000 chars)
     entityType: string       // Tipo de entidad: 'user' | 'beneficiary' | 'transfer' | 'general'
     entityId?: ObjectId      // ID de la entidad asociada (optional para 'general')
     createdBy: ObjectId      // Ref a User
     priority: string         // 'low' | 'medium' | 'high'
     isResolved: boolean      // Default false
     resolvedBy?: ObjectId    // Ref a User
     resolvedAt?: Date
     tags: string[]           // Array de tags para busqueda
   }
   ```
3. Implementa el schema con:
   - Validaciones en cada campo (required, enum, maxlength)
   - `timestamps: true` (agrega createdAt y updatedAt automaticamente)
   - Indice compuesto: `{ entityType: 1, entityId: 1 }` para queries rapidas
   - Indice de texto: `{ content: 'text', tags: 'text' }` para busqueda full-text
   - Virtual `isOverdue`: retorna true si la nota tiene mas de 7 dias sin resolver
   - Metodo `resolve(userId)`: marca la nota como resuelta
4. Exporta el modelo y la interface

## Criterios de Aceptacion
- [ ] El modelo se crea sin errores de TypeScript
- [ ] Campos required: content, entityType, createdBy
- [ ] Campos con enum: entityType (4 opciones), priority (3 opciones)
- [ ] content tiene maxlength de 2000
- [ ] Indices compuesto y de texto definidos
- [ ] Virtual `isOverdue` funciona correctamente
- [ ] Metodo `resolve()` marca isResolved=true con resolvedBy y resolvedAt
- [ ] timestamps generan createdAt y updatedAt

## Guia de AI Tool
- **Claude Code:** `claude "crea un modelo Mongoose para notas internas siguiendo el patron de beneficiaries.model.ts"` — dejalo que lea la referencia y genere.
- **Cursor:** Copia beneficiaries.model.ts, renombralo, y usa Cmd+K para transformar "convierte este modelo a uno de Notas Internas con estos campos: ..."

## Hints
<details>
<summary>Hint 1: Virtual con calculo de fecha</summary>

```typescript
schema.virtual('isOverdue').get(function() {
  if (this.isResolved) return false;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return this.createdAt < sevenDaysAgo;
});
```
</details>
<details>
<summary>Hint 2: Metodo de instancia</summary>

```typescript
schema.methods.resolve = async function(userId: mongoose.Types.ObjectId) {
  this.isResolved = true;
  this.resolvedBy = userId;
  this.resolvedAt = new Date();
  return this.save();
};
```
</details>
