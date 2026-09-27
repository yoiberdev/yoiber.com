import { animate, stagger, utils, type JSAnimation } from 'animejs';
import '../styles/kit-casos.css';

// EL KIT DE LOS CASOS — lo que hace que una página de caso se lea tocando y no solo bajando
// ================================================================================================
// 27/09/2026, Yoiber: «hacerlos más interactivos y no tan monótonos». Cada caso era título, párrafo,
// captura y párrafo. Este módulo busca en el marcado cinco piezas y les da vida; sin JavaScript,
// cada una se queda como lo que es en HTML (una lista, una imagen con su pie), así que el texto se
// lee igual y Google indexa lo mismo:
//
//   · APARECER al entrar en pantalla, escalonado por grupos (una sola vez, sin atarse al scroll);
//   · CIFRAS (`[data-hasta]`) que cuentan desde cero cuando se ven;
//   · RECORRIDOS (`[data-recorrido]`): una lista ordenada que pasa a ser pestañas con una línea de
//     avance; avanza sola mientras se ve, hasta que alguien toca;
//   · CAPTURAS ANOTADAS (`[data-anotada]`): la lista de notas pinta sus puntos sobre la imagen, y al
//     señalar una nota (o su punto) la cámara se acerca a esa zona, como las guías del ERP. Con la
//     captura a la vista hace una pasada sola por todas las notas;
//   · SIMULACIONES (`[data-sim]`): la escena de src/sim/ en modo guía, que anda mientras se ve.
//
// Con movimiento reducido no hay acercamientos, ni pasadas solas, ni apariciones: todo quieto y
// completo, y las notas se siguen resaltando al señalarlas.

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Llama a `fn` la primera vez que `el` se ve (y `alSalir` cada vez que deja de verse). */
function alVer(el: Element, fn: () => void, umbral = 0.35, alSalir?: () => void): () => void {
  let visto = false;
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) {
      if (!visto || alSalir) fn();
      visto = true;
    } else if (visto) {
      alSalir?.();
    }
    if (visto && !alSalir) io.disconnect();
  }, { threshold: umbral });
  io.observe(el);
  return () => io.disconnect();
}

// ------------------------------------------------------------------------------------------------
// Aparecer. Grupos: los hijos de estas cajas entran escalonados; lo demás, pieza a pieza.
const SUELTAS = '.escena > h2, .escena > p, .escena > .figura, .escena > .pila-tec, .escena > .lienzo, .escena > .guia-sim, .anotada, .recorrido, .cierre, .escena > details';
const GRUPOS = '.cifras, .balance, .lecciones, .fichas';

function montarAparecer(): void {
  if (reduce) return;
  const piezas = Array.from(document.querySelectorAll<HTMLElement>(SUELTAS));
  const grupos = Array.from(document.querySelectorAll<HTMLElement>(GRUPOS));
  const pantalla = window.innerHeight;
  // Lo que ya está a la vista al cargar no se esconde: aparecería tarde y parpadearía.
  const debajo = (el: HTMLElement): boolean => el.getBoundingClientRect().top > pantalla * 0.92;
  for (const el of piezas.filter(debajo)) {
    utils.set(el, { opacity: 0, y: 26 });
    alVer(el, () => animate(el, { opacity: [0, 1], y: [26, 0], duration: 700, ease: 'out(3)' }), 0.15);
  }
  for (const g of grupos.filter(debajo)) {
    const hijos = Array.from(g.children) as HTMLElement[];
    utils.set(hijos, { opacity: 0, y: 30 });
    alVer(g, () => animate(hijos, { opacity: [0, 1], y: [30, 0], duration: 650, ease: 'out(3)', delay: stagger(90) }), 0.2);
  }
}

// ------------------------------------------------------------------------------------------------
// Cifras: el marcado trae el valor final (sin JS se lee); aquí se cuenta desde cero al verse.
function montarCifras(): void {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-hasta]'))) {
    const hasta = Number(el.dataset.hasta);
    if (!Number.isFinite(hasta) || reduce) continue;
    el.style.minWidth = `${String(hasta).length}ch`;
    const cuenta = { v: 0 };
    el.textContent = '0';
    alVer(el, () => animate(cuenta, {
      v: [0, hasta], duration: 1100 + hasta * 12, ease: 'out(3)', modifier: utils.round(0),
      onUpdate: () => { el.textContent = String(cuenta.v); },
    }), 0.6);
  }
}

