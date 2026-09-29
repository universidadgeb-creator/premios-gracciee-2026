/**
 * ═══════════════════════════════════════════════════════════════════════
 *  PREMIOS GRACCIEE 2026 · Formulario de nominaciones
 *  Universidad GEB · Capital Humano
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  CÓMO USARLO
 *   1. En la hoja de colaboradores: Extensiones > Apps Script.
 *   2. Borra lo que haya en "Código.gs", pega TODO este archivo y guarda (Ctrl + S).
 *   3. Arriba, en el desplegable de funciones, elige  crearFormulario  (NO "onOpen")
 *      y da clic en ▷ Ejecutar.
 *   4. Autoriza con tu cuenta @gebienestar.com.mx.
 *   5. Cuando termine, los links están en la pestaña "Config GRACCIEE" de la hoja.
 *
 *  FUNCIONES QUE PUEDES EJECUTAR (también están en el menú "GRACCIEE" de la hoja)
 *   - revisarColaboradores ............ prueba: dice cuántas secciones se crearían, sin crear nada
 *   - crearFormulario ................. crea el formulario (si tarda, se pausa y sigue sola)
 *   - consolidarNominaciones .......... rehace la pestaña "Nominaciones" con todas las respuestas
 *   - activarConsolidacionAutomatica .. cada respuesta nueva se agrega sola a "Nominaciones"
 *   - reiniciarFormulario ............. cierra el formulario actual para poder crear uno nuevo
 */

// ─────────────────────────────── CONFIGURACIÓN ───────────────────────────────
const CONFIG = {
  // Déjalo vacío ('') si pegaste el código desde la hoja (Extensiones > Apps Script).
  // Solo si usas un script independiente, pega el link de la hoja ENTRE COMILLAS, así:
  //   SHEET_URL: 'https://docs.google.com/spreadsheets/d/XXXXXXXXXX/edit',
  SHEET_URL: '',

  // Pestaña con los colaboradores. Fila 1 = encabezados:
  //   A: Unidad de Negocio | B: Sucursal | C: Área | D: Nombre
  HOJA_COLABORADORES: 'Colaboradores',

  // Si el script se ejecuta con una cuenta de otro dominio (p. ej. tu Gmail personal),
  // se detiene y te avisa. Pon '' para no revisar.
  DOMINIO_ESPERADO: 'gebienestar.com.mx',

  TITULO: 'Nominaciones Premios GRACCIEE 2026',
  DESCRIPCION:
    'Gracias por esa chispa de consciencia, amor y acción que transforma lo ordinario en ' +
    'extraordinario e impulsa 1% que lo cambia todo.\n\n' +
    'Cada respuesta es una nominación: un valor y una persona. Para nominar en otro valor, ' +
    'al terminar da clic en "Enviar otra respuesta".',
  MENSAJE_FINAL:
    '¡Gracias por tu nominación! Si quieres nominar en otro valor, da clic en "Enviar otra respuesta".',

  VALORES: ['Gratitud', 'Ritmo', 'Actitud', 'Ambición', 'Calidad', 'Creatividad',
            'Integridad', 'Equipo', 'Empoderamiento'],

  // Si una fila no tiene sucursal (por ejemplo GEB o Center), se usa este valor.
  SUCURSAL_VACIA: 'Corporativo',

  // true = si una unidad tiene una sola sucursal (o una sucursal una sola área),
  // esa pregunta se salta y la persona pasa directo al siguiente paso.
  SALTAR_PREGUNTAS_DE_UNA_OPCION: true,

  // false = cualquiera con el link puede responder, sin iniciar sesión.
  // true  = solo cuentas del dominio de la empresa.
  SOLO_CUENTAS_DEL_DOMINIO: false,

  // Google corta cada ejecución a los 6 minutos. Antes de eso, el script se pausa
  // y continúa solo un minuto después.
  LIMITE_MINUTOS: 4.5,
};

// Textos de las preguntas
const TXT = {
  NOMBRE: 'Tu nombre completo',
  VALOR: '¿En qué valor quieres nominar?',
  UNIDAD: 'Unidad de Negocio',
  // Pregunta de las secciones de nivel 0 (unidad), 1 (sucursal) y 2 (área)
  POR_NIVEL: ['Sucursal', 'Área', '¿A quién nominas?'],
  MOTIVO_SECCION: 'Cuéntanos por qué',
  MOTIVO: '¿Qué hizo esta persona que refleje este valor?',
};

