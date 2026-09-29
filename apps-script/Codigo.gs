/**
 * ═══════════════════════════════════════════════════════════════════════
 *  PREMIOS GRACCIEE 2026 · Backend del formulario web
 *  Universidad GEB · Capital Humano
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Qué hace
 *   - GET  → entrega al formulario los valores y la lista de colaboradores
 *            (pestaña "Colaboradores": Unidad de Negocio | Sucursal | Área | Nombre).
 *   - POST → guarda cada nominación como una fila en la pestaña "Nominaciones".
 *
 *  CÓMO INSTALARLO (una sola vez)
 *   1. En la hoja de colaboradores: Extensiones > Apps Script. Pega este archivo y guarda (Ctrl + S).
 *   2. En el desplegable de funciones elige  configurar  y da clic en ▷ Ejecutar. Autoriza con tu
 *      cuenta @gebienestar.com.mx.
 *   3. Implementar > Nueva implementación > engrane > "Aplicación web":
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

  // Si una fila no tiene sucursal (por ejemplo GEB o Center), se usa este valor.
  SUCURSAL_VACIA: 'Corporativo',

  // La lista de colaboradores se guarda en caché unos minutos para que el formulario cargue rápido.
  // Si cambias la hoja, se actualiza sola en ese tiempo (o usa el menú GRACCIEE > Refrescar lista).
  MINUTOS_CACHE: 5,

  LARGO_MAXIMO_MOTIVO: 3000,
};

const HOJAS = { NOMINACIONES: 'Nominaciones', CONTEO: 'Conteo' };
const COLUMNAS = ['Fecha', 'Nominador', 'Valor', 'Unidad de Negocio', 'Sucursal', 'Área', 'Nominado', 'Motivo'];
const CLAVE_CACHE = 'catalogo';
const PROP_CERRADO = 'GRACCIEE_CERRADO';

// ─────────────────────────────── MENÚ ───────────────────────────────

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('GRACCIEE')
      .addItem('Configurar pestañas', 'configurar')
      .addItem('Refrescar lista de colaboradores', 'refrescarLista')
      .addSeparator()
      .addItem('Cerrar nominaciones', 'cerrarNominaciones')
      .addItem('Abrir nominaciones', 'abrirNominaciones')
      .addToUi();
  } catch (e) {
    // Pasa si se ejecuta onOpen desde el editor: no hay hoja abierta donde poner el menú.
    Logger.log('onOpen solo agrega el menú al abrir la hoja. Para instalar, ejecuta "configurar".');
  }
}

/** Crea las pestañas "Nominaciones" y "Conteo" y revisa la lista. Ejecútala una vez para autorizar. */
function configurar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  prepararHojas_(ss);
  CacheService.getScriptCache().remove(CLAVE_CACHE);
  const cat = catalogo_();
  const personas = cat.unidades.reduce((t, u) => t + u.sucursales.reduce((t2, s) =>
    t2 + s.areas.reduce((t3, a) => t3 + a.personas.length, 0), 0), 0);
  let url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) { /* aún sin implementar */ }
  avisar_('Listo. Colaboradores en la lista: ' + personas + ' (' +
    cat.unidades.map(u => u.nombre).join(', ') + ').' +
    (cat.ignoradas.length ? '\nFilas ignoradas por datos incompletos: ' + cat.ignoradas.join(', ') : '') +
    '\n\nSiguiente paso: Implementar > Nueva implementación > Aplicación web ' +
    '(Ejecutar como: Yo · Acceso: Cualquier usuario) y copia la URL /exec a config.js.' +
    (url ? '\nURL actual: ' + url : ''));
}

function refrescarLista() {
  CacheService.getScriptCache().remove(CLAVE_CACHE);
  avisar_('Listo: el formulario ya usa la lista actual de "' + CONFIG.HOJA_COLABORADORES + '".');
}

function cerrarNominaciones() {
  PropertiesService.getScriptProperties().setProperty(PROP_CERRADO, '1');
  avisar_('Nominaciones cerradas: el formulario ya no acepta respuestas.');
}

function abrirNominaciones() {
  PropertiesService.getScriptProperties().deleteProperty(PROP_CERRADO);
  avisar_('Nominaciones abiertas: el formulario vuelve a aceptar respuestas.');
}

// ─────────────────────────────── API DEL FORMULARIO ───────────────────────────────

