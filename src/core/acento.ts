import type { Galeria } from '../effects/galeria';

// EL ACENTO VIGENTE — el contrato entre la página y el motor (fila 9 del informe)
// ================================================================================================
// Antes había un solo acento para todo el recorrido: el ámbar. Ahora cada proyecto de la galería
// tiene el suyo (base.css, `.tarjeta[data-slot]`), y todo lo que no es la tarjeta —el cursor y las
// paradas de la sub-nav, el contador, los aros emisivos del motor— tiene que seguirlo.
//
// QUIÉN DECIDE Y CÓMO SE ENTERA EL RESTO. La decisión es de la página y se toma desde el reloj del
// maestro, como el tema (core/tema.ts): en GALERIA con una tarjeta delante (galeria.indice >= 0)
// manda el acento de esa tarjeta; en cualquier otro instante, el de :root. SOLO cuando cambia, y
// nunca por fotograma, se hacen dos cosas:
//   1) `--acento` se escribe en línea en <html>. La cascada lo lleva a la sub-nav, al contador y a
//      las placas del escenario CSS; la transición de 400 ms la hace el CSS sobre cada consumidor
//      (y con reduce, ninguna: base.css).
//   2) se despacha el CustomEvent 'yoi:acento' en `document`, con { detail: { color } }. El motor
//      3D (src/motor, otro carril) lo escucha y funde sus emisivos hacia ese color con el reloj del
//      navegador (~400 ms). Al montar, el motor lee --acento del estilo computado de <html> para
//      arrancar con el vigente, así que da igual si llega antes o después del primer cambio.
//
// LOS COLORES NO VIVEN AQUÍ: se leen del estilo computado de cada tarjeta (los pone base.css) y el
// de :root de <html>, una vez al montar. Así hay una sola fuente y este módulo no sabe de hex.

export interface Acento {
  actualizar(tiempo: number): void;
  /** El hex vigente, por si alguien lo necesita sin leer el DOM. */
  actual(): string;
  revertir(): void;
}

export function montarAcento(galeria: Galeria): Acento {
  const html = document.documentElement;
  const leer = (el: Element): string => getComputedStyle(el).getPropertyValue('--acento').trim();
  // El de :root. Se lee ANTES de escribir nada en línea; `revertir()` quita el inline antes de que
  // el scope vuelva a montar, así que aquí siempre se lee el de la hoja.
  const porDefecto = leer(html);
  const deTarjeta = Array.from(document.querySelectorAll<HTMLElement>('#galeria-tarjetas .tarjeta'))
    .map((t) => leer(t) || porDefecto);

  let vigente = porDefecto;
  const avisar = (color: string): void => {
    document.dispatchEvent(new CustomEvent('yoi:acento', { detail: { color } }));
  };

  return {
    actual: () => vigente,
    actualizar(tiempo) {
      const k = galeria.indice(tiempo);
      const color = k >= 0 && k < deTarjeta.length ? deTarjeta[k] : porDefecto;
      if (color === vigente) return;
      vigente = color;
      html.style.setProperty('--acento', color);
      avisar(color);
    },
    revertir() {
      html.style.removeProperty('--acento');
      if (vigente !== porDefecto) {
        vigente = porDefecto;
        avisar(porDefecto); // el motor no debe quedarse con el color de una tarjeta que ya no manda
      }
    },
  };
}