// ------------------------------------------------------------------------------------------------
// Recorridos: lista ordenada → pestañas (patrón de la APG: flechas, Inicio y Fin).
function montarRecorrido(raiz: HTMLElement, n: number): void {
  const lista = raiz.querySelector<HTMLOListElement>(':scope > ol');
  if (!lista) return;
  const pasos = Array.from(lista.children) as HTMLLIElement[];
  if (pasos.length < 2) return;
  raiz.classList.add('recorrido-vivo');
  const pestanas = document.createElement('div');
  pestanas.className = 'recorrido-pestanas';
  pestanas.setAttribute('role', 'tablist');
  if (raiz.getAttribute('aria-label')) pestanas.setAttribute('aria-label', raiz.getAttribute('aria-label')!);
  const linea = document.createElement('span');
  linea.className = 'recorrido-linea';
  linea.innerHTML = '<i></i>';
  pestanas.append(linea);
  const botones = pasos.map((li, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = `rec${n}-p${i}`;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', `rec${n}-c${i}`);
    b.innerHTML = `<span class="n">${i + 1}</span><span class="t"></span><span class="avance"><i></i></span>`;
    b.querySelector('.t')!.textContent = li.dataset.titulo ?? li.querySelector('h3')?.textContent ?? `Paso ${i + 1}`;
    li.id = `rec${n}-c${i}`;
    li.setAttribute('role', 'tabpanel');
    li.setAttribute('aria-labelledby', b.id);
    li.tabIndex = 0;
    pestanas.append(b);
    return b;
  });
  raiz.insertBefore(pestanas, lista);
  const lleno = linea.querySelector('i')!;
  let actual = -1;
  let tocado = reduce;
  let espera = 0;
  // En un objeto: TypeScript no ve las asignaciones que se hacen dentro de los cierres.
  const tira: { anim: JSAnimation | null } = { anim: null };
  const DWELL = 6000;
  const ir = (i: number, foco = false): void => {
    if (i === actual) return;
    actual = i;
    botones.forEach((b, k) => {
      const si = k === i;
      b.setAttribute('aria-selected', String(si));
      b.tabIndex = si ? 0 : -1;
      b.classList.toggle('hecho', k < i);
      pasos[k].hidden = !si;
    });
    if (foco) botones[i].focus();
    const hacia = botones.length > 1 ? i / (botones.length - 1) : 1;
    if (reduce) lleno.style.transform = `scaleX(${hacia})`;
    else animate(lleno, { scaleX: hacia, duration: 500, ease: 'inOut(3)' });
    if (!reduce) animate(pasos[i], { opacity: [0, 1], y: [12, 0], duration: 420, ease: 'out(3)' });
    programar();
  };
  const programar = (): void => {
    window.clearTimeout(espera);
    tira.anim?.pause();
    botones.forEach((b) => { (b.querySelector('.avance i') as HTMLElement).style.transform = 'scaleX(0)'; });
    if (tocado) return;
    const barraEl = botones[actual].querySelector('.avance i') as HTMLElement;
    tira.anim = animate(barraEl, { scaleX: [0, 1], duration: DWELL, ease: 'linear' });
    espera = window.setTimeout(() => ir((actual + 1) % botones.length), DWELL);
  };
  const parar = (): void => {
    tocado = true;
    window.clearTimeout(espera);
    tira.anim?.pause();
    botones.forEach((b) => { (b.querySelector('.avance i') as HTMLElement).style.transform = 'scaleX(0)'; });
  };
  botones.forEach((b, i) => {
    b.addEventListener('click', () => { parar(); ir(i); });
    b.addEventListener('keydown', (e) => {
      const mapa: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: botones.length - 1 };
      if (!(e.key in mapa)) return;
      e.preventDefault();
      parar();
      ir((mapa[e.key] + botones.length) % botones.length, true);
    });
  });
  raiz.addEventListener('pointerdown', parar, { once: true });
  ir(0);
  window.clearTimeout(espera);
  tira.anim?.pause();
  // Solo avanza sola mientras se ve.
  alVer(raiz, () => { if (!tocado) programar(); }, 0.4, () => { window.clearTimeout(espera); tira.anim?.pause(); });
}

