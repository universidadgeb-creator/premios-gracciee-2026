/**
 * ═══════════════════════════════════════════════════════════════════════
 *  PREMIOS GRACCIEE 2026 · Backend del formulario web
 *  Universidad GEB · Capital Humano
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Qué hace
 *   - GET  → entrega al formulario los 9 valores y la lista de colaboradores
 *            (pestaña "Colaboradores": Unidad de Negocio | Sucursal | Área | Nombre).
 *   - POST → recibe las 9 nominaciones de una persona (una por valor) y las guarda
 *            en la pestaña "Nominaciones". Cada persona puede enviar una sola vez.
 *   - Menú GRACCIEE → actualizar la lista desde el formulario de Empoderamientos,
 *            abrir/cerrar nominaciones.
 *
 *  CÓMO INSTALARLO (una sola vez)
 *   1. En una hoja de cálculo nueva: Extensiones > Apps Script. Pega este archivo y guarda (Ctrl + S).
 *   2. En el desplegable de funciones elige  configurar  y da clic en ▷ Ejecutar. Autoriza con tu
 *      cuenta @gebienestar.com.mx.
 *   3. Recarga la hoja y usa  GRACCIEE > Actualizar lista desde Empoderamientos  (te pide el link
 *      del formulario de Empoderamientos una sola vez).
 *   4. Implementar > Nueva implementación > engrane > "Aplicación web":
 *        Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier usuario
 *      Copia la URL que termina en /exec y pégala en config.js del formulario.
 *
 *  Si cambias este código: Implementar > Administrar implementaciones > lápiz >
 *  Versión: "Nueva versión" > Implementar. (Así la URL no cambia.)
 */

// ─────────────────────────────── CONFIGURACIÓN ───────────────────────────────
const CONFIG = {
  HOJA_COLABORADORES: 'Colaboradores',

  VALORES: ['Gratitud', 'Ritmo', 'Actitud', 'Ambición', 'Calidad', 'Creatividad',
            'Integridad', 'Equipo', 'Empoderamiento'],

  // true = cada persona puede enviar sus nominaciones una sola vez.
  UN_ENVIO_POR_PERSONA: true,

  // Nombres escritos TODO EN MAYÚSCULAS se muestran como "Juan Pérez de la Cruz".
  NOMBRES_EN_FORMATO_TITULO: true,

  // La lista se guarda en caché unos minutos para que el formulario cargue rápido.
  MINUTOS_CACHE: 5,

  LARGO_MAXIMO_MOTIVO: 3000,
};

const HOJAS = { NOMINACIONES: 'Nominaciones', CONTEO: 'Conteo', PARTICIPACION: 'Participación' };
const COLUMNAS = ['Fecha', 'Nominador', 'Valor', 'Unidad de Negocio', 'Sucursal', 'Área', 'Nominado', 'Motivo',
                  'Unidad (nominador)', 'Sucursal (nominador)', 'Área (nominador)', 'Envío'];
const CLAVE_CACHE = 'catalogo';
const PROP = { CERRADO: 'GRACCIEE_CERRADO', FUENTE: 'GRACCIEE_FORM_EMPODERAMIENTOS' };

// ─────────────────────────────── MENÚ ───────────────────────────────

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('GRACCIEE')
      .addItem('Actualizar lista desde Empoderamientos', 'actualizarListaDesdeEmpoderamientos')
      .addItem('Refrescar formulario (después de editar Colaboradores)', 'refrescarLista')
      .addSeparator()
      .addItem('Cerrar nominaciones', 'cerrarNominaciones')
      .addItem('Abrir nominaciones', 'abrirNominaciones')
      .addSeparator()
      .addItem('Configurar pestañas', 'configurar')
      .addToUi();
  } catch (e) {
    // Pasa si se ejecuta onOpen desde el editor: no hay hoja abierta donde poner el menú.
    Logger.log('onOpen solo agrega el menú al abrir la hoja. Para instalar, ejecuta "configurar".');
  }
}

