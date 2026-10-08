import { createTimeline, createTimer, type Timeline, type Timer } from 'animejs';
import './sim.css';

// EL MOTOR DE LAS SIMULACIONES — guías animadas de un producto, con datos inventados
// ================================================================================================
// Nació el 27/09/2026 para enseñar en la galería dos proyectos que no se pueden grabar tal cual
// (las cámaras de los barcos son de un cliente; las automatizaciones pasan en tres aplicaciones a la
// vez). La idea es la de las guías del ERP del centro de terapias: una pantalla dibujada, un puntero
// que toca, la cámara que se acerca y un rótulo numerado que cuenta el paso. Aquí sin capturas: la
// pantalla es HTML y SVG propios, así que se ve nítida a cualquier tamaño y densidad.
//
// UN SOLO RELOJ POR ESCENA. Una timeline de duración fija (`duracion`) que NO hace el bucle ella
// misma: la mueve `reloj`, un createTimer en bucle que en cada fotograma hace `tl.seek(t)`. Con
// `loop: true` en la timeline, al volver a empezar Anime.js no devolvía a su estado de partida las
// piezas que habían cambiado varias veces (medido el 27/09/2026 en Kuantera: dos segundos después
// de reiniciar seguían a la vista la boleta emitida y el ticket, con el puntero haciendo el login
// por debajo). Un seek hacia atrás sí lo hace, en cualquier dirección: es el mismo modelo que el
// maestro de la página, donde subir con el scroll deshace todo. Dentro de la timeline:
//   · lo CONTINUO (puntero, cámara, fundidos, trazos) son hijos de la timeline con [desde, hasta]
//     explícitos en las dos puntas y `composition: 'none'`, el mismo contrato que el maestro de la
//     página: se puede saltar a cualquier instante y hacia atrás y el fotograma sale igual;
//   · lo DISCRETO (el texto del rótulo, las cifras, lo tecleado, las clases de estado) lo escribe
//     `pintar(t)` en el onRender de la timeline, como función pura del instante de la vuelta. Así el
//     bucle, la pausa y el salto a un paso no dejan estados a medias.
//
// EL TAMAÑO. La escena se diseña a 1000 px de ancho y todo va en `em`: la raíz lleva
// `font-size: 1.6cqw` sobre su contenedor, así que 1 em son 16 px de diseño a cualquier tamaño. Las
// posiciones del puntero se miden UNA vez, en % de la escena y con la cámara quieta: como todo
// escala junto, el % no cambia al redimensionar.

export interface Paso {
  /** Instante de la vuelta (ms) en que el rótulo pasa a este paso. */
  t: number;
  texto: string;
}

export interface OpcionesSim {
  reduce: boolean;
  /** En una página de caso: la fila de pasos pulsables, pausa y «otra vez» va DESPUÉS de este
   *  elemento (el marco de la escena recorta lo que tiene dentro). */
  guia?: HTMLElement;
}

export interface Sim {
  reproducir(): void;
  pausar(): void;
  /** Vuelve al principio de la vuelta (al entrar la tarjeta: la historia se entiende desde el 1). */
  reiniciar(): void;
  /** Coloca la vuelta en el instante `t` (ms) sin cambiar si anda o no: pasos de la guía y QA. */
  irA(t: number): void;
  revertir(): void;
}

interface Punto { x: number; y: number }

/** Una posición: un elemento de la escena (se mide su centro) o un punto en % de la escena. */
export type Destino = Element | Punto;

export class Escena {
  readonly raiz: HTMLElement;
  readonly camara: HTMLElement;
  readonly puntero: HTMLElement;
  readonly tl: Timeline;
  /** El que anda: un temporizador en bucle que coloca la timeline con seek (ver arriba). */
  readonly reloj: Timer;
  readonly duracion: number;
  private readonly onda: HTMLElement;
  private readonly notaN: HTMLElement;
  private readonly notaT: HTMLElement;
  private readonly puntos: HTMLElement[] = [];
  private pasos: Paso[] = [];
  private donde: Punto;
  private pintores: ((t: number) => void)[] = [];
  private pasoPintado = -2;
  private alCambiarPaso: ((i: number) => void) | null = null;

