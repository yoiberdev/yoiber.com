import type { Maestro } from '../core/maestro';
import type { Sim } from '../sim/motor';
import type { Galeria } from './galeria';

// LAS VITRINAS DE LA GALERÍA — el trabajo de cada proyecto, andando
// ================================================================================================
// Hasta el 27/09/2026 cada tarjeta llevaba una captura JPG fija y el que se movía era el motor. Ahora
// el motor despega en la portada y la galería enseña el TRABAJO en movimiento: una grabación corta de
// cada proyecto (la boleta que SUNAT acepta, el pedido que llega a cocina, la reserva en el móvil,
// el formulario que se genera, la web de Sebastian) dentro de un marco de navegador o de teléfono.
//
// EL PESO MANDA. Los cinco vídeos juntos pasan del megabyte, así que en el marcado no hay ni un
// `src`: ni en el cartel ni en el vídeo.
//   · Los CARTELES (un fotograma en WebP, 15-50 kB) se piden al salir de la portada: son lo que se ve
//     mientras el vídeo carga y lo único que se ve con movimiento reducido o ahorro de datos.
//   · Los VÍDEOS se piden de uno en uno: el de la tarjeta que manda y el de la siguiente, para que
//     al pasar de tarjeta ya esté. Uno que nunca se llega a ver nunca se descarga.
//   · Anda SOLO el vídeo de la tarjeta que manda (galeria.indice, el mismo reparto que el contador).
//     Los demás, en pausa. Al volver a una tarjeta el vídeo empieza desde el principio: cuentan una
//     historia corta (emitir → aceptada) y a mitad no se entiende.
//   · MP4 (H.264) primero: es el más ligero y lo reproducen todos los navegadores de verdad. El WebM
//     es la red para los que no traen H.264 (el Chromium de Playwright, algún Linux sin códecs).
//
// LAS SIMULACIONES (27/09/2026). Dos vitrinas no llevan vídeo sino una escena viva (src/sim/): las
// cámaras de los barcos, que son de un cliente y no se pueden grabar, y las automatizaciones, que
// pasan en tres pantallas a la vez. `data-sim` en la .vitrina-medio dice cuál; el trozo se pide con
// los carteles (pesa poco y no descarga medios), se monta encima del cartel y sigue la misma regla:
// solo anda la de la tarjeta que manda, y al volver a ella empieza desde el paso 1. Con movimiento
// reducido se monta igual pero quieta, en su instante más explicativo.
//
// Este módulo NO escribe nada del maestro: la opacidad y el destape de la vitrina los lleva
// galeria.ts con el scroll. Esto solo decide qué medio está cargado y cuál anda.

export interface Vitrinas {
  actualizar(tiempo: number): void;
  revertir(): void;
}

interface Vitrina {
  cartel: HTMLImageElement | null;
  video: HTMLVideoElement | null;
  base: string;
  medio: HTMLElement | null;
  sim: string;
  escena: Sim | null;
  capa: HTMLElement | null;
}

type MontarSim = (raiz: HTMLElement, opciones: { reduce: boolean }) => Sim;
// Un import por escena, escrito entero: así Vite parte cada una en su trozo.
const SIMS: Record<string, () => Promise<MontarSim>> = {
  camaras: () => import('../sim/camaras').then((m) => m.montarCamaras),
  automatizaciones: () => import('../sim/automatizaciones').then((m) => m.montarAutomatizaciones),
};

