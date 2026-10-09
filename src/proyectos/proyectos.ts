import { animate, stagger, utils } from 'animejs';
import { montarFicha } from './ficha';

// LOS PROYECTOS — #proyectos, en flujo después del maestro (10/10/2026)
// ================================================================================================
// Cuatro sistemas contados como flujos, dos herramientas y un estante con lo personal (portada.css).
// Este módulo hace cinco cosas, ninguna atada al reloj del maestro:
//   · LOS FLUJOS se ejecutan la primera vez que se ven (clase .en-marcha: sus animaciones CSS dejan
//     de estar en pausa), y el botón «Ejecutar otra vez» los corre de nuevo desde el principio.
//   · ENTRADA: las piezas y las herramientas suben y aparecen la primera vez que asoman, con un
//     escalón entre las de la misma fila. Una sola vez: después se quedan.
//   · EN VISTA: las animaciones CSS de cada vista solo andan mientras se ve (clase .en-vista), y los
//     vídeos de las vistas (el ajolote, la web de Sebastian) se piden y se reproducen igual.
//   · LAS IMÁGENES de las vistas llevan data-src: se piden al acercarse.
//   · LA FICHA (ficha.ts) al tocar un proyecto.
// Con movimiento reducido no hay entrada ni bucles (portada.css los apaga): todo quieto y completo,
// y cada flujo se ve ya ejecutado.

