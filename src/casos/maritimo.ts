import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import '../styles/caso.css';
import { animate, createDrawable, createMotionPath, createTimeline, stagger, utils, type JSAnimation } from 'animejs';

// EL RECORRIDO DE LA SEÑAL (caso marítimo)
// ================================================================================================
// El diagrama de /root/trabajos/dss-diagrama traído al sitio: mismo relato y mismos tiempos, pero
// con la copia de Anime.js que ya usa la página (una dependencia, un solo paquete con hash) y con
// los colores de la casa (styles/caso.css). La escena se construye de izquierda a derecha, los
// paquetes circulan en bucles propios y cada pocos segundos el enlace se CAE: el trazo del SRT se
// recorta, se pone rojo y se recompone. Ese es el problema del proyecto y por eso está animado.
//
// TRAMPA de la v4 que ya mordió aquí: `draw` solo lo entiende el proxy que devuelve
// `createDrawable()`. Sobre un selector crudo la animación se crea, no avisa por consola y no hace
// nada (doc 6.4 de /opt/docs/ANIMEJS-RECETAS.md).
//
// SIN JAVASCRIPT el SVG se ve entero y quieto: el estado inicial (todo apagado) lo escribe este
// módulo, y la hoja solo lo esconde mientras se espera (`#diagrama:not(.listo)`), con un rescate a
// los 5 s por si este trozo no llegara a cargar.

const svg = document.querySelector<SVGSVGElement>('#diagrama');
const pasosLi = Array.from(document.querySelectorAll<HTMLElement>('.pasos li'));
const btn = document.querySelector<HTMLButtonElement>('#btn-play');
const contPuntos = document.querySelector<HTMLElement>('#puntos');

