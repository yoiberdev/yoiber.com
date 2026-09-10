import { P } from '../params';
import type { Maestro } from './maestro';
import { montarEscenario } from './escenario';
import { medirCapacidad, type Calidad, type Capacidad } from './capacidad';

// EL RELEVO DE ESCENARIO
// ================================================================================================
// Hay dos escenarios y solo uno se ve:
//   - el de CSS (core/escenario.ts): placas con perspective. No pesa nada y siempre funciona.
//   - el de WebGL (effects/motor3d.ts): el motor de cohete. Pesa ~150 kB comprimidos y solo se
//     pide con import() cuando la máquina lo aguanta.
// Los dos cumplen el mismo contrato `Escena` y los dos escriben dentro del MISMO timeline maestro.
// Ni maestro.ts ni scroller.ts saben cuál está puesto: por eso son intercambiables.
//
// Regla de oro: el escenario CSS se monta SIEMPRE y no se desmonta nunca. Cuando entra el 3D, el
// CSS se tapa (opacity 0 y luego `hidden`), pero sus animaciones siguen dentro del maestro. Por eso
// la vuelta atrás es instantánea: si se pierde el contexto WebGL a mitad de página, se destapa el
// CSS y ya está en el fotograma correcto, porque nunca dejó de seguir al reloj.

export interface Escena {
  readonly tipo: 'css' | 'webgl';
  /** Idempotente: llamarla dos veces no debe hacer nada la segunda. */
  revertir(): void;
  /** Contadores para el overlay de ?debug y para comprobar que la limpieza no deja nada. */
  info?(): Record<string, number | string | boolean>;
}

/** Lo que el trozo diferido necesita de la entrada. Todo lo demás lo construye él. */
export interface ContextoMotor {
  m: Maestro;
  /** Contenedor del lienzo, ya en el DOM y con tamaño. */
  anfitrion: HTMLElement;
  /** El reloj del maestro ahora mismo (proxy.currentTime). El trozo lo lee; nunca lo mueve. */
  tiempo: () => number;
  calidad: Calidad;
  tactil: boolean;
  /** Lo llama el 3D cuando se rinde en marcha: contexto perdido o demasiado lento. */
  rendirse: (motivo: string) => void;
}

/** Firma que exporta effects/motor3d.ts. Se importa solo como tipo: no arrastra nada al bundle. */
export type MontarMotor = (ctx: ContextoMotor) => Escena;

export interface OpcionesEscena {
  reduce: boolean;
  tiempo: () => number;
  /** Se llama cuando el trozo 3D acaba de montarse, para que quien lleva el reloj de la página lo
   *  vuelva a colocar. Colgar los ~130 hijos del motor del maestro le pone el reloj a 0 (ver el
   *  comienzo de effects/motor3d.ts); el motor repone el suyo, pero el maestro también manda sobre
   *  el hero y sobre la salida del logo, que van en OTRA librería. Esto es el tirante: main.ts hace
   *  un `colocar()` completo y las dos capas vuelven al fotograma que toca. */
  alMontarMotor?: () => void;
}

export type EstadoRelevo = 'css' | 'cargando' | 'webgl' | 'fallido';

export interface Relevo {
  capacidad: Capacidad;
  estado(): EstadoRelevo;
  info(): Record<string, number | string | boolean> | null;
  /** Pide el trozo 3D AHORA (si procede). Lo llama main.ts desde el `alTerminar` de la intro del
   *  logo: el eslabón entre las dos piezas. Idempotente y sin efecto si el 3D está descartado. */
  pedirMotor(): void;
  revertir(): void;
}

