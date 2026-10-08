import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource-variable/inter';
import palabra from './marcas/kipup-palabra-oscuro.svg?raw';
import monograma from './marcas/kipup-monograma-oscuro.svg?raw';
import { Escena, envolver, escribir, teclear, tramos, type OpcionesSim, type Sim } from './motor';
import './comandas.css';

// KIP-UP COMANDAS POR DENTRO — de la entrada al ticket, pasando por la cocina
// ================================================================================================
// Sustituye a la grabación de nueve fotogramas (27/09/2026, Yoiber: «más llamativo sin saturar, con
// mejores ejemplos de platos»). RECREACIÓN de la aplicación real (kip-up-agency/comandas): la entrada
// con el panel de marca de Kip-Up, la barra navy, el plano de mesas, la vista del mesero con fotos,
// la pantalla de cocina con su conmutador Cocina/Barra y el cobro con propina (sin propina, 10 % o
// 15 %) y método (efectivo, tarjeta o transferencia), tal cual los ofrece el producto. Datos de
// ejemplo: una cevichería inventada. Las fotos de los platos son de Wikimedia Commons (autores y
// licencias en /proyectos/platos/creditos.txt). Una vuelta de 38 s en seis pasos.

const D = 38000;

const PASOS = [
  { t: 400, texto: 'Entra desde la tablet o la caja' },
  { t: 5000, texto: 'El plano dice qué mesa está libre' },
  { t: 7800, texto: 'Toca los platos: la comanda se arma sola' },
  { t: 15600, texto: 'Un toque y llega a cocina; las bebidas, a barra' },
  { t: 18800, texto: 'Cocina la ve al instante, con su tiempo' },
  { t: 26400, texto: 'Caja cobra con propina e imprime el ticket' },
];

const PLATOS = [
  { id: 'ceviche', n: 'Ceviche clásico', p: 38 },
  { id: 'causa', n: 'Causa limeña', p: 22 },
  { id: 'anticuchos', n: 'Anticuchos', p: 26 },
  { id: 'lomo', n: 'Lomo saltado', p: 45 },
  { id: 'aji', n: 'Ají de gallina', p: 34 },
  { id: 'chaufa', n: 'Arroz chaufa', p: 30 },
  { id: 'chicha', n: 'Chicha morada · jarra', p: 18 },
  { id: 'pisco', n: 'Pisco sour', p: 24 },
];

const ICO: Record<string, string> = {
  mesas: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />',
  cocina: '<path d="M6 13a4 4 0 0 1 .5-8 5 5 0 0 1 11 0 4 4 0 0 1 .5 8v6H6z M6 16h12" />',
  caja: '<path d="M4 7h16v12H4z M4 11h16 M8 15h3" />',
  menu: '<path d="M7 3v18 M4 3v5a3 3 0 0 0 6 0V3 M17 3c-2 2-3 5-3 8h3v10" />',
  panel: '<path d="M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z" />',
  correo: '<path d="M3 6h18v12H3z M3 7l9 6 9-6" />',
  candado: '<path d="M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />',
  chispa: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />',
  rayo: '<path d="M13 2 4 14h7l-1 8 9-12h-7z" />',
  cartera: '<path d="M4 7h14a2 2 0 0 1 2 2v9H4z M4 7l11-4v4 M16 13h1" />',
  enviar: '<path d="M4 12 20 4l-6 16-3-7z M11 13l9-9" />',
  nota: '<path d="M5 19l1-4L16 5l3 3L9 18z M14 7l3 3" />',
  personas: '<circle cx="9" cy="8" r="3" /><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5 M16 6a2.6 2.6 0 0 1 0 5 M17.5 14.5c1.6.6 2.6 2 3 4.5" />',
  reloj: '<circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />',
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5" />',
  atras: '<path d="M15 5l-7 7 7 7" />',
  buscar: '<circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" />',
};
const ico = (n: string): string => `<svg class="cm-ico" viewBox="0 0 24 24" aria-hidden="true">${ICO[n]}</svg>`;