const HOJAS = { CONFIG: 'Config GRACCIEE', NOMINACIONES: 'Nominaciones', CONTEO: 'Conteo' };
const COLUMNAS_NOMINACIONES = ['Fecha', 'Nominador', 'Valor', 'Unidad de Negocio', 'Sucursal',
                               'Área', 'Nominado', 'Motivo'];
const PROP = { ESTADO: 'GRACCIEE_ESTADO', FIJOS: 'GRACCIEE_FIJOS', MAPA: 'GRACCIEE_MAPA' };

/*
 * Orden de las preguntas dentro del formulario (el script se apoya en él para continuar
 * donde se quedó si una ejecución se pausa):
 *   [0] Tu nombre   [1] Valor   [2] Unidad de Negocio               ← sección 1
 *   por cada sección k:  [3 + 2k] salto de sección   [4 + 2k] lista desplegable
 *   al final:            salto "Cuéntanos por qué"   párrafo del motivo
 */

// ─────────────────────────────── MENÚ ───────────────────────────────

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('GRACCIEE')
      .addItem('Crear formulario', 'crearFormulario')
      .addItem('Consolidar nominaciones', 'consolidarNominaciones')
      .addItem('Activar consolidación automática', 'activarConsolidacionAutomatica')
      .addSeparator()
      .addItem('Revisar colaboradores (prueba, no crea nada)', 'revisarColaboradores')
      .addItem('Reiniciar (para crear un formulario nuevo)', 'reiniciarFormulario')
      .addToUi();
  } catch (e) {
    // Pasa si se ejecuta onOpen desde el editor: ahí no hay hoja abierta donde poner el menú.
    Logger.log('onOpen solo agrega el menú al abrir la hoja. Para crear el formulario, ' +
               'elige "crearFormulario" en el desplegable de funciones y da clic en Ejecutar.');
  }
}

// ─────────────────────────── CREAR EL FORMULARIO ───────────────────────────

/** Función principal. Si ya había una creación a medias, la continúa. */
function crearFormulario() {
  const reloj = crearReloj_();
  const candado = LockService.getScriptLock();
  if (!candado.tryLock(5000)) {
    avisar_('Ya hay una creación en curso. Espera a que la pestaña "' + HOJAS.CONFIG +
            '" diga "✅ Listo".');
    return;
  }
  let mensaje;
  try {
    mensaje = construir_(reloj);
  } finally {
    candado.releaseLock(); // se libera antes de mostrar la ventana, para no frenar la continuación
  }
  avisar_(mensaje, true);
}

/** La ejecuta el activador de tiempo cuando la creación se pausó. */
function continuarCreacion() {
  crearFormulario();
}

/** Prueba sin crear nada: resume lo que se generaría con la pestaña Colaboradores. */
function revisarColaboradores() {
  const plan = armarPlan_(leerColaboradores_(abrirHoja_()));
  avisar_('Revisión de "' + CONFIG.HOJA_COLABORADORES + '" (no se creó nada):\n\n' +
          resumenPlan_(plan) + '\n\nSi todo se ve bien, ejecuta "crearFormulario".', true);
}