if (svg && pasosLi.length && btn && contPuntos) {
  const TOTAL = pasosLi.length;
  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Estado inicial: todo apagado antes del primer fotograma.
  utils.set(createDrawable('.linea'), { draw: '0 0' });
  utils.set('.nodo rect', { opacity: 0, scale: 0.92 });
  utils.set('.nodo text', { opacity: 0 });
  utils.set('.proto', { opacity: 0, scale: 0.8 });
  utils.set('.pk', { opacity: 0 });
  utils.set('.zona', { opacity: 0 });
  utils.set('.zona-tit', { opacity: 0 });
  utils.set(pasosLi, { opacity: 0, y: 14 });
  // `fill-box` para que scale y rotate en SVG giren sobre el propio elemento y no sobre el lienzo.
  utils.set('.nodo rect, .proto', { transformBox: 'fill-box', transformOrigin: 'center' });
  svg.classList.add('listo');

  const nodosDePaso = (n: number): Element[] => Array.from(svg.querySelectorAll(`.nodo[data-paso="${n}"]`));
  const protosDePaso = (n: number): Element[] => Array.from(svg.querySelectorAll(`.proto[data-paso="${n}"]`));

  const marcarActivos = (n: number): void => {
    svg.querySelectorAll('.nodo').forEach((g) => g.classList.remove('activo'));
    nodosDePaso(n).forEach((g) => g.classList.add('activo'));
  };

  const montaje = createTimeline({ defaults: { ease: 'outQuad', duration: 600 }, autoplay: false });

  /** Aparece un nodo: primero la caja, luego sus textos. */
  const entraNodo = (sel: string, desfase: number): void => {
    montaje
      .add(`${sel} rect`, { opacity: [0, 1], scale: [0.92, 1], duration: 520, ease: 'outBack' }, desfase)
      .add(`${sel} text`, { opacity: [0, 1], duration: 380, ease: 'outQuad', delay: stagger(70) }, desfase + 160);
  };
  /** Dibuja un trazado de la nada al trazo completo. */
  const dibuja = (id: string, desfase: number, dur = 620): void => {
    montaje.add(createDrawable(id), { draw: ['0 0', '0 1'], duration: dur, ease: 'inOutQuad' }, desfase);
  };

  montaje
    .add('.zona', { opacity: [0, 1], duration: 700, delay: stagger(120) }, 0)
    .add('.zona-tit', { opacity: [0, 1], duration: 500, delay: stagger(120) }, 200);

  entraNodo('#n-camara', 500);
  dibuja('#t-rtsp', 900, 420);
  montaje.add(protosDePaso(1), { opacity: [0, 1], scale: [0.8, 1], duration: 380, ease: 'outBack', delay: stagger(110) }, 1050);

  entraNodo('#n-agente', 1250);
  dibuja('#t-sqlite', 1650, 380);
  entraNodo('#n-sqlite', 1800);

  dibuja('#t-srt', 2050, 560);
  montaje.add('#p-srt', { opacity: [0, 1], scale: [0.8, 1], duration: 380, ease: 'outBack' }, 2300);
  entraNodo('#n-enlace', 2350);
  dibuja('#t-srt2', 2700, 520);

  entraNodo('#n-slate', 2950);
  dibuja('#t-hls', 3350, 420);
  montaje.add('#p-hls', { opacity: [0, 1], scale: [0.8, 1], duration: 380, ease: 'outBack' }, 3500);

  dibuja('#t-mqtt', 3550, 800);
  montaje.add('#p-mqtt', { opacity: [0, 1], scale: [0.8, 1], duration: 380, ease: 'outBack' }, 3900);
  entraNodo('#n-mqtt', 3950);
  dibuja('#t-api', 4250, 400);
  entraNodo('#n-api', 4400);
  dibuja('#t-pg', 4700, 360);
  entraNodo('#n-pg', 4820);
  dibuja('#t-web', 5000, 420);
  entraNodo('#n-web', 5150);

  // Los paquetes: cada uno recorre su trazado en un bucle propio, ajeno al relato.
  const viajes: JSAnimation[] = [];
  const lanzaPaquete = (sel: string, trazado: string, duracion: number, retardo = 0): void => {
    if (reducido) return;
    utils.set(sel, { opacity: 1 });
    viajes.push(animate(sel, { ...createMotionPath(trazado), duration: duracion, delay: retardo, ease: 'linear', loop: true }));
  };

  // EL ENLACE QUE SE CAE: el trazo del SRT se recorta por delante, se pone rojo y se recompone.
  const simulaPerdida = (): void => {
    if (reducido) return;
    const trazo = createDrawable('#t-srt');
    createTimeline({ loop: true, defaults: { ease: 'inOutQuad' } })
      .add(trazo, { draw: ['0 1', '0 0.45'], duration: 300 }, 1400)
      .add(trazo, { draw: ['0 0.45', '0 1'], duration: 900, ease: 'outExpo' }, 1900)
      .add('#t-srt', { stroke: ['#22d3ee', '#ff6b6b'], duration: 300 }, 1400)
      .add('#t-srt', { stroke: ['#ff6b6b', '#22d3ee'], duration: 800 }, 1900)
      .add('#n-enlace rect', { stroke: ['#2b6b8f', '#ff6b6b', '#2b6b8f'], duration: 1400 }, 1400);
  };

  // El relato: un capítulo cada vez, con sus rayitas de navegación.
  let pasoActual = 0;
  const muestraPaso = (n: number, inmediato = false): void => {
    pasoActual = n;
    marcarActivos(n + 1);
    pasosLi.forEach((li, i) => {
      if (i === n) animate(li, { opacity: [0, 1], y: [14, 0], duration: inmediato ? 0 : 520, ease: 'outQuad' });
      else utils.set(li, { opacity: 0, y: 14 });
    });
    Array.from(document.querySelectorAll('.punto')).forEach((b, i) => b.setAttribute('aria-selected', String(i === n)));
  };

  let temporizador: number | null = null;
  const detenerAvance = (): void => {
    if (temporizador) { window.clearInterval(temporizador); temporizador = null; }
    btn.textContent = 'Reanudar';
  };
  const avanceAutomatico = (): void => {
    temporizador = window.setInterval(() => muestraPaso((pasoActual + 1) % TOTAL), 7000);
  };

  pasosLi.forEach((_, i) => {
    const b = document.createElement('button');
    b.className = 'punto';
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', 'false');
    b.setAttribute('aria-label', `Paso ${i + 1} de ${TOTAL}`);
    b.addEventListener('click', () => { detenerAvance(); muestraPaso(i); });
    contPuntos.appendChild(b);
  });

  btn.addEventListener('click', () => {
    if (temporizador) {
      detenerAvance();
      viajes.forEach((v) => v.pause());
    } else {
      avanceAutomatico();
      viajes.forEach((v) => v.play());
      btn.textContent = 'Pausar';
    }
  });

  montaje.play();
  // Los paquetes entran cuando ya hay por donde circular.
  window.setTimeout(() => {
    lanzaPaquete('#pk1', '#t-srt', 1900);
    lanzaPaquete('#pk2', '#t-srt2', 1500, 400);
    lanzaPaquete('#pk3', '#t-hls', 1200, 800);
    lanzaPaquete('#pkc', '#t-mqtt', 2600);
    simulaPerdida();
  }, reducido ? 0 : 3200);

  muestraPaso(0, true);
  if (reducido) btn.textContent = 'Reanudar';
  else avanceAutomatico();
}
