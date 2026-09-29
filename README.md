# Premios GRACCIEE 2026 · Formulario de nominaciones

Formulario web para que los colaboradores de Grupo Empresarial Bienestar nominen a sus compañeros en los 9 valores GRACCIEE. La persona se **elige de una lista** (Unidad de Negocio → Sucursal → Área → Nombre, o buscándola por nombre) y cada nominación llega como una fila a Google Sheets.

- **Página** (`index.html`, `estilos.css`, `app.js`, `config.js`): se publica gratis con GitHub Pages.
- **Backend** (`apps-script/Codigo.gs`): un Apps Script dentro de la hoja de colaboradores. Entrega la lista a la página y guarda las nominaciones.
- La lista de colaboradores **no se guarda en GitHub**: la página la pide a la hoja cada vez que se abre.

```
index.html · estilos.css · app.js   ← el formulario
config.js                           ← aquí va la URL del Apps Script
apps-script/Codigo.gs               ← backend (se pega en la hoja)
plantilla/                          ← plantilla de la pestaña "Colaboradores"
alternativa-google-forms/           ← plan B: el mismo formulario hecho con Google Forms
```

## Puesta en marcha (una sola vez)

Todo con la cuenta **@gebienestar.com.mx**. Para no mezclarla con tu cuenta personal, usa una ventana de incógnito donde solo esté esa cuenta.

### 1. La hoja de colaboradores
- En Google Drive crea una hoja nueva → **Archivo › Importar › Subir** → `plantilla/Plantilla_Colaboradores_GRACCIEE.xlsx` → **Reemplazar hoja de cálculo**.
- En la pestaña **Colaboradores** borra los ejemplos y pega tu lista: A Unidad de Negocio · B Sucursal · C Área · D Nombre.
- Sin sucursal (GEB, Center) → déjala vacía y aparecerá como "Corporativo". Las filas sin Unidad, Área o Nombre se ignoran; los repetidos se quitan solos.

### 2. El backend (Apps Script)
- En la hoja: **Extensiones › Apps Script**. Borra lo que haya, pega todo `apps-script/Codigo.gs` y guarda (Ctrl + S).
- En el desplegable de funciones elige **`configurar`** (no `onOpen`) → **▷ Ejecutar** → autoriza. Si aparece "Google no verificó esta app": *Configuración avanzada › Ir a… › Permitir*.
- **Implementar › Nueva implementación** → engrane → **Aplicación web**:
  - Ejecutar como: **Yo**
  - Quién tiene acceso: **Cualquier usuario**
- Copia la **URL de la aplicación web** (termina en `/exec`).

### 3. Conectar la página
- Abre `config.js` y pega la URL entre comillas:
  ```js
  API_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec',
  ```
- Si `API_URL` está vacío, la página funciona en **modo de prueba**: se ve igual pero no guarda nada.

### 4. Publicar en GitHub Pages
- En el repositorio: **Settings › Pages › Build and deployment** → *Deploy from a branch* → rama `main`, carpeta `/ (root)` → Save.
- En 1–2 minutos queda en `https://<usuario>.github.io/premios-gracciee-2026/`. Ese es el link que se comparte.

## Durante las nominaciones
- Cada nominación se agrega a la pestaña **Nominaciones**: Fecha · Nominador · Valor · Unidad de Negocio · Sucursal · Área · Nominado · Motivo.
- **Conteo** muestra las nominaciones por valor y persona (con unidad, sucursal y área), de más a menos. A la derecha está el total por valor.
- Menú **GRACCIEE** de la hoja (aparece al recargarla):
  - **Cerrar nominaciones / Abrir nominaciones**: la página muestra "Las nominaciones están cerradas" y deja de aceptar envíos.
  - **Refrescar lista de colaboradores**: la página toma la lista al momento. Sin esto, los cambios aparecen solos en unos 5 minutos.
- Entró alguien nuevo: agrégalo a la pestaña Colaboradores. No hay que tocar la página.

## Si cambias el código
- **Página** (`index.html`, `app.js`, …): súbelo a GitHub; Pages se actualiza sola.
- **Apps Script**: pega el código nuevo y luego **Implementar › Administrar implementaciones › lápiz › Versión: Nueva versión › Implementar**. Así la URL no cambia.

## Si algo sale mal
- **La página dice "No pudimos cargar el formulario"**: revisa que la URL de `config.js` termine en `/exec` y que la implementación tenga acceso **Cualquier usuario**.
- **No aparece la opción "Cualquier usuario"**: tu organización no permite apps web públicas. Pide a quien administra Google Workspace que lo habilite, o usa el plan B de `alternativa-google-forms/`.
- **"Cannot call SpreadsheetApp.getUi()…"**: ejecutaste `onOpen`. Elige `configurar`.
- **"No item with the given ID…" o errores de permisos**: Apps Script está usando tu cuenta personal. Usa una ventana de incógnito solo con la cuenta @gebienestar.

## Opcional: subir el Apps Script con clasp
- Una vez: activa **API de Google Apps Script** en https://script.google.com/home/usersettings (con la cuenta @gebienestar) e instala dependencias con `npm install`.
- `npm run login` → elige la cuenta @gebienestar en el navegador.
- `npm run vincular -- "LINK_DE_TU_HOJA"` → crea el Apps Script dentro de la hoja.
- `npm run subir` → sube `apps-script/Codigo.gs`. Después sigue desde el paso 2 (ejecutar `configurar` e implementar).

## Probar en tu computadora
Abre `index.html` con doble clic: con `API_URL` vacío verás el modo de prueba.