function construir_(reloj) {
  borrarActivadores_('continuarCreacion');
  const cuenta = revisarCuenta_();
  const ss = abrirHoja_();
  const plan = armarPlan_(leerColaboradores_(ss));
  let estado = leerJSON_(PROP.ESTADO);

  if (estado && estado.fase === 'listo') {
    return 'El formulario ya existe.\n\nLink para compartir: ' +
      (estado.linkCorto || estado.linkPublico) + '\n\nSi necesitas crearlo de nuevo (por ejemplo, ' +
      'porque cambió la lista de colaboradores), ejecuta primero "reiniciarFormulario".';
  }
  if (estado && estado.hash !== plan.hash) {
    throw new Error('La pestaña "' + CONFIG.HOJA_COLABORADORES + '" cambió mientras se creaba el ' +
      'formulario. Ejecuta "reiniciarFormulario" y luego "crearFormulario" otra vez.');
  }
  if (!estado) estado = iniciarFormulario_(ss, plan, cuenta);
  const form = abrirFormulario_(estado.formId);
  const total = plan.nodos.length + 2; // + sección 1 + motivo

  try {
    escribirConfig_(ss, '⏳ Creando…', estado, plan);

    // Pasada 1: crear todas las secciones y preguntas (sin opciones)
    if (estado.fase === 'secciones') {
      const hechas = crearSecciones_(form, plan, reloj);
      if (hechas < plan.nodos.length + 1) {
        return pausar_(ss, estado, plan, 'secciones creadas: ' + (hechas + 1) + ' de ' + total);
      }
      Logger.log('Secciones creadas: ' + total + ' de ' + total);
      estado.fase = 'navegacion';
      estado.paso = 0;
      guardarJSON_(PROP.ESTADO, estado);
    }

    // Pasada 2: poner las opciones con su "ir a la sección…"
    if (estado.fase === 'navegacion') {
      if (!conectarSecciones_(form, plan, estado, reloj)) {
        return pausar_(ss, estado, plan,
                       'conectando secciones: ' + estado.paso + ' de ' + plan.nodos.length);
      }
      estado.fase = 'final';
      guardarJSON_(PROP.ESTADO, estado);
    }

    if (reloj.restanteMs() < 90 * 1000) return pausar_(ss, estado, plan, 'últimos ajustes');
    return finalizar_(form, ss, plan, estado);
  } catch (e) {
    try {
      escribirConfig_(ss, '❌ Error: ' + e.message +
                      '  →  Vuelve a ejecutar crearFormulario: sigue donde se quedó.', estado, plan);
    } catch (e2) { /* si ni la hoja responde, basta con el error original */ }
    throw e;
  }
}

function iniciarFormulario_(ss, plan, cuenta) {
  const form = FormApp.create(CONFIG.TITULO);
  const estado = {
    formId: form.getId(), ssId: ss.getId(), hash: plan.hash, fase: 'secciones', paso: 0,
    cuenta: cuenta, linkEdicion: form.getEditUrl(), inicio: new Date().toISOString(),
  };
  guardarJSON_(PROP.ESTADO, estado);

  form.setDescription(CONFIG.DESCRIPCION)
      .setConfirmationMessage(CONFIG.MENSAJE_FINAL)
      .setShowLinkToRespondAgain(true)
      .setProgressBar(false); // con tantas secciones, la barra de progreso confunde
  try {
    form.setRequireLogin(CONFIG.SOLO_CUENTAS_DEL_DOMINIO);
  } catch (e) {
    Logger.log('Aviso: no se pudo ajustar "solo cuentas del dominio" (' + e.message + ').');
  }
  Logger.log('Formulario creado: ' + estado.linkEdicion);
  return estado;
}

function crearSeccion1_(form) {
  form.addTextItem().setTitle(TXT.NOMBRE).setRequired(true);
  form.addMultipleChoiceItem().setTitle(TXT.VALOR).setChoiceValues(CONFIG.VALORES).setRequired(true);
  form.addMultipleChoiceItem().setTitle(TXT.UNIDAD).setRequired(true); // opciones en la pasada 2
}

/**
 * Pasada 1. Devuelve cuántas secciones del plan existen ya (incluida la del motivo),
 * de 0 a nodos + 1. Retoma lo que haya en el formulario y repara un corte a medias.
 */
function crearSecciones_(form, plan, reloj) {
  const N = plan.nodos.length;
  let items = form.getItems();

  if (items.length < 3) { // sección 1 vacía o incompleta: se rehace
    for (let i = items.length - 1; i >= 0; i--) form.deleteItem(i);
    crearSeccion1_(form);
    items = form.getItems();
  }
  if ((items.length - 3) % 2 === 1) { // quedó un salto de sección sin su pregunta
    form.deleteItem(items.length - 1);
    items = items.slice(0, -1);
  }
  const hechas = (items.length - 3) / 2;
  if (hechas > N + 1) {
    throw new Error('El formulario tiene más preguntas de las esperadas (¿se editó a mano?). ' +
                    'Ejecuta "reiniciarFormulario" y vuelve a crear.');
  }
  // Por si la ejecución anterior se cortó justo después de agregar la última pregunta
  if (hechas > 0) {
    const k = hechas - 1;
    if (k < N) items[4 + 2 * k].asListItem().setTitle(TXT.POR_NIVEL[plan.nodos[k].nivel]).setRequired(true);
    else items[4 + 2 * k].asParagraphTextItem().setTitle(TXT.MOTIVO).setRequired(true);
  }

  for (let k = hechas; k < N; k++) {
    if (!reloj.hayTiempo()) return k;
    const nodo = plan.nodos[k];
    form.addPageBreakItem().setTitle(nodo.titulo);
    form.addListItem().setTitle(TXT.POR_NIVEL[nodo.nivel]).setRequired(true);
    if ((k + 1) % 25 === 0) Logger.log('Secciones creadas: ' + (k + 2) + ' de ' + (N + 2));
  }
  if (hechas <= N) {
    form.addPageBreakItem().setTitle(TXT.MOTIVO_SECCION);
    form.addParagraphTextItem().setTitle(TXT.MOTIVO).setRequired(true);
  }
  return N + 1;
}

