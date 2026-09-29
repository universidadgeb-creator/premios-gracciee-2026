/* Premios GRACCIEE 2026 · Lógica del formulario de nominaciones */
(function () {
  'use strict';

  const API = ((window.GRACCIEE_CONFIG || {}).API_URL || '').trim();
  const DEMO = !API;
  const PANTALLAS = ['cargando', 'error-carga', 'cerrado', 'formulario', 'gracias'];
  const $ = id => document.getElementById(id);

  // Datos de ejemplo para el modo de prueba (nombres inventados)
  const DATOS_DEMO = {
    ok: true,
    abierto: true,
    valores: ['Gratitud', 'Ritmo', 'Actitud', 'Ambición', 'Calidad', 'Creatividad', 'Integridad', 'Equipo', 'Empoderamiento'],
    unidades: [
      { nombre: 'Center', sucursales: [{ nombre: 'Corporativo', areas: [
        { nombre: 'Administración', personas: ['Laura Gómez Díaz', 'Ricardo Salas Vega'] }] }] },
      { nombre: 'EasyFit', sucursales: [
        { nombre: 'Sucursal Ejemplo', areas: [
          { nombre: 'Entrenamiento', personas: ['Diego Castro Luna', 'Paola Ríos Medina'] },
          { nombre: 'Ventas', personas: ['Mariana López Hernández', 'Óscar Núñez Prieto'] }] },
        { nombre: 'Sucursal Ejemplo 2', areas: [
          { nombre: 'Recepción', personas: ['Fernanda Aguilar Cruz'] }] }] },
      { nombre: 'GEB', sucursales: [{ nombre: 'Corporativo', areas: [
        { nombre: 'Capital Humano', personas: ['Jorge Ramírez Soto', 'Valeria Ortega Paz'] },
        { nombre: 'Finanzas', personas: ['Héctor Morales Gil'] }] }] },
      { nombre: 'Vivo 47', sucursales: [
        { nombre: 'NAC', areas: [
          { nombre: 'Acuática', personas: ['Andrés Beltrán Ruiz'] },
          { nombre: 'Recepción', personas: ['Ana Sofía Torres Ruiz', 'Luis Pérez Campos'] }] },
        { nombre: 'VR', areas: [
          { nombre: 'Entrenamiento', personas: ['Carlos Méndez Ortiz', 'Sofía Herrera León'] }] }] },
    ],
  };

  let catalogo = null;
  let indice = [];
  const sel = { unidad: null, sucursal: null, area: null, persona: null };
  const yaNominados = new Set();

  // ───────────── Arranque ─────────────
  function iniciar() {
    if (DEMO) $('aviso-demo').hidden = false;
    const guardado = leerLocal('gracciee_nominador');
    if (guardado) $('nominador').value = guardado;

    $('reintentar').addEventListener('click', cargar);
    $('formulario').addEventListener('submit', enviar);
    $('otra').addEventListener('click', otraNominacion);
    $('cambiar').addEventListener('click', cambiarPersona);
    $('buscar').addEventListener('input', alBuscar);
    $('sucursal').addEventListener('change', e => (e.target.value ? elegirSucursal(e.target.value) : limpiarDesde('sucursal')));
    $('area').addEventListener('change', e => (e.target.value ? elegirArea(e.target.value) : limpiarDesde('area')));
    $('persona').addEventListener('change', e => elegirPersona(e.target.value || null));
    $('motivo').addEventListener('input', () => { $('cuenta').textContent = $('motivo').value.length; });
    ['nominador', 'motivo'].forEach(id => $(id).addEventListener('input', () => quitarError(id)));

    cargar();
  }

  async function cargar() {
    mostrar('cargando');
    try {
      const datos = DEMO ? DATOS_DEMO : await pedir(API);
      if (!datos || !datos.ok) throw new Error((datos && datos.error) || 'Respuesta inválida del servidor.');
      catalogo = datos;
      if (!datos.abierto) return mostrar('cerrado');
      pintarValores();
      pintarUnidades();
      indexar();
      mostrar('formulario');
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

  // ───────────── Pintar opciones ─────────────
  function crearChip(nombreGrupo, valor, conLetra) {
    const label = document.createElement('label');
    label.className = 'chip' + (conLetra ? '' : ' chip--simple');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = nombreGrupo;
    input.value = valor;
    const caja = document.createElement('span');
    caja.className = 'chip__caja';
    if (conLetra) {
      const letra = document.createElement('span');
      letra.className = 'chip__letra';
      letra.textContent = valor.charAt(0);
      caja.appendChild(letra);
    }
    const texto = document.createElement('span');
    texto.textContent = valor;
    caja.appendChild(texto);
    label.append(input, caja);
    return label;
  }

  function pintarValores() {
    const cont = $('valores');
    cont.textContent = '';
    catalogo.valores.forEach(v => {
      const chip = crearChip('valor', v, true);
      chip.querySelector('input').addEventListener('change', () => quitarError('valor'));
      cont.appendChild(chip);
    });
    marcarYaNominados();
  }

  function pintarUnidades() {
    const cont = $('unidades');
    cont.textContent = '';
    catalogo.unidades.forEach(u => {
      const chip = crearChip('unidad', u.nombre, false);
      chip.querySelector('input').addEventListener('change', () => elegirUnidad(u.nombre));
      cont.appendChild(chip);
    });
  }

  function marcarYaNominados() {
    document.querySelectorAll('input[name="valor"]').forEach(input => {
      const caja = input.nextElementSibling;
      const previa = caja.querySelector('.chip__ya');
      if (previa) previa.remove();
      if (yaNominados.has(input.value)) {
        const ya = document.createElement('span');
        ya.className = 'chip__ya';
        ya.textContent = '✓ ya nominaste';
        caja.appendChild(ya);
      }
    });
  }

  // ───────────── Cascada Unidad → Sucursal → Área → Persona ─────────────
  const buscarPorNombre = (lista, nombre) => lista.find(x => x.nombre === nombre);

  /** Llena un nivel. Si hay una sola opción la muestra fija y la devuelve; si no, devuelve null. */
  function llenarNivel(id, opciones, textoVacio, siempreLista) {
    $('campo-' + id).hidden = false;
    const select = $(id);
    const fijo = $('fijo-' + id);
    if (opciones.length === 1 && !siempreLista) {
      select.hidden = true;
      fijo.hidden = false;
      fijo.textContent = opciones[0];
      return opciones[0];
    }
    select.hidden = false;
    if (fijo) fijo.hidden = true;
    select.textContent = '';
    select.add(new Option(textoVacio, ''));
    opciones.forEach(o => select.add(new Option(o, o)));
    return null;
  }

  function limpiarDesde(nivel) {
    const orden = ['unidad', 'sucursal', 'area', 'persona'];
    orden.slice(orden.indexOf(nivel)).forEach(n => { sel[n] = null; });
    orden.slice(orden.indexOf(nivel) + 1).forEach(n => { $('campo-' + n).hidden = true; });
    actualizarElegida();
  }

  function elegirUnidad(nombre) {
    limpiarDesde('unidad');
    sel.unidad = buscarPorNombre(catalogo.unidades, nombre);
    const unica = llenarNivel('sucursal', sel.unidad.sucursales.map(s => s.nombre), 'Elige la sucursal…');
    if (unica) elegirSucursal(unica);
  }

  function elegirSucursal(nombre) {
    limpiarDesde('sucursal');
    sel.sucursal = buscarPorNombre(sel.unidad.sucursales, nombre);
    const unica = llenarNivel('area', sel.sucursal.areas.map(a => a.nombre), 'Elige el área…');
    if (unica) elegirArea(unica);
  }

  function elegirArea(nombre) {
    limpiarDesde('area');
    sel.area = buscarPorNombre(sel.sucursal.areas, nombre);
    llenarNivel('persona', sel.area.personas, 'Elige a la persona…', true);
  }

  function elegirPersona(nombre) {
    sel.persona = nombre;
    if (nombre) quitarError('persona');
    actualizarElegida();
  }

  function actualizarElegida() {
    const hay = Boolean(sel.persona);
    $('elegida').hidden = !hay;
    $('selector').hidden = hay;
    if (hay) {
      $('elegida-nombre').textContent = sel.persona;
      $('elegida-ruta').textContent = [sel.unidad.nombre, sel.sucursal.nombre, sel.area.nombre].join(' · ');
    }
  }

  function cambiarPersona() {
    sel.persona = null;
    $('persona').value = '';
    actualizarElegida();
    $('persona').focus();
  }

  // ───────────── Búsqueda por nombre ─────────────
  const normalizar = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  function indexar() {
    indice = [];
    catalogo.unidades.forEach(u => u.sucursales.forEach(s => s.areas.forEach(a => a.personas.forEach(p => {
      indice.push({ persona: p, unidad: u.nombre, sucursal: s.nombre, area: a.nombre, clave: normalizar(p) });
    }))));
  }

  function alBuscar() {
    const lista = $('resultados');
    lista.textContent = '';
    const q = normalizar($('buscar').value);
    if (q.length < 2) return;
    const palabras = q.split(' ');
    const todos = indice.filter(x => palabras.every(w => x.clave.includes(w)));
    const hallados = todos.slice(0, 8);
    if (!hallados.length) {
      const li = document.createElement('li');
      li.className = 'sin-resultados';
      li.textContent = 'No encontramos ese nombre. Prueba con su apellido o elige unidad, sucursal y área.';
      lista.appendChild(li);
      return;
    }
    hallados.forEach(x => {
      const li = document.createElement('li');
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'resultado';
      boton.textContent = x.persona;
      const ruta = document.createElement('small');
      ruta.textContent = [x.unidad, x.sucursal, x.area].join(' · ');
      boton.appendChild(ruta);
      boton.addEventListener('click', () => elegirDesdeBusqueda(x));
      li.appendChild(boton);
      lista.appendChild(li);
    });
    if (todos.length > hallados.length) {
      const li = document.createElement('li');
      li.className = 'sin-resultados';
      li.textContent = 'Y ' + (todos.length - hallados.length) + ' más. Escribe también su apellido para encontrarla más rápido.';
      lista.appendChild(li);
    }
  }

  function elegirDesdeBusqueda(x) {
    const radio = Array.from(document.querySelectorAll('input[name="unidad"]')).find(r => r.value === x.unidad);
    radio.checked = true;
    elegirUnidad(x.unidad);
    if (!sel.sucursal) { $('sucursal').value = x.sucursal; elegirSucursal(x.sucursal); }
    if (!sel.area) { $('area').value = x.area; elegirArea(x.area); }
    $('persona').value = x.persona;
    $('buscar').value = '';
    $('resultados').textContent = '';
    elegirPersona(x.persona);
    $('cambiar').focus();
  }

  // ───────────── Envío ─────────────
  function valorElegido() {
    const r = document.querySelector('input[name="valor"]:checked');
    return r ? r.value : '';
  }

  function validar() {
    const errores = [];
    if (!$('nominador').value.trim()) errores.push(['nominador', 'Escribe tu nombre completo.']);
    if (!valorElegido()) errores.push(['valor', 'Elige el valor en el que nominas.']);
    if (!sel.persona) errores.push(['persona', 'Elige a la persona que nominas.']);
    if (!$('motivo').value.trim()) errores.push(['motivo', 'Cuéntanos qué hizo esta persona.']);
    errores.forEach(([id, msg]) => ponerError(id, msg));
    if (errores.length) {
      const primero = errores[0][0];
      const destino = primero === 'valor' ? document.querySelector('input[name="valor"]')
        : primero === 'persona' ? (sel.area ? $('persona') : sel.sucursal ? $('area') : sel.unidad ? $('sucursal')
          : document.querySelector('input[name="unidad"]'))
        : $(primero);
      destino.closest('fieldset').scrollIntoView({ behavior: 'smooth', block: 'start' });
      destino.focus({ preventScroll: true });
    }
    return !errores.length;
  }

  async function enviar(e) {
    e.preventDefault();
    $('error-envio').textContent = '';
    if (!validar()) return;

    const datos = {
      nominador: $('nominador').value.trim(),
      valor: valorElegido(),
      unidad: sel.unidad.nombre,
      sucursal: sel.sucursal.nombre,
      area: sel.area.nombre,
      nominado: sel.persona,
      motivo: $('motivo').value.trim(),
      sitio_web: $('sitio_web').value,
    };
    const boton = $('enviar');
    boton.disabled = true;
    boton.textContent = 'Enviando…';
    try {
      if (DEMO) {
        await new Promise(r => setTimeout(r, 700));
      } else {
        // Texto plano para que el navegador no pida permiso previo (CORS) a Apps Script
        const r = await pedir(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(datos) });
        if (!r.ok) throw new Error(r.error || 'No se pudo guardar la nominación.');
      }
      guardarLocal('gracciee_nominador', datos.nominador);
      yaNominados.add(datos.valor);
      mostrarGracias(datos);
    } catch (err) {
      $('error-envio').textContent = err instanceof TypeError
        ? 'No pudimos enviar tu nominación. Revisa tu conexión e inténtalo de nuevo.'
        : err.message;
    } finally {
      boton.disabled = false;
      boton.textContent = 'Enviar nominación';
    }
  }

  function mostrarGracias(datos) {
    const resumen = $('resumen');
    resumen.textContent = '';
    const nombre = document.createElement('strong');
    nombre.textContent = datos.nominado;
    const valor = document.createElement('strong');
    valor.textContent = datos.valor;
    resumen.append('Nominaste a ', nombre, ' en ', valor, '. ¿Quieres reconocer a alguien más o nominar en otro valor?');
    mostrar('gracias');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    $('gracias').focus({ preventScroll: true });
  }

  function otraNominacion() {
    document.querySelectorAll('input[name="valor"], input[name="unidad"]').forEach(r => { r.checked = false; });
    limpiarDesde('unidad');
    $('motivo').value = '';
    $('cuenta').textContent = '0';
    $('buscar').value = '';
    $('resultados').textContent = '';
    marcarYaNominados();
    mostrar('formulario');
    $('valores').closest('fieldset').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ───────────── Apoyo ─────────────
  function mostrar(id) {
    PANTALLAS.forEach(p => { $(p).hidden = p !== id; });
  }

  function ponerError(id, mensaje) {
    $('error-' + id).textContent = mensaje;
    const campo = $(id);
    if (campo && campo.tagName !== 'DIV') campo.setAttribute('aria-invalid', 'true');
  }

  function quitarError(id) {
    $('error-' + id).textContent = '';
    const campo = $(id);
    if (campo) campo.removeAttribute('aria-invalid');
  }

  function leerLocal(clave) {
    try { return localStorage.getItem(clave); } catch (e) { return null; }
  }

  function guardarLocal(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch (e) { /* navegación privada: no pasa nada */ }
  }

  iniciar();
})();
