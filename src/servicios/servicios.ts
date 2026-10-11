import '@fontsource-variable/instrument-sans';
import '@fontsource/fragment-mono';
import '../styles/pagina.css';
import { sugerirIdioma } from '../comun/idioma';

// SERVICIOS Y PRECIOS (servicios/index.html y en/services/index.html)
// ================================================================================================
// Una página de texto como las de los casos, sin motor 3D ni maestro. La pieza es la boleta: un
// presupuesto en papel térmico que sale de la ticketera al entrar. Cada precio enlaza al contacto con
// `?sobre=` (o `?about=`), y contacto.ts escribe con eso el comienzo del mensaje.
//
// Lo que hace este módulo, y nada más:
//   · la fecha de la boleta, la de hoy en Lima, en el idioma de la página;
//   · la impresión: la clase `imprime` arranca la animación (sin JavaScript la boleta se ve entera
//     y quieta, que es su estado final);
//   · el camino de los cuatro pasos se dibuja cuando llega a la vista.

const lang = (document.documentElement.lang || 'es').slice(0, 2);

const fecha = document.querySelector<HTMLElement>('[data-fecha]');
if (fecha) {
  const hoy = new Intl.DateTimeFormat(lang === 'es' ? 'es-PE' : 'en-US', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
  fecha.textContent = `${fecha.dataset.fecha}: ${hoy}`;
}

const ticketera = document.querySelector<HTMLElement>('.ticketera');
const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (ticketera) {
  if (quieto) ticketera.classList.add('impresa');
  else {
    ticketera.classList.add('imprime');
    // Tocar la ranura vuelve a imprimir: es un detalle para quien juega con la página.
    ticketera.querySelector('.ranura')?.addEventListener('click', () => {
      ticketera.classList.remove('imprime');
      void ticketera.offsetWidth;
      ticketera.classList.add('imprime');
    });
  }
}

const camino = document.querySelector<HTMLElement>('.camino');
if (camino) {
  if (quieto || !('IntersectionObserver' in window)) camino.classList.add('visto');
  else {
    const vigia = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          camino.classList.add('visto');
          vigia.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    vigia.observe(camino);
  }
}

sugerirIdioma();