/** Pasada 2. Devuelve true si terminó; si se acabó el tiempo guarda en estado.paso dónde iba. */
function conectarSecciones_(form, plan, estado, reloj) {
  const N = plan.nodos.length;
  const items = form.getItems();
  if (items.length !== 3 + 2 * N + 2) {
    throw new Error('El formulario no tiene la estructura esperada (¿se editó a mano mientras se ' +
                    'creaba?). Ejecuta "reiniciarFormulario" y vuelve a crear.');
  }
  const secciones = {};
  const seccion = idx => secciones[idx] || (secciones[idx] = items[3 + 2 * idx].asPageBreakItem());
  const motivo = items[3 + 2 * N].asPageBreakItem();

  if (estado.paso === 0) {
    const unidad = items[2].asMultipleChoiceItem();
    unidad.setChoices(plan.unidades.map(u => unidad.createChoice(u.nombre, seccion(entrada_(u)))));
  }
  for (let k = estado.paso; k < N; k++) {
    if (!reloj.hayTiempo()) {
      estado.paso = k;
      return false;
    }
    const nodo = plan.nodos[k];
    const lista = items[4 + 2 * k].asListItem();
    lista.setChoices(nodo.nivel === 2
      ? nodo.nombres.map(nombre => lista.createChoice(nombre, motivo))
      : nodo.hijos.map(h => lista.createChoice(h.nombre, seccion(entrada_(h)))));
    if ((k + 1) % 25 === 0) {
      estado.paso = k + 1;
      guardarJSON_(PROP.ESTADO, estado);
      Logger.log('Secciones conectadas: ' + (k + 1) + ' de ' + N);
    }
  }
  estado.paso = N;
  return true;
}

/** Sección a la que lleva elegir un nodo (si su pregunta se saltó, la de su único hijo). */
function entrada_(nodo) {
  while (nodo.idx === undefined) nodo = nodo.hijos[0];
  return nodo.idx;
}

function finalizar_(form, ss, plan, estado) {
  const items = form.getItems();
  const N = plan.nodos.length;

  // IDs de las preguntas fijas y mapa itemId → [unidad, sucursal, área] de cada lista de nombres
  guardarJSON_(PROP.FIJOS, {
    nombre: items[0].getId(), valor: items[1].getId(), motivo: items[4 + 2 * N].getId(),
  });
  const mapa = {};
  plan.nodos.filter(n => n.nivel === 2).forEach(n => { mapa[items[4 + 2 * n.idx].getId()] = n.ruta; });
  guardarJSON_(PROP.MAPA, mapa);

  // Respuestas a esta misma hoja
  let vinculado = false;
  try { vinculado = form.getDestinationId() === ss.getId(); } catch (e) { /* aún sin destino */ }
  if (!vinculado) form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  try { form.setPublished(true); } catch (e) { /* versiones de Forms que ya lo publican al crearlo */ }
  form.setAcceptingResponses(true);

  prepararHojasAnalisis_(ss);
  activarActivadorRespuestas_(estado.formId);

  estado.fase = 'listo';
  estado.linkPublico = form.getPublishedUrl();
  try { estado.linkCorto = form.shortenFormUrl(estado.linkPublico); } catch (e) { /* opcional */ }
  estado.linkEdicion = form.getEditUrl();
  estado.fin = new Date().toISOString();
  guardarJSON_(PROP.ESTADO, estado);
  escribirConfig_(ss, '✅ Listo', estado, plan);

  return '✅ ¡Formulario listo!\n\n' + resumenPlan_(plan) +
    '\n\nLink para compartir: ' + (estado.linkCorto || estado.linkPublico) +
    '\nLink de edición: ' + estado.linkEdicion +
    '\n\nTodo quedó en la pestaña "' + HOJAS.CONFIG + '". Las respuestas nuevas se agregan solas a "' +
    HOJAS.NOMINACIONES + '".';
}

