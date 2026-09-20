# Confirmaciones de asistencia → Google Sheets

El sitio se publica como archivos estáticos (GitHub Pages), así que no hay backend
propio. El formulario de "Confirma tu asistencia" envía cada respuesta directo a
un **Google Form**, que las va agregando como filas en una **Google Sheet**
vinculada — gratis, sin límite práctico de respuestas, sin código propio que
mantener, y sin la pantalla de "Google no verificó esta app" que sí aparece con
Apps Script.

## Cómo funciona

Google Forms acepta respuestas por `POST` directo a su URL de
`.../formResponse`, usando el mismo formato que usa el propio formulario al
enviarse. No requiere autenticación ni autorización — cualquiera puede enviar
una respuesta, igual que si hubiera llenado el formulario a mano. Cada campo del
formulario tiene un identificador `entry.NNNNNNNN`; para enviar una respuesta
por código hay que mandar esos mismos nombres de campo.

## Ya está conectado

El formulario "Confirmacion" (ID `1FAIpQLScnGc51Ue42DYhAL5VkhOdmBNMYR-wjYZylq6YZyHxsk7HAzA`)
ya está enlazado en [`src/routes/index.tsx`](../src/routes/index.tsx):

```ts
const GOOGLE_FORM_ACTION_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScnGc51Ue42DYhAL5VkhOdmBNMYR-wjYZylq6YZyHxsk7HAzA/formResponse";
const GOOGLE_FORM_ENTRY_NOMBRE = "entry.721620457";
const GOOGLE_FORM_ENTRY_ASISTENCIA = "entry.2110773338";
```

Cada confirmación desde el sitio aparece como fila nueva en la Google Sheet
vinculada a ese formulario (pestaña **Respuestas → ícono de Sheets** dentro del
formulario, en [forms.google.com](https://forms.google.com)).

## Si alguna vez recreas el formulario

Si borras el formulario y haces uno nuevo (o cambias las preguntas), hay que
volver a obtener los identificadores:

1. Abre el link público de "Enviar" del formulario (el mismo que compartiste
   para llenarlo, no el de edición).
2. En la consola del navegador (F12 → pestaña Console), ejecuta:
   ```js
   window.FB_PUBLIC_LOAD_DATA_
   ```
3. Ahí aparece la estructura del formulario: cada pregunta trae un array con su
   `entry.NNNNNNNN` correspondiente. Actualiza las constantes de arriba con los
   nuevos valores, y la URL de acción con el nuevo ID del formulario (la parte
   `.../forms/d/e/<ID>/...` del link).
4. Si la pregunta de asistencia cambia de texto, revisa también en
   `RsvpSection` (en `index.tsx`) que el valor que se envía coincida
   **exactamente** con el texto de la opción en el formulario — si no coincide,
   Google Forms no la cuenta como respuesta seleccionada.

## Notas

- Se usa `mode: "no-cors"` al enviar porque Google Forms no agrega headers CORS
  en su respuesta. Esto significa que el sitio no puede confirmar con certeza
  que la respuesta se registró (solo que la solicitud salió) — es la limitación
  estándar de este approach gratuito y sin backend propio.
- No se envía marca de tiempo manual: Google Forms ya agrega automáticamente la
  fecha/hora de cada respuesta en la hoja.
