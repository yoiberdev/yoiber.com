import * as THREE from 'three';
import { PM } from '../params-motor';
import type { Rig } from './rig';
import type { Estado } from './coreografia';

// RÓTULOS Y GUÍAS DEL DESPIECE
// ===============================================================================================
// Cada rótulo es HTML normal (un <div> con título y nota) anclado a un punto 3D de su pieza.
// El punto se proyecta a mano con `camera.project()`; NO se usa CSS2DRenderer. El porqué, medido:
//   · CSS2DRenderer coloca el elemento EN el punto proyectado. Aquí los rótulos no van sobre la
//     pieza: van en dos columnas fijas, a izquierda y derecha, con una guía en codo que los une.
//     O sea, de CSS2DRenderer solo aprovecharíamos la proyección.
//   · Y la proyección hace falta igual para dibujar la guía, porque el extremo de la línea es el
//     píxel del ancla. CSS2DRenderer la calcula por dentro y no la devuelve: habría que proyectar
//     otra vez. Serían los dos cálculos, más un `render()` extra por frame, más el peso del addon.
//   · Peso medido en este servidor (ver el informe): el addon suma al trozo 3D lo que suma, y este
//     fichero entero cuesta menos.
// El precio: colocar los rótulos es cosa nuestra. Se resuelve con ranuras fijas, que además evita
// el problema de verdad de los rótulos 3D: que se solapen al girar.
//
// REVERSIBILIDAD: este módulo no tiene memoria. Cada frame lee `estado.rotulos[i].t` (0..1, lo mueve
// la timeline maestra) y repinta. No hay transiciones CSS ni clases que se peguen: al arrastrar
// hacia atrás la guía se "des-dibuja" por el mismo camino.

export interface Rotulos {
  aplicar(): void;
  medir(): void;
  revertir(): void;
}

const NS = 'http://www.w3.org/2000/svg';

// LAS COTAS. Cada rótulo abre con una cifra que NO se escribe: cuenta desde cero mientras el texto
// entra. Es el gesto que animejs.com hace con `utils.roundPad` durante su despiece (tabla 2.2 de
// CANALES-ANIMEJS.md) y aquí sale gratis, porque la cifra es función pura de `t`: al arrastrar
// hacia arriba descuenta sola y vuelve a cero sin estado propio que deshacer.
//
// El separador de millares y el relleno son U+2007 (ESPACIO DE CIFRA), que mide exactamente lo
// mismo que un dígito. Con eso y `tabular-nums` la caja de la cifra mide LO MISMO en todos los
// valores del recorrido: sin esto, "7" -> "36 000" empuja el texto de al lado seis veces por
// segundo y la línea entera tiembla mientras cuenta. También hace que medirTextos() pueda medir el
// rótulo con la cifra a cero y acertar el ancho final.
const FIG = '\u2007';

function cifra(v: number, dec: number): string {
  const s = v.toFixed(dec).replace('.', ',');
  const c = s.indexOf(',');
  const ent = c < 0 ? s : s.slice(0, c);
  return ent.replace(/\B(?=(\d{3})+(?!\d))/g, FIG) + (c < 0 ? '' : s.slice(c));
}

