import { animate } from 'animejs';
import type { Sim } from '../sim/motor';

// LA FICHA DE UN PROYECTO — <dialog id="ficha"> (09/10/2026)
// ================================================================================================
// Al tocar un proyecto se abre su ficha: a la izquierda su trabajo andando, a la derecha qué es, la
// pila, cómo está hecho, sus enlaces y el aviso. Con las flechas (de la ficha o del teclado) se pasa
// al anterior y al siguiente. El texto sale del propio marcado de
// cada proyecto (.objeto-mas), que es lo que se lee sin JavaScript: una sola fuente.
//
// QUÉ SE ENSEÑA. El medio lo dicen los data-* del .objeto:
//   · data-sim: una de las simulaciones de src/sim (Kuantera, Comandas, Contenido), que se pide
//     al abrir y se monta encima del cartel, como en las páginas de caso;
//   · data-video: la grabación (MP4, o WebM donde no hay H.264), en marco de teléfono o de navegador;
//   · data-imagen: una captura (los casos del ERP y de gestión de campo);
//   · nada: la vista del propio proyecto, agrandada (la terminal, la pantalla de Kuidy, el colibrí).
// Al cerrar o al pasar a otro, la simulación se revierte y el vídeo se suelta.

type MontarSim = (raiz: HTMLElement, opciones: { reduce: boolean }) => Sim;
// Un import por escena, escrito entero: así Vite parte cada una en su trozo.
const SIMS: Record<string, () => Promise<MontarSim>> = {
  kuantera: () => import('../sim/kuantera').then((m) => m.montarKuantera),
  comandas: () => import('../sim/comandas').then((m) => m.montarComandas),
  contenido: () => import('../sim/contenido').then((m) => m.montarContenido),
};

interface Opciones {
  reduce: boolean;
  conVideo: boolean;
  ext: string;
}