function plantilla(): string {
  const mesas = [
    { n: 'T-01', s: 2, e: 'ocupada', x: '24 min · S/ 96.00' }, { n: 'T-02', s: 4, e: 'ocupada', x: '41 min · S/ 212.00' },
    { n: 'T-03', s: 4, e: 'libre' }, { n: 'T-04', s: 6, e: 'libre', clase: ' cm-t4' }, { n: 'T-05', s: 2, e: 'cobrar', x: 'Por cobrar · S/ 74.00' },
    { n: 'T-06', s: 4, e: 'libre' }, { n: 'T-07', s: 4, e: 'ocupada', x: '12 min · S/ 58.00' }, { n: 'T-08', s: 2, e: 'libre' },
    { n: 'T-09', s: 6, e: 'ocupada', x: '5 min · S/ 34.00' }, { n: 'T-10', s: 4, e: 'libre' }, { n: 'B-1', s: 2, e: 'libre' }, { n: 'B-2', s: 2, e: 'libre' },
  ];
  const estadoTxt: Record<string, string> = { libre: 'Libre', ocupada: 'Ocupada', cobrar: 'Por cobrar' };
  const mesa = (m: (typeof mesas)[number]): string => `<span class="cm-mesa ${m.e}${m.clase ?? ''}"><b>${m.n}</b><i>${estadoTxt[m.e]}</i><small>${ico('personas')}${m.s}</small>${m.x ? `<em>${m.x}</em>` : '<em>&nbsp;</em>'}</span>`;
  const platos = PLATOS.map((p) => `<span class="cm-plato cm-p-${p.id}"><img src="/proyectos/platos/${p.id}.webp" alt="" width="400" height="300" decoding="async" /><b>${p.n}</b><em>S/ ${p.p.toFixed(2)}</em></span>`).join('');
  const lineas = [
    ['ceviche', 'Ceviche clásico', '38.00'], ['lomo', 'Lomo saltado', '45.00'], ['aji', 'Ají de gallina', '34.00'],
    ['chicha', 'Chicha morada · jarra', '18.00'], ['pisco', 'Pisco sour', '24.00'],
  ].map(([id, n, p]) => `<li class="cm-l cm-l-${id}"><span class="cm-cant"><b class="cm-q-${id}">1</b>×</span><span class="cm-ln">${n}${id === 'lomo' ? `<small class="cm-nota">${ico('nota')}<span class="cm-nota-t"></span></small>` : ''}</span><span class="cm-lp cm-lp-${id}">${p}</span><i class="cm-enc">En cocina</i></li>`).join('');
  const ticketCocina = (m: string, hace: string, items: string[], clase = ''): string =>
    `<div class="cm-tk ${clase}"><p class="cm-tk-cab"><b>${m}</b><span class="cm-hace">${ico('reloj')}${hace}</span></p><ul>${items.map((it, i) => `<li class="cm-it cm-it${i}"><i></i>${it}</li>`).join('')}</ul><span class="cm-listo">Listo</span></div>`;
  return `
  <div class="sim-camara">
    <div class="cm-app">
      <aside class="cm-lat">
        <p class="cm-marca"><span class="cm-mono">${monograma}</span><span><b>Comandas</b><small>de Kip-Up</small></span></p>
        <p class="cm-sec">Catálogo</p>
        <span class="cm-nav">${ico('panel')}Dashboard</span>
        <span class="cm-nav">${ico('menu')}Menú</span>
        <p class="cm-sec">Operación</p>
        <span class="cm-nav cm-nav-mesero">${ico('mesas')}Vista mesero</span>
        <span class="cm-nav cm-nav-cocina">${ico('cocina')}Vista cocina</span>
        <span class="cm-nav cm-nav-caja">${ico('caja')}Vista cajero</span>
        <p class="cm-yo"><i>CR</i><span><b>Carmen Ríos</b><small>Administradora</small></span></p>
      </aside>
      <div class="cm-main">
        <section class="cm-mesas">
          <div class="cm-cab"><span><h3>Plano de mesas</h3><small>Toca una mesa para abrir o continuar la comanda.</small></span>
            <span class="cm-chip verde">7 libres</span><span class="cm-chip naranja">4 ocupadas</span><span class="cm-chip rojo">1 por cobrar</span></div>
          <p class="cm-zona">Salón <i>6</i></p>
          <div class="cm-rejilla-mesas">${mesas.slice(0, 6).map(mesa).join('')}</div>
          <p class="cm-zona">Terraza y barra <i>6</i></p>
          <div class="cm-rejilla-mesas">${mesas.slice(6).map(mesa).join('')}</div>
        </section>

        <section class="cm-pedido">
          <div class="cm-carta">
            <div class="cm-cab"><span class="cm-atras">${ico('atras')}</span><h3>Mesa <b class="cm-rojo">4</b></h3><small class="cm-sub">Salón · 4 pers.</small><span class="cm-busca">${ico('buscar')}Buscar…</span></div>
            <p class="cm-cats"><i class="on">Todo</i><i>Cebiches</i><i>Entradas</i><i>Fondos</i><i>Bebidas</i><i>Postres</i></p>
            <div class="cm-platos">${platos}</div>
          </div>
          <aside class="cm-comanda">
            <p class="cm-com-cab"><b>Comanda · Mesa 4</b><small class="cm-com-est">Vacía</small></p>
            <p class="cm-com-vacia">Toca un producto del menú para añadirlo.</p>
            <ol class="cm-lineas">${lineas}</ol>
            <div class="cm-com-pie">
              <p class="cm-total"><span>Total</span><b class="cm-tot">S/ 0.00</b></p>
              <span class="cm-boton cm-enviar">${ico('enviar')}Enviar a cocina</span>
              <span class="cm-boton cm-borde">Pasar a cobrar</span>
            </div>
          </aside>
          <p class="cm-toast">${ico('ok')}<span><b>Enviado</b> · 3 platos a cocina, 2 bebidas a barra</span></p>
        </section>

        <section class="cm-cocina">
          <div class="cm-cab"><span><h3>Cocina</h3><small class="cm-coc-sub">2 comandas en curso</small></span><span class="cm-conm"><i class="on">${ico('cocina')}Cocina</i><i class="cm-barra">Barra <b class="cm-barra-n">0</b></i></span></div>
          <div class="cm-tickets">
            ${ticketCocina('Mesa 2 · Salón', 'hace 14 min', ['2 × Causa limeña', '1 × Arroz chaufa', '1 × Anticuchos'], 'cm-tk-tarde')}
            ${ticketCocina('Mesa 9 · Terraza', 'hace 5 min', ['1 × Ají de gallina', '1 × Arroz chaufa'])}
            ${ticketCocina('Mesa 4 · Salón', '<span class="cm-crono">0:00</span>', ['1 × Ceviche clásico', '2 × Lomo saltado <small>término medio</small>', '1 × Ají de gallina'], 'cm-tk-nuevo')}
          </div>
        </section>

        <section class="cm-caja">
          <div class="cm-cab"><span><h3>Cuentas</h3><small>Cobra cuentas pendientes y registra pagos.</small></span></div>
          <div class="cm-stats">
            <p class="cm-stat"><small>Total de hoy</small><b class="cm-hoy">S/ 3 842.50</b></p>
            <p class="cm-stat"><small>Propinas de hoy</small><b class="cm-prop">S/ 286.00</b></p>
            <p class="cm-stat"><small>Tickets cobrados</small><b class="cm-tks">41</b></p>
          </div>
          <p class="cm-zona">Por cobrar <i class="cm-pc-n">1</i></p>
          <div class="cm-cuenta cm-cta-4"><span><b>Mesa 4 · Salón</b><small>4 pers. · 7 ítems · abierta hace 38 min</small></span><b class="cm-cta-tot">S/ 228.00</b><span class="cm-boton cm-cobrar">Cobrar</span></div>
          <p class="cm-zona">Cobradas hoy <i class="cm-co-n">41</i></p>
          <div class="cm-cuenta cm-hecha"><span><b>Mesa 4 · Salón</b><small>Tarjeta · propina S/ 22.80</small></span><b>S/ 250.80</b><span class="cm-pagada">${ico('ok')}Pagada</span></div>
          <div class="cm-cuenta cm-vieja"><span><b>Mesa 7 · Terraza</b><small>Efectivo · sin propina</small></span><b>S/ 96.00</b><span class="cm-pagada">${ico('ok')}Pagada</span></div>
        </section>
      </div>
    </div>

    <div class="cm-modal">
      <p class="cm-mod-cab"><b>Cobrar · Mesa 4</b><small>7 ítems</small></p>
      <p class="cm-mod-l"><span>Subtotal</span><b>S/ 228.00</b></p>
      <p class="cm-rot">Método</p>
      <p class="cm-opc"><i class="cm-m-ef on">Efectivo</i><i class="cm-m-ta">Tarjeta</i><i>Transferencia</i></p>
      <p class="cm-rot">Propina</p>
      <p class="cm-opc"><i class="cm-pr-0 on">Sin propina</i><i class="cm-pr-10">10 %</i><i>15 %</i></p>
      <p class="cm-mod-l"><span>Propina</span><b class="cm-m-prop">S/ 0.00</b></p>
      <p class="cm-mod-l cm-mod-tot"><span>Total</span><b class="cm-m-tot">S/ 228.00</b></p>
      <span class="cm-boton cm-pagar">Cobrar e imprimir</span>
    </div>

    <div class="cm-ticket">
      <p class="cm-tq-neg">LA CEVICHERÍA DE CARMEN</p>
      <p>Jr. Huallaga 318 · Lima</p>
      <p class="cm-tq-sep">Mesa 4 · Salón · 4 pers.</p>
      <p>27/09/2026 · 14:32 · Carmen</p>
      <p class="cm-tq-sep"></p>
      <p class="cm-tq-l"><span>1 Ceviche clásico</span><span>38.00</span></p>
      <p class="cm-tq-l"><span>2 Lomo saltado</span><span>90.00</span></p>
      <p class="cm-tq-l"><span>1 Ají de gallina</span><span>34.00</span></p>
      <p class="cm-tq-l"><span>1 Chicha morada jarra</span><span>18.00</span></p>
      <p class="cm-tq-l"><span>2 Pisco sour</span><span>48.00</span></p>
      <p class="cm-tq-sep"></p>
      <p class="cm-tq-l"><span>Subtotal</span><span>228.00</span></p>
      <p class="cm-tq-l"><span>Propina 10%</span><span>22.80</span></p>
      <p class="cm-tq-l cm-tq-tot"><span>TOTAL S/</span><span>250.80</span></p>
      <p class="cm-tq-l"><span>Pago</span><span>Tarjeta</span></p>
      <p class="cm-tq-pie">¡Gracias por su visita!</p>
    </div>

    <div class="cm-login">
      <div class="cm-marca-panel">
        <i class="cm-mancha1"></i><i class="cm-mancha2"></i>
        <span class="cm-palabra">${palabra}</span>
        <div class="cm-lema">
          <p class="cm-kicker">Comandas</p>
          <h2>Tu restaurante, sincronizado en tiempo real.</h2>
          <p>Mesa, cocina y caja conectadas. Comandas que vuelan, cuentas que se cierran sin fricción.</p>
          <ul><li>${ico('chispa')}Plano de mesas con estado en vivo</li><li>${ico('rayo')}Pantalla de cocina con tiempos y prioridades</li><li>${ico('cartera')}Cobro, propinas y ticket en segundos</li></ul>
        </div>
        <small>Ideas creativas con ejecución real. · kipups.com</small>
      </div>
      <div class="cm-form">
        <h3>Bienvenido de vuelta</h3>
        <p>Inicia sesión para entrar a la operación.</p>
        <label><small>Email</small><span class="cm-campo cm-email">${ico('correo')}<span class="cm-email-t"></span><span class="cm-ph">tucorreo@restaurante.com</span></span></label>
        <label><small>Contraseña</small><span class="cm-campo cm-clave">${ico('candado')}<span class="cm-clave-t"></span></span></label>
        <span class="cm-boton cm-entrar">Entrar</span>
      </div>
    </div>
  </div>`;
}

