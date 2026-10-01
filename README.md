# Premios GRACCIEE 2026 · Formulario de nominaciones

Formulario web para que cada colaborador de Grupo Empresarial Bienestar nomine a una persona **en cada uno de los 9 valores** GRACCIEE: Gratitud, Ritmo, Actitud, Ambición, Calidad, Creatividad, Integridad, Equipo y Empoderamiento.

**Cómo lo vive quien nomina**
1. **¿Quién eres?** Se elige de la lista (por unidad y área/sucursal, o buscándose por nombre).
2. **Un paso por valor**: a quién nomina (de la lista, nunca escrito a mano) y qué hizo para merecerlo. Nadie puede nominarse a sí mismo.
3. **Revisión**: ve sus 9 nominaciones, puede cambiar cualquiera y las envía **una sola vez**.

Si se cierra la página a la mitad, al volver sigue donde se quedó (se guarda en ese teléfono).

**Cómo está hecho**
- **Página** (`index.html`, `estilos.css`, `app.js`, `config.js`): publicada con GitHub Pages.
- **Backend** (`apps-script/Codigo.gs`): Apps Script dentro de una hoja de Google. Entrega la lista a la página, valida y guarda las nominaciones.
- **La lista de colaboradores no está en GitHub.** Vive en la hoja y se llena desde el formulario de Empoderamientos con un clic.

## Puesta en marcha (una sola vez)

Todo con la cuenta **@gebienestar.com.mx** (de preferencia en una ventana de incógnito donde solo esté esa cuenta).

1. **Hoja y script**: crea una hoja de cálculo nueva → **Extensiones › Apps Script** → borra lo que haya, pega todo `apps-script/Codigo.gs` y guarda (Ctrl + S).
2. **Autorizar**: en el desplegable de funciones elige **`configurar`** (no `onOpen`) → **▷ Ejecutar** → autoriza. Si aparece "Google no verificó esta app": *Configuración avanzada › Ir a… › Permitir*.
3. **Lista de colaboradores**: recarga la hoja → menú **GRACCIEE › Actualizar lista desde Empoderamientos** → pega el link del formulario de Empoderamientos. Se llena la pestaña **Colaboradores** (Vivo 47 por área, EasyFit por sucursal, GEB y Center directo).
4. **Publicar el backend**: **Implementar › Nueva implementación** → engrane → **Aplicación web** → Ejecutar como: **Yo** · Quién tiene acceso: **Cualquier usuario** → copia la URL que termina en `/exec`.
5. **Conectar la página**: pega esa URL en `config.js` (`API_URL: 'https://script.google.com/macros/s/…/exec'`) y súbelo a GitHub. Sin URL, la página funciona en **modo de prueba** con nombres inventados.

## Durante las nominaciones
- **Nominaciones**: una fila por nominación (9 por persona): Fecha · Nominador · Valor · Unidad · Sucursal · Área · Nominado · Motivo, más los datos de quien nominó y un ID de envío.
- **Conteo**: nominaciones por valor y persona, de más a menos; a la derecha, total por valor.
- **Participación**: toda la lista con "Sí" / "Pendiente" según si ya envió sus nominaciones (primero los pendientes) y un resumen "Ya nominaron: X de Y".
- Menú **GRACCIEE**:
  - **Actualizar lista desde Empoderamientos**: vuelve a leer la lista (por ejemplo, si RH agregó gente allá).
  - **Refrescar formulario**: si editaste a mano la pestaña Colaboradores, para que la página lo tome al momento (si no, en ~5 minutos).
  - **Cerrar / Abrir nominaciones**.
- Si alguien envió por otra persona, borra sus 9 filas en **Nominaciones** (mismo "Envío") y ya podrá enviar.
- **Ajustes**: personas que faltan en Empoderamientos (por ejemplo Nuevos Negocios: Acton, Clínica, Onara, Seven) o que están en otra unidad. Columnas: Nombre · Unidad de Negocio · Sucursal · Área. Si el nombre ya existe se mueve; si no, se agrega. Se aplica cada vez que usas **GRACCIEE › Actualizar lista desde Empoderamientos**. No edites Colaboradores a mano: se reescribe en cada actualización.

## Si cambias el código
- **Página**: súbela a GitHub; Pages se actualiza sola.
- **Apps Script**: pega el código nuevo y luego **Implementar › Administrar implementaciones › lápiz › Versión: Nueva versión › Implementar** (la URL no cambia).

## Si algo sale mal
- **"No pudimos cargar el formulario"**: la URL de `config.js` debe terminar en `/exec` y la implementación tener acceso **Cualquier usuario**.
- **No aparece "Cualquier usuario"**: tu organización no permite apps web públicas; pide a quien administra Google Workspace que lo habilite.
- **"Cannot call SpreadsheetApp.getUi()…"**: ejecutaste `onOpen`; elige `configurar`.
- **Errores de permisos o "No item with the given ID"**: Apps Script está usando tu cuenta personal; usa una ventana de incógnito solo con la cuenta @gebienestar.

## Instalación actual
- Hoja: **Premios GRACCIEE 2026 · Nominaciones** (Drive de universidad@gebienestar.com.mx), con su Apps Script vinculado.
- El link del formulario de Empoderamientos vive en `apps-script/Privado.gs`, que se sube a Apps Script pero **no** a GitHub. Si la pestaña Colaboradores está vacía, el script la llena solo desde ese link.

## Subir cambios del Apps Script con clasp
- Una vez: activa **API de Google Apps Script** en https://script.google.com/home/usersettings, ejecuta `npm install` y `npm run login` (cuenta @gebienestar).
- `npm run subir` sube `apps-script/` y luego `npx clasp create-deployment -i <ID de la implementación>` publica la nueva versión con la misma URL.

## Otros archivos
- `plantilla/`: plantilla para llenar Colaboradores a mano (Unidad · Sucursal · Área · Nombre; Sucursal y Área pueden ir vacías).
- `alternativa-google-forms/`: primera versión con Google Forms (un valor por respuesta). Ya no es el flujo vigente.