function pausar_(ss, estado, plan, avance) {
  guardarJSON_(PROP.ESTADO, estado);
  ScriptApp.newTrigger('continuarCreacion').timeBased().after(60 * 1000).create();
  escribirConfig_(ss, '⏳ En proceso (' + avance + '). Sigue sola cada minuto; no tienes que hacer nada.',
                  estado, plan);
  return 'Google limita cada ejecución a 6 minutos, así que la creación se pausó (' + avance +
    ') y seguirá sola en 1 minuto.\n\nPuedes cerrar esta ventana. Cuando la pestaña "' + HOJAS.CONFIG +
    '" diga "✅ Listo", ahí estarán los links.';
}

// ─────────────────────────── LEER COLABORADORES ───────────────────────────

/** Devuelve { registros: [[unidad, sucursal, área, nombre]], incompletas: [núm. de fila] }. */
function leerColaboradores_(ss) {
  const hoja = ss.getSheetByName(CONFIG.HOJA_COLABORADORES);
  if (!hoja) {
    throw new Error('No encontré la pestaña "' + CONFIG.HOJA_COLABORADORES + '". Revisa que se llame ' +
                    'exactamente así (fila 1: Unidad de Negocio | Sucursal | Área | Nombre).');
  }
  const registros = [];
  const incompletas = [];
  hoja.getDataRange().getDisplayValues().slice(1).forEach((fila, i) => {
    const [unidad, sucursal, area, nombre] = [0, 1, 2, 3].map(c => limpiar_(fila[c]));
    if (!unidad && !sucursal && !area && !nombre) return; // fila vacía
    if (!unidad || !area || !nombre) {
      incompletas.push(i + 2);
      return;
    }
    registros.push([unidad, sucursal || CONFIG.SUCURSAL_VACIA, area, nombre]);
  });
  if (!registros.length) {
    throw new Error('La pestaña "' + CONFIG.HOJA_COLABORADORES + '" no tiene filas completas ' +
                    '(Unidad de Negocio, Área y Nombre son obligatorios).');
  }
  return { registros: registros, incompletas: incompletas };
}

/**
 * Arma el árbol unidad > sucursal > área > nombres y la lista de secciones a crear,
 * en el orden en que irán en el formulario.
 */
