# Ejercicio 4.1: Modelos con Discriminators

## Objetivo
Crear un sistema de "Tickets de Soporte" usando el patron Mongoose discriminator para manejar diferentes tipos de tickets con campos especificos por tipo.

## Contexto
Los discriminators son "herencia" para documentos MongoDB. Un modelo base se extiende con subtipos que comparten la misma coleccion pero tienen campos diferentes. Es un patron avanzado usado en el codebase real (ver beneficiaries).

## Archivos de Referencia
- `lenderohub-backend/src/models/beneficiaries.model.ts` — EL ejemplo a seguir
  - Base: Beneficiary (campos comunes: type, alias, status, userProfile)
  - Discriminator 1: CostCentreBeneficiary (agrega: phoneNumber, isProvider, fiscalAddress)
  - Discriminator 2: CommissionAgentBeneficiary (agrega: userProfile con virtuals)

## Instrucciones
1. Crea `lenderohub-backend/src/models/tickets.model.ts`
2. **Base model `Ticket`:**
   - Fields comunes: title, description, status (open|in_progress|resolved|closed), priority (low|medium|high|urgent), createdBy (ref User), assignedTo (ref User, optional)
   - discriminatorKey: 'ticketType'
   - timestamps: true

3. **Discriminator 1: `BugTicket`** (ticketType: 'bug')
   - Extra fields: severity ('cosmetic'|'minor'|'major'|'critical'), stepsToReproduce (string[]), affectedModule (string), browserInfo (string)

4. **Discriminator 2: `FeatureTicket`** (ticketType: 'feature')
   - Extra fields: businessJustification (string), estimatedEffort ('small'|'medium'|'large'), requestedBy (string), targetRelease (string)

5. **Discriminator 3: `QuestionTicket`** (ticketType: 'question')
   - Extra fields: topic (string), answer (string, initially empty), answeredBy (ref User), answeredAt (Date)

6. Crea controller + routes con:
   - POST /api/tickets — crea ticket (el ticketType determina que discriminator usar)
   - GET /api/tickets — lista todos (con filtro por ticketType)
   - GET /api/tickets/:id — detalle
   - PUT /api/tickets/:id/status — cambiar status
   - PUT /api/tickets/:id/assign — asignar a usuario

## Criterios de Aceptacion
- [ ] Los 3 discriminators se crean en la misma coleccion
- [ ] POST con ticketType='bug' requiere severity y stepsToReproduce
- [ ] POST con ticketType='feature' requiere businessJustification
- [ ] GET /api/tickets?ticketType=bug filtra solo bugs
- [ ] Cada tipo tiene sus campos extra disponibles
- [ ] El modelo base Ticket tiene todos los campos comunes
- [ ] Sin errores de TypeScript

## Guia de AI Tool
- **Claude Code:** `claude "lee beneficiaries.model.ts y crea un modelo Tickets con 3 discriminators (Bug, Feature, Question) siguiendo el mismo patron"`
- **Cursor:** Copia beneficiaries.model.ts y usa Cmd+K para transformarlo al nuevo modelo.

## Hints
<details>
<summary>Hint 1: Patron discriminator</summary>

```typescript
const baseSchema = new Schema({...}, { discriminatorKey: 'ticketType', timestamps: true });
const BaseModel = mongoose.model('Ticket', baseSchema);
const BugTicket = BaseModel.discriminator('BugTicket', bugSchema, 'bug');
```
El tercer argumento de discriminator() es el valor que se guarda en ticketType.
</details>
<details>
<summary>Hint 2: Validacion por tipo en el controller</summary>
En el controller, usa el ticketType del body para decidir que modelo instanciar:

```typescript
const models = { bug: BugTicket, feature: FeatureTicket, question: QuestionTicket };
const Model = models[req.body.ticketType];
const ticket = new Model(req.body);
```
</details>