  constructor(raiz: HTMLElement, duracion: number, opciones: { inicio: Punto; tactil?: boolean }) {
    this.raiz = raiz;
    this.duracion = duracion;
    this.camara = raiz.querySelector<HTMLElement>('.sim-camara') ?? raiz;
    // El puntero y la onda del toque van DENTRO de la cámara: al acercarse, se acercan con lo que tocan.
    this.puntero = document.createElement('span');
    this.puntero.className = opciones.tactil ? 'sim-puntero sim-dedo' : 'sim-puntero';
    this.puntero.setAttribute('aria-hidden', 'true');
    if (!opciones.tactil) {
      this.puntero.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 2.5 L4 19.5 L8.6 15.4 L11.6 22 L14.6 20.7 L11.7 14.2 L18 14.2 Z" /></svg>';
    }
    this.onda = document.createElement('span');
    this.onda.className = 'sim-onda';
    this.onda.setAttribute('aria-hidden', 'true');
    this.camara.append(this.onda, this.puntero);
    // El rótulo del paso, FUERA de la cámara: no escala con el acercamiento y siempre se lee.
    const nota = document.createElement('p');
    nota.className = 'sim-nota';
    nota.innerHTML = '<span class="sim-nota-n"></span><span class="sim-nota-t"></span><span class="sim-nota-puntos"></span>';
    raiz.append(nota);
    this.notaN = nota.querySelector<HTMLElement>('.sim-nota-n')!;
    this.notaT = nota.querySelector<HTMLElement>('.sim-nota-t')!;
    this.donde = opciones.inicio;
    this.tl = createTimeline({
      autoplay: false,
      defaults: { composition: 'none', ease: 'inOut(2)' },
      onRender: (self) => this.pintar(self.currentTime),
    });
    this.reloj = createTimer({
      duration: duracion,
      loop: true,
      autoplay: false,
      onUpdate: (self) => { this.tl.seek(self.iterationCurrentTime); },
    });
    // La duración de la vuelta la fija un tween que la ocupa entera: el bucle es de `duracion` exacta
    // aunque el último gesto acabe antes.
    const marca = { v: 0 };
    this.tl.add(marca, { v: [0, 1], duration: duracion, ease: 'linear' }, 0);
    this.tl.set(this.puntero, { left: `${this.donde.x}%`, top: `${this.donde.y}%`, scale: 1 }, 0);
    this.tl.set(this.onda, { left: '0%', top: '0%', scale: 0.2, opacity: 0 }, 0);
    this.tl.set(this.camara, { x: '0%', y: '0%', scale: 1 }, 0);
  }

  /** Centro de un elemento en % de la escena. Se llama al construir, con la cámara quieta. */
  pos(d: Destino): Punto {
    if (!(d instanceof Element)) return d;
    const s = this.raiz.getBoundingClientRect();
    const r = d.getBoundingClientRect();
    if (s.width <= 0 || s.height <= 0) return this.donde;
    return { x: ((r.left + r.width / 2 - s.left) / s.width) * 100, y: ((r.top + r.height / 2 - s.top) / s.height) * 100 };
  }

