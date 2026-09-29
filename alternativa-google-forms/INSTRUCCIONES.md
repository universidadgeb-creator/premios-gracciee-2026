# Plan B · El formulario hecho con Google Forms

> Úsalo solo si tu organización no permite publicar el Apps Script como aplicación web pública. El formulario principal está en la raíz del repositorio (ver README).

> Todo se hace con tu cuenta **@gebienestar.com.mx**. Para evitar líos con tu cuenta personal, usa una **ventana de incógnito** donde solo tengas abierta esa cuenta.

## 1. Prepara la hoja
- En Google Drive crea una hoja nueva → **Archivo › Importar › Subir** → elige `plantilla/Plantilla_Colaboradores_GRACCIEE.xlsx` → **Reemplazar hoja de cálculo**.
- En la pestaña **Colaboradores**, borra los 5 ejemplos y pega tu lista: A Unidad de Negocio · B Sucursal · C Área · D Nombre.
- Si una persona no tiene sucursal (GEB, Center), déjala vacía: el formulario pone "Corporativo".
- Las filas sin Unidad, Área o Nombre se ignoran. Los repetidos y los espacios de más se limpian solos.

## 2. Pega el script
- En la hoja: **Extensiones › Apps Script**.
- Borra lo que haya en `Código.gs`, pega **todo** el contenido de `GRACCIEE.gs` y guarda (**Ctrl + S**).
- No hace falta cambiar nada más.

## 3. Ejecútalo
- *(Opcional, recomendado)* En el desplegable de funciones de arriba elige **`revisarColaboradores`** → **▷ Ejecutar**. En el registro verás cuántas secciones se crearían y qué filas se ignoraron. No crea nada.
- Elige **`crearFormulario`** (¡no `onOpen`!) → **▷ Ejecutar**.
- La primera vez te pide permisos: **Revisar permisos** → elige tu cuenta @gebienestar → si aparece "Google no verificó esta app": **Configuración avanzada › Ir a … › Permitir**.
- Si la lista es grande, a los 4.5 minutos se pausa y **sigue sola** cada minuto. No tienes que hacer nada.

## 4. Dónde ver los links
- En la pestaña **Config GRACCIEE** de la hoja: estado, link para compartir, link de edición, número de secciones y fecha.
- Cuando diga **✅ Listo**, comparte el **Link para compartir**.
- El formulario queda en tu Drive (Mi unidad) y las respuestas llegan a esta misma hoja.

## 5. Nominaciones y conteo
- La consolidación automática queda activada al terminar: cada respuesta se agrega a la pestaña **Nominaciones** (Fecha · Nominador · Valor · Unidad · Sucursal · Área · Nominado · Motivo).
- **Conteo** muestra las nominaciones por valor y persona, de más a menos. A la derecha está el total por valor.
- Recarga la hoja y aparece el menú **GRACCIEE**: *Consolidar nominaciones* rehace la pestaña completa; *Activar consolidación automática* vuelve a encender el automático si hiciera falta.
- Para analizar, usa **Nominaciones**, no "Respuestas de formulario 1" (esa tiene una columna por cada lista de nombres).

## Si algo sale mal
- **"Cannot call SpreadsheetApp.getUi()…"**: ejecutaste `onOpen`. Elige `crearFormulario`.
- **"No se pudo guardar el proyecto" / error de sintaxis**: falta una comilla. Un link en CONFIG va así: `SHEET_URL: 'https://…',`
- **"No item with the given ID…" o aviso de "cuenta equivocada"**: Apps Script está usando tu cuenta personal. Ciérralo, abre una ventana de incógnito solo con la cuenta @gebienestar y repite.
- **Config se queda en ⏳ más de 10 minutos o dice ❌**: vuelve a ejecutar `crearFormulario`, que sigue donde se quedó.
- **Cambió la lista antes de publicar**: menú **GRACCIEE › Reiniciar** y después **Crear formulario**.
- **Entra alguien nuevo después de publicar**: abre el link de edición, busca la sección de su área y agrégalo a la lista "¿A quién nominas?". No hay que rehacer nada.
- **Alguien sin cuenta de GEB no puede abrir el link**: en el formulario, en *Publicado › Administrar* (o *Configuración › Respuestas*), deja que responda **cualquier persona con el vínculo**.

## Nota sobre clasp
- El clasp de este repositorio sube el backend del formulario web, no este script. Para este plan B, copia y pega `GRACCIEE.gs`.