export function montarFicha(objetos: HTMLElement[], op: Opciones): () => void {
  const dialogo = document.querySelector<HTMLDialogElement>('#ficha');
  if (!dialogo || !objetos.length || typeof dialogo.showModal !== 'function') return () => undefined;
  const q = <T extends Element>(s: string): T => dialogo.querySelector<T>(s) as T;
  const marco = q<HTMLElement>('.ficha-marco');
  const medio = q<HTMLElement>('.ficha-medio');
  const titulo = q<HTMLElement>('#ficha-titulo');
  const que = q<HTMLElement>('.ficha-que');
  const pila = q<HTMLElement>('.ficha-pila');
  const detalle = q<HTMLElement>('.ficha-detalle');
  const acceso = q<HTMLElement>('.ficha-acceso');
  const aviso = q<HTMLElement>('.ficha-aviso');
  const grupo = q<HTMLElement>('.ficha-grupo');
  const cuenta = q<HTMLElement>('.ficha-cuenta');
  const texto = q<HTMLElement>('.ficha-texto');

  let actual: HTMLElement | null = null;
  let escena: Sim | null = null;
  let pedido = 0;
  let vivo = true;
  let origen: HTMLElement | null = null;

  const visibles = (): HTMLElement[] => objetos.filter((o) => !o.closest<HTMLElement>('.grupo')?.hidden);

  const soltarMedio = (): void => {
    pedido++;
    escena?.revertir();
    escena = null;
    for (const v of medio.querySelectorAll('video')) {
      v.pause();
      v.removeAttribute('src');
      v.load();
    }
    medio.replaceChildren();
  };

  const armarMedio = (o: HTMLElement): void => {
    const d = o.dataset;
    if (!d.sim && !d.video && !d.imagen) {
      // Sin grabación: la vista del proyecto, agrandada y andando.
      const vista = o.querySelector<HTMLElement>('.vista')?.cloneNode(true) as HTMLElement | undefined;
      if (!vista) return;
      vista.dataset.ancho = d.ancho ?? '2';
      vista.classList.add('en-vista');
      for (const img of vista.querySelectorAll<HTMLImageElement>('img[data-src]')) img.src = img.dataset.src ?? '';
      medio.append(vista);
      return;
    }
    const vitrina = document.createElement('div');
    vitrina.className = 'vitrina';
    vitrina.dataset.marco = d.marco ?? 'navegador';
    vitrina.style.setProperty('--proporcion', d.proporcion ?? '16 / 10');
    if (vitrina.dataset.marco === 'navegador') {
      const barra = document.createElement('span');
      barra.className = 'vitrina-barra';
      barra.setAttribute('aria-hidden', 'true');
      barra.innerHTML = '<i></i><i></i><i></i>';
      const url = document.createElement('span');
      url.className = 'vitrina-url';
      url.textContent = d.url ?? '';
      barra.append(url);
      vitrina.append(barra);
    }
    const m = document.createElement('span');
    m.className = 'vitrina-medio';
    const cartel = document.createElement('img');
    cartel.className = 'vitrina-cartel';
    cartel.alt = '';
    cartel.decoding = 'async';
    cartel.src = d.cartel ?? d.imagen ?? '';
    m.append(cartel);
    if (d.video && op.conVideo) {
      const video = document.createElement('video');
      video.className = 'vitrina-video';
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('aria-hidden', 'true');
      video.addEventListener('loadeddata', () => video.classList.add('lista'), { once: true });
      video.src = `${d.video}.${op.ext}`;
      m.append(video);
      video.play().catch(() => undefined);
    }
    vitrina.append(m);
    medio.append(vitrina);
    const cargar = d.sim ? SIMS[d.sim] : undefined;
    if (cargar) {
      const n = pedido;
      cargar()
        .then((montar) => {
          if (!vivo || n !== pedido) return;
          const capa = document.createElement('div');
          m.classList.add('con-sim');
          m.append(capa);
          escena = montar(capa, { reduce: op.reduce });
          escena.reiniciar();
          escena.reproducir();
        })
        .catch(() => undefined); // sin el trozo se queda el cartel, que dice lo mismo quieto
    }
  };

  const llenar = (o: HTMLElement): void => {
    actual = o;
    const mas = o.querySelector<HTMLElement>('.objeto-mas');
    dialogo.style.setProperty('--acento', o.style.getPropertyValue('--acento'));
    titulo.textContent = o.querySelector('h3')?.textContent ?? '';
    que.textContent = mas?.querySelector('.larga')?.textContent ?? '';
    pila.textContent = o.querySelector('.pila')?.textContent ?? '';
    detalle.textContent = mas?.querySelector('.detalle')?.textContent ?? '';
    // Los enlaces, sin los « · » que los separan en el marcado: en la ficha son botones.
    acceso.replaceChildren(...Array.from(mas?.querySelectorAll('.acceso a') ?? []).map((a) => a.cloneNode(true)));
    aviso.innerHTML = mas?.querySelector('.aviso')?.innerHTML ?? '';
    grupo.textContent = o.closest('.grupo')?.querySelector('.grupo-titulo span')?.textContent ?? '';
    const lista = visibles();
    cuenta.textContent = `${lista.indexOf(o) + 1} / ${lista.length}`;
    texto.scrollTop = 0;
    soltarMedio();
    armarMedio(o);
  };

  const pasar = (paso: number): void => {
    const lista = visibles();
    if (!actual || lista.length < 2) return;
    const i = (lista.indexOf(actual) + paso + lista.length) % lista.length;
    llenar(lista[i]);
    if (!op.reduce) animate([medio, texto], { opacity: [0, 1], x: [paso * 18, 0], duration: 420, ease: 'out(3)' });
  };

  const abrir = (o: HTMLElement): void => {
    origen = o.querySelector<HTMLElement>('.objeto-abrir');
    llenar(o);
    dialogo.showModal();
    if (!op.reduce) animate(marco, { opacity: [0, 1], scale: [0.97, 1], y: [16, 0], duration: 460, ease: 'out(4)' });
  };

  const alCerrar = (): void => {
    // El evento `close` llega en una tarea aparte: si para entonces la ficha ya se volvió a abrir
    // con otro proyecto, no hay nada que soltar.
    if (dialogo.open) return;
    soltarMedio();
    actual = null;
    origen?.focus();
  };

  const alClic = (ev: Event): void => {
    const b = (ev.target as Element | null)?.closest<HTMLElement>('.objeto-abrir');
    const o = b?.closest<HTMLElement>('.objeto');
    if (o) abrir(o);
  };
  const alTecla = (ev: KeyboardEvent): void => {
    if (!dialogo.open) return;
    if (ev.key === 'ArrowRight') { ev.preventDefault(); pasar(1); }
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); pasar(-1); }
  };
  // Un clic en el fondo (fuera del marco) cierra, como en cualquier ventana de este tipo.
  const alClicDialogo = (ev: MouseEvent): void => {
    if (ev.target === dialogo) dialogo.close();
  };
  const ant = q<HTMLButtonElement>('.ficha-ant');
  const sig = q<HTMLButtonElement>('.ficha-sig');
  const cerrar = q<HTMLButtonElement>('.ficha-cerrar');
  const irAnt = (): void => pasar(-1);
  const irSig = (): void => pasar(1);
  const irCerrar = (): void => dialogo.close();

  const seccion = document.querySelector<HTMLElement>('#proyectos');
  seccion?.addEventListener('click', alClic);
  dialogo.addEventListener('keydown', alTecla);
  dialogo.addEventListener('click', alClicDialogo);
  dialogo.addEventListener('close', alCerrar);
  ant.addEventListener('click', irAnt);
  sig.addEventListener('click', irSig);
  cerrar.addEventListener('click', irCerrar);

  return () => {
    vivo = false;
    seccion?.removeEventListener('click', alClic);
    dialogo.removeEventListener('keydown', alTecla);
    dialogo.removeEventListener('click', alClicDialogo);
    dialogo.removeEventListener('close', alCerrar);
    ant.removeEventListener('click', irAnt);
    sig.removeEventListener('click', irSig);
    cerrar.removeEventListener('click', irCerrar);
    if (dialogo.open) dialogo.close();
    soltarMedio();
  };
}