/** Crea las pestañas que faltan. Ejecútala una vez desde el editor para autorizar el script. */
function configurar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const colab = ss.getSheetByName(CONFIG.HOJA_COLABORADORES) || ss.insertSheet(CONFIG.HOJA_COLABORADORES, 0);
  if (colab.getRange('A1').getValue() === '') {
    colab.getRange(1, 1, 1, 4).setValues([['Unidad de Negocio', 'Sucursal', 'Área', 'Nombre']])
      .setFontWeight('bold').setBackground('#f1f3f4');
    colab.setFrozenRows(1);
  }
  prepararHojas_(ss);
  CacheService.getScriptCache().remove(CLAVE_CACHE);
  avisar_('Pestañas listas.\n\nSiguiente paso: recarga la hoja y usa GRACCIEE > Actualizar lista desde ' +
    'Empoderamientos. Después: Implementar > Nueva implementación > Aplicación web ' +
    '(Ejecutar como: Yo · Acceso: Cualquier usuario) y copia la URL /exec a config.js.');
}

function refrescarLista() {
  CacheService.getScriptCache().remove(CLAVE_CACHE);
  avisar_('Listo: el formulario ya usa la lista actual de "' + CONFIG.HOJA_COLABORADORES + '".');
}

function cerrarNominaciones() {
  PropertiesService.getScriptProperties().setProperty(PROP.CERRADO, '1');
  avisar_('Nominaciones cerradas: el formulario ya no acepta respuestas.');
}

function abrirNominaciones() {
  PropertiesService.getScriptProperties().deleteProperty(PROP.CERRADO);
  avisar_('Nominaciones abiertas: el formulario vuelve a aceptar respuestas.');
}

// ─────────────────────────────── API DEL FORMULARIO ───────────────────────────────

