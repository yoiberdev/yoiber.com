import gsap from 'gsap';
import type { Scope } from 'animejs';

// INTRO DEL LOGO — el original de yoiber.com, sin React
// ================================================================================================
// Port literal de la coreografía de `src/components/AnimatedLogo.tsx` de yoiber.com (solo lectura;
// ver /opt/yoiblog/src/CLAUDE.md). Las tres formas del logo entran enormes desde fuera de pantalla,
// se ensamblan y después flotan.
//
// POR QUÉ GSAP Y NO ANIME.JS, que es el motor del resto del demo:
// traducir esta coreografía a Anime.js NO la reproduce. Con los mismos números y el mismo reloj, a
// mitad de la entrada las dos versiones se ven distintas (a t=2,5 s las formas de una están casi
// montadas y las de la otra siguen enormes); solo coinciden al final. La causa es el orden en que
// cada librería compone las transformaciones, y aquí hay escalas de 15-20 con rotaciones de por
// medio, que es justo donde el orden se nota. Yoiber quiere ESTA entrada, no una equivalente, así
// que se usa la misma librería del original y el mismo código. Coste medido: +27 kB comprimidos.
//
// QUÉ SE HA QUITADO del original: la envoltura de React (refs, useCallback, useEffect) y las props
// `className`/`size`/`autoPlay`. Los números, el orden de las llamadas, las duraciones, las
// posiciones relativas, las curvas y los 300 ms de espera son los del original, uno a uno.
//
// DÓNDE ESTÁ EL SVG: en `index.html`, como el resto del marcado del demo (los efectos aquí animan
// nodos que ya existen; ver effects/hero.ts y core/escenario.ts). Además el marcado lleva
// `opacity: 0` en línea en las tres formas, igual que el original: `main.ts` monta dentro de
// `document.fonts.ready`, o sea después de la primera pintura, y sin esa opacidad el logo se vería
// montado un instante y luego saltaría a su posición de salida. Con ella no hay nada visible hasta
// que GSAP toma el mando.

export interface OpcionesLogo {
  /** Se llama al terminar la entrada, antes del medio segundo de espera del bucle. Es el punto de
   *  enganche para encadenar el motor 3D. */
  alTerminar?: () => void;
}

/** El cleanup de siempre (contrato `mount(scope) => cleanup`) con tres mandos colgados para el
 *  relevo. Ninguno toca la coreografía: solo la dejan terminar antes, o la congelan. */
export interface MandosLogo {
  /** true mientras la entrada sigue en el aire. */
  entradaViva(): boolean;
  /** El visitante ha bajado con la entrada a medias: se acelera hasta el final en vez de dejar que
   *  el logo se retire mientras todavía está llegando. No la corta: la termina. */
  acelerarEntrada(): void;
  /** Congela (o reanuda) el bucle de flotación. El logo ya no se ve: no hay por qué moverlo. */
  congelar(fuera: boolean): void;
}
export type MandoLogo = (() => void) & MandosLogo;

