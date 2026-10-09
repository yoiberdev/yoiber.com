// EL AJOLOTE DE LA PÁGINA (10/10/2026)
// ================================================================================================
// Mi mascota de ajolote.yoiber.dev, aquí en pixel art: aparece cuando la página deja atrás el logo,
// nada abajo, sigue al puntero con calma y, si nadie lo mueve, pasea solo. Mientras alguien hace
// scroll se sumerge (para no tapar lo que se lee) y vuelve a salir cuando se detiene. Si le haces clic da una
// voltereta y cambia de color; el azul sale una vez de cada doce, como en el juego.
//
// EL SECRETO: cinco clics seguidos al ajolote, o escribir «ajolote» en cualquier parte de la página,
// y cruza un cardumen entero (con uno azul, si hay suerte). La pista está en la última tarjeta del
// muro. Con movimiento reducido no nada ni hay cardumen: se queda quieto y cambia de color igual.

// El dibujo, 20 × 9: B cuerpo, C cola, G branquias, P patas, O ojo, M boca.
const MAPA = [
  '............G..G....',
  '...........GG.GG....',
  '........BBBBBBBB....',
  'C.....BBBBBBBBBBB...',
  'CC..BBBBBBBBBBOBBB..',
  'CCCBBBBBBBBBBBBBBBM.',
  'CC..BBBBBBBBBBBBBB..',
  'C.....PP...PP..GG...',
  '......P....P...G.G..',
];
const CLASE: Record<string, string> = { B: 'aj-cuerpo', C: 'aj-cola', G: 'aj-branquias', P: 'aj-patas', O: 'aj-ojo', M: 'aj-boca' };

// Los colores del juego: rosado, silvestre, dorado y cian; el azul es el raro.
const COLORES = ['rosado', 'silvestre', 'dorado', 'cian'] as const;
type Color = (typeof COLORES)[number] | 'azul';

function dibujo(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 20 9');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const grupos: Record<string, SVGGElement> = {};
  MAPA.forEach((fila, y) => {
    [...fila].forEach((c, x) => {
      const clase = CLASE[c];
      if (!clase) return;
      const g = (grupos[clase] ??= svg.appendChild(document.createElementNS(ns, 'g')));
      g.setAttribute('class', clase);
      const r = document.createElementNS(ns, 'rect');
      r.setAttribute('x', String(x));
      r.setAttribute('y', String(y));
      r.setAttribute('width', '1.02');
      r.setAttribute('height', '1.02');
      g.append(r);
    });
  });
  return svg;
}

function otroColor(actual: Color): Color {
  if (Math.random() < 1 / 12) return 'azul';
  const opciones = COLORES.filter((c) => c !== actual);
  return opciones[Math.floor(Math.random() * opciones.length)] ?? 'rosado';
}

