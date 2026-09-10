import { animate, stagger, utils, type JSAnimation } from 'animejs';
import { P } from '../params';
import type { Maestro } from '../core/maestro';

// EL FONDO VIVO DE LA INTRO — #fondo-intro, detrás del logo (fila 15 del informe)
// ================================================================================================
// Medido antes: desde que el logo aterriza (+3 s) hasta que el visitante baja, el hero no cambiaba
// un píxel salvo la flotación del logo. La referencia tiene un anillo que se enciende y sigue vivo
// mientras dura la portada. Esto es lo mismo con diseño propio y SIN TOCAR EL LOGO: un anillo de
// 72 marcas —el bisel de un instrumento— y un barrido, un arco con cola que le da la vuelta.
//
// TRES RELOJES, y por qué cada cosa va en el suyo:
//   · EL ENCENDIDO va en el maestro, con el texto (INTRO_ON + intro.texto.delay): las marcas se
//     encienden una tras otra en el sentido de las agujas y el barrido aparece cuando el anillo
//     está completo. Es un instante de la intro, así que se deshace al subir como todo lo demás.
//   · LA RETIRADA también en el maestro: el anillo se va CON EL VELO en HERO_OUT (misma duración y
//     misma curva que en hero.ts), no con el logo, que hace su gesto aparte con GSAP.
//   · LOS DOS GIROS van FUERA del maestro, con el reloj del navegador (`animate` con loop): el
//     barrido da una vuelta cada 12 s y el anillo, en sentido contrario, una cada 4 min. Son los
//     bucles decorativos de siempre: registrados en scope.data.loops por main.ts, revertidos aquí,
//     no existen con reduce, y se PARAN cuando HERO_OUT los ha fundido (nada que mover si no se ve)
//     y se reanudan si el visitante vuelve arriba.
//
// QUE NO COMPITA CON EL LOGO: el color es --muted y la opacidad tope es P.intro.fondo.opacidad
// (0,35). El logo sigue siendo lo único blanco de la pantalla.
//
// EL GIRO EN SVG. Anime.js escribe `rotate` como transform CSS también en un <g>. El origen del
// giro se fija en base.css con `transform-box: view-box; transform-origin: 0 0`: el (0,0) del
// usuario, que con el viewBox -100 -100 200 200 es el centro del anillo. Medido: con `50% 50%` la
// caja de referencia (del tamaño del viewBox pero con la esquina en el (0,0) del usuario) ponía el
// origen en (100,100) y el barrido orbitaba esa esquina con 628 px de radio.
const F = P.intro.fondo;
const NS = 'http://www.w3.org/2000/svg';

export interface FondoIntro {
  actualizar(tiempo: number): void;
  /** Los bucles que corren solos (para registrarlos en el scope). Vacío con reduce. */
  bucles: JSAnimation[];
  revertir(): void;
}

export function montarFondoIntro(m: Maestro, reduce: boolean): FondoIntro {
  const caja = document.querySelector<HTMLElement>('#fondo-intro');
  const anillo = caja?.querySelector<SVGGElement>('.anillo') ?? null;
  const giro = caja?.querySelector<SVGGElement>('.giro') ?? null;
  const barrido = caja?.querySelector<SVGPathElement>('.barrido') ?? null;
  if (!caja || !anillo || !giro || !barrido) return { actualizar: () => undefined, bucles: [], revertir: () => undefined };

  // LAS MARCAS: radiales, del radio `marca` (o `larga`, una de cada `cadaLarga`) al borde (100),
  // giradas cada una su ángulo con el atributo `transform` de SVG (no CSS: así el giro del grupo,
  // que sí es CSS, no se pisa con el de cada marca).
  const marcas: SVGLineElement[] = [];
  for (let i = 0; i < F.marcas; i++) {
    const l = document.createElementNS(NS, 'line');
    const desde = i % F.cadaLarga === 0 ? F.radio.larga : F.radio.marca;
    l.setAttribute('x1', '0');
    l.setAttribute('y1', String(-desde));
    l.setAttribute('x2', '0');
    l.setAttribute('y2', '-100');
    l.setAttribute('transform', `rotate(${(360 / F.marcas) * i})`);
    anillo.append(l);
    marcas.push(l);
  }
  // EL BARRIDO: un arco de `arco` grados centrado en las doce, en el radio `barrido`. Su degradado
  // (index.html, #fondo-grad) va de izquierda a derecha de su caja: cola transparente, cabeza
  // llena; girando en el sentido de las agujas la cabeza va delante.
  const r = F.radio.barrido;
  const a = ((F.barrido.arco / 2) * Math.PI) / 180;
  const x = r * Math.sin(a);
  const y = -r * Math.cos(a);
  barrido.setAttribute('d', `M ${-x} ${y} A ${r} ${r} 0 0 1 ${x} ${y}`);
  barrido.setAttribute('stroke-width', String(F.barrido.grosor));

  const { tl } = m;
  const piezas = [...marcas, barrido];
  // La retirada dura lo que la del velo (hero.ts): el anillo es parte del suelo del hero.
  const durVelo = m.duracion('HERO_OUT') * P.intro.salidaTexto;
  const fuera = m.L.HERO_OUT + durVelo;

  const bucles: JSAnimation[] = [];
  let estatico: JSAnimation | null = null;

  if (reduce) {
    // Sin movimiento: el anillo está desde el principio, quieto, y se funde con el velo.
    estatico = utils.set(piezas, { opacity: F.opacidad });
    tl.set(caja, { opacity: 1 }, 0)
      .add(caja, { opacity: [1, 0], duration: durVelo, ease: 'linear' }, 'HERO_OUT');
  } else {
    const T = P.intro.texto;
    const E = F.encendido;
    tl.set(piezas, { opacity: 0 }, 0)
      .set(caja, { opacity: 1 }, 0)
      .add(marcas, { opacity: [0, F.opacidad], duration: E.duration, ease: 'out(2)', delay: stagger(E.stagger) }, `INTRO_ON+=${T.delay}`)
      // El barrido aparece cuando la última marca ya se está encendiendo.
      .add(barrido, { opacity: [0, F.opacidad], duration: E.duration * 2, ease: 'linear' }, `INTRO_ON+=${T.delay + F.marcas * E.stagger}`)
      .add(caja, { opacity: [1, 0], duration: durVelo, ease: 'in(2)' }, 'HERO_OUT');

    bucles.push(
      animate(giro, { rotate: [0, 360], duration: F.barrido.vuelta, ease: 'linear', loop: true }),
      animate(anillo, { rotate: [0, -360], duration: F.giro.vuelta, ease: 'linear', loop: true }),
    );
  }

  let parado = false;
  return {
    bucles,
    actualizar(tiempo) {
      const ahora = tiempo >= fuera;
      if (ahora === parado) return;
      parado = ahora;
      for (const b of bucles) (ahora ? b.pause() : b.resume());
    },
    revertir() {
      for (const b of bucles) b.revert();
      estatico?.revert();
      for (const l of marcas) l.remove();
      barrido.setAttribute('d', '');
    },
  };
}
