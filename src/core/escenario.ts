import { stagger } from 'animejs';
import { P } from '../params';
import type { Maestro } from './maestro';
import type { Escena } from './escena';

// Escenario CSS 3D: un panel de placas apiladas en translateZ que entra, gira, se abre y se hunde
// según el tramo del maestro. Con reduced-motion solo hay fundidos.
// Cumple el contrato `Escena` (core/escena.ts) para poder relevarse con el motor 3D. Su
// `revertir()` no tiene nada que soltar: no crea nodos ni escuchadores, y sus animaciones son
// hijas del maestro, así que las deshace el `m.tl.revert()` de main.ts.
export function montarEscenario(m: Maestro, reduce: boolean): Escena {
  const { tl } = m;
  const escena: Escena = { tipo: 'css', revertir: () => undefined };
  const panel = '#panel';
  const placas = '.placa';
  const puntos = '.galeria-punto';

  tl.set(puntos, { opacity: 0.15, scale: 0.5 }, 0);

  // LAS OPACIDADES VAN CON [desde, hasta] EXPLÍCITO, igual que en motor/coreografia.ts y por el
  // mismo motivo: el `from` implícito se captura EN EL `.add()`, leyendo el nodo vivo, no del
  // `set()` de t=0. Con solo `{ opacity: 1 }` el panel se quedaba asomando durante toda la INTRO
  // (una placa gris con su trama de puntos detrás del logo). Antes no se veía en el camino 3D
  // porque el lienzo lo tapaba en cuanto llegaba; ahora el telón del motor no se levanta hasta
  // HERO_OUT, así que la INTRO enseña el escenario CSS en los tres caminos y el fallo salió a la luz.
  if (reduce) {
    tl.set(panel, { opacity: 0, rotateX: 0, rotateY: 0, y: 0, scale: 1 }, 0)
      .add(panel, { opacity: [0, 1], duration: m.duracion('HERO_OUT'), ease: 'linear' }, 'HERO_OUT')
      .add(puntos, { opacity: 1, scale: 1, duration: 400 }, stagger(1000, { start: 'GALERIA' }))
      .add(panel, { opacity: [1, 0], duration: m.duracion('CIERRE'), ease: 'linear' }, 'CIERRE');
    return escena;
  }

  const e = P.panel.entrada;
  tl.set(panel, { opacity: 0, rotateX: e.rotateX, rotateY: 0, y: e.y, scale: e.scale }, 0)
    .set(placas, { z: 0 }, 0)
    // Entra desde abajo mientras el hero se va.
    .add(panel, { opacity: [0, 1], rotateX: 0, y: '0vh', scale: 1, duration: m.duracion('HERO_OUT'), ease: 'out(2)' }, 'HERO_OUT')
    // Galería: balanceo lento y los 8 puntos se encienden uno por tramo.
    .add(panel, {
      rotateY: [{ to: P.panel.galeria.rotateY }, { to: -P.panel.galeria.rotateY }, { to: 0 }],
      duration: m.duracion('GALERIA'),
      ease: 'inOut(2)',
    }, 'GALERIA')
    .add(puntos, { opacity: 1, scale: 1, duration: 400, ease: 'out(3)' }, stagger(1000, { start: 'GALERIA' }))
    // "Cómo está hecho": se inclina, las placas se separan, gira y se recompone.
    .add(panel, { rotateX: P.panel.como.rotateX, duration: 1500 }, 'COMO')
    .add(placas, { z: stagger([-P.panel.como.z, P.panel.como.z]), duration: 1500 }, 'COMO')
    .add(panel, { rotateY: P.panel.como.giro, duration: 2000 }, 'COMO+=1500')
    .add(placas, { z: 0, duration: 1500 }, 'COMO+=3500')
    .add(panel, { rotateX: 0, rotateY: 0, duration: 1500 }, 'COMO+=3500')
    // Cierre: se hunde bajo el horizonte.
    .add(panel, { rotateX: P.panel.cierre.rotateX, y: P.panel.cierre.y, opacity: [1, 0], duration: m.duracion('CIERRE'), ease: 'in(2)' }, 'CIERRE');

  return escena;
}