export function montarComandas(raiz: HTMLElement, opciones: OpcionesSim): Sim {
  raiz.classList.add('sim', 'sim-comandas');
  raiz.innerHTML = plantilla();
  const $ = (s: string): HTMLElement => raiz.querySelector<HTMLElement>(s)!;
  const $$ = (s: string): HTMLElement[] => Array.from(raiz.querySelectorAll<HTMLElement>(s));
  const inicio = { x: 74, y: 93 };
  const escena = new Escena(raiz, D, { inicio, tactil: true });
  const { tl } = escena;
  const login = $('.cm-login');
  const app = $('.cm-app');
  const vMesas = $('.cm-mesas');
  const vPedido = $('.cm-pedido');
  const vCocina = $('.cm-cocina');
  const vCaja = $('.cm-caja');
  const modal = $('.cm-modal');
  const ticket = $('.cm-ticket');
  const toast = $('.cm-toast');
  const nuevo = $('.cm-tk-nuevo');
  const vista = (el: HTMLElement, ini: number, fin: number): void => {
    tl.set(el, { opacity: 0 }, 0)
      .add(el, { opacity: [0, 1], duration: 350 }, ini)
      .add(el, { opacity: [1, 0], duration: 300 }, fin);
  };

  escena.guion(PASOS, 36200);

  // 1 · La entrada.
  escena.ir($('.cm-email'), 900, 700).clic(1700);
  escena.ir($('.cm-clave'), 3100, 500).clic(3700);
  escena.ir($('.cm-entrar'), 4400, 500).clic(4950);
  tl.set(login, { opacity: 1 }, 0)
    .add(login, { opacity: [1, 0], duration: 450, ease: 'in(2)' }, 5150)
    .add(login, { opacity: [0, 1], duration: 600 }, 37000)
    .set(app, { opacity: 0 }, 0)
    .add(app, { opacity: [0, 1], duration: 450 }, 5200)
    .add(app, { opacity: [1, 0], duration: 500 }, 36700);

  // 2 · El plano.
  vista(vMesas, 5200, 6800);
  const mesasEls = $$('.cm-mesa');
  tl.set(mesasEls, { opacity: 0, scale: 0.94 }, 0);
  mesasEls.forEach((m, i) => tl.add(m, { opacity: [0, 1], scale: [0.94, 1], duration: 300, ease: 'out(3)' }, 5300 + i * 45));
  escena.ir($('.cm-t4'), 5700, 700).clic(6500);

  // 3 · La comanda.
  vista(vPedido, 6900, 17600);
  const platosEls = $$('.cm-plato');
  tl.set(platosEls, { opacity: 0, y: '0.6em' }, 0);
  platosEls.forEach((p, i) => tl.add(p, { opacity: [0, 1], y: ['0.6em', '0em'], duration: 320, ease: 'out(3)' }, 7000 + i * 55));
  const tocar = (id: string, t: number, dur = 550): void => {
    escena.ir($(`.cm-p-${id}`), t - dur - 100, dur).clic(t);
    tl.add($(`.cm-p-${id}`), { scale: [0.95, 1], duration: 300, ease: 'outBack(2)' }, t);
  };
  tocar('ceviche', 8400, 600);
  tocar('lomo', 9200, 500);
  escena.clic(9500);
  tocar('aji', 10300, 500);
  tocar('chicha', 11100, 500);
  tocar('pisco', 11900, 500);
  escena.clic(12200);
  const entra = { ceviche: 8450, lomo: 9250, aji: 10350, chicha: 11150, pisco: 11950 };
  for (const [id, t] of Object.entries(entra)) {
    const li = $(`.cm-l-${id}`);
    tl.set(li, { opacity: 0, x: '0.8em' }, 0).add(li, { opacity: [0, 1], x: ['0.8em', '0em'], duration: 300, ease: 'out(3)' }, t);
  }
  // A las líneas, no al centro del panel: el centro de la comanda es hueco.
  let cam = escena.enfocar($('.cm-l-lomo'), 1.5, 12400, 800);
  escena.ir($('.cm-l-lomo .cm-ln'), 12500, 600).clic(13200);
  cam = escena.enfocar(null, 1, 14500, 700, cam);
  escena.ir($('.cm-enviar'), 14800, 700).clic(15600);
  tl.set(toast, { opacity: 0, y: '-1em' }, 0)
    .add(toast, { opacity: [0, 1], y: ['-1em', '0em'], duration: 350, ease: 'out(3)' }, 15800)
    .add(toast, { opacity: [1, 0], y: ['0em', '0em'], duration: 300 }, 17200);

  // 4 y 5 · La cocina.
  vista(vCocina, 17700, 24900);
  tl.set(nuevo, { opacity: 0, y: '-1.5em' }, 0)
    .add(nuevo, { opacity: [0, 1], y: ['-1.5em', '0em'], duration: 500, ease: 'outBack(1.8)' }, 18200);
  cam = escena.enfocar(nuevo, 1.5, 19000, 800, cam);
  escena.ir($('.cm-tk-nuevo .cm-it0'), 20000, 600).clic(20700);
  escena.ir($('.cm-tk-nuevo .cm-it1'), 20800, 400).clic(21400);
  escena.ir($('.cm-tk-nuevo .cm-it2'), 21600, 400).clic(22100);
  escena.ir($('.cm-tk-nuevo .cm-listo'), 22400, 600).clic(23100);
  cam = escena.enfocar(null, 1, 23800, 700, cam);

  // 6 · La caja.
  vista(vCaja, 25000, 36700);
  escena.ir($('.cm-cobrar'), 25400, 700).clic(26200);
  tl.set(modal, { opacity: 0, scale: 0.96 }, 0)
    .add(modal, { opacity: [0, 1], scale: [0.96, 1], duration: 350, ease: 'out(3)' }, 26400)
    .add(modal, { opacity: [1, 0], scale: [1, 0.98], duration: 300 }, 29400);
  escena.ir($('.cm-m-ta'), 26900, 500).clic(27500);
  escena.ir($('.cm-pr-10'), 27700, 500).clic(28300);
  escena.ir($('.cm-pagar'), 28500, 600).clic(29200);
  tl.set(ticket, { opacity: 0, y: '110%' }, 0)
    .add(ticket, { opacity: [0, 1], y: ['110%', '0%'], duration: 750, ease: 'out(3)' }, 29600)
    .add(ticket, { opacity: [1, 0], y: ['0%', '0%'], duration: 500 }, 36400);
  cam = escena.enfocar(ticket, 1.45, 30500, 800, cam);
  escena.enfocar(null, 1, 33600, 700, cam);
  escena.ir(inicio, 34400, 900);

  // Lo discreto.
  const email = $('.cm-email-t');
  const ph = $('.cm-ph');
  const clave = $('.cm-clave-t');
  const t4 = $('.cm-t4');
  const tot = $('.cm-tot');
  const est = $('.cm-com-est');
  const vacia = $('.cm-com-vacia');
  const notaT = $('.cm-nota-t');
  const nota = $('.cm-nota');
  const qLomo = $('.cm-q-lomo');
  const lpLomo = $('.cm-lp-lomo');
  const qPisco = $('.cm-q-pisco');
  const lpPisco = $('.cm-lp-pisco');
  const comanda = $('.cm-comanda');
  const cronos = $('.cm-crono');
  const barraN = $('.cm-barra-n');
  const cocSub = $('.cm-coc-sub');
  const items = [$('.cm-tk-nuevo .cm-it0'), $('.cm-tk-nuevo .cm-it1'), $('.cm-tk-nuevo .cm-it2')];
  const navs = { mesero: $('.cm-nav-mesero'), cocina: $('.cm-nav-cocina'), caja: $('.cm-nav-caja') };
  const mEf = $('.cm-m-ef');
  const mTa = $('.cm-m-ta');
  const pr0 = $('.cm-pr-0');
  const pr10 = $('.cm-pr-10');
  const mProp = $('.cm-m-prop');
  const mTot = $('.cm-m-tot');
  const cta = $('.cm-cta-4');
  const hecha = $('.cm-hecha');
  const hoy = $('.cm-hoy');
  const prop = $('.cm-prop');
  const tks = $('.cm-tks');
  const pcN = $('.cm-pc-n');
  const coN = $('.cm-co-n');
  const soles = (n: number): string => `S/ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, ' ')}`;
  escena.alPintar((t) => {
    const vivo = t < 36700;
    teclear(email, 'carmen@lacevicheria.pe', vivo ? t : 0, 1800, 3000);
    ph.style.display = t >= 1800 && vivo ? 'none' : '';
    teclear(clave, '••••••••', vivo ? t : 0, 3800, 4300);
    $('.cm-email').classList.toggle('foco', t >= 1700 && t < 3100);
    t4.classList.toggle('elegida', t >= 6500 && vivo);
    // La comanda: cantidades, nota, total y estado.
    const dosLomos = t >= 9500 && vivo;
    const dosPiscos = t >= 12200 && vivo;
    escribir(qLomo, dosLomos ? '2' : '1');
    escribir(lpLomo, dosLomos ? '90.00' : '45.00');
    escribir(qPisco, dosPiscos ? '2' : '1');
    escribir(lpPisco, dosPiscos ? '48.00' : '24.00');
    const suma = (t >= 8450 ? 38 : 0) + (t >= 9250 ? 45 : 0) + (dosLomos ? 45 : 0) + (t >= 10350 ? 34 : 0) + (t >= 11150 ? 18 : 0) + (t >= 11950 ? 24 : 0) + (dosPiscos ? 24 : 0);
    escribir(tot, soles(vivo ? suma : 0));
    escribir(est, !vivo || t < 8450 ? 'Vacía' : t < 15600 ? 'Sin enviar' : 'En cocina');
    vacia.style.opacity = t < 8450 || !vivo ? '1' : '0';
    teclear(notaT, 'término medio', vivo ? t : 0, 13300, 14200);
    nota.classList.toggle('abierta', t >= 13200 && vivo);
    comanda.classList.toggle('enviada', t >= 15650 && vivo);
    // La cocina: el cronómetro corre en cámara rápida y los platos se marcan.
    const s = Math.max(0, Math.round(tramos(t, [[18700, 0], [25000, 522]])));
    escribir(cronos, `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
    escribir(barraN, t >= 18400 && vivo ? '2' : '0');
    escribir(cocSub, t >= 18200 && vivo ? '3 comandas en curso' : '2 comandas en curso');
    items.forEach((it, k) => it.classList.toggle('hecho', t >= [20700, 21400, 22100][k] && vivo));
    nuevo.classList.toggle('lista', t >= 23100 && vivo);
    navs.mesero.classList.toggle('on', t < 17700 || t >= 36700);
    navs.cocina.classList.toggle('on', t >= 17700 && t < 25000);
    navs.caja.classList.toggle('on', t >= 25000 && t < 36700);
    // La caja.
    const tarjeta = t >= 27500 && vivo;
    const propina = t >= 28300 && vivo;
    mEf.classList.toggle('on', !tarjeta);
    mTa.classList.toggle('on', tarjeta);
    pr0.classList.toggle('on', !propina);
    pr10.classList.toggle('on', propina);
    escribir(mProp, soles(propina ? 22.8 : 0));
    escribir(mTot, soles(propina ? 250.8 : 228));
    const pagada = t >= 29400 && vivo;
    cta.classList.toggle('fuera', pagada);
    hecha.classList.toggle('dentro', pagada);
    escribir(hoy, soles(pagada ? 3842.5 + 250.8 : 3842.5));
    escribir(prop, soles(pagada ? 286 + 22.8 : 286));
    escribir(tks, pagada ? '42' : '41');
    escribir(pcN, pagada ? '0' : '1');
    escribir(coN, pagada ? '42' : '41');
  });

  // Quieta (movimiento reducido): la comanda armada y con su nota, a punto de enviarse, sin acercar.
  return envolver(escena, opciones, 15350);
}