function armarPlan_(lectura) {
  // Árbol sin repetidos (ignora mayúsculas, acentos y espacios de más)
  const raiz = new Map();
  lectura.registros.forEach(fila => {
    let nivel = raiz;
    fila.forEach(valor => {
      const k = clave_(valor);
      if (!nivel.has(k)) nivel.set(k, { nombre: valor, hijos: new Map() });
      nivel = nivel.get(k).hijos;
    });
  });

  const nodos = [];
  const ordenados = mapa => Array.from(mapa.values()).sort(
    (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base', numeric: true }));
  const armar = (dato, ruta, nivel) => {
    const hijos = ordenados(dato.hijos);
    const nodo = { nivel: nivel, nombre: dato.nombre, ruta: ruta, titulo: ruta.join(' · ') };
    const saltar = CONFIG.SALTAR_PREGUNTAS_DE_UNA_OPCION && nivel < 2 && hijos.length === 1;
    if (!saltar) {
      nodo.idx = nodos.length;
      nodos.push(nodo);
    }
    if (nivel < 2) nodo.hijos = hijos.map(h => armar(h, ruta.concat(h.nombre), nivel + 1));
    else nodo.nombres = hijos.map(h => h.nombre);
    return nodo;
  };
  const unidades = ordenados(raiz).map(u => armar(u, [u.nombre], 0));

  const personas = nodos.filter(n => n.nivel === 2).reduce((s, n) => s + n.nombres.length, 0);
  const huella = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(unidades),
                                         Utilities.Charset.UTF_8);
  return {
    unidades: unidades,
    nodos: nodos,
    porNivel: [0, 1, 2].map(l => nodos.filter(n => n.nivel === l).length),
    personas: personas,
    duplicados: lectura.registros.length - personas,
    incompletas: lectura.incompletas,
    hash: Utilities.base64Encode(huella),
  };
}

function resumenPlan_(plan) {
  const [u, s, a] = plan.porNivel;
  const personasDe = n => n.nombres ? n.nombres.length : n.hijos.reduce((t, h) => t + personasDe(h), 0);
  const lineas = [
    'Secciones: ' + (plan.nodos.length + 2) + '  (1 inicial + ' + u + ' para elegir sucursal + ' + s +
      ' para elegir área + ' + a + ' para elegir persona + 1 del motivo)',
    'Colaboradores: ' + plan.personas +
      (plan.duplicados ? '  (se quitaron ' + plan.duplicados + ' repetidos)' : ''),
    'Por unidad: ' + plan.unidades.map(n =>
      n.nombre + ' (' + n.hijos.length + ' suc., ' + personasDe(n) + ' personas)').join(' · '),
  ];
  if (plan.incompletas.length) {
    lineas.push('Filas ignoradas por datos incompletos: ' + resumirLista_(plan.incompletas));
  }
  return lineas.join('\n');
}

// ─────────────────────────── CONSOLIDACIÓN ───────────────────────────

/** Rehace la pestaña "Nominaciones" (una fila por respuesta) con todas las respuestas. */
function consolidarNominaciones() {
  const ctx = contexto_();
  const total = conCandado_(() => consolidar_(ctx));
  avisar_('Listo: ' + total + ' nominaciones en la pestaña "' + HOJAS.NOMINACIONES +
          '". El resumen está en "' + HOJAS.CONTEO + '".');
}

/** Crea el activador que agrega cada respuesta nueva a "Nominaciones". */
function activarConsolidacionAutomatica() {
  const ctx = contexto_();
  activarActivadorRespuestas_(ctx.estado.formId);
  const total = conCandado_(() => consolidar_(ctx)); // pone al día lo que ya hubiera
  avisar_('Consolidación automática activada: cada respuesta nueva se agrega sola a "' +
          HOJAS.NOMINACIONES + '". Por ahora hay ' + total + ' nominaciones.', true);
}

/** La ejecuta el activador cada vez que alguien envía el formulario. */
function alEnviarNominacion(e) {
  conCandado_(() => {
    const ctx = contexto_();
    prepararHojasAnalisis_(ctx.ss).appendRow(filaNominacion_(e.response, ctx));
  });
}

function consolidar_(ctx) {
  const form = abrirFormulario_(ctx.estado.formId);
  const filas = form.getResponses().map(r => filaNominacion_(r, ctx));
  const hoja = prepararHojasAnalisis_(ctx.ss);
  const ancho = COLUMNAS_NOMINACIONES.length;
  if (hoja.getLastRow() > 1) hoja.getRange(2, 1, hoja.getLastRow() - 1, ancho).clearContent();
  if (filas.length) hoja.getRange(2, 1, filas.length, ancho).setValues(filas);
  return filas.length;
}

/** Fecha | Nominador | Valor | Unidad | Sucursal | Área | Nominado | Motivo */
function filaNominacion_(respuesta, ctx) {
  const f = { nominador: '', valor: '', nominado: '', motivo: '', ruta: ['', '', ''] };
  respuesta.getItemResponses().forEach(ir => {
    const id = String(ir.getItem().getId());
    const texto = ir.getResponse();
    if (id === String(ctx.fijos.nombre)) f.nominador = texto;
    else if (id === String(ctx.fijos.valor)) f.valor = texto;
    else if (id === String(ctx.fijos.motivo)) f.motivo = texto;
    else if (ctx.mapa[id]) {
      f.nominado = texto;
      f.ruta = ctx.mapa[id];
    }
  });
  return [respuesta.getTimestamp(), f.nominador, f.valor].concat(f.ruta, [f.nominado, f.motivo])
    .map(comoTexto_);
}

/** Crea (si faltan) las pestañas "Nominaciones" y "Conteo". Devuelve "Nominaciones". */
function prepararHojasAnalisis_(ss) {
  const nom = ss.getSheetByName(HOJAS.NOMINACIONES) || ss.insertSheet(HOJAS.NOMINACIONES);
  if (nom.getRange('A1').getValue() === '') {
    nom.getRange(1, 1, 1, COLUMNAS_NOMINACIONES.length).setValues([COLUMNAS_NOMINACIONES])
       .setFontWeight('bold').setBackground('#f1f3f4');
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

function activarActivadorRespuestas_(formId) {
  borrarActivadores_('alEnviarNominacion');
  ScriptApp.newTrigger('alEnviarNominacion').forForm(formId).onFormSubmit().create();
}

// ─────────────────────────── REINICIAR ───────────────────────────

/** Cierra el formulario actual (no lo borra) y limpia la configuración para crear uno nuevo. */
function reiniciarFormulario() {
  let ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) { /* desde el editor no hay ventana de confirmación */ }
  if (ui) {
    const r = ui.alert('Reiniciar formulario',
      'El formulario actual se cerrará (dejará de aceptar respuestas) y podrás crear uno nuevo con ' +
      '"Crear formulario". No se borra nada: el formulario anterior y sus respuestas se quedan en tu ' +
      'Drive y en esta hoja. ¿Continuar?', ui.ButtonSet.YES_NO);
    if (r !== ui.Button.YES) return;
  }
  conCandado_(() => {
    const estado = leerJSON_(PROP.ESTADO);
    if (estado && estado.formId) {
      try {
        const form = FormApp.openById(estado.formId);
        form.setAcceptingResponses(false);
        try { form.removeDestination(); } catch (e) { /* no tenía destino */ }
      } catch (e) {
        Logger.log('No pude cerrar el formulario anterior (' + e.message + '). Ciérralo a mano si hace falta.');
      }
    }
    borrarActivadores_('continuarCreacion');
    borrarActivadores_('alEnviarNominacion');
    const props = PropertiesService.getScriptProperties();
    Object.keys(props.getProperties())
      .filter(k => k.indexOf('GRACCIEE_') === 0)
      .forEach(k => props.deleteProperty(k));
    try {
      escribirConfig_(abrirHoja_(), '🔄 Reiniciado. Ejecuta "crearFormulario" para crear uno nuevo.', null, null);
    } catch (e) { /* opcional */ }
  });
  avisar_('Listo. El formulario anterior quedó cerrado y sigue en tu Drive por si lo necesitas. ' +
          'Ya puedes ejecutar "crearFormulario".', true);
}

// ─────────────────────────── APOYO ───────────────────────────

function abrirHoja_(idGuardado) {
  if (CONFIG.SHEET_URL) return SpreadsheetApp.openByUrl(CONFIG.SHEET_URL);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  if (idGuardado) return SpreadsheetApp.openById(idGuardado);
  throw new Error('Este script no está vinculado a una hoja. Ábrelo desde la hoja ' +
                  '(Extensiones > Apps Script) o pega el link de la hoja en CONFIG.SHEET_URL, entre comillas.');
}

function abrirFormulario_(formId) {
  try {
    return FormApp.openById(formId);
  } catch (e) {
    throw new Error('No pude abrir el formulario guardado (ID ' + formId + ') con la cuenta ' +
      cuentaActual_() + '. Casi siempre es porque Apps Script está usando otra cuenta de Google ' +
      '(por ejemplo la personal en lugar de la @' + CONFIG.DOMINIO_ESPERADO + '): abre la hoja en una ' +
      'ventana de incógnito con solo la cuenta correcta. Si el formulario se borró, ejecuta ' +
      '"reiniciarFormulario". Detalle: ' + e.message);
  }
}

function contexto_() {
  const estado = leerJSON_(PROP.ESTADO);
  if (!estado || estado.fase !== 'listo') {
    throw new Error('Primero hay que crear el formulario: ejecuta "crearFormulario" y espera a que la ' +
                    'pestaña "' + HOJAS.CONFIG + '" diga "✅ Listo".');
  }
  return { estado: estado, ss: abrirHoja_(estado.ssId), fijos: leerJSON_(PROP.FIJOS), mapa: leerJSON_(PROP.MAPA) };
}

function revisarCuenta_() {
  const cuenta = cuentaActual_();
  Logger.log('Ejecutando con la cuenta: ' + cuenta);
  const dominio = CONFIG.DOMINIO_ESPERADO.toLowerCase();
  if (dominio && cuenta.indexOf('@') > 0 && !cuenta.toLowerCase().endsWith('@' + dominio)) {
    throw new Error('Estás ejecutando el script con la cuenta ' + cuenta + ', pero el formulario debe ' +
      'crearse con tu cuenta @' + CONFIG.DOMINIO_ESPERADO + '. Abre la hoja en una ventana de incógnito ' +
      '(o en un perfil de Chrome) donde solo esté esa cuenta y vuelve a intentarlo. Si de verdad quieres ' +
      'usar esta cuenta, cambia DOMINIO_ESPERADO a \'\' en CONFIG.');
  }
  return cuenta;
}

function cuentaActual_() {
  try {
    return Session.getEffectiveUser().getEmail() || '(desconocida)';
  } catch (e) {
    return '(desconocida)';
  }
}

function escribirConfig_(ss, textoEstado, estado, plan) {
  const hoja = ss.getSheetByName(HOJAS.CONFIG) || ss.insertSheet(HOJAS.CONFIG);
  const e = estado || {};
  const filas = [
    ['Estado', textoEstado],
    ['Link para compartir', e.linkCorto || e.linkPublico || '(aparece al terminar)'],
    ['Link completo', e.linkPublico || ''],
    ['Link de edición', e.linkEdicion || ''],
    ['Secciones del formulario', plan ? plan.nodos.length + 2 : ''],
    ['Colaboradores en el formulario', plan ? plan.personas : ''],
    ['Filas ignoradas (incompletas)', plan ? (resumirLista_(plan.incompletas) || 'Ninguna') : ''],
    ['Cuenta que creó el formulario', e.cuenta || ''],
    ['Actualizado', new Date()],
    ['ID del formulario', e.formId || ''],
  ];
  hoja.clear();
  hoja.getRange(1, 1, filas.length, 2).setValues(filas.map(f => [f[0], comoTexto_(f[1])]));
  hoja.getRange(1, 1, filas.length, 1).setFontWeight('bold');
  hoja.setColumnWidth(1, 240);
  hoja.setColumnWidth(2, 560);
}

function avisar_(mensaje, conVentana) {
  Logger.log(mensaje);
  try {
    if (conVentana) SpreadsheetApp.getUi().alert('Premios GRACCIEE', mensaje, SpreadsheetApp.getUi().ButtonSet.OK);
    else SpreadsheetApp.getActive().toast(mensaje, 'Premios GRACCIEE', 8);
  } catch (e) { /* desde el editor o un activador no hay ventana: basta con el registro */ }
}

function crearReloj_() {
  const inicio = Date.now();
  const limite = CONFIG.LIMITE_MINUTOS * 60 * 1000;
  return {
    hayTiempo: () => Date.now() - inicio < limite,
    restanteMs: () => limite - (Date.now() - inicio),
  };
}

function conCandado_(fn) {
  const candado = LockService.getScriptLock();
  candado.waitLock(30000);
  try {
    return fn();
  } finally {
    candado.releaseLock();
  }
}

function borrarActivadores_(funcion) {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === funcion)
    .forEach(t => ScriptApp.deleteTrigger(t));
}

/** Quita espacios de más (incluidos los "invisibles"). */
function limpiar_(valor) {
  return (valor == null ? '' : String(valor)).replace(/\s+/g, ' ').trim();
}

/** Para comparar sin importar mayúsculas ni acentos: "Recepción" = "recepcion". */
function clave_(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Evita que un texto que empieza con =, +, - o @ se tome como fórmula en la hoja. */
function comoTexto_(valor) {
  return typeof valor === 'string' && /^[=+\-@]/.test(valor) ? "'" + valor : valor;
}

function resumirLista_(lista) {
  return lista.length > 40 ? lista.slice(0, 40).join(', ') + '… (' + lista.length + ' en total)'
                           : lista.join(', ');
}

// Las propiedades del script aceptan ~9 KB por valor: el JSON se guarda en partes.
const TAM_PARTE = 8000;

function guardarJSON_(clave, objeto) {
  const props = PropertiesService.getScriptProperties();
  // Acentos y otros caracteres especiales se escriben como \uXXXX: todo queda en ASCII (1 byte por carácter)
  const texto = JSON.stringify(objeto).replace(/[\u007f-￿]/g,
    c => '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4));
  const partes = {};
  let n = 0;
  for (let i = 0; i < texto.length; i += TAM_PARTE) partes[clave + '_' + n++] = texto.slice(i, i + TAM_PARTE);
  const anteriores = Number(props.getProperty(clave + '_N') || 0);
  partes[clave + '_N'] = String(n);
  props.setProperties(partes);
  for (let i = n; i < anteriores; i++) props.deleteProperty(clave + '_' + i);
}

function leerJSON_(clave) {
  const props = PropertiesService.getScriptProperties().getProperties();
  const n = Number(props[clave + '_N'] || 0);
  if (!n) return null;
  let texto = '';
  for (let i = 0; i < n; i++) texto += props[clave + '_' + i] || '';
  return JSON.parse(texto);
}
