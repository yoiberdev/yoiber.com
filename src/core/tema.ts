import { P } from '../params';
import type { Maestro } from './maestro';

// Tema claro mientras el maestro está dentro de un tramo marcado con data-theme="light".
// Se decide desde el tiempo del maestro (coherente con el scrub) y la transición la hace el CSS (html.is-light).
export interface Tema { actualizar(tiempo: number): void; revertir(): void }

export function montarTema(m: Maestro): Tema {
  const html = document.documentElement;
  const claros = Array.from(document.querySelectorAll<HTMLElement>('section[data-theme="light"]'))
    .map((s) => s.dataset.label ?? '')
    .filter((X) => X in m.L)
    .map((X) => ({ ini: m.L[X] + P.tema.margen, fin: m.L[`${X}_END`] - P.tema.margen })); // margen para que el cambio caiga dentro del tramo
  let claro = false;
  return {
    actualizar(tiempo) {
      const dentro = claros.some((c) => tiempo >= c.ini && tiempo < c.fin);
      if (dentro !== claro) {
        claro = dentro;
        html.classList.toggle('is-light', claro);
      }
    },
    revertir() {
      html.classList.remove('is-light');
    },
  };
}
