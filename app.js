/* Premios GRACCIEE 2026 · Formulario de nominaciones
   Flujo: ¿quién eres? → un paso por cada valor (a quién y por qué) → revisión → envío único. */
(function () {
  'use strict';

  const API = ((window.GRACCIEE_CONFIG || {}).API_URL || '').trim();
  const DEMO = !API;
  const PANTALLAS = ['cargando', 'error-carga', 'cerrado', 'asistente', 'gracias'];
  const CLAVE_BORRADOR = 'gracciee_borrador_v2';
  const LARGO_MOTIVO = 3000;
  const $ = id => document.getElementById(id);

  // Datos de ejemplo para el modo de prueba (nombres inventados). Sucursal o área vacías = ese nivel no se pregunta.
  const DATOS_DEMO = {
    ok: true,
    abierto: true,
    valores: ['Gratitud', 'Ritmo', 'Actitud', 'Ambición', 'Calidad', 'Creatividad', 'Integridad', 'Equipo', 'Empoderamiento'],
    unidades: [
      { nombre: 'Center', sucursales: [{ nombre: '', areas: [{ nombre: '', personas: ['Laura Gómez Díaz', 'Patricia Lara Solís', 'Ricardo Salas Vega'] }] }] },
      { nombre: 'EasyFit', sucursales: [
        { nombre: 'Oficina Central', areas: [{ nombre: '', personas: ['Fernanda Aguilar Cruz', 'Héctor Morales Gil'] }] },
        { nombre: 'Sucursal Ejemplo', areas: [{ nombre: '', personas: ['Diego Castro Luna', 'Mariana López Hernández', 'Paola Ríos Medina'] }] }] },
      { nombre: 'GEB', sucursales: [{ nombre: '', areas: [{ nombre: '', personas: ['Jorge Ramírez Soto', 'Valeria Ortega Paz'] }] }] },
      { nombre: 'Vivo 47', sucursales: [{ nombre: '', areas: [
        { nombre: 'Acuática', personas: ['Andrés Beltrán Ruiz', 'Sofía Herrera León'] },
        { nombre: 'Deportes', personas: ['Carlos Méndez Ortiz', 'Luis Pérez Campos', 'Óscar Núñez Prieto'] },
        { nombre: 'Oficina Central', personas: ['Ana Sofía Torres Ruiz'] }] }] },
    ],
  };

  let catalogo = null;
  let valores = [];
  // paso: 0 = ¿quién eres?, 1..9 = un valor cada uno, 10 = revisión
  let estado = nuevoEstado();

  function nuevoEstado() {
    return { paso: 0, nominador: null, nominaciones: {} };
  }
  const nominacion = valor => estado.nominaciones[valor] || (estado.nominaciones[valor] = { persona: null, motivo: '' });
  const pasoRevision = () => valores.length + 1;

  // ───────────── Arranque ─────────────
  function iniciar() {
    if (DEMO) $('aviso-demo').hidden = false;
    $('reintentar').addEventListener('click', cargar);
    $('reiniciar').addEventListener('click', () => {
      if (window.confirm('¿Borrar lo que llevas y empezar de nuevo?')) empezarDeNuevo();
    });
    $('otra-persona').addEventListener('click', empezarDeNuevo);
    $('paso').addEventListener('submit', e => {
      e.preventDefault();
      if (estado.paso === pasoRevision()) enviar();
      else avanzar();
    });
    cargar();
  }

  async function cargar() {
    mostrar('cargando');
    try {
      const datos = DEMO ? DATOS_DEMO : await pedir(API);
      if (!datos || !datos.ok) throw new Error((datos && datos.error) || 'Respuesta inválida del servidor.');
      if (!datos.abierto) return mostrar('cerrado');
      catalogo = { unidades: datos.unidades };
      valores = datos.valores;
      restaurarBorrador();
      mostrar('asistente');
      pintar(false);
    } catch (err) {
      $('error-carga-detalle').textContent = err.message;
      mostrar('error-carga');
    }
  }

  async function pedir(url, opciones) {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), 25000);
    try {
      const r = await fetch(url, Object.assign({ signal: control.signal }, opciones));
      if (!r.ok) throw new Error('El servidor respondió ' + r.status + '.');
      return await r.json();
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('El servidor tardó demasiado en responder.');
      throw err;
    } finally {
      clearTimeout(reloj);
    }
  }

  // ───────────── Pasos ─────────────
  function pintar(moverFoco) {
    const form = $('paso');
    form.textContent = '';
    document.body.classList.toggle('en-curso', estado.paso > 0);
    pintarProgreso();
    if (estado.paso === 0) pasoQuienEres(form);
    else if (estado.paso === pasoRevision()) pasoRevisar(form);
    else pasoValor(form, valores[estado.paso - 1], estado.paso);
    guardarBorrador();
    if (moverFoco) {
      $('asistente').scrollIntoView({ block: 'start' });
      const titulo = form.querySelector('h2');
      if (titulo) titulo.focus({ preventScroll: true });
    }
  }

  function pintarProgreso() {
    const p = estado.paso;
    const listos = valores.filter(completoValor).length;
    $('progreso-texto').textContent = p === 0 ? 'Antes de empezar'
      : p === pasoRevision() ? 'Revisión final' : 'Llevas ' + listos + ' de ' + valores.length;
    $('reiniciar').hidden = p === 0 && !estado.nominador;
    const barra = $('progreso-barra');
    barra.textContent = '';
    valores.forEach((v, i) => {
      const n = estado.nominaciones[v];
      const completo = n && n.persona && n.motivo.trim();
      barra.appendChild(h('li', { class: (completo ? 'hecho' : '') + (p === i + 1 ? ' actual' : ''), title: v }));
    });
  }

  function pasoQuienEres(form) {
    const selector = crearSelector({
      catalogo: catalogo,
      inicial: estado.nominador,
      etiqueta: 'Eres',
      paraMi: true,
      alCambiar: p => {
        estado.nominador = p;
        if (p) {
          quitarError(form);
          // Si ya había elegido a esta persona en algún valor, se quita: nadie se nomina a sí mismo
          valores.forEach(v => { if (mismaPersona(nominacion(v).persona, p)) nominacion(v).persona = null; });
        }
        guardarBorrador();
        pintarProgreso();
      },
    });
    form.append(
      h('h2', { tabindex: '-1' }, '¿Quién eres?'),
      h('p', { class: 'ayuda' }, 'Búscate en la lista. Después nominarás a una persona en cada uno de los ',
        String(valores.length), ' valores y, al final, enviarás todo junto.'),
      selector.elemento,
      h('p', { class: 'nota nota--izq' }, '¿No apareces en la lista? Avisa a Capital Humano.'),
      h('p', { class: 'error', role: 'alert' }),
      navegacion(null, estado.volverARevision ? 'Volver a la revisión' : 'Comenzar'));
  }

  function pasoValor(form, valor, k) {
    const n = nominacion(valor);
    const idMotivo = 'motivo-' + k;
    const selector = crearSelector({
      catalogo: sinPersona(catalogo, estado.nominador),
      inicial: n.persona,
      etiqueta: 'Nominas en ' + valor + ' a',
      alCambiar: p => { n.persona = p; if (p) quitarError(form); guardarBorrador(); pintarProgreso(); },
    });
    const motivo = h('textarea', { id: idMotivo, rows: '5', maxlength: String(LARGO_MOTIVO) });
    motivo.value = n.motivo;
    const cuenta = h('span', {}, String(n.motivo.length));
    motivo.addEventListener('input', () => {
      n.motivo = motivo.value;
      cuenta.textContent = motivo.value.length;
      quitarError(form);
      guardarBorrador();
      pintarProgreso();
    });
    form.append(
      h('div', { class: 'valor-cabecera' },
        h('span', { class: 'valor-cabecera__letra', 'aria-hidden': 'true' }, valor.charAt(0)),
        h('div', {},
          h('p', { class: 'valor-cabecera__num' }, 'Valor ' + k + ' de ' + valores.length),
          h('h2', { tabindex: '-1' }, valor))),
      h('p', { class: 'etiqueta' }, '¿A quién nominas en ', h('strong', {}, valor), '?'),
      selector.elemento,
      h('label', { for: idMotivo, class: 'etiqueta-motivo' }, '¿Qué hizo esta persona que refleje ', h('strong', {}, valor), '?'),
      motivo,
      h('p', { class: 'contador' }, cuenta, ' / ' + LARGO_MOTIVO),
      h('p', { class: 'error', role: 'alert' }),
      navegacion('Anterior', estado.volverARevision ? 'Volver a la revisión' : k === valores.length ? 'Revisar' : 'Siguiente'));
  }

  function pasoRevisar(form) {
    const lista = h('ol', { class: 'revision' });
    valores.forEach((v, i) => {
      const n = nominacion(v);
      lista.appendChild(h('li', { class: 'revision__item' },
        h('span', { class: 'chip__letra', 'aria-hidden': 'true' }, v.charAt(0)),
        h('div', { class: 'revision__texto' },
          h('p', { class: 'revision__valor' }, v),
          h('p', { class: 'revision__persona' }, n.persona ? n.persona.nombre : '—'),
          h('p', { class: 'revision__ruta' }, n.persona ? ruta(n.persona) : ''),
          h('p', { class: 'revision__motivo' }, n.motivo)),
        h('button', { type: 'button', class: 'enlace', onclick: () => irA(i + 1) }, 'Cambiar')));
    });
    form.append(
      h('h2', { tabindex: '-1' }, 'Revisa tus nominaciones'),
      h('div', { class: 'elegida elegida--compacta' },
        h('div', {},
          h('p', { class: 'elegida__etiqueta' }, 'Nominas como'),
          h('p', { class: 'elegida__nombre' }, estado.nominador.nombre),
          h('p', { class: 'elegida__ruta' }, ruta(estado.nominador))),
        h('button', { type: 'button', class: 'enlace', onclick: () => irA(0) }, 'Cambiar')),
      lista,
      h('div', { class: 'trampa', 'aria-hidden': 'true' },
        h('label', {}, 'Sitio web ', h('input', { id: 'sitio_web', type: 'text', tabindex: '-1', autocomplete: 'off' }))),
      h('p', { class: 'nota nota--izq' }, 'Solo puedes enviar tus nominaciones una vez. Revisa que todo esté bien.'),
      h('p', { class: 'error error--general', role: 'alert' }),
      navegacion('Anterior', 'Enviar mis nominaciones'));
  }

  function navegacion(textoAtras, textoAdelante) {
    return h('div', { class: 'navegacion' },
      textoAtras ? h('button', { type: 'button', class: 'boton boton--secundario', onclick: retroceder }, '← ' + textoAtras) : null,
      h('button', { type: 'submit', class: 'boton' }, textoAdelante + (textoAdelante.startsWith('Enviar') ? '' : ' →')));
  }

  function avanzar() {
    const form = $('paso');
    if (estado.paso === 0) {
      if (!estado.nominador) return ponerError(form, 'Elige tu nombre para continuar.');
    } else {
      const valor = valores[estado.paso - 1];
      const n = nominacion(valor);
      if (!n.persona) return ponerError(form, 'Elige a la persona que nominas en ' + valor + '.');
      if (!n.motivo.trim()) return ponerError(form, 'Cuéntanos qué hizo para merecer ' + valor + '.', form.querySelector('textarea'));
    }
    // Al volver de la revisión para corregir algo, se regresa directo a la revisión
    irA(estado.volverARevision ? pasoRevision() : estado.paso + 1);
  }

  function retroceder() {
    irA(Math.max(0, estado.paso - 1));
  }

  function irA(paso) {
    estado.volverARevision = estado.paso === pasoRevision() && paso !== pasoRevision() && todoCompleto();
    if (paso === pasoRevision() && !todoCompleto()) paso = primerPasoIncompleto();
    estado.paso = paso;
    pintar(true);
  }

  const completoValor = v => { const n = estado.nominaciones[v]; return Boolean(n && n.persona && n.motivo.trim()); };
  const todoCompleto = () => Boolean(estado.nominador) && valores.every(completoValor);
  function primerPasoIncompleto() {
    if (!estado.nominador) return 0;
    const i = valores.findIndex(v => !completoValor(v));
    return i < 0 ? pasoRevision() : i + 1;
  }

  async function enviar() {
    const form = $('paso');
    if (!todoCompleto()) return irA(primerPasoIncompleto());
    const datos = {
      nominador: estado.nominador,
      nominaciones: valores.map(v => {
        const n = nominacion(v);
        return { valor: v, unidad: n.persona.unidad, sucursal: n.persona.sucursal, area: n.persona.area,
                 nominado: n.persona.nombre, motivo: n.motivo.trim() };
      }),
      sitio_web: ($('sitio_web') || {}).value || '',
    };
    const boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;
    boton.textContent = 'Enviando…';
    try {
      if (DEMO) {
        await new Promise(r => setTimeout(r, 700));
      } else {
        // Texto plano para que el navegador no pida permiso previo (CORS) a Apps Script
        const r = await pedir(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(datos) });
        if (!r.ok) throw new Error(r.error || 'No se pudieron guardar tus nominaciones.');
      }
      borrarLocal(CLAVE_BORRADOR);
      $('gracias-nombre').textContent = estado.nominador.nombre.split(' ')[0];
      mostrar('gracias');
      document.body.classList.remove('en-curso');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      $('gracias').focus({ preventScroll: true });
    } catch (err) {
      ponerError(form, err instanceof TypeError
        ? 'No pudimos enviar tus nominaciones. Revisa tu conexión e inténtalo de nuevo; no se perdió nada.'
        : err.message);
      boton.disabled = false;
      boton.textContent = 'Enviar mis nominaciones';
    }
  }

  function empezarDeNuevo() {
    borrarLocal(CLAVE_BORRADOR);
    estado = nuevoEstado();
    mostrar('asistente');
    pintar(true);
  }

  // ───────────── Selector de persona ─────────────
  let contador = 0;

  /** Unidad → Sucursal → Área → Persona (los niveles vacíos no se preguntan) o búsqueda por nombre. */
  function crearSelector({ catalogo: cat, inicial, etiqueta, alCambiar, paraMi }) {
    const raiz = $('tpl-selector').content.firstElementChild.cloneNode(true);
    const q = c => raiz.querySelector('.' + c);
    if (paraMi) {
      q('sel-separador').textContent = 'o búscate por nombre';
      q('sel-buscar').placeholder = 'Escribe tu nombre o apellido';
    }
    const uid = 'sel' + (++contador);
    ['sucursal', 'area', 'persona'].forEach(n => {
      q('sel-' + n).id = uid + '-' + n;
      q('sel-label-' + n).htmlFor = uid + '-' + n;
    });
    q('sel-etiqueta-unidad').id = uid + '-unidad';
    q('sel-unidades').setAttribute('aria-labelledby', uid + '-unidad');
    q('sel-elegida-etiqueta').textContent = etiqueta;

    const sel = { unidad: null, sucursal: null, area: null };
    let persona = null;
    const ORDEN = ['unidad', 'sucursal', 'area', 'persona'];

    cat.unidades.forEach(u => {
      const chip = crearChip(uid + '-u', u.nombre);
      chip.querySelector('input').addEventListener('change', () => elegirUnidad(u.nombre));
      q('sel-unidades').appendChild(chip);
    });

    /** Devuelve la opción elegida sola (texto, puede ser '') o null si la persona tiene que elegir. */
    function nivel(n, opciones, textoVacio, siempreLista) {
      const campo = q('sel-campo-' + n);
      const select = q('sel-' + n);
      const fijo = raiz.querySelector('.sel-fijo-' + n);
      if (opciones.length === 1 && !siempreLista) {
        campo.hidden = opciones[0] === '';
        select.hidden = true;
        fijo.hidden = false;
        fijo.textContent = opciones[0];
        return opciones[0];
      }
      campo.hidden = false;
      select.hidden = false;
      if (fijo) fijo.hidden = true;
      select.textContent = '';
      select.add(new Option(textoVacio, ''));
      opciones.forEach((o, i) => select.add(new Option(o || '(sin especificar)', String(i))));
      return null;
    }
    const opcionDe = (select, opciones) => (select.value === '' ? null : opciones[Number(select.value)]);

    function limpiarDesde(n) {
      const i = ORDEN.indexOf(n);
      ORDEN.slice(i, 3).forEach(k => { sel[k] = null; });
      ORDEN.slice(i + 1).forEach(k => { q('sel-campo-' + k).hidden = true; });
      if (persona) elegirPersona(null);
    }
    function elegirUnidad(nombre) {
      limpiarDesde('unidad');
      sel.unidad = cat.unidades.find(u => u.nombre === nombre);
      const sola = nivel('sucursal', sel.unidad.sucursales.map(s => s.nombre), 'Elige la sucursal…');
      if (sola !== null) elegirSucursal(sola);
    }
    function elegirSucursal(nombre) {
      limpiarDesde('sucursal');
      sel.sucursal = sel.unidad.sucursales.find(s => s.nombre === nombre);
      const sola = nivel('area', sel.sucursal.areas.map(a => a.nombre), 'Elige el área…');
      if (sola !== null) elegirArea(sola);
    }
    function elegirArea(nombre) {
      limpiarDesde('area');
      sel.area = sel.sucursal.areas.find(a => a.nombre === nombre);
      nivel('persona', sel.area.personas, 'Elige a la persona…', true);
    }
    function elegirPersona(nombre) {
      persona = nombre ? { nombre: nombre, unidad: sel.unidad.nombre, sucursal: sel.sucursal.nombre, area: sel.area.nombre } : null;
      mostrarElegida();
      alCambiar(persona);
    }
    function mostrarElegida() {
      q('sel-cascada').hidden = Boolean(persona);
      q('sel-elegida').hidden = !persona;
      if (persona) {
        q('sel-elegida-nombre').textContent = persona.nombre;
        q('sel-elegida-ruta').textContent = ruta(persona);
      }
    }

    q('sel-sucursal').addEventListener('change', e => {
      const o = opcionDe(e.target, sel.unidad.sucursales.map(s => s.nombre));
      if (o === null) limpiarDesde('sucursal'); else elegirSucursal(o);
    });
    q('sel-area').addEventListener('change', e => {
      const o = opcionDe(e.target, sel.sucursal.areas.map(a => a.nombre));
      if (o === null) limpiarDesde('area'); else elegirArea(o);
    });
    q('sel-persona').addEventListener('change', e => elegirPersona(opcionDe(e.target, sel.area.personas)));
    q('sel-cambiar').addEventListener('click', () => {
      elegirPersona(null);
      q('sel-persona').value = '';
      (q('sel-campo-persona').hidden ? raiz.querySelector('input') : q('sel-persona')).focus();
    });

    /** Deja el selector en una persona concreta (desde la búsqueda o un borrador). */
    function establecer(p) {
      const radio = Array.from(q('sel-unidades').querySelectorAll('input')).find(r => r.value === p.unidad);
      if (!radio) return false;
      radio.checked = true;
      elegirUnidad(p.unidad);
      if (!sel.sucursal) {
        const i = sel.unidad.sucursales.findIndex(s => s.nombre === p.sucursal);
        if (i < 0) return false;
        q('sel-sucursal').value = String(i);
        elegirSucursal(p.sucursal);
      }
      if (!sel.area) {
        const i = sel.sucursal.areas.findIndex(a => a.nombre === p.area);
        if (i < 0) return false;
        q('sel-area').value = String(i);
        elegirArea(p.area);
      }
      const i = sel.area.personas.indexOf(p.nombre);
      if (i < 0) return false;
      q('sel-persona').value = String(i);
      elegirPersona(p.nombre);
      return true;
    }

    // Búsqueda por nombre (sin importar acentos ni mayúsculas)
    const indice = [];
    cat.unidades.forEach(u => u.sucursales.forEach(s => s.areas.forEach(a => a.personas.forEach(p => {
      indice.push({ nombre: p, unidad: u.nombre, sucursal: s.nombre, area: a.nombre, clave: clave(p) });
    }))));
    const buscar = q('sel-buscar');
    const resultados = q('sel-resultados');
    let hallados = [];
    buscar.addEventListener('input', () => {
      resultados.textContent = '';
      const palabras = clave(buscar.value).split(' ').filter(Boolean);
      if (!palabras.length || palabras.join('').length < 2) { hallados = []; return; }
      const todos = indice.filter(x => palabras.every(w => x.clave.includes(w)));
      hallados = todos.slice(0, 8);
      if (!hallados.length) {
        resultados.appendChild(h('li', { class: 'sin-resultados' },
          'No encontramos ese nombre. Prueba con su apellido o elige unidad y área.'));
        return;
      }
      hallados.forEach(x => resultados.appendChild(h('li', {},
        h('button', { type: 'button', class: 'resultado', onclick: () => desdeBusqueda(x) },
          x.nombre, h('small', {}, ruta(x))))));
      if (todos.length > hallados.length) {
        resultados.appendChild(h('li', { class: 'sin-resultados' },
          'Y ' + (todos.length - hallados.length) + ' más. Escribe también su apellido.'));
      }
    });
    buscar.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault(); // que Enter no mande el paso completo
      if (hallados.length) desdeBusqueda(hallados[0]);
    });
    function desdeBusqueda(x) {
      buscar.value = '';
      resultados.textContent = '';
      hallados = [];
      establecer(x);
      q('sel-cambiar').focus();
    }

    if (inicial && !establecer(inicial)) alCambiar(null);
    return { elemento: raiz };
  }

  function crearChip(grupo, valor) {
    return h('label', { class: 'chip chip--simple' },
      h('input', { type: 'radio', name: grupo, value: valor }),
      h('span', { class: 'chip__caja' }, valor));
  }

  // ───────────── Datos ─────────────
  const clave = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const ruta = p => [p.unidad, p.sucursal, p.area].filter(Boolean).join(' · ');
  const mismaPersona = (a, b) => Boolean(a && b) && ['nombre', 'unidad', 'sucursal', 'area'].every(k => clave(a[k]) === clave(b[k]));

  /** Copia de la lista sin la persona indicada (para que nadie se nomine a sí mismo). */
  function sinPersona(cat, p) {
    if (!p) return cat;
    return {
      unidades: cat.unidades.map(u => ({
        nombre: u.nombre,
        sucursales: u.sucursales.map(s => ({
          nombre: s.nombre,
          areas: s.areas.map(a => ({
            nombre: a.nombre,
            personas: a.personas.filter(x => !mismaPersona({ nombre: x, unidad: u.nombre, sucursal: s.nombre, area: a.nombre }, p)),
          })).filter(a => a.personas.length),
        })).filter(s => s.areas.length),
      })).filter(u => u.sucursales.length),
    };
  }

  function existe(p) {
    if (!p) return false;
    const u = catalogo.unidades.find(x => x.nombre === p.unidad);
    const s = u && u.sucursales.find(x => x.nombre === p.sucursal);
    const a = s && s.areas.find(x => x.nombre === p.area);
    return Boolean(a && a.personas.indexOf(p.nombre) >= 0);
  }

  // ───────────── Borrador (por si se cierra la página a la mitad) ─────────────
  function guardarBorrador() {
    guardarLocal(CLAVE_BORRADOR, JSON.stringify({ paso: estado.paso, nominador: estado.nominador, nominaciones: estado.nominaciones }));
  }

  function restaurarBorrador() {
    let b = null;
    try { b = JSON.parse(leerLocal(CLAVE_BORRADOR) || 'null'); } catch (e) { b = null; }
    estado = nuevoEstado();
    if (!b || !existe(b.nominador)) return;
    estado.nominador = b.nominador;
    valores.forEach(v => {
      const n = (b.nominaciones || {})[v];
      if (!n) return;
      estado.nominaciones[v] = {
        persona: existe(n.persona) && !mismaPersona(n.persona, b.nominador) ? n.persona : null,
        motivo: typeof n.motivo === 'string' ? n.motivo.slice(0, LARGO_MOTIVO) : '',
      };
    });
    estado.paso = Math.min(Math.max(Number(b.paso) || 0, 0), primerPasoIncompleto());
  }

  // ───────────── Apoyo ─────────────
  function h(etiqueta, props, ...hijos) {
    const el = document.createElement(etiqueta);
    Object.keys(props || {}).forEach(k => {
      const v = props[k];
      if (k === 'class') el.className = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else if (v != null && v !== false) el.setAttribute(k, v);
    });
    hijos.forEach(c => { if (c != null && c !== false) el.append(c); });
    return el;
  }

  function mostrar(id) {
    PANTALLAS.forEach(p => { $(p).hidden = p !== id; });
  }

  function ponerError(form, mensaje, campo) {
    const error = form.querySelector('.error');
    error.textContent = mensaje;
    if (campo) {
      campo.setAttribute('aria-invalid', 'true');
      campo.focus();
    } else {
      error.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function quitarError(form) {
    const error = form.querySelector('.error');
    if (error) error.textContent = '';
    form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  }

  function leerLocal(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function guardarLocal(k, v) {
    try { localStorage.setItem(k, v); } catch (e) { /* navegación privada: no pasa nada */ }
  }
  function borrarLocal(k) {
    try { localStorage.removeItem(k); } catch (e) { /* nada */ }
  }

  iniciar();
})();