export function montarVitrinas(m: Maestro, galeria: Galeria, reduce: boolean): Vitrinas {
  const vitrinas: Vitrina[] = Array.from(document.querySelectorAll<HTMLElement>('#galeria-tarjetas .tarjeta')).map((t) => {
    const video = t.querySelector<HTMLVideoElement>('video.vitrina-video[data-video]');
    const medio = t.querySelector<HTMLElement>('.vitrina-medio');
    return {
      cartel: t.querySelector<HTMLImageElement>('img.vitrina-cartel[data-src]'),
      video,
      base: video?.dataset.video ?? '',
      medio,
      sim: medio?.dataset.sim ?? '',
      escena: null,
      capa: null,
    };
  });
  if (!vitrinas.length) return { actualizar: () => undefined, revertir: () => undefined };

  const conexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const sonda = document.createElement('video');
  const ext = sonda.canPlayType('video/mp4; codecs="avc1.42E01E"')
    ? 'mp4'
    : sonda.canPlayType('video/webm; codecs="vp9"') ? 'webm' : '';
  const conVideo = !reduce && !conexion?.saveData && ext !== '';

  // El vídeo tapa al cartel en cuanto tiene imagen de verdad (base.css, `.vitrina-video.lista`).
  const alListo = (ev: Event): void => (ev.currentTarget as HTMLVideoElement).classList.add('lista');
  for (const { video } of vitrinas) video?.addEventListener('loadeddata', alListo);

  let carteles = false;
  const pedidos = new Set<number>();
  const cargar = (i: number): void => {
    const v = vitrinas[i];
    if (!conVideo || !v?.video || pedidos.has(i)) return;
    pedidos.add(i);
    v.video.preload = 'auto';
    v.video.src = `${v.base}.${ext}`;
  };

  let activa = -1;
  let visible = !document.hidden;
  let vivo = true;
  const montarSim = (v: Vitrina, i: number): void => {
    const cargar = SIMS[v.sim];
    if (!cargar || !v.medio) return;
    cargar().then((montar) => {
      if (!vivo || !v.medio || v.escena) return;
      const capa = document.createElement('div');
      v.medio.classList.add('con-sim');
      v.medio.append(capa);
      v.capa = capa;
      v.escena = montar(capa, { reduce });
      if (i === activa) { v.escena.reiniciar(); reproducir(); }
    }).catch(() => undefined);   // sin el trozo se queda el cartel, que dice lo mismo quieto
  };

  const reproducir = (): void => {
    for (let i = 0; i < vitrinas.length; i++) {
      const escena = vitrinas[i].escena;
      if (escena) {
        if (i === activa && visible) escena.reproducir(); else escena.pausar();
      }
      const video = vitrinas[i].video;
      if (!video || !pedidos.has(i)) continue;
      if (i === activa && visible) {
        if (video.paused) video.play().catch(() => undefined);   // sin gesto: muted + playsinline
      } else if (!video.paused) {
        video.pause();
      }
    }
  };
  const alCambiarVisibilidad = (): void => { visible = !document.hidden; reproducir(); };
  // Para el QA (?debug): las escenas montadas, para colocarlas en un instante y fotografiarlas.
  if (location.search.includes('debug')) Object.assign(window, { __sims: () => vitrinas.map((v) => v.escena) });
  document.addEventListener('visibilitychange', alCambiarVisibilidad);

  return {
    actualizar(tiempo) {
      // Los carteles, una vez, en cuanto se deja atrás la portada (o se aterriza más abajo).
      if (!carteles && tiempo >= m.L.DESPEGUE) {
        carteles = true;
        for (const { cartel } of vitrinas) if (cartel?.dataset.src) cartel.src = cartel.dataset.src;
        vitrinas.forEach((v, i) => { if (v.sim) montarSim(v, i); });
      }
      const i = galeria.indice(tiempo);
      if (i === activa) return;
      if (i >= 0) {
        cargar(i);
        cargar(i + 1);
        const video = vitrinas[i].video;
        if (video && pedidos.has(i) && video.readyState > 0) video.currentTime = 0;
        vitrinas[i].escena?.reiniciar();
      }
      activa = i;
      reproducir();
    },
    revertir() {
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      vivo = false;
      for (const v of vitrinas) {
        v.escena?.revertir();
        v.capa?.remove();
        v.medio?.classList.remove('con-sim');
        v.escena = null;
        v.capa = null;
      }
      for (const { cartel, video } of vitrinas) {
        cartel?.removeAttribute('src');
        if (!video) continue;
        video.removeEventListener('loadeddata', alListo);
        video.pause();
        video.classList.remove('lista');
        video.removeAttribute('src');
        video.preload = 'none';
        video.load();
      }
      pedidos.clear();
      activa = -1;
      carteles = false;
    },
  };
}