export function montarAjolote(reduce: boolean): () => void {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'ajolote fuera';
  boton.dataset.color = 'rosado';
  boton.setAttribute('aria-label', 'El ajolote de la página. Tócalo.');
  const cuerpo = document.createElement('span');
  cuerpo.className = 'ajolote-cuerpo';
  cuerpo.append(dibujo());
  boton.append(cuerpo);
  document.body.append(boton);

  // ——— Cuándo se ve: con los proyectos, el cierre o el pie en pantalla; nunca sobre el logo ———
  const vistos = new Set<Element>();
  const vigia = new IntersectionObserver((entradas) => {
    for (const e of entradas) (e.isIntersecting ? vistos.add(e.target) : vistos.delete(e.target));
    boton.classList.toggle('fuera', vistos.size === 0);
  });
  for (const s of document.querySelectorAll('#proyectos, #hablemos, #pie')) vigia.observe(s);

  // ——— Nadar ———
  const ancho = (): number => boton.offsetWidth || 64;
  let x = Math.max(24, window.innerWidth * 0.12);
  let objetivo = x;
  let mira = 1;
  let ultimoPuntero = 0;
  let proximoPaseo = 0;
  let cuadro = 0;
  const alPuntero = (ev: PointerEvent): void => {
    if (ev.pointerType !== 'mouse') return;
    objetivo = ev.clientX - ancho() / 2;
    ultimoPuntero = performance.now();
  };
  const nadar = (ahora: number): void => {
    cuadro = requestAnimationFrame(nadar);
    if (boton.classList.contains('fuera') || document.hidden) return;
    const max = window.innerWidth - ancho() - 16;
    if (ahora - ultimoPuntero > 4000 && ahora > proximoPaseo) {
      objetivo = 16 + Math.random() * Math.max(0, max - 16);
      proximoPaseo = ahora + 5000 + Math.random() * 5000;
    }
    objetivo = Math.min(Math.max(objetivo, 16), max);
    const dx = objetivo - x;
    x += Math.max(-3.2, Math.min(3.2, dx * 0.03));
    if (Math.abs(dx) > 3) mira = dx > 0 ? 1 : -1;
    const sube = Math.sin(ahora / 620) * 4;
    boton.style.transform = `translate(${x.toFixed(1)}px, ${sube.toFixed(1)}px)`;
    cuerpo.style.setProperty('--mira', String(mira));
  };
  // Se sumerge mientras hay scroll y sale un rato después de que para.
  let quieto = 0;
  const alScroll = (): void => {
    boton.classList.add('hundido');
    window.clearTimeout(quieto);
    quieto = window.setTimeout(() => boton.classList.remove('hundido'), 1100);
  };
  window.addEventListener('scroll', alScroll, { passive: true });

  if (reduce) {
    boton.style.transform = 'translate(24px, 0)';
  } else {
    window.addEventListener('pointermove', alPuntero, { passive: true });
    cuadro = requestAnimationFrame(nadar);
  }

  // ——— El cardumen (el secreto) ———
  let cardumen: HTMLElement | null = null;
  let finCardumen = 0;
  const soltarCardumen = (): void => {
    if (cardumen || reduce) return;
    cardumen = document.createElement('div');
    cardumen.className = 'cardumen';
    cardumen.setAttribute('aria-hidden', 'true');
    const azul = Math.floor(Math.random() * 12);
    for (let i = 0; i < 12; i++) {
      const pez = document.createElement('span');
      pez.className = 'cardumen-pez';
      pez.dataset.color = i === azul && Math.random() < 0.5 ? 'azul' : COLORES[i % COLORES.length];
      pez.style.setProperty('--alto', `${8 + Math.random() * 74}%`);
      pez.style.setProperty('--dura', `${6 + Math.random() * 5}s`);
      pez.style.setProperty('--espera', `${Math.random() * 2.4}s`);
      pez.style.setProperty('--tam', String(0.6 + Math.random() * 0.8));
      pez.append(dibujo());
      cardumen.append(pez);
    }
    const aviso = document.createElement('p');
    aviso.className = 'cardumen-aviso';
    aviso.setAttribute('role', 'status');
    aviso.textContent = 'Encontraste el cardumen.';
    document.body.append(cardumen, aviso);
    finCardumen = window.setTimeout(() => {
      cardumen?.remove();
      aviso.remove();
      cardumen = null;
    }, 14000);
  };

  // ——— Tocarlo: voltereta, color nuevo y, a los cinco seguidos, el cardumen ———
  let toques: number[] = [];
  const alClic = (): void => {
    boton.dataset.color = otroColor(boton.dataset.color as Color);
    if (!reduce) {
      boton.classList.remove('gira');
      void boton.offsetWidth;
      boton.classList.add('gira');
    }
    const ahora = performance.now();
    toques = [...toques.filter((t) => ahora - t < 2500), ahora];
    if (toques.length >= 5) {
      toques = [];
      soltarCardumen();
    }
  };
  boton.addEventListener('click', alClic);

  // Escribir «ajolote» en cualquier parte (fuera de un campo de texto).
  let tecleado = '';
  const alTecla = (ev: KeyboardEvent): void => {
    const t = ev.target;
    if ((t instanceof Element && t.closest('input, textarea, select, [contenteditable]')) || ev.key.length !== 1) return;
    tecleado = (tecleado + ev.key.toLowerCase()).slice(-7);
    if (tecleado === 'ajolote') soltarCardumen();
  };
  window.addEventListener('keydown', alTecla);

  return () => {
    cancelAnimationFrame(cuadro);
    window.clearTimeout(finCardumen);
    vigia.disconnect();
    window.removeEventListener('pointermove', alPuntero);
    window.removeEventListener('scroll', alScroll);
    window.clearTimeout(quieto);
    window.removeEventListener('keydown', alTecla);
    boton.removeEventListener('click', alClic);
    boton.remove();
    cardumen?.remove();
  };
}