export function montarEscena(m: Maestro, op: OpcionesEscena): Relevo {
  const html = document.documentElement;
  const stage = document.querySelector<HTMLElement>('#stage');
  const anfitrion = document.querySelector<HTMLElement>('#motor');

  // 1) El reserva, siempre y primero: se añade al maestro antes de que main.ts llame a tl.init().
  const css = montarEscenario(m, op.reduce);

  const forzado = new URLSearchParams(location.search).get('motor'); // ?motor=css | ?motor=3d
  const capacidad = medirCapacidad(op.reduce);

  let estado: EstadoRelevo = 'css';
  let muerto = false;
  let pedido = false;
  /** false cuando el 3D está descartado de entrada (sin anfitrión, ?motor=css o máquina que no lo
   *  aguanta): entonces nadie puede pedirlo, tampoco el enganche de la intro del logo. */
  let enPie = false;
  let tresD: Escena | null = null;

  // Temporizadores, todos con su identificador guardado para poder cancelarlos.
  let idOcio = 0;          // requestIdleCallback, o setTimeout donde no exista
  let ocioEsTimeout = false;
  let idEspera = 0;        // espera mínima antes de mirar si hay ocio
  let idTope = 0;          // tope duro
  let idTapar = 0;         // tapar el CSS cuando termina el cruce
  let idSoltar = 0;        // soltar el 3D cuando termina el cruce de vuelta
  let idRaf = 0;
  let idVigila = 0;        // espera al primer fotograma dibujado
  /** El 3D que se está soltando tras rendirse: sigue vivo hasta que termina el cruce. */
  let soltando: Escena | null = null;

  function desarmarDisparadores(): void {
    window.clearTimeout(idEspera);
    window.clearTimeout(idTope);
    cancelAnimationFrame(idRaf);
    if (idOcio) {
      if (ocioEsTimeout) window.clearTimeout(idOcio);
      else window.cancelIdleCallback(idOcio);
      idOcio = 0;
    }
    window.removeEventListener('scroll', alBajar);
  }

  function alBajar(): void {
    if (window.scrollY > 1) pedir();
  }

  /** ¿Está el lienzo descubierto? Lo mueve `mirar()` según el reloj del maestro. */
  let telon = false;

  function subirTelon(): void {
    if (telon) return;
    telon = true;
    html.classList.add('motor-on');   // el cruce lo hace el CSS (transition de opacidad)
    window.clearTimeout(idTapar);
    // El escenario CSS se saca del árbol solo al final del cruce, y solo si el telón sigue arriba:
    // en esos 420 ms el visitante puede haber vuelto para atrás.
    idTapar = window.setTimeout(() => {
      if (!muerto && estado === 'webgl' && telon && stage) stage.hidden = true;
    }, P.motor.relevo);
  }

  function bajarTelon(): void {
    if (!telon) return;
    telon = false;
    window.clearTimeout(idTapar);
    if (stage) stage.hidden = false;   // primero se destapa, y luego se funde: nunca hay hueco negro
    html.classList.remove('motor-on');
  }

  function pedir(): void {
    if (pedido || muerto) return;
    pedido = true;
    desarmarDisparadores();
    estado = 'cargando';
    html.classList.add('motor-cargando');
    void cargar();
  }

  async function cargar(): Promise<void> {
    try {
      // ÚNICO import() dinámico del proyecto. Vite lo saca a su propio fichero bajo /assets/,
      // del mismo origen: la CSP `script-src 'self'` lo permite sin tocar nada.
      const mod = await import('../effects/motor3d');
      if (muerto || !anfitrion) return;
      tresD = mod.montarMotor({
        m, anfitrion, tiempo: op.tiempo,
        calidad: capacidad.calidad, tactil: capacidad.tactil, rendirse,
      });
      estado = 'webgl';
      html.classList.remove('motor-cargando');
      op.alMontarMotor?.();
      // NADA DE CRUZAR POR RELOJ. El cruce (que es lo que deja el escenario CSS a opacidad 0) no
      // empieza hasta que el motor ha DIBUJADO un fotograma. Si el contexto se crea pero el bucle
      // no entrega —un driver que no compone, unos sombreadores que se atascan— no salta ninguna
      // excepción, así que sin esta comprobación quedaría el CSS tapado y el lienzo vacío: la
      // página en blanco. Y si en `sinFotogramas` ms no ha salido ninguno, se vuelve al CSS.
      const desde = performance.now();
      let dibuja = false;
      const mirar = (): void => {
        if (muerto || estado !== 'webgl') return;
        if (!dibuja) {
          const f = Number(tresD?.info?.().fotogramas ?? 0);
          if (f > 0) dibuja = true;
          else if (performance.now() - desde > P.motor.sinFotogramas) {
            rendirse('sin fotogramas');
            return;
          }
        }
        // EL TELÓN VA CON EL RELOJ, Y EN LOS DOS SENTIDOS. Dibujar un fotograma es condición
        // necesaria, no suficiente: el trozo 3D llega mientras el logo flota y el visitante todavía
        // no ha bajado, y en INTRO el motor está en su estado de partida, o sea con las piezas
        // repartidas fuera de sitio. Enseñarlo ahí es poner chatarra detrás del logo. Se descubre
        // cuando el maestro entra en HERO_OUT, que es cuando el motor empieza a ensamblarse, y se
        // vuelve a tapar al volver a INTRO: quien arrastra el scroll hacia atrás desde la galería
        // tiene que encontrarse la misma intro limpia que la primera vez.
        if (dibuja) {
          const t = op.tiempo();
          if (t > m.L.HERO_OUT + P.motor.telonSube) subirTelon();
          else if (t < m.L.HERO_OUT + P.motor.telonBaja) bajarTelon();
        }
        idVigila = requestAnimationFrame(mirar);
      };
      idVigila = requestAnimationFrame(mirar);
    } catch (e) {
      // Red caída, trozo que no está, CSP, error al crear el renderizador o fallo dentro del
      // módulo: nunca se propaga. La página se queda con el escenario CSS, que no se ha movido.
      estado = 'fallido';
      html.classList.remove('motor-cargando');
      if (import.meta.env.DEV) console.warn('[motor] no se pudo montar el 3D:', e);
    }
  }

  // Vuelta atrás en caliente. El CSS sigue enganchado al maestro: basta con destaparlo.
  function rendirse(motivo: string): void {
    if (estado !== 'webgl' || muerto) return;
    estado = 'fallido';
    cancelAnimationFrame(idVigila);
    bajarTelon();
    // La instancia pendiente se guarda en el cierre y no solo en la local del temporizador: si el
    // scope se revierte dentro de esos 420 ms, el clearTimeout mataba al único que la conocía y el
    // renderizador, el lienzo y el bucle se quedaban puestos para siempre.
    soltando = tresD;
    tresD = null;
    idSoltar = window.setTimeout(() => { soltando?.revertir(); soltando = null; }, P.motor.relevo);
    if (import.meta.env.DEV) console.warn('[motor] vuelta al escenario CSS:', motivo);
  }

  let idEnganche = 0;

  const salida: Relevo = {
    capacidad,
    estado: () => estado,
    info: () => tresD?.info?.() ?? null,
    // EL ENGANCHE CON LA INTRO DEL LOGO. Un fotograma de margen: `alTerminar` se dispara desde el
    // `onComplete` de la entrada (o, con movimiento reducido, en mitad del propio montaje), y no
    // conviene arrancar ahí mismo el análisis de 610 kB de JS. Con `enPie === false` no hace nada:
    // la máquina no lleva el 3D y no hay trozo que pedir.
    pedirMotor() {
      if (muerto || pedido || !enPie) return;
      cancelAnimationFrame(idEnganche);
      idEnganche = requestAnimationFrame(() => pedir());
    },
    revertir() {
      cancelAnimationFrame(idEnganche);
      if (muerto) return;
      muerto = true;
      desarmarDisparadores();
      window.clearTimeout(idTapar);
      window.clearTimeout(idSoltar);
      cancelAnimationFrame(idVigila);
      (tresD ?? soltando)?.revertir();
      tresD = null;
      soltando = null;
      css.revertir();
      bajarTelon();
      html.classList.remove('motor-cargando');
    },
  };

  if (!anfitrion || forzado === 'css' || (!capacidad.usar3d && forzado !== '3d')) return salida;
  enPie = true;

  // 2) Cuándo se pide el trozo. QUIEN LO PIDE EN LA VIDA REAL ES EL LOGO: main.ts engancha
  //    `escena.pedirMotor()` al `alTerminar` de la intro, así que el trozo sale en cuanto las tres
  //    formas se ensamblan y mientras el logo flota esperando al visitante. Nunca antes: durante la
  //    entrada no se compite por el ancho de banda ni por el hilo principal.
  //    Lo de abajo es la RED por si ese aviso no llega (marcado sin el SVG, pestaña en segundo plano
  //    durante la entrada): dos fotogramas para dejar pasar la primera pintura, luego el suelo de
  //    P.motor.esperaMinima —que ya cae DESPUÉS de la entrada del logo—, luego el primer hueco de
  //    ocio y, si el navegador nunca está ocioso, el tope duro. Si el visitante ya está bajando, se
  //    pide en el acto: el 3D hace falta a partir de HERO_OUT.
  window.addEventListener('scroll', alBajar, { passive: true });
  if (window.scrollY > 1) {
    pedir(); // recarga a mitad de página: el 3D ya se necesita
  } else {
    idRaf = requestAnimationFrame(() => {
      idRaf = requestAnimationFrame(() => {
        idEspera = window.setTimeout(() => {
          ocioEsTimeout = !('requestIdleCallback' in window);
          idOcio = ocioEsTimeout
            ? window.setTimeout(pedir, P.motor.esperaOciosa)
            : window.requestIdleCallback(() => pedir(), { timeout: P.motor.esperaOciosa });
        }, P.motor.esperaMinima);
        idTope = window.setTimeout(pedir, P.motor.esperaMaxima);
      });
    });
  }

  return salida;
}