  /** La caja de un elemento en fracciones de la escena. */
  caja(el: Element): { x: number; y: number; w: number; h: number } {
    const s = this.raiz.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: (r.left - s.left) / s.width, y: (r.top - s.top) / s.height, w: r.width / s.width, h: r.height / s.height };
  }

  /** El puntero va a `d` empezando en `t`. Dos curvas distintas en x y en y: el trazo sale curvo. */
  ir(d: Destino, t: number, dur = 900): this {
    const a = this.donde;
    const b = this.pos(d);
    this.tl
      .add(this.puntero, { left: [`${a.x}%`, `${b.x}%`], duration: dur, ease: 'inOut(3)' }, t)
      .add(this.puntero, { top: [`${a.y}%`, `${b.y}%`], duration: dur, ease: 'inOut(2)' }, t);
    this.donde = b;
    return this;
  }

  /** Un toque donde esté el puntero: se hunde un poco y sale una onda. */
  clic(t: number): this {
    const p = this.donde;
    this.tl
      .add(this.puntero, { scale: [1, 0.82], duration: 110, ease: 'out(2)' }, t)
      .add(this.puntero, { scale: [0.82, 1], duration: 220, ease: 'out(2)' }, t + 110)
      .set(this.onda, { left: `${p.x}%`, top: `${p.y}%` }, t)
      .add(this.onda, { scale: [0.2, 1.7], opacity: [0.55, 0], duration: 560, ease: 'out(3)' }, t);
    return this;
  }

  /** La cámara encuadra `el` a `escala` aumentos en `dur` ms desde `t`; `null` vuelve al plano entero. */
  enfocar(el: Element | null, escala: number, t: number, dur = 1000, desde?: { x: number; y: number; s: number }): { x: number; y: number; s: number } {
    const a = desde ?? { x: 0, y: 0, s: 1 };
    let b = { x: 0, y: 0, s: 1 };
    if (el) {
      const c = this.caja(el);
      const s = escala;
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      // Origen arriba a la izquierda: el punto c acaba en c·s + t; se quiere en el centro (0,5) sin
      // enseñar lo que hay fuera de la escena, o sea t entre 1 − s y 0.
      const tx = Math.min(0, Math.max(1 - s, 0.5 - cx * s));
      const ty = Math.min(0, Math.max(1 - s, 0.5 - cy * s));
      b = { x: tx * 100, y: ty * 100, s };
    }
    this.tl.add(this.camara, { x: [`${a.x}%`, `${b.x}%`], y: [`${a.y}%`, `${b.y}%`], scale: [a.s, b.s], duration: dur, ease: 'inOut(3)' }, t);
    return b;
  }

  /** Los pasos del rótulo, en orden. El último `t` más allá de la vuelta no se pinta nunca. */
  guion(pasos: Paso[], apagar: number): this {
    this.pasos = pasos;
    const puntos = this.raiz.querySelector<HTMLElement>('.sim-nota-puntos');
    if (puntos) {
      puntos.replaceChildren();
      for (let i = 0; i < pasos.length; i++) {
        const p = document.createElement('i');
        puntos.append(p);
        this.puntos.push(p);
      }
    }
    const nota = this.raiz.querySelector<HTMLElement>('.sim-nota');
    if (nota) {
      this.tl.set(nota, { opacity: 0, y: '0.6em' }, 0)
        .add(nota, { opacity: [0, 1], y: ['0.6em', '0em'], duration: 420, ease: 'out(3)' }, pasos[0]?.t ?? 0)
        .add(nota, { opacity: [1, 0], y: ['0em', '0.6em'], duration: 380, ease: 'in(2)' }, apagar);
    }
    return this;
  }

  /** Lo discreto: `fn(t)` se llama en cada render con el instante de la vuelta. */
  alPintar(fn: (t: number) => void): this {
    this.pintores.push(fn);
    return this;
  }

  /** Aviso al cambiar de paso (la fila de pasos de la guía). */
  siguePaso(fn: (i: number) => void): void {
    this.alCambiarPaso = fn;
  }

  pasoEn(t: number): number {
    let i = -1;
    for (let k = 0; k < this.pasos.length; k++) if (this.pasos[k].t <= t) i = k;
    return i;
  }

  instanteDe(i: number): number {
    return this.pasos[i]?.t ?? 0;
  }

  get totalPasos(): number {
    return this.pasos.length;
  }

  textoPaso(i: number): string {
    return this.pasos[i]?.texto ?? '';
  }

  private pintar(t: number): void {
    const i = this.pasoEn(t);
    if (i !== this.pasoPintado) {
      this.pasoPintado = i;
      const p = this.pasos[Math.max(0, i)];
      this.notaN.textContent = String(Math.max(0, i) + 1);
      this.notaT.textContent = p?.texto ?? '';
      this.puntos.forEach((el, k) => el.classList.toggle('hecho', k <= i));
      this.alCambiarPaso?.(i);
    }
    for (const fn of this.pintores) fn(t);
  }
}

// ------------------------------------------------------------------------------------------------
// Ayudas de lo discreto: piezas de `pintar(t)` que se repiten en las escenas.

/** Interpolación por tramos: `claves` son pares [instante, valor] en orden. */
export function tramos(t: number, claves: [number, number][]): number {
  if (!claves.length) return 0;
  if (t <= claves[0][0]) return claves[0][1];
  for (let k = 1; k < claves.length; k++) {
    const [t1, v1] = claves[k];
    const [t0, v0] = claves[k - 1];
    if (t <= t1) return v0 + (v1 - v0) * ((t - t0) / Math.max(1, t1 - t0));
  }
  return claves[claves.length - 1][1];
}

/** Lo tecleado en `el` entre `t0` y `t1` (y borrado al volver al principio de la vuelta). */
export function teclear(el: HTMLElement, texto: string, t: number, t0: number, t1: number): void {
  const n = t <= t0 ? 0 : t >= t1 ? texto.length : Math.round(((t - t0) / (t1 - t0)) * texto.length);
  const s = texto.slice(0, n);
  if (el.textContent !== s) el.textContent = s;
}