/** Contrato de efecto del demo: `mount(scope) => cleanup`. */
export function montarLogoIntro(scope?: Scope | null, op: OpcionesLogo = {}): MandoLogo {
  const svg = document.querySelector<SVGSVGElement>('#logo .logo-svg');
  const triangulo = svg?.querySelector<SVGPathElement>('.triangle') ?? null;
  const trapecio = svg?.querySelector<SVGPathElement>('.trapezoid') ?? null;
  const barra = svg?.querySelector<SVGPathElement>('.diagonal-bar') ?? null;

  const mando = (limpiar: () => void, mandos: MandosLogo): MandoLogo => Object.assign(limpiar, mandos);
  const quieto: MandosLogo = { entradaViva: () => false, acelerarEntrada: () => undefined, congelar: () => undefined };

  if (!svg || !triangulo || !trapecio || !barra) return mando(() => undefined, quieto);

  const reduce = scope?.matches.reduceMotion === true;

  // Movimiento reducido: el logo aparece montado y quieto. Ni entrada ni bucle.
  if (reduce) {
    gsap.set([triangulo, trapecio, barra], { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });
    gsap.set(svg, { filter: 'blur(0px) brightness(1)', scale: 1 });
    op.alTerminar?.();
    return mando(() => gsap.killTweensOf([svg, triangulo, trapecio, barra]), quieto);
  }

  // Los bucles decorativos del demo se guardan en `scope.data.loops` para poder pausarlos (main.ts
  // hace lo mismo con el pulso del punto). Un timeline de GSAP y una animación de Anime.js no son
  // la misma clase, pero los dos responden a .pause()/.play(), que es todo lo que el registro pide.
  const bucles: Set<unknown> | null = scope ? ((scope.data.loops ??= new Set()) as Set<unknown>) : null;

  let entrada: gsap.core.Timeline | null = null;
  let flotacion: gsap.core.Timeline | null = null;
  let esperaFlotacion: gsap.core.Tween | null = null;
  let arranque = 0;
  // El logo ya está fuera de cuadro (lo dice effects/logo-salida.ts). Se guarda porque la flotación
  // puede nacer DESPUÉS de que el visitante se haya ido: en ese caso nace parada.
  let congelado = false;

  // Coloca las formas fuera de pantalla, en tamaño enorme, antes de animar.
  function colocar(): void {
    entrada?.kill();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    gsap.set(triangulo, { x: -vw * 1.5, y: -vh * 1.2, scale: 15, rotation: -45, opacity: 0.9 });
    gsap.set(trapecio, { x: -vw * 1.8, y: vh * 1.5, scale: 18, rotation: 90, opacity: 0.9 });
    gsap.set(barra, { x: vw * 1.8, y: -vh * 1.3, scale: 20, rotation: -60, opacity: 0.9 });
    gsap.set(svg, { filter: 'blur(0px) brightness(1)', scale: 1 });
  }

  function pararFlotacion(): void {
    esperaFlotacion?.kill();
    esperaFlotacion = null;
    if (flotacion) bucles?.delete(flotacion);
    flotacion?.kill();
    flotacion = null;
  }

  function arrancarFlotacion(): void {
    pararFlotacion();

    flotacion = gsap.timeline({ repeat: -1 });
    flotacion
      .to(triangulo, { duration: 3, y: -8, rotation: '+=2', ease: 'power2.inOut', yoyo: true, repeat: 1 }, 0)
      .to(trapecio, { duration: 2.5, y: 6, rotation: '-=1.5', ease: 'power2.inOut', yoyo: true, repeat: 1 }, 0.5)
      .to(barra, { duration: 3.5, y: -5, rotation: '+=1', ease: 'power2.inOut', yoyo: true, repeat: 1 }, 1);
    if (congelado) flotacion.pause();
    bucles?.add(flotacion);
  }

  function tocar(): void {
    pararFlotacion();
    colocar();

    entrada = gsap.timeline({
      onComplete: () => {
        op.alTerminar?.();
        esperaFlotacion = gsap.delayedCall(0.5, arrancarFlotacion);
      },
    });

    // Las formas aparecen enormes desde fuera de la pantalla y convergen en el logo.
    entrada
      .to(triangulo, { duration: 3.5, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, ease: 'power4.out' })
      .to(trapecio, { duration: 3.8, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, ease: 'power4.out' }, '-=3.3')
      .to(barra, { duration: 4, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, ease: 'power4.out' }, '-=3.5')
      .to(svg, { duration: 0.8, filter: 'blur(0px) brightness(1)', scale: 1, ease: 'power2.out' }, '-=0.5');
  }

  // Estado inicial cuanto antes: el marcado ya trae las formas invisibles, y esto las pone en su
  // sitio de salida antes de que empiecen los 300 ms.
  colocar();

  // Si cambia el tamaño de la ventana durante la entrada, se recalcula desde el principio (las
  // posiciones de salida se miden en anchos y altos de ventana).
  const alRedimensionar = (): void => {
    if (entrada?.isActive()) tocar();
  };
  window.addEventListener('resize', alRedimensionar);

  arranque = window.setTimeout(tocar, 300);

  return mando(() => {
    window.removeEventListener('resize', alRedimensionar);
    window.clearTimeout(arranque);
    entrada?.kill();
    entrada = null;
    pararFlotacion();
    // No se limpian los estilos que GSAP dejó puestos: igual que en el original, al desmontar solo
    // se matan las animaciones. Si el scope se rehace (cambio de prefers-reduced-motion), el nuevo
    // montaje vuelve a fijar el estado en su primera línea.
  }, {
    entradaViva: () => entrada?.isActive() === true,

    // Acelerar, no cortar. `timeScale` estira el reloj de la entrada sin tocar ni un número de la
    // coreografía: pasa por los mismos sitios, más deprisa. Se le da una rampa en vez de un escalón
    // porque el salto de 1x a 4x de golpe se ve como un tirón. Y se deja que termine sola, así que
    // su `onComplete` sigue disparando `alTerminar` (que es quien pide el motor) y la flotación.
    acelerarEntrada() {
      if (!entrada?.isActive()) return;
      gsap.to(entrada, { timeScale: 4, duration: 0.45, ease: 'power2.in', overwrite: true });
    },

    congelar(fuera: boolean) {
      congelado = fuera;
      if (!flotacion) return;   // todavía no ha nacido: nacerá parada (ver arrancarFlotacion)
      if (fuera) flotacion.pause();
      else flotacion.play();
    },
  });
}