/** GET: valores, lista de colaboradores y si las nominaciones están abiertas. */
function doGet() {
  try {
    const cat = catalogo_();
    return json_({ ok: true, abierto: estaAbierto_(), valores: cat.valores, unidades: cat.unidades });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

/** POST: guarda una nominación. El formulario manda JSON como texto plano (evita problemas de CORS). */
function doPost(e) {
  try {
    const datos = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (datos.sitio_web) return json_({ ok: true }); // campo trampa: solo lo llenan los bots
    if (!estaAbierto_()) throw new Error('Las nominaciones ya están cerradas. ¡Gracias por participar!');
    const n = validar_(datos);
    const candado = LockService.getScriptLock();
    candado.waitLock(20000);
    try {
      prepararHojas_(SpreadsheetApp.getActiveSpreadsheet()).appendRow(
        [new Date(), n.nominador, n.valor, n.unidad, n.sucursal, n.area, n.nominado, n.motivo].map(comoTexto_));
    } finally {
      candado.releaseLock();
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

function validar_(d) {
  const n = {
    nominador: limpiar_(d.nominador), valor: limpiar_(d.valor), unidad: limpiar_(d.unidad),
    sucursal: limpiar_(d.sucursal), area: limpiar_(d.area), nominado: limpiar_(d.nominado),
    motivo: String(d.motivo == null ? '' : d.motivo).trim(),
  };
  if (!n.nominador) throw new Error('Escribe tu nombre completo.');
  if (n.nominador.length > 120) throw new Error('Tu nombre es demasiado largo.');
  if (CONFIG.VALORES.indexOf(n.valor) < 0) throw new Error('Elige el valor en el que nominas.');
  if (!n.motivo) throw new Error('Cuéntanos qué hizo esta persona.');
  if (n.motivo.length > CONFIG.LARGO_MAXIMO_MOTIVO) {
    throw new Error('El motivo es muy largo (máximo ' + CONFIG.LARGO_MAXIMO_MOTIVO + ' caracteres).');
  }
  // La persona tiene que existir en la lista, en esa unidad, sucursal y área
  const buscar = (lista, nombre) => lista.filter(x => clave_(x.nombre) === clave_(nombre))[0];
  const unidad = buscar(catalogo_().unidades, n.unidad);
  const sucursal = unidad && buscar(unidad.sucursales, n.sucursal);
  const area = sucursal && buscar(sucursal.areas, n.area);
  const nominado = area && area.personas.filter(p => clave_(p) === clave_(n.nominado))[0];
  if (!nominado) {
    throw new Error('No encontré a esa persona en la lista. Recarga la página e inténtalo de nuevo.');
  }
  // Se guarda con la escritura oficial de la lista, para que el conteo agrupe bien
  n.unidad = unidad.nombre;
  n.sucursal = sucursal.nombre;
  n.area = area.nombre;
  n.nominado = nominado;
  return n;
}

// ─────────────────────────────── LISTA DE COLABORADORES ───────────────────────────────

/** { valores, unidades: [{nombre, sucursales: [{nombre, areas: [{nombre, personas: []}]}]}], ignoradas } */
function catalogo_() {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get(CLAVE_CACHE);
  if (guardado) return JSON.parse(guardado);

  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HOJA_COLABORADORES);
  if (!hoja) throw new Error('No encontré la pestaña "' + CONFIG.HOJA_COLABORADORES + '".');

  // Árbol sin repetidos (ignora mayúsculas, acentos y espacios de más)
  const raiz = new Map();
  const ignoradas = [];
  hoja.getDataRange().getDisplayValues().slice(1).forEach((fila, i) => {
    const [unidad, sucursal, area, nombre] = [0, 1, 2, 3].map(c => limpiar_(fila[c]));
    if (!unidad && !sucursal && !area && !nombre) return;
    if (!unidad || !area || !nombre) {
      ignoradas.push(i + 2);
      return;
    }
    let nivel = raiz;
    [unidad, sucursal || CONFIG.SUCURSAL_VACIA, area, nombre].forEach(valor => {
      const k = clave_(valor);
      if (!nivel.has(k)) nivel.set(k, { nombre: valor, hijos: new Map() });
      nivel = nivel.get(k).hijos;
    });
  });

  const ordenados = mapa => Array.from(mapa.values()).sort(
    (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base', numeric: true }));
  const cat = {
    valores: CONFIG.VALORES,
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

// ─────────────────────────────── HOJAS DE ANÁLISIS ───────────────────────────────

/** Crea (si faltan) "Nominaciones" y "Conteo". Devuelve "Nominaciones". */
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
    // Por valor y nominado (con unidad, sucursal y área); dentro de cada valor, de más a menos
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
  return nom;
}

// ─────────────────────────────── APOYO ───────────────────────────────

function estaAbierto_() {
  return PropertiesService.getScriptProperties().getProperty(PROP_CERRADO) !== '1';
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
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Evita que un texto que empieza con =, +, - o @ se tome como fórmula en la hoja. */
function comoTexto_(valor) {
  return typeof valor === 'string' && /^[=+\-@]/.test(valor) ? "'" + valor : valor;
}
