import '@fontsource-variable/instrument-sans';
import '@fontsource/fragment-mono';
import './styles/base.css';
import './styles/portada.css';
import { sugerirIdioma } from './comun/idioma';
import { animate, createScope, type JSAnimation, type Scope } from 'animejs';
import { P } from './params';
import { crearMaestro } from './core/maestro';
import { crearScroller, type Proxy } from './core/scroller';
import { montarEscena } from './core/escena';
import { montarTema } from './core/tema';
import { crearViaje } from './core/viaje';
import { montarDebug } from './core/debug';
import { limpiarUrl } from './core/url-limpia';
import { montarHero } from './effects/hero';
import { montarFondoIntro } from './effects/fondo-intro';
import { montarCabecera, alturaProyectos } from './effects/cabecera';
import { montarLogoIntro } from './effects/logo-intro';
import { montarLogoSalida } from './effects/logo-salida';
import { montarPie } from './effects/pie';
import { montarHablemos } from './effects/hablemos';
import { montarProyectos } from './proyectos/proyectos';

// LA PORTADA EN DOS MITADES (09/10/2026). Arriba, el MAESTRO: la intro del logo, el texto del hero y
// el motor que se ensambla y despega, todo en un reloj que mueve el scroll de #capitulos. Abajo, en
// flujo normal, los proyectos (src/proyectos), la frase de cierre y el pie: suben por encima de las
// capas fijas cuando el maestro se acaba, y cada uno mira su propio scroll. Antes la galería era un
// tramo más del maestro, veinte pantallas con una tarjeta cada una; ahora se ven todos de un vistazo.

// Las secciones son espaciadores: su altura fija cuánto scroll dura cada tramo.
// Sin @property el tema no puede fundirse animando sus variables (base.css): se marca <html> para
// que vuelvan las transiciones de color de siempre. Una vez, al cargar el módulo.
if (typeof CSS === 'undefined' || !('registerProperty' in CSS)) {
  document.documentElement.classList.add('sin-property');
}

function ajustarAlturas(): void {
  for (const s of document.querySelectorAll<HTMLElement>('section[data-label]')) {
    const alturas = P.scroll.alturas[s.dataset.label ?? ''] ?? 1;
    s.style.height = `${alturas * 100}vh`;
    s.style.height = `${alturas * 100}lvh`;
  }
}

