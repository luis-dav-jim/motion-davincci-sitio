(() => {
  const raiz = document.documentElement;
  const mov = () => raiz.classList.contains('mov');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const SVG = 'http://www.w3.org/2000/svg';
  const icono = (d) => {
    const s = document.createElementNS(SVG, 'svg');
    s.setAttribute('class', 'ico'); s.setAttribute('viewBox', '0 0 16 16'); s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVG, 'path'); p.setAttribute('d', d); s.append(p);
    return s;
  };
  const alEnviar = (caja, fn) => {
    $('[data-envia]', caja).addEventListener('click', fn);
    $('input', caja).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); fn(); } });
  };
  const el = (etiqueta, clase, texto) => { const e = document.createElement(etiqueta); if (clase) e.className = clase; if (texto != null) e.textContent = texto; return e; };

  const visor = $('#visor');
  if (visor) {
    const NOTAS = {
      tiktok: 'Zonas de TikTok en Motion: 7 % arriba, 27 % abajo y la columna derecha.',
      reels: 'Zonas de Reels en Motion: 7 % arriba, 25 % abajo y la columna derecha.',
      shorts: 'Zonas de Shorts en Motion: 6 % arriba, 28 % abajo y la columna derecha.',
      youtube: '16:9 en Motion: el mismo video en horizontal, con un margen seguro del 5 %.',
    };
    const nota = $('[data-nota-red]', visor), boton = $('[data-zonas-boton]', visor);
    visor.addEventListener('elegido', (e) => { if (e.detail.nombre === 'red') nota.textContent = NOTAS[e.detail.valor]; });
    boton.addEventListener('click', () => {
      const si = visor.dataset.zonas !== 'si';
      visor.dataset.zonas = si ? 'si' : 'no';
      boton.setAttribute('aria-pressed', String(si));
    });
  }

  const escena = $('[data-cadena]');
  if (escena) {
    const etapas = $$('.etapas li', escena);
    const poner = (paso) => etapas.forEach((li, i) => { li.classList.toggle('hecha', i < paso - 1); li.classList.toggle('activa', i === paso - 1); });
    escena.addEventListener('paso', (e) => poner(e.detail.paso));
    poner(Number(escena.dataset.paso) || etapas.length);
  }

  const editor = $('[data-editor]');
  if (editor) {
    const DUR = 24;
    const PLANOS = [
      { nombre: 'título', sub: 'Hoy: pan con cuatro ingredientes.' },
      { nombre: 'mezclar', sub: 'Mezcla harina, agua y sal.' },
      { nombre: 'amasar', sub: 'Amasa diez minutos.' },
      { nombre: 'horno', sub: 'Al horno hasta que dore.' },
    ];
    const cuadro = $('[data-cuadro]', editor), capas = $$('.capa-plano', cuadro), sub = $('[data-subtitulo]', cuadro), marcas = $('[data-marcas]', cuadro);
    const form = $('[data-pedir]', editor), campo = $('input', form), contexto = $('[data-contexto]', form), ayuda = $('[data-ayuda]', form);
    const lista = $('[data-pedidos]', editor), sinPedidos = $('[data-sin-pedidos]', editor);
    const tiempo = $('[data-tiempo]', editor), carril = $('[data-carril]', editor), cabezal = $('[data-cabezal]', editor), ticks = $('[data-ticks]', editor);
    const reloj = $('[data-reloj]', editor), tocar = $('[data-reproducir]', editor);
    const AYUDA = ayuda.textContent;
    let t = 0, pendiente = null, pedidos = [], suena = false, cuadroRaf = 0;

    const fmt = (s) => `0:${String(Math.floor(s)).padStart(2, '0')}`;
    const planoDe = (s) => Math.min(PLANOS.length - 1, Math.floor(s / (DUR / PLANOS.length)));
    const donde = (m) => `${fmt(m.t)} · plano ${m.plano + 1} · ${PLANOS[m.plano].nombre}`;

    const pintar = () => {
      const p = planoDe(t);
      capas.forEach((c, i) => c.classList.toggle('activo', i === p));
      sub.textContent = PLANOS[p].sub;
      reloj.textContent = `${fmt(t)} / ${fmt(DUR)}`;
      cabezal.style.setProperty('--x', ((t / DUR) * carril.clientWidth).toFixed(1));
      tiempo.setAttribute('aria-valuenow', String(Math.floor(t)));
      tiempo.setAttribute('aria-valuetext', `${fmt(t)}, plano ${p + 1}`);
      contexto.textContent = donde(pendiente || { t, plano: p });
      marcas.replaceChildren();
      const visibles = [...pedidos, ...(pendiente ? [pendiente] : [])].filter((m) => m.plano === p);
      for (const m of visibles) {
        const i = el('i', m.n ? '' : 'pendiente', m.n ? String(m.n) : '');
        i.style.setProperty('left', `${m.x}%`);
        i.style.setProperty('top', `${m.y}%`);
        marcas.append(i);
      }
    };
    const pintarPedidos = () => {
      lista.replaceChildren();
      ticks.replaceChildren();
      for (const m of pedidos) {
        const li = el('li');
        li.append(el('span', 'dato', `${m.n} · ${donde(m)}`), el('span', 'cuerpo-s', m.texto));
        lista.append(li);
        const tick = el('i');
        tick.style.setProperty('left', `${(m.t / DUR) * 100}%`);
        ticks.append(tick);
      }
      sinPedidos.hidden = pedidos.length > 0;
    };
    const parar = () => { suena = false; editor.removeAttribute('data-suena'); tocar.setAttribute('aria-label', 'Reproducir'); cancelAnimationFrame(cuadroRaf); };
    const ir = (s, usuario) => {
      t = Math.max(0, Math.min(DUR, s));
      if (usuario && pendiente) { pendiente = null; ayuda.textContent = AYUDA; ayuda.classList.remove('falta'); }
      pintar();
    };
    const sonar = () => {
      if (t >= DUR) t = 0;
      suena = true; editor.setAttribute('data-suena', ''); tocar.setAttribute('aria-label', 'Pausar');
      let antes = performance.now();
      const paso = (ahora) => {
        if (!suena) return;
        ir(t + (ahora - antes) / 1000, false); antes = ahora;
        if (t >= DUR) return parar();
        cuadroRaf = requestAnimationFrame(paso);
      };
      cuadroRaf = requestAnimationFrame(paso);
    };

    tocar.addEventListener('click', () => (suena ? parar() : sonar()));

    cuadro.addEventListener('click', (e) => {
      parar();
      const r = cuadro.getBoundingClientRect();
      const conPuntero = e.detail > 0 && (e.clientX || e.clientY);
      const x = conPuntero ? ((e.clientX - r.left) / r.width) * 100 : 50;
      const y = conPuntero ? ((e.clientY - r.top) / r.height) * 100 : 45;
      pendiente = { t: Math.floor(t), plano: planoDe(t), x: Math.max(8, Math.min(92, x)), y: Math.max(6, Math.min(94, y)) };
      ayuda.textContent = `Marca en ${fmt(pendiente.t)}. Escribe el cambio y pídelo.`;
      ayuda.classList.remove('falta');
      pintar();
      campo.focus({ preventScroll: true });
    });

    alEnviar(form, () => {
      const texto = campo.value.trim().replace(/\s+/g, ' ').slice(0, 80);
      if (!texto) {
        campo.setAttribute('aria-invalid', 'true');
        ayuda.textContent = 'Escribe qué cambiarías.';
        ayuda.classList.add('falta');
        campo.focus();
        return;
      }
      campo.removeAttribute('aria-invalid');
      const m = pendiente || { t: Math.floor(t), plano: planoDe(t), x: 50, y: 45 };
      pendiente = null;
      if (pedidos.length >= 4) pedidos.shift();
      pedidos.push({ ...m, texto });
      pedidos.forEach((p, i) => { p.n = i + 1; });
      campo.value = '';
      ayuda.classList.remove('falta');
      ayuda.textContent = `Pedido. El orquestador lo recibe con el video, el segundo ${m.t} y el plano ${m.plano + 1}. Aquí es una demostración: no sale de la página.`;
      pintarPedidos();
      pintar();
    });
    campo.addEventListener('input', () => { if (campo.value.trim()) { campo.removeAttribute('aria-invalid'); ayuda.classList.remove('falta'); } });

    const aSegundo = (clientX) => { const r = carril.getBoundingClientRect(); return ((clientX - r.left) / r.width) * DUR; };
    let arrastra = false;
    tiempo.addEventListener('pointerdown', (e) => { if (e.button) return; arrastra = true; tiempo.setPointerCapture(e.pointerId); parar(); ir(aSegundo(e.clientX), true); });
    tiempo.addEventListener('pointermove', (e) => { if (arrastra) ir(aSegundo(e.clientX), true); });
    const soltar = () => { arrastra = false; };
    tiempo.addEventListener('pointerup', soltar);
    tiempo.addEventListener('pointercancel', soltar);
    tiempo.addEventListener('keydown', (e) => {
      const d = { ArrowLeft: -1, ArrowRight: 1, ArrowDown: -1, ArrowUp: 1, PageDown: -6, PageUp: 6 }[e.key];
      if (d) { e.preventDefault(); parar(); ir(Math.round(t) + d, true); }
      else if (e.key === 'Home') { e.preventDefault(); parar(); ir(0, true); }
      else if (e.key === 'End') { e.preventDefault(); parar(); ir(DUR, true); }
    });

    $('[data-limpiar]', editor).addEventListener('click', () => {
      parar(); pedidos = []; pendiente = null; campo.value = ''; campo.removeAttribute('aria-invalid');
      ayuda.textContent = AYUDA; ayuda.classList.remove('falta');
      pintarPedidos(); ir(0, false);
    });

    if ('ResizeObserver' in window) new ResizeObserver(pintar).observe(carril); else addEventListener('resize', pintar);
    pintarPedidos();
    ir(7, false);
  }

  const cal = $('[data-calendario]');
  if (cal) {
    const MAX = 2;
    const nota = $('[data-cal-nota]', cal), fichas = $$('.ficha', cal), dias = $$('.dia', cal);
    let elegida = null;
    const ocupados = (dia) => $$('.huecos i.lleno, .huecos i.nuevo', dia).length;
    const rotular = (dia) => dia.setAttribute('aria-label', `${dia.dataset.dia}: ${ocupados(dia)} de ${MAX}`);
    dias.forEach(rotular);
    fichas.forEach((f) => f.addEventListener('click', () => {
      elegida = elegida === f ? null : f;
      fichas.forEach((x) => x.setAttribute('aria-pressed', String(x === elegida)));
      nota.textContent = elegida ? `«${f.dataset.pieza}» elegida. Ahora toca un día.` : 'Elige una obra lista y después un día.';
    }));
    dias.forEach((dia) => dia.addEventListener('click', () => {
      const n = ocupados(dia), nombre = dia.dataset.dia;
      if (!elegida) { nota.textContent = `El ${nombre} tiene ${n} de ${MAX}. Elige primero una obra lista.`; return; }
      if (n >= MAX) { nota.textContent = `El ${nombre} ya tiene ${MAX}: tu regla dice máximo ${MAX} al día. Prueba otro.`; return; }
      $('.huecos i:not(.lleno):not(.nuevo)', dia).classList.add('nuevo');
      rotular(dia);
      nota.textContent = `«${elegida.dataset.pieza}» queda planeada para el ${nombre}. Publicarla sigue siendo un paso tuyo.`;
      elegida.disabled = true;
      elegida.setAttribute('aria-pressed', 'false');
      elegida.textContent = `${elegida.dataset.pieza} · ${nombre}`;
      elegida = null;
    }));
  }

  const fila = $('[data-fila]');
  if (fila) {
    const filas = $$('[data-trabajos] li', fila), nota = $('[data-fila-nota]', fila), avanzar = $('[data-avanzar]', fila);
    const pintar = () => {
      for (const li of filas) {
        const e = $('.t-estado', li);
        e.replaceChildren();
        const estado = li.dataset.estado;
        if (estado === 'lista') e.append(icono('M3 8.5l3.2 3.2L13 5'), 'lista');
        else if (estado === 'generando') e.append(el('span', 'gira'), 'generando');
        else if (estado === 'fila') e.append(el('span', 'punto hueco'), 'en fila');
        else {
          const b = el('button', 'btn fantasma m', 'Reintentar');
          b.type = 'button';
          b.addEventListener('click', () => {
            li.dataset.estado = filas.some((x) => x.dataset.estado === 'generando') ? 'fila' : 'generando';
            nota.textContent = `«${$('.t-nombre', li).textContent}» vuelve a la fila.`;
            pintar();
            avanzar.focus();
          });
          e.append(icono('M4 4l8 8M12 4l-8 8'), 'falló', b);
        }
      }
      avanzar.disabled = !filas.some((x) => x.dataset.estado === 'generando' || x.dataset.estado === 'fila');
    };
    avanzar.addEventListener('click', () => {
      const va = filas.find((x) => x.dataset.estado === 'generando');
      if (va) va.dataset.estado = 'lista';
      const sigue = filas.find((x) => x.dataset.estado === 'fila');
      if (sigue) sigue.dataset.estado = 'generando';
      const falla = filas.some((x) => x.dataset.estado === 'fallo');
      nota.textContent = sigue ? `Ahora se genera «${$('.t-nombre', sigue).textContent}».` : falla ? 'La fila terminó. Queda una toma que falló: puedes reintentarla.' : 'La fila quedó vacía: todas las tomas están listas.';
      pintar();
    });
    pintar();
  }
})();