// ------------------------------------------------------------------------------------------------
// Capturas anotadas.
function montarAnotada(fig: HTMLElement): void {
  const marco = fig.querySelector<HTMLElement>('.anotada-marco');
  const lienzo = fig.querySelector<HTMLElement>('.anotada-lienzo');
  const notas = Array.from(fig.querySelectorAll<HTMLLIElement>('.anotada-notas > li'));
  if (!marco || !lienzo || !notas.length) return;
  fig.classList.add('anotada-viva');
  utils.set(lienzo, { x: '0%', y: '0%', scale: 1 });
  const puntos = notas.map((li, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'anotada-punto';
    b.style.left = `${li.dataset.x}%`;
    b.style.top = `${li.dataset.y}%`;
    b.textContent = String(i + 1);
    b.setAttribute('aria-label', `Nota ${i + 1}: ${li.textContent?.trim() ?? ''}`);
    lienzo.append(b);
    li.tabIndex = 0;
    return b;
  });
  let activa = -1;
  let cam: { x: number; y: number; s: number } = { x: 0, y: 0, s: 1 };
  const encuadrar = (i: number): void => {
    let destino = { x: 0, y: 0, s: 1 };
    if (i >= 0 && !reduce) {
      const s = Number(notas[i].dataset.zoom ?? 1.9);
      const px = Number(notas[i].dataset.x) / 100;
      const py = Number(notas[i].dataset.y) / 100;
      destino = {
        s,
        x: Math.min(0, Math.max(1 - s, 0.5 - px * s)) * 100,
        y: Math.min(0, Math.max(1 - s, 0.5 - py * s)) * 100,
      };
    }
    if (destino.s === cam.s && destino.x === cam.x && destino.y === cam.y) return;
    animate(lienzo, { x: [`${cam.x}%`, `${destino.x}%`], y: [`${cam.y}%`, `${destino.y}%`], scale: [cam.s, destino.s], duration: 750, ease: 'inOut(3)' });
    // Los puntos viven dentro del lienzo y crecerían con él: se compensan para que midan siempre lo mismo.
    animate(puntos, { scale: [1 / cam.s, 1 / destino.s], duration: 750, ease: 'inOut(3)' });
    cam = destino;
  };
  const activar = (i: number): void => {
    activa = i;
    notas.forEach((li, k) => li.classList.toggle('activa', k === i));
    puntos.forEach((p, k) => p.classList.toggle('activa', k === i));
    fig.classList.toggle('con-activa', i >= 0);
    encuadrar(i);
  };
  // La pasada sola: una vez, con la captura a la vista y nadie tocando.
  let tocado = reduce;
  let paso = 0;
  const siguiente = (): void => {
    if (tocado) return;
    if (paso >= notas.length) { activar(-1); return; }
    activar(paso++);
    espera = window.setTimeout(siguiente, 3400);
  };
  let espera = 0;
  const tomar = (): void => { tocado = true; window.clearTimeout(espera); };
  const soltar = (): void => { window.clearTimeout(espera); espera = window.setTimeout(() => { if (!fig.matches(':hover, :focus-within')) activar(-1); }, 700); };
  notas.forEach((li, i) => {
    li.addEventListener('pointerenter', () => { tomar(); window.clearTimeout(espera); activar(i); });
    li.addEventListener('focus', () => { tomar(); window.clearTimeout(espera); activar(i); });
    li.addEventListener('click', () => { tomar(); activar(i); });
  });
  puntos.forEach((p, i) => {
    p.addEventListener('pointerenter', () => { tomar(); window.clearTimeout(espera); activar(i); });
    p.addEventListener('focus', () => { tomar(); window.clearTimeout(espera); activar(i); });
    p.addEventListener('click', () => { tomar(); activar(activa === i ? -1 : i); });
  });
  fig.addEventListener('pointerleave', () => { if (tocado) soltar(); });
  fig.addEventListener('focusout', (e) => { if (tocado && !fig.contains(e.relatedTarget as Node)) soltar(); });
  if (!reduce) alVer(marco, () => { if (!tocado && paso === 0) espera = window.setTimeout(siguiente, 900); }, 0.6);
}

// ------------------------------------------------------------------------------------------------
// Simulaciones en modo guía.
type MontarSim = (raiz: HTMLElement, o: { reduce: boolean; guia?: HTMLElement }) => { reproducir(): void; pausar(): void; reiniciar(): void };
const SIMS: Record<string, () => Promise<MontarSim>> = {
  kuantera: () => import('../sim/kuantera').then((m) => m.montarKuantera),
  camaras: () => import('../sim/camaras').then((m) => m.montarCamaras),
  comandas: () => import('../sim/comandas').then((m) => m.montarComandas),
  automatizaciones: () => import('../sim/automatizaciones').then((m) => m.montarAutomatizaciones),
};

function montarSim(marco: HTMLElement): void {
  const cargar = SIMS[marco.dataset.sim ?? ''];
  if (!cargar) return;
  // Se pide cuando el marco está cerca, no al cargar la página.
  alVer(marco, () => {
    cargar().then((montar) => {
      const capa = document.createElement('div');
      marco.append(capa);
      const sim = montar(capa, { reduce, guia: marco });
      let primera = true;
      alVer(marco, () => {
        if (primera) { primera = false; sim.reiniciar(); }
        sim.reproducir();
      }, 0.33, () => sim.pausar());
    }).catch(() => undefined);
  }, 0.01);
}

export function montarKit(): void {
  document.documentElement.classList.add('kit');
  montarAparecer();
  montarCifras();
  Array.from(document.querySelectorAll<HTMLElement>('[data-recorrido]')).forEach(montarRecorrido);
  Array.from(document.querySelectorAll<HTMLElement>('[data-anotada]')).forEach(montarAnotada);
  Array.from(document.querySelectorAll<HTMLElement>('[data-sim]')).forEach(montarSim);
}
