import { P } from '../params';
import type { Maestro } from './maestro';

// LA GEOMETRÍA DE LA GALERÍA, en su propio módulo. Antes vivía en effects/galeria.ts, pero la
// necesita también la coreografía del motor (trozo 3D) para saber cuándo puede volver al centro
// sin meterse bajo la última tarjeta. Aquí solo depende de params: el trozo 3D la importa sin
// arrastrar el resto de la galería.

const S = P.galeria.secuencia;

/** LA GEOMETRÍA DE LA GALERÍA, en unidades del maestro. Función pura y exportada porque la
 *  necesitan tres sitios que deben coincidir al milímetro: el montaje de las tarjetas, la capa de
 *  vida y los tres enlaces que aterrizan en la primera tarjeta. Antes cada uno echaba su cuenta, y
 *  la de los enlaces caía con el esquema sin trazar y la vida apagada (medido: 0 %/s al llegar). */
export function geometriaGaleria(m: Maestro, n: number) {
  // El motor necesita apartarse antes de que entre nada: ese margen es `arranque`.
  const margen = m.duracion('GALERIA') * P.galeria.arranque;
  const ini = m.L.GALERIA + margen;
  const dur = m.duracion('GALERIA') - margen;
  const paso = dur / Math.max(1, n);
  // Cruce corto respecto al tramo: la tarjeta entra, se queda MUCHO rato quieta y se va.
  // Con un cruce largo el texto pasa media vida a media opacidad y no se puede leer.
  const cruce = Math.min(500, paso * 0.14);
  // LA SALIDA SE APOYA EN EL FINAL DEL CRUCE, NO EN SU PRINCIPIO. La salida es más corta que la
  // entrada a propósito (acaba en el 0,70 del cruce, P.galeria.secuencia.salida), pero empezaba en
  // `fin`, así que terminaba al 70 % y la tarjeta siguiente no entraba hasta el 100 %: quedaba un
  // 30 % del cruce con TODAS las tarjetas apagadas (cuatro huecos de 65 px, medido). Ahora arranca
  // `retrasoSalida` más tarde y termina justo cuando la siguiente empieza a entrar.
  const X0 = S.salida;
  const finSalida = Math.max(
    X0.titulo.ini + X0.titulo.dur,
    X0.captura.ini + X0.captura.dur,
    X0.parrafos.ini + X0.parrafos.dur + X0.parrafos.stagger * 2,
    X0.acceso.ini + X0.acceso.dur + X0.acceso.stagger,
    S.esquema.salida.ini + S.esquema.salida.dur,
  );
  const retrasoSalida = cruce * Math.max(0, 1 - finSalida);
  const desde = (i: number): number => ini + paso * i;                      // empieza a entrar
  const fin = (i: number): number => desde(i) + paso - cruce + retrasoSalida; // empieza a salir
  const quieto = (i: number): [number, number] => [desde(i) + cruce, fin(i)];  // el tramo que dibuja el esquema
  const esquemaFuera = (i: number): number => fin(i) + cruce * (S.esquema.salida.ini + S.esquema.salida.dur);
  return { ini, dur, paso, cruce, retrasoSalida, desde, fin, quieto, esquemaFuera };
}

/** Fracción del tramo quieto en que termina de trazarse la última pieza de CUALQUIER esquema.
 *  Se calcula de la tabla (P.galeria.esquemas) y de la compresión (P.galeria.dibujo), no se copia:
 *  si alguien alarga una ventana, la vida se sigue encendiendo cuando toca. Hoy: 0,38 × 0,90. */
export function finDelDibujo(): number {
  let ultima = 0;
  for (const ventanas of Object.values(P.galeria.esquemas)) {
    for (const v of Object.values(ventanas) as number[][]) ultima = Math.max(ultima, v[1]);
  }
  return P.galeria.dibujo * ultima;
}

/** El instante en que la vida de la tarjeta `i` ya está entera: su esquema trazado y el bucle a
 *  opacidad 1. Es donde aterrizan "Ver los proyectos", el enlace Proyectos y la parada de la
 *  sub-nav: llegar y ver la tarjeta funcionando, no un esquema a medio empezar. */
export function tiempoConVida(m: Maestro, n: number, i = 0): number {
  const G = geometriaGaleria(m, n);
  const [a, b] = G.quieto(i);
  const V = P.galeria.vida;
  return a + (b - a) * Math.min(1, finDelDibujo() + V.entraLargo + V.aterrizaAire);
}

/** El instante en que el motor puede empezar a volver al centro al final de GALERIA: cuando la
 *  CAPTURA de la última tarjeta empieza a irse, que es la pieza que ocupa el sitio al que vuelve.
 *  Antes era un número fijo (PM.coreo.galeria.vuelve = 0,023) calculado a mano con la geometría
 *  de entonces; al retrasarse la salida de las tarjetas 69 unidades, el motor volvía con la quinta
 *  captura todavía opaca y su campana se metía 70 px debajo (medido en un iPhone 13). */
export function tiempoRegresoMotor(m: Maestro, n: number): number {
  const G = geometriaGaleria(m, n);
  return G.fin(n - 1) + G.cruce * S.salida.captura.ini;
}