function montar(self?: Scope): () => void {
  const reduce = self?.matches.reduceMotion === true;
  const m = crearMaestro();
  const proxy: Proxy = { currentTime: 0 };
  // El texto del hero (lema, nota y enlace) y el velo: Anime.js, dentro del maestro.
  const hero = montarHero(m, reduce);
  // El anillo de marcas detrás del logo: se enciende en el maestro y gira con el reloj del
  // navegador. Sus bucles se apuntan en el registro del scope, como la flotación del logo.
  const fondo = montarFondoIntro(m, reduce);
  if (self) for (const b of fondo.bucles) ((self.data.loops ??= new Set()) as Set<unknown>).add(b);
  // EL VIAJE (core/viaje.ts): el único que mueve el scroll por su cuenta. Mientras dura, el
  // scroller va clavado al scroll; el scroller nace más abajo, pero el primer viaje llega con un clic.
  const viaje = crearViaje(reduce, (activo) => scroller.exacto(activo));
  // La cabecera entra con el texto del hero (tween en el maestro).
  const cabecera = montarCabecera(m, reduce, viaje.irA);
  // El escenario: CSS siempre, y el motor 3D por encima si la máquina lo aguanta. Ver core/escena.ts.
  // El reloj que lee el motor 3D es el del PROPIO MAESTRO, no `proxy`: el motor lee el reloj 60
  // veces por segundo y tiene que dibujar lo que el maestro acaba de colocar.
  const escena = montarEscena(m, {
    reduce,
    tiempo: () => m.tl.currentTime,
    // El motor llega con la página quieta (lo pide la intro del logo al ensamblarse): nadie va a
    // mover el scroll detrás para recolocar el reloj, así que se recoloca aquí.
    alMontarMotor: () => colocar(proxy.currentTime),
  });

  // EL RELEVO del logo (ver effects/logo-salida.ts): la salida va en el maestro como un escalar
  // 0..1 en HERO_OUT; `alEmpezar` acelera la entrada si el visitante ya baja, y `alTapar` congela la
  // flotación cuando el logo ya no se ve.
  let logo: ReturnType<typeof montarLogoIntro> | null = null;
  const salidaLogo = montarLogoSalida(m, {
    reduce,
    alEmpezar: () => logo?.acelerarEntrada(),
    alTapar: (fuera) => logo?.congelar(fuera),
  });

  m.tl.init();

  // TODO EL MUNDO COLOCA EL RELOJ POR AQUÍ: el seek del maestro y la copia del escalar de la salida a
  // la timeline de GSAP del logo van siempre juntos.
  const colocar = (t: number): void => {
    m.tl.seek(t);
    salidaLogo.aplicar();
  };

  // La intro del logo (GSAP, su propio reloj). En cuanto las tres formas se ensamblan se pide el
  // trozo 3D, con una espera para que su análisis no congele la flotación (o en el acto, si el
  // visitante baja antes).
  let esperaMotor = 0;
  const pedirYa = (): void => {
    window.clearTimeout(esperaMotor);
    esperaMotor = 0;
    window.removeEventListener('scroll', pedirYa);
    escena.pedirMotor();          // idempotente: escena.ts lleva su propio pestillo
  };
  logo = montarLogoIntro(self, {
    alTerminar: () => {
      esperaMotor = window.setTimeout(pedirYa, P.motor.esperaTrasIntro);
      window.addEventListener('scroll', pedirYa, { once: true, passive: true });
    },
  });

  let introTemporal: JSAnimation | null = null;

  // LO QUE VA EN FLUJO, fuera del maestro: los proyectos, la frase de cierre y el pie.
  const quitarProyectos = montarProyectos(reduce);
  const quitarHablemos = montarHablemos(reduce);
  const quitarPie = montarPie(reduce, viaje.irA);

  const tema = montarTema(m);
  // EL TRASPASO DE LA INTRO va en el segundo callback (`manda`): mientras la intro corre por tiempo
  // y el visitante no ha bajado, el scroller ni toca el proxy. En cuanto baja 2 px la intro se para
  // y el scroll toma el mando para siempre.
  const scroller = crearScroller(m, proxy, () => {
    colocar(proxy.currentTime);
    tema.actualizar(proxy.currentTime);
    hero.actualizar(proxy.currentTime);
    cabecera.actualizar(proxy.currentTime);
    fondo.actualizar(proxy.currentTime);
  }, () => {
    if (!introTemporal || introTemporal.completed || introTemporal.paused) return true;
    if (window.scrollY < 2) return false; // el scroller aún no manda: la intro sigue por tiempo
    introTemporal.pause(); // el usuario hizo scroll durante la intro: el scroll toma el mando
    return true;
  });
  const destinos: Record<string, () => number> = { PROYECTOS: alturaProyectos };
  const quitarDebug = location.search.includes('debug')
    ? montarDebug(m, scroller, proxy, escena, salidaLogo, { viaje, destinos })
    : null;

  // "Ver los proyectos": el enlace del hero. Viaja hasta la sección (con la cabecera descontada).
  const bajar = document.querySelector<HTMLAnchorElement>('#bajar');
  const irAProyectos = (ev: Event): void => {
    ev.preventDefault();
    viaje.irA(alturaProyectos);
  };
  bajar?.addEventListener('click', irAProyectos);

  if (reduce || window.scrollY > 1) {
    // Recarga a mitad de página o movimiento reducido: sin intro por tiempo. El reloj se pone
    // directamente donde está el scroll.
    proxy.currentTime = scroller.objetivo();
    colocar(proxy.currentTime);
    tema.actualizar(proxy.currentTime);
    cabecera.actualizar(proxy.currentTime);
    fondo.actualizar(proxy.currentTime);
  } else {
    // La intro corre por tiempo y dura lo que la entrada del logo. Sin onComplete: el bucle de
    // flotación lo arranca el propio logo.
    introTemporal = animate(proxy, {
      currentTime: [m.L.INTRO, m.L.INTRO_END],
      duration: P.scroll.introDuration,
      ease: 'linear',
      onUpdate: () => {
        colocar(proxy.currentTime);
        hero.actualizar(proxy.currentTime);     // suelta el lema partido en cuanto acaban sus letras
        cabecera.actualizar(proxy.currentTime); // la cabecera se activa a mitad de la intro
      },
    });
  }

  let temporizador = 0;
  const alRedimensionar = (): void => {
    window.clearTimeout(temporizador);
    window.clearTimeout(esperaMotor);
    window.removeEventListener('scroll', pedirYa);
    temporizador = window.setTimeout(() => {
      ajustarAlturas();
      scroller.refrescar();   // rehace los tramos y en su primer tic vuelve a colocar el maestro
      viaje.recolocar();      // un viaje en marcha escribe ya su posición con los tramos nuevos
    }, 250);
  };
  window.addEventListener('resize', alRedimensionar);

  return () => {
    window.removeEventListener('resize', alRedimensionar);
    window.clearTimeout(temporizador);
    bajar?.removeEventListener('click', irAProyectos);
    introTemporal?.revert();
    quitarDebug?.();
    viaje.revertir();
    quitarPie();
    quitarHablemos();
    quitarProyectos();
    escena.revertir();
    cabecera.revertir();
    fondo.revertir();
    tema.revertir();
    scroller.revertir();
    logo?.();            // el cleanup de la intro del logo: mata entrada, flotación y espera
    salidaLogo.revertir();
    hero.revertir();
    m.tl.revert();
  };
}

// La dirección se limpia antes que nada: no depende de las fuentes ni de la escena.
limpiarUrl();

document.fonts.ready.then(() => {
  ajustarAlturas();
  document.documentElement.classList.add('is-ready');
  createScope({ mediaQueries: { reduceMotion: '(prefers-reduced-motion: reduce)' } }).add(montar);
});

// LA SUGERENCIA DE IDIOMA (comun/idioma.ts). La portada solo existe en español; a quien llega con
// el navegador en inglés se le ofrece /en/, sin redirigirle y una sola vez.
sugerirIdioma();