export function montarProyectos(reduce: boolean): () => void {
  const seccion = document.querySelector<HTMLElement>('#proyectos');
  if (!seccion) return () => undefined;
  const objetos = Array.from(seccion.querySelectorAll<HTMLElement>('.objeto'));
  const vistas = objetos.map((o) => o.querySelector<HTMLElement>('.vista')).filter((v): v is HTMLElement => !!v);
  const limpiezas: (() => void)[] = [];

  // ——— Medios perezosos ———
  const sonda = document.createElement('video');
  const ext = sonda.canPlayType('video/mp4; codecs="avc1.42E01E"') ? 'mp4' : sonda.canPlayType('video/webm; codecs="vp9"') ? 'webm' : '';
  const ahorro = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  const conVideo = !reduce && !ahorro && ext !== '';
  const alListo = (ev: Event): void => (ev.currentTarget as HTMLVideoElement).classList.add('lista');

  const despertar = (vista: HTMLElement, visible: boolean): void => {
    vista.classList.toggle('en-vista', visible);
    if (visible) {
      for (const img of vista.querySelectorAll<HTMLImageElement>('img[data-src]')) {
        img.src = img.dataset.src ?? '';
        img.removeAttribute('data-src');
      }
    }
    for (const v of vista.querySelectorAll<HTMLVideoElement>('video[data-video]')) {
      if (!conVideo) continue;
      if (visible) {
        if (!v.src) {
          v.addEventListener('loadeddata', alListo);
          v.preload = 'auto';
          v.src = `${v.dataset.video}.${ext}`;
        }
        v.play().catch(() => undefined);
      } else if (!v.paused) {
        v.pause();
      }
    }
  };
  const vigia = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) despertar(e.target as HTMLElement, e.isIntersecting);
    },
    { rootMargin: '120px 0px' },
  );
  for (const v of vistas) vigia.observe(v);
  limpiezas.push(() => {
    vigia.disconnect();
    for (const v of vistas) {
      v.classList.remove('en-vista');
      for (const video of v.querySelectorAll<HTMLVideoElement>('video')) {
        video.removeEventListener('loadeddata', alListo);
        video.pause();
      }
    }
  });

  // ——— Entrada ———
  if (!reduce) {
    const bajoElBorde = objetos.filter((o) => !o.matches('.caso, .caso-corto') && o.getBoundingClientRect().top > window.innerHeight * 0.9);
    utils.set(bajoElBorde, { opacity: 0, y: 48 });
    const pendientes = new Set(bajoElBorde);
    let tanda: HTMLElement[] = [];
    let espera = 0;
    // Los que asoman en el mismo instante entran juntos, con un escalón entre ellos.
    const soltar = (): void => {
      espera = 0;
      const lote = tanda.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      tanda = [];
      animate(lote, { opacity: [0, 1], y: [48, 0], duration: 900, ease: 'out(4)', delay: stagger(110) });
    };
    const entrada = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          const o = e.target as HTMLElement;
          if (!pendientes.delete(o)) continue;
          entrada.unobserve(o);
          tanda.push(o);
        }
        if (tanda.length && !espera) espera = window.setTimeout(soltar, 30);
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    for (const o of bajoElBorde) entrada.observe(o);
    limpiezas.push(() => {
      entrada.disconnect();
      window.clearTimeout(espera);
      utils.set(objetos, { opacity: 1, y: 0 });
    });
  }

  // ——— La cabecera, con fondo cuando tiene contenido debajo ———
  // Una franja del alto de la cabecera en lo alto de la ventana: si alguna de las secciones en flujo
  // la cruza, la cabecera se tapa (portada.css, .cabecera-sobre).
  const cab = document.querySelector<HTMLElement>('#cabecera');
  const debajo = new Set<Element>();
  const html = document.documentElement;
  const franja = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting) debajo.add(e.target);
        else debajo.delete(e.target);
      }
      html.classList.toggle('cabecera-sobre', debajo.size > 0);
    },
    { rootMargin: `0px 0px -${Math.max(0, window.innerHeight - (cab?.offsetHeight ?? 56))}px 0px` },
  );
  for (const s of document.querySelectorAll('#proyectos, #hablemos, #pie')) franja.observe(s);
  limpiezas.push(() => {
    franja.disconnect();
    html.classList.remove('cabecera-sobre');
  });

  // ——— Los flujos ———
  // Se ejecutan una vez al verse casi enteros, y el botón los vuelve a correr: cancelar y reproducir
  // cada animación la devuelve al principio, con su retraso. En el teléfono el lienzo es más ancho
  // que la pantalla: mientras corre, su ventana se desliza sola detrás del nodo que trabaja, hasta
  // que la persona la toque.
  const flujos = Array.from(seccion.querySelectorAll<HTMLElement>('.flujo'));
  const seguir = (f: HTMLElement): void => {
    const ventana = f.parentElement;
    if (!ventana || ventana.scrollWidth <= ventana.clientWidth + 4) return;
    const tiempos = Array.from(f.querySelectorAll<HTMLElement>('.nodo')).map((n) => parseFloat(n.style.getPropertyValue('--t')) || 0);
    const total = (Math.max(...tiempos) + 0.9) * 1000;
    const desde = ventana.scrollLeft;
    const hasta = ventana.scrollWidth - ventana.clientWidth;
    const t0 = performance.now();
    let cuadro = 0;
    const soltar = (): void => {
      cancelAnimationFrame(cuadro);
      ventana.removeEventListener('pointerdown', soltar);
      ventana.removeEventListener('wheel', soltar);
    };
    const paso = (ahora: number): void => {
      const p = Math.min(1, (ahora - t0) / total);
      ventana.scrollLeft = desde + (hasta - desde) * (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
      if (p < 1) cuadro = requestAnimationFrame(paso);
      else soltar();
    };
    ventana.addEventListener('pointerdown', soltar, { once: true });
    ventana.addEventListener('wheel', soltar, { once: true, passive: true });
    cuadro = requestAnimationFrame(paso);
  };
  const correr = (f: HTMLElement): void => {
    f.classList.add('en-marcha');
    for (const a of f.getAnimations({ subtree: true })) {
      a.cancel();
      a.play();
    }
    if (f.parentElement) f.parentElement.scrollLeft = 0;
    seguir(f);
  };
  // Se mira la ventana y no el lienzo: en el teléfono el lienzo nunca entra entero.
  const arranque = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        arranque.unobserve(e.target);
        const f = e.target.querySelector<HTMLElement>('.flujo');
        if (!f) continue;
        f.classList.add('en-marcha');
        seguir(f);
      }
    },
    { threshold: 0.6 },
  );
  if (!reduce) for (const f of flujos) if (f.parentElement) arranque.observe(f.parentElement);
  const alCorrer = (ev: Event): void => {
    const b = (ev.target as Element | null)?.closest('.flujo-correr');
    const f = b?.closest('.objeto')?.querySelector<HTMLElement>('.flujo');
    if (f && !reduce) correr(f);
  };
  seccion.addEventListener('click', alCorrer);
  limpiezas.push(() => {
    arranque.disconnect();
    seccion.removeEventListener('click', alCorrer);
    for (const f of flujos) f.classList.remove('en-marcha');
  });

  // ——— La ficha ———
  limpiezas.push(montarFicha(objetos, { reduce, conVideo, ext }));

  return () => {
    for (const l of limpiezas.reverse()) l();
  };
}