/** Escribe `texto` en `el` solo si cambia (el render corre a 60 por segundo). */
export function escribir(el: Element | null, texto: string): void {
  if (el && el.textContent !== texto) el.textContent = texto;
}

/** Clase de estado según el instante: la primera ventana [desde, hasta) que contenga `t`. */
export function estado(el: Element | null, t: number, ventanas: [number, number, string][], clases: string[]): void {
  if (!el) return;
  const toca = ventanas.find(([a, b]) => t >= a && t < b)?.[2] ?? '';
  for (const c of clases) el.classList.toggle(c, c === toca);
}

// ------------------------------------------------------------------------------------------------
// El montaje común: reproducción, movimiento reducido y la guía de las páginas de caso.

export function envolver(escena: Escena, opciones: OpcionesSim, tReducido: number): Sim {
  const { tl, raiz } = escena;
  tl.init();
  raiz.classList.add('sim-lista');
  let pausada = true;
  // `.corriendo` deja andar los bucles de ambiente en CSS (olas, parpadeos): con la escena en pausa
  // se congelan con ella.
  const reloj = escena.reloj;
  const marcha = (p: boolean): void => {
    pausada = p;
    raiz.classList.toggle('corriendo', !p);
    if (p) reloj.pause(); else reloj.resume();
  };
  // Colocar la vuelta en un instante: el reloj y la timeline a la vez (un seek del reloj en pausa
  // no garantiza que pase por su onUpdate).
  const colocar = (t: number): void => {
    const x = Math.max(0, Math.min(escena.duracion - 1, t));
    reloj.seek(x);
    tl.seek(x);
  };
  // Con movimiento reducido no hay bucle: la escena se queda quieta en su instante más explicativo,
  // sin puntero.
  if (opciones.reduce) {
    raiz.classList.add('sim-quieta');
    colocar(tReducido);
  }
  let quitarGuia: (() => void) | null = null;
  if (opciones.guia) [, quitarGuia] = montarGuia(escena, opciones.guia, opciones.reduce, () => pausada, marcha, colocar);
  return {
    reproducir() {
      if (opciones.reduce) return;
      marcha(false);
    },
    pausar() {
      marcha(true);
    },
    reiniciar() {
      if (opciones.reduce) return;
      colocar(0);
    },
    irA(t) {
      colocar(t);
    },
    revertir() {
      reloj.revert();
      tl.revert();
      quitarGuia?.();
      raiz.classList.remove('sim-lista', 'sim-quieta', 'corriendo');
    },
  };
}

/** La fila de la guía: un botón por paso (salta a su instante), pausa y «otra vez». */
function montarGuia(escena: Escena, tras: HTMLElement, reduce: boolean, pausada: () => boolean, fijar: (p: boolean) => void, colocar: (t: number) => void): [HTMLElement, () => void] {
  const fila = document.createElement('div');
  fila.className = 'sim-guia';
  const lista = document.createElement('ol');
  lista.className = 'sim-guia-pasos';
  const botones: HTMLButtonElement[] = [];
  for (let i = 0; i < escena.totalPasos; i++) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span class="n">${i + 1}</span><span class="t"></span>`;
    b.querySelector('.t')!.textContent = escena.textoPaso(i);
    b.addEventListener('click', () => {
      colocar(escena.instanteDe(i) + 1);
      if (reduce) return;
      fijar(false);
      alternar.textContent = 'Pausar';
    });
    li.append(b);
    lista.append(li);
    botones.push(b);
  }
  const mandos = document.createElement('div');
  mandos.className = 'sim-guia-mandos';
  const alternar = document.createElement('button');
  alternar.type = 'button';
  alternar.textContent = 'Pausar';
  alternar.addEventListener('click', () => {
    const p = !pausada();
    fijar(p);
    alternar.textContent = p ? 'Seguir' : 'Pausar';
  });
  const otra = document.createElement('button');
  otra.type = 'button';
  otra.textContent = 'Otra vez';
  otra.addEventListener('click', () => {
    colocar(0);
    if (reduce) return;
    fijar(false);
    alternar.textContent = 'Pausar';
  });
  if (!reduce) mandos.append(alternar);
  mandos.append(otra);
  fila.append(lista, mandos);
  tras.after(fila);
  escena.siguePaso((i) => botones.forEach((b, k) => b.setAttribute('aria-current', k === i ? 'step' : 'false')));
  return [fila, () => fila.remove()];
}
