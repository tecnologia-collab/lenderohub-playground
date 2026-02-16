# Ejercicio 1.3: Formulario con Validacion

## Objetivo
Crear un formulario de contacto con validacion en tiempo real, mensajes de error, y submit handler.

## Contexto
Los formularios son el principal medio de entrada de datos en aplicaciones web. Una buena validacion previene errores en el backend y mejora la experiencia del usuario.

## Archivos de Referencia
- `lenderohub-frontend/src/components/beneficiaries/AddBeneficiaryForm.tsx` — formulario real existente
- `lenderohub-frontend/src/components/ui/input.tsx` — componente de input base
- `lenderohub-frontend/src/components/ui/label.tsx` — componente de label base
- `lenderohub-frontend/src/components/ui/button.tsx` — componente de boton base

## Instrucciones
1. Crea `lenderohub-frontend/src/components/playground/contact-form.tsx`
2. Campos del formulario:
   - **Nombre** (required, min 2 chars)
   - **Email** (required, formato email valido)
   - **Telefono** (optional, exactamente 10 digitos si se llena)
   - **Mensaje** (required, min 10 chars, max 500 chars)
3. Implementa:
   - Validacion en `onChange` (en tiempo real) y en `onSubmit`
   - Mensajes de error debajo de cada campo (rojo)
   - Indicador de campo valido (verde) cuando el campo es valido
   - Contador de caracteres para el campo Mensaje
   - Boton submit deshabilitado mientras haya errores
   - Al submit exitoso, muestra un toast/alerta de "Mensaje enviado" y limpia el form
4. Crea la pagina demo: `lenderohub-frontend/src/app/playground/form/page.tsx`

## Criterios de Aceptacion
- [ ] Cada campo valida en tiempo real al escribir
- [ ] Mensajes de error son claros y especificos ("El email no tiene formato valido")
- [ ] Campo telefono acepta solo numeros y exactamente 10 digitos
- [ ] Contador de caracteres se actualiza en tiempo real
- [ ] Boton submit se habilita solo cuando todo es valido
- [ ] Submit muestra confirmacion y limpia el formulario
- [ ] Sin errores de TypeScript

## Guia de AI Tool
- **Cursor:** Abre AddBeneficiaryForm.tsx como referencia y usa el chat para entender el patron de validacion. Luego crea tu propio form.
- **Claude Code:** Util para generar las reglas de validacion: `claude "genera funciones de validacion para email, telefono mexicano (10 digitos), y texto con min/max length"`

## Hints
<details>
<summary>Hint 1: Patron de validacion</summary>
Usa un estado `errors: Record<string, string>` y una funcion `validate(field, value)` que retorna string (error) o '' (valido).
</details>
<details>
<summary>Hint 2: Regex para email</summary>
`/^[^\s@]+@[^\s@]+\.[^\s@]+$/` — validacion basica de email. Para produccion se usa una libreria como zod.
</details>