export function montarRotulos(rig: Rig, estado: Estado, host: HTMLElement): Rotulos {
  const capa = document.createElement('div');
  capa.className = 'motor-rotulos';
  capa.setAttribute('aria-hidden', 'true');
  capa.hidden = true;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'motor-guias');
  svg.setAttribute('preserveAspectRatio', 'none');
  capa.append(svg);

  const cajas: HTMLElement[] = [];
  const titulos: HTMLElement[] = [];
  const cotas: ({ el: HTMLElement; valor: number; dec: number; ancho: number } | null)[] = [];
  const lineas: SVGPolylineElement[] = [];
  const puntos: SVGCircleElement[] = [];
  // Dos repartos de ranuras: el completo (nueve rótulos, en DOS LISTAS: la de la izquierda cuelga
  // de PM.rotulos.listaAlta y la de la derecha sube desde listaBaja) y el compacto (cuatro, en dos
  // bandas). En una pantalla estrecha nueve títulos en dos columnas se comen el objeto —
  // comprobado en captura de 390 px.
  const ranura: number[] = [];
  const ranuraCompacta: number[] = [];
  let nIzq = 0;
  let nDer = 0;
  let nCompacto = 0;
  let compacto = false;

  for (const pieza of rig.piezas) {
    const caja = document.createElement('div');
    caja.className = `motor-rotulo lado-${pieza.lado < 0 ? 'izq' : 'der'}`;
    const t = document.createElement('b');
    t.textContent = pieza.titulo;
    const n = document.createElement('span');
    if (pieza.cota) {
      const c = document.createElement('i');
      const [valor, dec] = pieza.cota;
      const ancho = cifra(valor, dec).length;
      c.textContent = FIG.repeat(Math.max(0, ancho - cifra(0, dec).length)) + cifra(0, dec);
      n.append(c, ` ${pieza.nota}`);
      cotas.push({ el: c, valor, dec, ancho });
    } else {
      n.textContent = pieza.nota;
      cotas.push(null);
    }
    caja.append(t, n);
    capa.append(caja);
    cajas.push(caja);
    titulos.push(t);

    const linea = document.createElementNS(NS, 'polyline');
    const punto = document.createElementNS(NS, 'circle');
    punto.setAttribute('r', '0');
    svg.append(linea, punto);
    lineas.push(linea);
    puntos.push(punto);
    ranura.push(pieza.lado < 0 ? nIzq++ : nDer++);
    // en compacto es UNA sola secuencia: las tres primeras a la banda de arriba, las otras tres
    // a la de abajo. El lado deja de importar porque no hay columnas laterales.
    ranuraCompacta.push(pieza.movil ? nCompacto++ : -1);
  }
  host.append(capa);
  // cuántas ranuras compactas van en la banda de arriba (el resto, abajo)
  const mitad = Math.min(PM.rotulos.enBandaAlta, nCompacto);

  const v = new THREE.Vector3();
  let ancho = 1;
  let alto = 1;
  let visible = false;
  // Cachés: escribir en el DOM solo cuando el valor cambia de verdad ahorra la mitad de las
  // escrituras durante el parallax, donde muchos rótulos están quietos en su ranura.
  const ultimo = rig.piezas.map(() => ({ pts: '', tr: '', op: '', r: '', og: '', ct: '' }));

  // EL TEXTO MÁS ANCHO DE CADA GRUPO, en px: en compacto el <b> más ancho de cada banda (0 = alta,
  // 1 = baja); en columnas la caja más ancha (título y nota) de cada lista (0 = izquierda, 1 =
  // derecha). Ahí arranca el codo de sus guías (ver PM.rotulos.aireCodo / codoLista): es la única
  // manera de que la diagonal nazca FUERA de todo el texto del grupo, y en las listas es lo que
  // deja la guía en tres puntos y corta (fila 22 del informe BRECHA: de 600 px a menos de 250).
  // Se lee del DOM cuando la capa se destapa —con [hidden] los rects son 0x0— y al redimensionar
  // estando abierta; nueve rects, dos veces por visita al capítulo.
  const anchoTexto = [0, 0];
  function medirTextos(): void {
    if (capa.hidden) return;
    anchoTexto[0] = anchoTexto[1] = 0;
    for (let i = 0; i < titulos.length; i++) {
      if (compacto) {
        const r = ranuraCompacta[i];
        if (r < 0) continue;
        const w = titulos[i].getBoundingClientRect().width;
        const b = r < mitad ? 0 : 1;
        if (w > anchoTexto[b]) anchoTexto[b] = w;
      } else {
        const w = cajas[i].getBoundingClientRect().width;
        const b = rig.piezas[i].lado < 0 ? 0 : 1;
        if (w > anchoTexto[b]) anchoTexto[b] = w;
      }
    }
  }

  // Lecturas de layout de todo el módulo: esta, al redimensionar, y medirTextos() al destaparse.
  function medir(): void {
    const r = host.getBoundingClientRect();
    ancho = Math.max(1, r.width);
    alto = Math.max(1, r.height);
    compacto = ancho < PM.rotulos.anchoCompacto;
    capa.classList.toggle('compacto', compacto);
    svg.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);
    medirTextos();
  }
  medir();

  function aplicar(): void {
    let algo = false;
    for (let i = 0; i < estado.rotulos.length; i++) {
      if (estado.rotulos[i].t > 0.001) { algo = true; break; }
    }
    if (!algo) {
      if (visible) { capa.hidden = true; visible = false; }
      return;
    }
    if (!visible) { capa.hidden = false; visible = true; medirTextos(); }

    for (let i = 0; i < rig.piezas.length; i++) {
      const pieza = rig.piezas[i];
      const ranuraI = compacto ? ranuraCompacta[i] : ranura[i];
      const t = ranuraI < 0 ? 0 : estado.rotulos[i].t;
      const u = ultimo[i];
      if (t <= 0.001) {
        if (u.op !== '0') { cajas[i].style.opacity = u.op = '0'; }
        if (u.pts !== '') { lineas[i].setAttribute('points', u.pts = ''); }
        if (u.r !== '0') { puntos[i].setAttribute('r', u.r = '0'); }
        if (u.og !== '0.00') { lineas[i].style.opacity = u.og = '0.00'; puntos[i].style.opacity = '0.00'; }
        continue;
      }

      // 1) el ancla de la pieza: local -> mundo -> clip -> píxel.
      //    localToWorld() usa la matriz del objeto, que Three actualiza en el render anterior;
      //    como este módulo corre justo ANTES de render(), la matriz es la del frame actual
      //    salvo el primer frame. Para no arrastrar un frame de retraso, se fuerza la matriz
      //    de la rama que nos interesa (8 piezas, no la escena entera).
      //    En compacto la pieza puede llevar OTRA ancla (PM.piezas, anclaMovil): las guías de la
      //    banda alta bajan hacia la derecha y solo no se cruzan con las anclas en ese flanco.
      pieza.obj.updateWorldMatrix(true, false);
      v.copy(compacto && pieza.anclaMovil ? pieza.anclaMovil : pieza.ancla).applyMatrix4(pieza.obj.matrixWorld).project(rig.camara);
      const ax = (v.x * 0.5 + 0.5) * ancho;
      const ay = (-v.y * 0.5 + 0.5) * alto;

      // 2) la ranura fija. En ancho normal, dos LISTAS: la izquierda cuelga de `listaAlta` hacia
      //    abajo y la derecha sube desde `listaBaja`, las dos con paso `alto` (ver PM.rotulos);
      //    en compacto, dos bandas (arriba y abajo) con todo el texto pegado a la izquierda.
      // En compacto el LADO lo pone la banda, no la pieza: la de arriba a la izquierda y la de
      // abajo a la derecha. (Se decidió cuando el rótulo de capítulo vivía abajo a la izquierda;
      // hoy el titular va arriba a la derecha en compacto, y las bandas se han dejado como estaban.)
      const lado = compacto ? (ranuraI < mitad ? -1 : 1) : pieza.lado;
      const bx = compacto
        ? (lado < 0 ? ancho * PM.rotulos.margen : ancho * (1 - PM.rotulos.margen))
        : (pieza.lado < 0 ? ancho * PM.rotulos.columna : ancho * (1 - PM.rotulos.columna));
      const by = compacto
        ? alto * (ranuraI < mitad
          ? PM.rotulos.bandaAlta + ranuraI * PM.rotulos.pasoCompacto
          : PM.rotulos.bandaBaja + (ranuraI - mitad) * PM.rotulos.pasoCompacto)
        : alto * (pieza.lado < 0
          ? PM.rotulos.listaAlta + ranuraI * PM.rotulos.alto
          : PM.rotulos.listaBaja - (nDer - 1 - ranuraI) * PM.rotulos.alto);
      // EL CODO VA EN EL EXTREMO CERCANO AL OBJETO (por eso el signo es `-lado`). Con el codo en
      // el extremo lejano, la diagonal salía por detrás del rótulo y cruzaba por delante del
      // bloque de texto entero: se veía la diagonal de "Paneles radiadores" rozando la nota de
      // "Estructura de empuje".
      // EN COMPACTO el codo va al borde del <b> más ancho de la banda más un aire, y la raya
      // horizontal NO pasa por el centro del rótulo sino a `raya` px de él, por debajo en la banda
      // alta y por encima en la baja (mismo signo `-lado`): la nota está oculta y la raya cruzaba
      // el título, y la diagonal, naciendo dentro del texto, tachaba los rótulos de debajo (ver
      // PM.rotulos). El extremo de la guía (`fin`) es el borde LEJANO del texto: la raya subraya
      // el rótulo entero.
      // EN LISTAS la guía no subraya nada: son TRES PUNTOS —el ancla, el codo y el borde CERCANO
      // del texto más ancho de la lista más un aire— con el tramo horizontal de `codoLista` px a
      // la altura del hueco entre título y nota. Antes el tramo horizontal recorría el texto
      // entero (desde su borde lejano) y la guía medía lo que el rótulo más la diagonal.
      const borde = bx - lado * (anchoTexto[lado < 0 ? 0 : 1] + PM.rotulos.aireCodo);
      const cx = compacto ? borde : borde - lado * PM.rotulos.codoLista;
      const fin = compacto ? bx : borde;
      const ly = compacto ? by - lado * PM.rotulos.raya : by;

      // 3) la guía se dibuja recortándola por longitud de arco con el mismo escalar.
      //    Nada de stroke-dasharray: el trazado cambia de forma cada frame (la pieza gira), así que
      //    habría que recalcular getTotalLength() en cada uno. Recortar los puntos es exacto y gratis.
      const d = Math.min(1, t / PM.rotulos.dibujo);
      const l1 = Math.hypot(cx - ax, ly - ay);
      const l2 = Math.abs(fin - cx);
      const hasta = d * (l1 + l2);
      let pts: string;
      if (hasta <= l1) {
        const k = l1 > 0.001 ? hasta / l1 : 0;
        pts = `${ax.toFixed(1)},${ay.toFixed(1)} ${(ax + (cx - ax) * k).toFixed(1)},${(ay + (ly - ay) * k).toFixed(1)}`;
      } else {
        const k = l2 > 0.001 ? (hasta - l1) / l2 : 1;
        pts = `${ax.toFixed(1)},${ay.toFixed(1)} ${cx.toFixed(1)},${ly.toFixed(1)} ${(cx + (fin - cx) * k).toFixed(1)},${ly.toFixed(1)}`;
      }
      if (pts !== u.pts) lineas[i].setAttribute('points', u.pts = pts);
      // La guía se ATENÚA con el mismo escalar. Sin esto, al recogerse el rótulo el texto ya era
      // invisible (se apaga por debajo de t = 0,62) y la guía seguía dibujada entera: en el crema
      // quedaban líneas colgando de ningún sitio (esc-16a). Por arriba de t = 0,5 no cambia nada,
      // así que el trazado de entrada se sigue viendo a plena tinta.
      const opg = Math.min(1, t * 2).toFixed(2);
      if (opg !== u.og) { lineas[i].style.opacity = u.og = opg; puntos[i].style.opacity = opg; }

      // 4) el punto sobre la pieza aparece de golpe al principio del trazo
      const r = (PM.rotulos.radioPunto * Math.min(1, t * 5)).toFixed(2);
      if (r !== u.r) {
        puntos[i].setAttribute('cx', ax.toFixed(1));
        puntos[i].setAttribute('cy', ay.toFixed(1));
        puntos[i].setAttribute('r', u.r = r);
      } else {
        puntos[i].setAttribute('cx', ax.toFixed(1));
        puntos[i].setAttribute('cy', ay.toFixed(1));
      }

      // 5) el texto entra cuando la guía ya ha llegado a la columna
      const opN = Math.max(0, (t - PM.rotulos.dibujo) / (1 - PM.rotulos.dibujo));
      const op = opN.toFixed(3);
      if (op !== u.op) cajas[i].style.opacity = u.op = op;

      // 5b) la cifra cuenta con la misma entrada, frenando al final (1-(1-k)^3): sube deprisa y se
      //     posa en el valor exacto, en vez de llegar a la meta a velocidad constante. Con la
      //     opacidad a 1 el escalar es 1 clavado, así que el número que queda en pantalla es el
      //     de la ficha y no un redondeo.
      const cota = cotas[i];
      if (cota) {
        const k = 1 - (1 - opN) * (1 - opN) * (1 - opN);
        const txt = cifra(cota.valor * k, cota.dec);
        const pad = txt.length >= cota.ancho ? txt : FIG.repeat(cota.ancho - txt.length) + txt;
        if (pad !== u.ct) cota.el.textContent = u.ct = pad;
      }
      const tr = `translate(${lado < 0 ? '0' : '-100'}%, -50%) translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, 0)`;
      if (tr !== u.tr) cajas[i].style.transform = u.tr = tr;
    }
  }

  return {
    aplicar,
    medir,
    revertir(): void { capa.remove(); },
  };
}