/** GET: valores, lista de colaboradores y si las nominaciones están abiertas. */
function doGet() {
  try {
    const cat = catalogo_();
    return json_({ ok: true, abierto: estaAbierto_(), valores: CONFIG.VALORES, unidades: cat.unidades });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

/**
 * POST: { nominador: {nombre, unidad, sucursal, area},
 *         nominaciones: [{valor, unidad, sucursal, area, nominado, motivo}] × 9 }
 * El formulario lo manda como texto plano para evitar el permiso previo (CORS) del navegador.
 */
function doPost(e) {
  try {
    const datos = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (datos.sitio_web) return json_({ ok: true }); // campo trampa: solo lo llenan los bots
    if (!estaAbierto_()) throw new Error('Las nominaciones ya están cerradas. ¡Gracias por participar!');
    const envio = validar_(datos);

    const candado = LockService.getScriptLock();
    candado.waitLock(20000);
    try {
      const hoja = prepararHojas_(SpreadsheetApp.getActiveSpreadsheet());
      if (CONFIG.UN_ENVIO_POR_PERSONA) revisarEnvioPrevio_(hoja, envio.nominador);
      const n = envio.nominador;
      const fecha = new Date();
      const id = Utilities.getUuid().slice(0, 8);
      const filas = envio.nominaciones.map(x =>
        [fecha, n.nombre, x.valor, x.unidad, x.sucursal, x.area, x.nominado, x.motivo, n.unidad, n.sucursal, n.area, id]
          .map(comoTexto_));
      hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, COLUMNAS.length).setValues(filas);
    } finally {
      candado.releaseLock();
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

function validar_(d) {
  const unidades = catalogo_().unidades;
  const nominador = buscarPersona_(unidades, d.nominador || {}, 'nombre');
  if (!nominador) throw new Error('No encontré tu nombre en la lista. Recarga la página y búscate de nuevo.');

  const lista = Array.isArray(d.nominaciones) ? d.nominaciones : [];
  const porValor = {};
  lista.forEach(x => { porValor[limpiar_(x && x.valor)] = x; });
  const faltan = CONFIG.VALORES.filter(v => !porValor[v]);
  if (faltan.length || lista.length !== CONFIG.VALORES.length) {
    throw new Error('Faltan nominaciones en: ' + (faltan.join(', ') || 'algún valor') + '.');
  }
  const nominaciones = CONFIG.VALORES.map(valor => {
    const x = porValor[valor];
    const nominado = buscarPersona_(unidades, x, 'nominado');
    if (!nominado) throw new Error('No encontré a la persona que nominaste en ' + valor + '. Recarga la página.');
    if (mismaPersona_(nominado, nominador)) throw new Error('No puedes nominarte a ti en ' + valor + '.');
    const motivo = String(x.motivo == null ? '' : x.motivo).trim();
    if (!motivo) throw new Error('Cuéntanos por qué nominas a ' + nominado.nombre + ' en ' + valor + '.');
    if (motivo.length > CONFIG.LARGO_MAXIMO_MOTIVO) {
      throw new Error('El motivo de ' + valor + ' es muy largo (máximo ' + CONFIG.LARGO_MAXIMO_MOTIVO + ' caracteres).');
    }
    return { valor: valor, unidad: nominado.unidad, sucursal: nominado.sucursal, area: nominado.area,
             nominado: nominado.nombre, motivo: motivo };
  });
  return { nominador: nominador, nominaciones: nominaciones };
}

/** Busca a una persona en la lista y la devuelve con la escritura oficial, o null. */
function buscarPersona_(unidades, d, campoNombre) {
  const igual = (a, b) => clave_(a) === clave_(b);
  const u = unidades.filter(x => igual(x.nombre, d.unidad))[0];
  const s = u && u.sucursales.filter(x => igual(x.nombre, d.sucursal))[0];
  const a = s && s.areas.filter(x => igual(x.nombre, d.area))[0];
  const p = a && a.personas.filter(x => igual(x, d[campoNombre]))[0];
  return p ? { nombre: p, unidad: u.nombre, sucursal: s.nombre, area: a.nombre } : null;
}

function mismaPersona_(a, b) {
  return ['nombre', 'unidad', 'sucursal', 'area'].every(k => clave_(a[k]) === clave_(b[k]));
}

function revisarEnvioPrevio_(hoja, n) {
  const ultima = hoja.getLastRow();
  if (ultima < 2) return;
  const filas = hoja.getRange(2, 1, ultima - 1, COLUMNAS.length).getValues();
  const previa = filas.filter(f => mismaPersona_({ nombre: f[1], unidad: f[8], sucursal: f[9], area: f[10] }, n))[0];
  if (previa) {
    const fecha = previa[0] instanceof Date
      ? Utilities.formatDate(previa[0], Session.getScriptTimeZone(), 'dd/MM/yyyy') : String(previa[0]);
    throw new Error('Ya enviaste tus nominaciones el ' + fecha + '. ¡Gracias! Si no fuiste tú, avisa a Capital Humano.');
  }
}

// ─────────────────────────────── LISTA DE COLABORADORES ───────────────────────────────

/** { unidades: [{nombre, sucursales: [{nombre, areas: [{nombre, personas: []}]}]}], ignoradas } */
function catalogo_() {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get(CLAVE_CACHE);
  if (guardado) return JSON.parse(guardado);

  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HOJA_COLABORADORES);
  if (!hoja) throw new Error('No encontré la pestaña "' + CONFIG.HOJA_COLABORADORES + '".');

  // Árbol sin repetidos (ignora mayúsculas, acentos y espacios de más).
  // Sucursal y Área pueden ir vacías: ese nivel no se pregunta en el formulario.
  const raiz = new Map();
  const ignoradas = [];
  hoja.getDataRange().getDisplayValues().slice(1).forEach((fila, i) => {
    const [unidad, sucursal, area, nombre] = [0, 1, 2, 3].map(c => limpiar_(fila[c]));
    if (!unidad && !sucursal && !area && !nombre) return;
    if (!unidad || !nombre) {
      ignoradas.push(i + 2);
      return;
    }
    let nivel = raiz;
    [unidad, sucursal, area, formatoNombre_(nombre)].forEach(valor => {
      const k = clave_(valor);
      if (!nivel.has(k)) nivel.set(k, { nombre: valor, hijos: new Map() });
      nivel = nivel.get(k).hijos;
    });
  });

  const ordenados = mapa => Array.from(mapa.values()).sort(
    (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base', numeric: true }));
  const cat = {
    ignoradas: ignoradas,
    unidades: ordenados(raiz).map(u => ({
      nombre: u.nombre,
      sucursales: ordenados(u.hijos).map(s => ({
        nombre: s.nombre,
        areas: ordenados(s.hijos).map(a => ({ nombre: a.nombre, personas: ordenados(a.hijos).map(p => p.nombre) })),
      })),
    })),
  };
  try {
    cache.put(CLAVE_CACHE, JSON.stringify(cat), CONFIG.MINUTOS_CACHE * 60);
  } catch (e) { /* más de 100 KB: se lee la hoja cada vez */ }
  return cat;
}

/**
 * Lee el formulario de Empoderamientos (su página pública) y reescribe la pestaña Colaboradores.
 * El link se pide una vez y se guarda en la configuración del script (no queda en el código).
 */
function actualizarListaDesdeEmpoderamientos() {
  const props = PropertiesService.getScriptProperties();
  let url = props.getProperty(PROP.FUENTE);
  if (!url) {
    let ui;
    try { ui = SpreadsheetApp.getUi(); } catch (e) {
      throw new Error('Ejecuta esta opción desde el menú GRACCIEE de la hoja (ahí te pide el link).');
    }
    const r = ui.prompt('Lista de colaboradores', 'Pega el link del formulario de Empoderamientos:', ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return;
    url = r.getResponseText().trim();
  }
  const filas = colaboradoresDeFormulario_(url);
  props.setProperty(PROP.FUENTE, url);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(CONFIG.HOJA_COLABORADORES) || ss.insertSheet(CONFIG.HOJA_COLABORADORES, 0);
  hoja.clearContents();
  hoja.getRange(1, 1, 1, 4).setValues([['Unidad de Negocio', 'Sucursal', 'Área', 'Nombre']])
    .setFontWeight('bold').setBackground('#f1f3f4');
  hoja.setFrozenRows(1);
  hoja.getRange(2, 1, filas.length, 4).setValues(filas);
  CacheService.getScriptCache().remove(CLAVE_CACHE);

  const porUnidad = {};
  filas.forEach(f => { porUnidad[f[0]] = (porUnidad[f[0]] || 0) + 1; });
  avisar_('Lista actualizada: ' + filas.length + ' colaboradores (' +
    Object.keys(porUnidad).map(u => u + ' ' + porUnidad[u]).join(' · ') + ').');
}

/**
 * Recorre el formulario como lo haría una persona: Unidad → (Sucursal) → (Departamento) → lista de
 * nombres, y devuelve filas [Unidad, Sucursal, Área, Nombre].
 */
function colaboradoresDeFormulario_(url) {
  const resp = UrlFetchApp.fetch(url.replace(/\/edit.*$/, '/viewform'), { muteHttpExceptions: true, followRedirects: true });
  const html = resp.getContentText();
  const marca = 'FB_PUBLIC_LOAD_DATA_ = ';
  const ini = html.indexOf(marca);
  if (resp.getResponseCode() !== 200 || ini < 0) {
    throw new Error('No pude leer el formulario (HTTP ' + resp.getResponseCode() + '). Revisa que el link sea ' +
                    'el del formulario de Empoderamientos y que cualquiera con el link pueda responderlo.');
  }
  const datos = JSON.parse(html.slice(ini + marca.length, html.indexOf(';</script>', ini)));
  return filasDesdeItems_(datos[1][1]);
}

/** Separada de la descarga para poder probarla sin internet. */
function filasDesdeItems_(items) {
  const SECCION = 8, OPCION_MULTIPLE = 2, DESPLEGABLE = 3, SIGUIENTE = -2;
  const posicion = {};
  items.forEach((it, i) => { posicion[it[0]] = i; });
  const opcionesDe = it => (it[4] && it[4][0] && it[4][0][1]) || [];
  const esPregunta = it => (it[3] === OPCION_MULTIPLE || it[3] === DESPLEGABLE) && opcionesDe(it).length;
  const siguienteSeccion = i => {
    for (let j = i + 1; j < items.length; j++) if (items[j][3] === SECCION) return j;
    return null;
  };
  const destino = (opcion, desde) => (opcion[2] == null || opcion[2] === SIGUIENTE)
    ? siguienteSeccion(desde) : (posicion[opcion[2]] === undefined ? null : posicion[opcion[2]]);

  // Encuentra cada lista de nombres y el camino (unidad / sucursal / departamento) que lleva a ella.
  // "inicio" es la posición del salto de sección (-1 = principio del formulario).
  const hallazgos = []; // { lista, ruta: {unidad, sucursal, area} }
  const recorrer = (inicio, ruta, profundidad) => {
    if (inicio === null || profundidad > 6) return;
    for (let i = inicio + 1; i < items.length && items[i][3] !== SECCION; i++) {
      const it = items[i];
      const titulo = String(it[1] || '');
      if (it[3] === DESPLEGABLE && /nombre/i.test(titulo)) {
        hallazgos.push({ lista: i, ruta: ruta });
        return;
      }
      if (!esPregunta(it) || !opcionesDe(it).some(o => o[2] != null)) continue;
      const nivel = /unidad/i.test(titulo) ? 'unidad' : /sucursal/i.test(titulo) ? 'sucursal'
        : /departamento|[aá]rea/i.test(titulo) ? 'area' : null;
      if (!nivel) continue;
      opcionesDe(it).forEach(o => {
        const siguiente = Object.assign({}, ruta);
        siguiente[nivel] = limpiar_(o[0]);
        recorrer(destino(o, i), siguiente, profundidad + 1);
      });
      return;
    }
  };
  recorrer(-1, { unidad: '', sucursal: '', area: '' }, 0);

  // Si la misma lista se alcanza desde varias sucursales, los nombres no dependen de la sucursal
  const sucursalesPorLista = {};
  hallazgos.forEach(h => {
    (sucursalesPorLista[h.lista] = sucursalesPorLista[h.lista] || new Set()).add(h.ruta.sucursal);
  });
  const vistos = new Set();
  const rutas = [];
  hallazgos.forEach(h => {
    const r = { unidad: h.ruta.unidad, sucursal: h.ruta.sucursal, area: h.ruta.area };
    if (sucursalesPorLista[h.lista].size > 1) r.sucursal = '';
    const k = h.lista + '|' + r.unidad + '|' + r.sucursal + '|' + r.area;
    if (vistos.has(k)) return;
    vistos.add(k);
    rutas.push({ lista: h.lista, ruta: r });
  });

  // En una unidad que se organiza por áreas, una "sucursal" suelta (p. ej. Oficina Central) pasa a ser un área
  const porAreas = {};
  rutas.forEach(x => { if (!x.ruta.sucursal && x.ruta.area) porAreas[x.ruta.unidad] = true; });
  rutas.forEach(x => {
    if (porAreas[x.ruta.unidad] && x.ruta.sucursal && !x.ruta.area) {
      x.ruta.area = x.ruta.sucursal;
      x.ruta.sucursal = '';
    }
    x.ruta.sucursal = sinNombreDeUnidad_(x.ruta.sucursal, x.ruta.unidad);
    x.ruta.area = sinNombreDeUnidad_(x.ruta.area, x.ruta.unidad);
  });

  const filas = [];
  const unicos = new Set();
  rutas.forEach(x => opcionesDe(items[x.lista]).forEach(o => {
    const nombre = formatoNombre_(limpiar_(o[0]));
    if (!nombre) return;
    const fila = [x.ruta.unidad, x.ruta.sucursal, x.ruta.area, nombre];
    const k = fila.map(clave_).join('|');
    if (unicos.has(k)) return;
    unicos.add(k);
    filas.push(fila);
  }));
  if (!filas.length) throw new Error('El formulario no tiene listas de nombres que yo reconozca.');
  const orden = (a, b) => a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true });
  return filas.sort((a, b) => orden(a[0], b[0]) || orden(a[1], b[1]) || orden(a[2], b[2]) || orden(a[3], b[3]));
}

/** "Oficina Central Vivo47" dentro de Vivo 47 → "Oficina Central". */
function sinNombreDeUnidad_(texto, unidad) {
  const u = clave_(unidad).replace(/\s/g, '');
  const palabras = texto.split(' ');
  for (let n = 1; n <= 2 && n < palabras.length; n++) {
    if (clave_(palabras.slice(-n).join('')) === u) return palabras.slice(0, -n).join(' ');
  }
  return texto;
}

/** "JUAN PÉREZ DE LA CRUZ" → "Juan Pérez de la Cruz" (solo si viene todo en mayúsculas). */
function formatoNombre_(nombre) {
  if (!CONFIG.NOMBRES_EN_FORMATO_TITULO || nombre !== nombre.toUpperCase()) return nombre;
  const menores = ['de', 'del', 'la', 'las', 'los', 'y', 'e'];
  return nombre.toLowerCase().split(' ').map((p, i) =>
    (i > 0 && menores.indexOf(p) >= 0) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

// ─────────────────────────────── HOJAS DE ANÁLISIS ───────────────────────────────

/** Crea (si faltan) "Nominaciones", "Conteo" y "Participación". Devuelve "Nominaciones". */
function prepararHojas_(ss) {
  const nom = ss.getSheetByName(HOJAS.NOMINACIONES) || ss.insertSheet(HOJAS.NOMINACIONES);
  if (nom.getRange('A1').getValue() === '') {
    nom.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS]).setFontWeight('bold').setBackground('#f1f3f4');
    nom.setFrozenRows(1);
    nom.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
    nom.setColumnWidth(8, 420);
  }
  if (!ss.getSheetByName(HOJAS.CONTEO)) {
    const conteo = ss.insertSheet(HOJAS.CONTEO);
    // Por valor y nominado; dentro de cada valor, de más a menos nominaciones
    conteo.getRange('A1').setFormula(
      '=IFERROR(QUERY(' + HOJAS.NOMINACIONES + '!A:H, "select C, G, D, E, F, count(A) ' +
      'where G <> \'\' group by C, G, D, E, F order by C, count(A) desc ' +
      'label count(A) \'Nominaciones\'", 1), "Aún no hay nominaciones")');
    // Total por valor
    conteo.getRange('H1').setFormula(
      '=IFERROR(QUERY(' + HOJAS.NOMINACIONES + '!A:H, "select C, count(A) where G <> \'\' ' +
      'group by C order by count(A) desc label C \'Valor (total)\', count(A) \'Nominaciones\'", 1), "")');
    conteo.setFrozenRows(1);
  }
  if (!ss.getSheetByName(HOJAS.PARTICIPACION)) {
    const part = ss.insertSheet(HOJAS.PARTICIPACION);
    // Quién ya envió sus nominaciones y quién falta (primero los pendientes)
    const c = "'" + CONFIG.HOJA_COLABORADORES + "'!";
    part.getRange('A1').setFormula(
      '=ARRAYFORMULA({"Unidad de Negocio", "Sucursal", "Área", "Nombre", "¿Ya nominó?"; ' +
      'IFERROR(SORT(FILTER({TRIM(' + c + 'A2:A), TRIM(' + c + 'B2:B), TRIM(' + c + 'C2:C), TRIM(' + c + 'D2:D), ' +
      'IF(COUNTIF(' + HOJAS.NOMINACIONES + '!B:B, TRIM(' + c + 'D2:D)) > 0, "Sí", "Pendiente")}, ' +
      'TRIM(' + c + 'D2:D) <> ""), 5, TRUE, 1, TRUE, 2, TRUE, 3, TRUE, 4, TRUE), {"", "", "", "", ""})})');
    part.getRange('G1').setValue('Resumen');
    part.getRange('G2').setFormula('="Ya nominaron: " & COUNTIF(E2:E, "Sí") & " de " & COUNTA(D2:D)');
    part.getRange('G1').setFontWeight('bold');
    part.setFrozenRows(1);
  }
  return nom;
}

// ─────────────────────────────── APOYO ───────────────────────────────

function estaAbierto_() {
  return PropertiesService.getScriptProperties().getProperty(PROP.CERRADO) !== '1';
}

function json_(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}

function avisar_(mensaje) {
  Logger.log(mensaje);
  try {
    SpreadsheetApp.getUi().alert('Premios GRACCIEE', mensaje, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) { /* desde el editor no hay ventana: basta con el registro */ }
}

/** Quita espacios de más (incluidos los "invisibles"). */
function limpiar_(valor) {
  return (valor == null ? '' : String(valor)).replace(/\s+/g, ' ').trim();
}

/** Para comparar sin importar mayúsculas ni acentos: "Recepción" = "recepcion". */
function clave_(texto) {
  return limpiar_(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Evita que un texto que empieza con =, +, - o @ se tome como fórmula en la hoja. */
function comoTexto_(valor) {
  return typeof valor === 'string' && /^[=+\-@]/.test(valor) ? "'" + valor : valor;
}
