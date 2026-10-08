import '@fontsource/poppins/latin-600.css';
import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import porKipup from './marcas/kuantera-por-kipup-oscuro.svg?raw';
import logoOscuro from './marcas/kuantera-logo-oscuro.svg?raw';
import { Escena, envolver, escribir, teclear, tramos, type OpcionesSim, type Sim } from './motor';
import './kuantera.css';

// KUANTERA POR DENTRO — simulación del panel, desde la entrada hasta la boleta aceptada
// (La entrada es la nueva del producto, kip-up-agency/kuantera#2 y PR #3: la marca a la izquierda
// sobre el fondo de acceso del kit y el formulario a la derecha. Medidas: las de 1440x900 x 0,694.
// Sin el comprobante de adorno: el producto no lo enseña por debajo de 1320x800, que es el tamaño
// que representa el resto de la escena, y aquí lo tapaba el rótulo del paso.)
// ================================================================================================
// Sustituye a la grabación de trece fotogramas (27/09/2026, Yoiber: «que se muestre incluso desde el
// login, todo bonito, que por algo tiene manual de marca»). Es una RECREACIÓN del panel real
// (apps/app de kip-up-agency/kuantera: la misma barra lateral, la misma pantalla de emisión, el mismo
// «SUNAT lo aceptó») con los colores, el logotipo y las tres letras del kit de marca (Poppins, Inter
// e IBM Plex Mono), y con datos de ejemplo: una panadería inventada en el entorno de pruebas de SUNAT
// (RUC 20000000001, el del beta). Los datos del panel de pruebas no valen para enseñar: arrastra
// comprobantes rechazados de las pruebas de firma. Una vuelta de 36 s en seis pasos.

const D = 36000;

const PASOS = [
  { t: 400, texto: 'Entra al panel de tu negocio' },
  { t: 5600, texto: 'Las ventas del día, de un vistazo' },
  { t: 9600, texto: 'El cliente sale de tu libreta' },
  { t: 14200, texto: 'Busca el producto: el IGV se calcula solo' },
  { t: 21800, texto: 'Se firma con tu certificado y va directo a SUNAT' },
  { t: 27600, texto: 'Aceptada: el ticket con su QR, listo para entregar' },
];

// Iconos de línea propios, 24x24.
const ICONOS: Record<string, string> = {
  panel: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />',
  emitir: '<path d="M12 5v14M5 12h14" />',
  comprobantes: '<path d="M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7M9 16h7" />',
  clientes: '<circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5 M16 5.5a3 3 0 0 1 0 6 M18 14.8c2 .8 3.2 2.6 3.5 5.2" />',
  compras: '<path d="M5 8h14l-1 12H6z M9 8V6a3 3 0 0 1 6 0v2" />',
  productos: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z M4 7.5l8 4.5 8-4.5 M12 12v9" />',
  ajustes: '<circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />',
  buscar: '<circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" />',
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5" />',
  xml: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />',
  firma: '<path d="M4 17c3-6 5-9 6-8s-2 7 0 7 3-5 5-5 1 4 3 4 2-2 2-2 M4 21h16" />',
  sunat: '<path d="M3 10l9-6 9 6 M5 10v8M9.5 10v8M14.5 10v8M19 10v8 M3 20h18" />',
  imprimir: '<path d="M7 9V3h10v6 M6 18H4v-8h16v8h-2 M7 14h10v7H7z" />',
  pdf: '<path d="M6 3h9l4 4v14H6z M14 3v5h5" />',
  correo: '<path d="M3 6h18v12H3z M3 7l9 6 9-6" />',
  reloj: '<circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />',
  ojo: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />',
};
const icono = (n: string): string => `<svg class="kt-ico" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[n]}</svg>`;

// Un QR de adorno (no se lee): tres marcas de esquina y módulos con azar de semilla fija.
function qr(): string {
  const n = 25;
  let s = 7;
  const azar = (): number => ((s = (s * 16807) % 2147483647) / 2147483647);
  let r = '';
  const esquina = (x: number, y: number): boolean => x >= 0 && x < 7 && y >= 0 && y < 7;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const enMarca = esquina(x, y) || esquina(x - (n - 7), y) || esquina(x, y - (n - 7));
    if (enMarca) continue;
    if (azar() < 0.48) r += `<rect x="${x}" y="${y}" width="1" height="1" />`;
  }
  const marca = (x: number, y: number): string => `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" fill="none" stroke="#111" stroke-width="1" /><rect x="${x + 2}" y="${y + 2}" width="3" height="3" />`;
  return `<svg class="kt-qr" viewBox="-1 -1 27 27" aria-hidden="true">${r}${marca(0, 0)}${marca(n - 7, 0)}${marca(0, n - 7)}</svg>`;
}

function plantilla(): string {
  const nav = [['panel', 'Panel'], ['emitir', 'Emitir'], ['comprobantes', 'Comprobantes'], ['clientes', 'Clientes'], ['compras', 'Compras'], ['productos', 'Productos'], ['ajustes', 'Ajustes']]
    .map(([k, n]) => `<span class="kt-nav kt-nav-${k}">${icono(k)}${n}</span>`).join('');
  const barras = [62, 48, 71, 55, 88, 94, 40].map((h, i) => `<i style="--h:${h}%"><b>${'LMMJVSD'[i]}</b></i>`).join('');
  const ultimos = [
    ['B001-416', 'Cliente varios', '12.00'],
    ['F001-088', 'Café Aroma S.A.C.', '236.00'],
    ['B001-415', 'Luis Mendoza', '31.50'],
    ['B001-414', 'Cliente varios', '8.40'],
  ].map(([n, c, m]) => `<tr><td class="kt-num">${n}</td><td>${c}</td><td class="kt-num kt-der">S/ ${m}</td><td><span class="kt-pill ok">Aceptado</span></td></tr>`).join('');
  return `
  <div class="sim-camara">
    <div class="kt-app">
      <aside class="kt-lat">
        <span class="kt-logo">${logoOscuro}</span>
        <p class="kt-seccion">Principal</p>
        ${nav}
      </aside>
      <div class="kt-main">
        <header class="kt-top">
          <span><b>Panadería La Espiga</b><small>RUC 20000000001 · Dueña</small></span>
          <span class="kt-pruebas">Entorno de pruebas</span><span class="kt-yo">Rosa</span>
        </header>
        <div class="kt-vista">
          <section class="kt-panel">
            <div class="kt-cabeza">
              <span><h3>Hola, Rosa</h3><small>Cómo va tu negocio al 27/09/2026</small></span>
              <span class="kt-boton">Emitir factura</span><span class="kt-boton kt-borde kt-ir-boleta">Emitir boleta</span>
            </div>
            <div class="kt-cifras">
              <div class="kt-tarjeta"><small>Ventas de hoy</small><b class="kt-num kt-hoy">S/ 1 284.50</b><em>63 comprobantes aceptados</em></div>
              <div class="kt-tarjeta"><small>Ventas del mes</small><b class="kt-num kt-mes">S/ 28 940.10</b><em>1 402 comprobantes aceptados</em></div>
              <div class="kt-tarjeta"><small>Pendientes de llegar a SUNAT</small><b class="kt-num">0</b><em>Nada en camino</em></div>
              <div class="kt-tarjeta"><small>Con problema</small><b class="kt-num kt-verde">0</b><em class="kt-verde">Todo en orden</em></div>
            </div>
            <div class="kt-dos">
              <div class="kt-tarjeta"><p class="kt-tit">Ventas de la semana</p><div class="kt-barras">${barras}</div></div>
              <div class="kt-tarjeta"><p class="kt-tit">Últimos comprobantes</p><table class="kt-tabla">${ultimos}</table></div>
            </div>
          </section>

          <section class="kt-emitir">
            <div class="kt-cabeza"><span><h3>Emitir boleta</h3><small>Se emite con la fecha de hoy en Perú.</small></span></div>
            <div class="kt-rejilla">
              <div class="kt-col">
                <div class="kt-tarjeta kt-comp">
                  <p class="kt-tit">Comprobante</p>
                  <div class="kt-fila"><span class="kt-toggle"><i class="on">Boleta</i><i>Factura</i></span><span class="kt-campo kt-serie">B001</span><small>Siguiente número <b class="kt-num">00000417</b></small></div>
                </div>
                <div class="kt-tarjeta kt-cliente">
                  <p class="kt-tit">Cliente</p>
                  <div class="kt-fila"><span class="kt-campo kt-buscar kt-buscar-cli">${icono('buscar')}<span class="kt-q1"></span><span class="kt-ph1">Nombre, RUC o DNI</span></span><span class="kt-boton kt-borde kt-chico">Cliente varios</span></div>
                  <ul class="kt-sug kt-sug1"><li class="kt-sug-a"><b>María Quispe Huamán</b><small>DNI 45678912 · maria.q@correo.pe</small></li><li><b>Mario Quispe Soto</b><small>DNI 45671203</small></li></ul>
                  <div class="kt-dosc">
                    <label><small>Tipo de documento</small><span class="kt-campo">DNI</span></label>
                    <label><small>Número de documento</small><span class="kt-campo kt-num kt-dni"></span></label>
                  </div>
                  <label><small>Nombre o razón social</small><span class="kt-campo kt-nombre"></span></label>
                </div>
                <div class="kt-tarjeta kt-productos">
                  <p class="kt-tit">Productos y servicios</p>
                  <div class="kt-fila"><span class="kt-campo kt-buscar kt-buscar-prod">${icono('buscar')}<span class="kt-q2"></span><span class="kt-ph2">Producto o servicio</span></span><span class="kt-boton kt-borde kt-chico">Línea libre</span></div>
                  <ul class="kt-sug kt-sug2"><li class="kt-sug-b"><b>Pan francés · bolsa x10</b><small>S/ 5.00 · Gravado</small></li><li><b>Pan de yema</b><small>S/ 1.20 · Gravado</small></li><li><b>Panetón 900 g</b><small>S/ 32.00 · Gravado</small></li></ul>
                  <ul class="kt-sug kt-sug3"><li class="kt-sug-c"><b>Torta de chocolate · porción</b><small>S/ 9.50 · Gravado</small></li><li><b>Torta helada · porción</b><small>S/ 8.00 · Gravado</small></li></ul>
                  <table class="kt-lineas">
                    <thead><tr><th>Descripción</th><th class="kt-der">Cant.</th><th class="kt-der">Precio</th><th class="kt-der">Importe</th></tr></thead>
                    <tbody>
                      <tr class="kt-l1"><td>Pan francés · bolsa x10</td><td class="kt-der"><span class="kt-cant"><i>−</i><b class="kt-num kt-c1">1</b><i class="kt-mas">+</i></span></td><td class="kt-der kt-num">5.00</td><td class="kt-der kt-num kt-i1">5.00</td></tr>
                      <tr class="kt-l2"><td>Torta de chocolate · porción</td><td class="kt-der"><span class="kt-cant"><i>−</i><b class="kt-num">1</b><i>+</i></span></td><td class="kt-der kt-num">9.50</td><td class="kt-der kt-num">9.50</td></tr>
                    </tbody>
                  </table>
                  <p class="kt-vacio">Todavía no has añadido nada. Busca en el catálogo o añade una línea libre.</p>
                </div>
              </div>
              <div class="kt-col">
                <div class="kt-tarjeta kt-totales">
                  <p class="kt-tit">Totales</p>
                  <p class="kt-t"><span>Gravadas</span><b class="kt-num kt-grav">S/ 0.00</b></p>
                  <p class="kt-t"><span>IGV (18 %)</span><b class="kt-num kt-igv">S/ 0.00</b></p>
                  <p class="kt-t kt-total"><span>Total</span><b class="kt-num kt-tot">S/ 0.00</b></p>
                  <p class="kt-pago"><span class="kt-toggle"><i class="on">Contado</i><i>Crédito</i></span></p>
                </div>
                <div class="kt-tarjeta kt-cobrar">
                  <small>Total a cobrar</small>
                  <b class="kt-num kt-tot2">S/ 0.00</b>
                  <span class="kt-boton kt-emitir-b">Emitir boleta</span>
                </div>
              </div>
            </div>
          </section>

          <section class="kt-emitido">
            <div class="kt-cabeza"><span><h3>Comprobante emitido</h3><small>Ya puedes entregarlo: el estado se actualiza solo.</small></span></div>
            <div class="kt-tarjeta kt-resumen">
              <label><small>Número</small><b class="kt-num">B001-00000417</b></label>
              <label><small>Importe</small><b class="kt-num">S/ 19.50</b></label>
              <label><small>Estado</small><span class="kt-pill kt-estado">En cola</span></label>
              <label><small>Cliente</small><b>María Quispe Huamán</b></label>
            </div>
            <div class="kt-tarjeta kt-camino">
              <p class="kt-tit">Camino a SUNAT</p>
              <div class="kt-pasos">
                <span class="kt-linea"><i class="kt-lleno"></i></span>
                <span class="kt-paso kt-p1">${icono('xml')}<b>XML UBL 2.1</b><small>armado y validado</small></span>
                <span class="kt-paso kt-p2">${icono('firma')}<b>Firma digital</b><small>con el certificado del negocio</small></span>
                <span class="kt-paso kt-p3">${icono('sunat')}<b>SUNAT</b><small>directo, sin intermediario</small></span>
              </div>
            </div>
            <div class="kt-aceptada">
              <p class="kt-ok">${icono('ok')}<b>SUNAT lo aceptó</b></p>
              <p>La Boleta número B001-417, ha sido aceptada. <span class="kt-num">Código 0</span></p>
              <small>El comprobante es válido. La constancia de SUNAT queda guardada con él.</small>
            </div>
            <div class="kt-acciones">
              <span class="kt-boton kt-borde">${icono('pdf')}Ver el PDF</span>
              <span class="kt-boton kt-borde kt-imprimir">${icono('imprimir')}Imprimir el ticket</span>
              <span class="kt-boton kt-borde">${icono('correo')}Enviar por correo</span>
              <span class="kt-boton">Emitir otro</span>
            </div>
          </section>
        </div>
      </div>
    </div>

    <div class="kt-login">
      <section class="kt-login-marca">
        <span class="kt-login-logo">${porKipup}</span>
        <div class="kt-login-texto">
          <p class="kt-login-lema">Tu negocio, en números claros<span>.</span></p>
          <p class="kt-login-bajada">Boletas y facturas electrónicas que salen de tu negocio directo a SUNAT, firmadas con tu propio certificado.</p>
          <ul class="kt-login-puntos">
            <li>${icono('sunat')}Directo a SUNAT, sin intermediarios: emites tú, con tu certificado y tu clave SOL.</li>
            <li>${icono('comprobantes')}Cada venta queda guardada con la constancia que devuelve SUNAT.</li>
            <li>${icono('reloj')}Te avisa antes de que venza el plazo para enviar un comprobante.</li>
          </ul>
        </div>
      </section>
      <div class="kt-login-lado">
        <div class="kt-login-caja">
          <h3>Entrar al panel</h3>
          <p>Emite y consulta tus comprobantes electrónicos.</p>
          <label><small>Correo</small><span class="kt-campo kt-correo"><span class="kt-correo-t"></span><i class="kt-caret"></i></span></label>
          <label><small>Contraseña</small><span class="kt-campo kt-clave"><span class="kt-clave-t"></span><span class="kt-ojo">${icono('ojo')}</span></span></label>
          <span class="kt-boton kt-entrar">Entrar</span>
          <small class="kt-olvido">¿No recuerdas tu contraseña? Pídesela a quien administra el negocio.</small>
        </div>
      </div>
    </div>

    <div class="kt-ticket">
      <p class="kt-tk-neg">PANADERÍA LA ESPIGA</p>
      <p>RUC 20000000001</p>
      <p>Av. Los Olivos 245 · Lima</p>
      <p class="kt-tk-tipo">BOLETA DE VENTA ELECTRÓNICA<br />B001-00000417</p>
      <p class="kt-tk-sep">27/09/2026 · 10:42</p>
      <p>Cliente: María Quispe Huamán</p>
      <p>DNI 45678912</p>
      <p class="kt-tk-sep"></p>
      <p class="kt-tk-l"><span>2 x Pan francés x10</span><span>10.00</span></p>
      <p class="kt-tk-l"><span>1 x Torta chocolate</span><span>9.50</span></p>
      <p class="kt-tk-sep"></p>
      <p class="kt-tk-l"><span>Op. gravadas</span><span>16.53</span></p>
      <p class="kt-tk-l"><span>IGV 18%</span><span>2.97</span></p>
      <p class="kt-tk-l kt-tk-tot"><span>TOTAL S/</span><span>19.50</span></p>
      ${qr()}
      <p class="kt-tk-pie">Representación impresa de la boleta de venta electrónica. Consúltala en kuantera.com</p>
    </div>
  </div>`;
}

export function montarKuantera(raiz: HTMLElement, opciones: OpcionesSim): Sim {
  raiz.classList.add('sim', 'sim-kuantera');
  raiz.innerHTML = plantilla();
  const $ = (s: string): HTMLElement => raiz.querySelector<HTMLElement>(s)!;
  const $$ = (s: string): HTMLElement[] => Array.from(raiz.querySelectorAll<HTMLElement>(s));
  const inicio = { x: 62, y: 92 };
  const escena = new Escena(raiz, D, { inicio });
  const { tl } = escena;
  const login = $('.kt-login');
  const app = $('.kt-app');
  const panel = $('.kt-panel');
  const emitir = $('.kt-emitir');
  const emitido = $('.kt-emitido');
  const ticket = $('.kt-ticket');
  const sug1 = $('.kt-sug1');
  const sug2 = $('.kt-sug2');
  const sug3 = $('.kt-sug3');
  const l1 = $('.kt-l1');
  const l2 = $('.kt-l2');
  const vacio = $('.kt-vacio');
  const aceptada = $('.kt-aceptada');
  const tarjetas = $$('.kt-panel .kt-cifras .kt-tarjeta, .kt-panel .kt-dos .kt-tarjeta');

  escena.guion(PASOS, 34400);

  // 1 · La entrada.
  escena.ir($('.kt-correo'), 900, 800).clic(1800);
  escena.ir($('.kt-clave'), 3200, 500).clic(3800);
  escena.ir($('.kt-entrar'), 4600, 500).clic(5150);
  tl.set(login, { opacity: 1, scale: 1 }, 0)
    .add(login, { opacity: [1, 0], scale: [1, 1.03], duration: 500, ease: 'in(2)' }, 5400)
    .add(login, { opacity: [0, 1], scale: [1.03, 1], duration: 600, ease: 'out(2)' }, 35000)
    .set(app, { opacity: 0 }, 0)
    .add(app, { opacity: [0, 1], duration: 500 }, 5450)
    .add(app, { opacity: [1, 0], duration: 500 }, 34700);

  // 2 · El panel.
  tl.set(tarjetas, { opacity: 0, y: '0.8em' }, 0);
  tarjetas.forEach((t, i) => tl.add(t, { opacity: [0, 1], y: ['0.8em', '0em'], duration: 420, ease: 'out(3)' }, 5700 + i * 80));
  let cam = escena.enfocar($('.kt-cifras'), 1.3, 6500, 900);
  cam = escena.enfocar(null, 1, 8000, 800, cam);
  escena.ir($('.kt-ir-boleta'), 8400, 700).clic(9200);
  tl.set(panel, { opacity: 1 }, 0)
    .add(panel, { opacity: [1, 0], duration: 300 }, 9350)
    .add(panel, { opacity: [0, 1], duration: 10 }, 35500)
    .set(emitir, { opacity: 0 }, 0)
    .add(emitir, { opacity: [0, 1], duration: 350 }, 9450)
    .add(emitir, { opacity: [1, 0], duration: 300 }, 22350)
    .add(emitir, { opacity: [0, 0], duration: 10 }, 35500);

  // 3 · El cliente, de la libreta.
  cam = escena.enfocar($('.kt-cliente'), 1.45, 10200, 900, cam);
  escena.ir($('.kt-buscar-cli'), 9800, 700).clic(10600);
  tl.set([sug1, sug2, sug3], { opacity: 0, y: '-0.4em' }, 0)
    .add(sug1, { opacity: [0, 1], y: ['-0.4em', '0em'], duration: 250, ease: 'out(2)' }, 11400)
    .add(sug1, { opacity: [1, 0], y: ['0em', '0em'], duration: 180 }, 12500);
  escena.ir($('.kt-sug-a'), 11700, 600).clic(12400);
  cam = escena.enfocar(null, 1, 13300, 800, cam);

  // 4 · Los productos y los totales.
  escena.ir($('.kt-buscar-prod'), 13900, 700).clic(14700);
  tl.add(sug2, { opacity: [0, 1], y: ['-0.4em', '0em'], duration: 250, ease: 'out(2)' }, 15300)
    .add(sug2, { opacity: [1, 0], y: ['0em', '0em'], duration: 180 }, 16300);
  escena.ir($('.kt-sug-b'), 15500, 600).clic(16200);
  tl.set([l1, l2], { opacity: 0, x: '-0.6em' }, 0)
    .add(l1, { opacity: [0, 1], x: ['-0.6em', '0em'], duration: 350, ease: 'out(3)' }, 16300)
    .set(vacio, { opacity: 1 }, 0)
    .add(vacio, { opacity: [1, 0], duration: 200 }, 16250);
  escena.ir($('.kt-mas'), 16600, 500).clic(17200);
  escena.ir($('.kt-buscar-prod'), 17400, 600).clic(18100);
  tl.add(sug3, { opacity: [0, 1], y: ['-0.4em', '0em'], duration: 250, ease: 'out(2)' }, 18800)
    .add(sug3, { opacity: [1, 0], y: ['0em', '0em'], duration: 180 }, 19800);
  escena.ir($('.kt-sug-c'), 19000, 600).clic(19700);
  tl.add(l2, { opacity: [0, 1], x: ['-0.6em', '0em'], duration: 350, ease: 'out(3)' }, 19800);
  cam = escena.enfocar($('.kt-totales'), 1.5, 19900, 800, cam);
  cam = escena.enfocar(null, 1, 21300, 700, cam);
  escena.ir($('.kt-emitir-b'), 21300, 800).clic(22200);

  // 5 · Firma y SUNAT.
  const lleno = $('.kt-lleno');
  tl.set(emitido, { opacity: 0 }, 0)
    .add(emitido, { opacity: [0, 1], duration: 400 }, 22450)
    .add(emitido, { opacity: [1, 0], duration: 10 }, 35500)
    .set(lleno, { scaleX: 0 }, 0)
    .add(lleno, { scaleX: [0, 1], duration: 2400, ease: 'inOut(2)' }, 22950)
    .set(aceptada, { opacity: 0, y: '0.8em' }, 0)
    .add(aceptada, { opacity: [0, 1], y: ['0.8em', '0em'], duration: 450, ease: 'outBack(1.6)' }, 25550);
  cam = escena.enfocar(aceptada, 1.4, 25500, 800, cam);
  cam = escena.enfocar(null, 1, 27100, 700, cam);

  // 6 · El ticket.
  escena.ir($('.kt-imprimir'), 27700, 700).clic(28500);
  tl.set(ticket, { opacity: 0, y: '110%' }, 0)
    .add(ticket, { opacity: [0, 1], y: ['110%', '0%'], duration: 800, ease: 'out(3)' }, 28700)
    .add(ticket, { opacity: [1, 0], y: ['0%', '0%'], duration: 500 }, 34600);
  cam = escena.enfocar(ticket, 1.45, 29600, 900, cam);
  escena.enfocar(null, 1, 32600, 800, cam);
  escena.ir(inicio, 33300, 900);

  // Lo discreto.
  const correo = $('.kt-correo-t');
  const clave = $('.kt-clave-t');
  const q1 = $('.kt-q1');
  const q2 = $('.kt-q2');
  const ph1 = $('.kt-ph1');
  const ph2 = $('.kt-ph2');
  const dni = $('.kt-dni');
  const nombre = $('.kt-nombre');
  const c1 = $('.kt-c1');
  const i1 = $('.kt-i1');
  const grav = $('.kt-grav');
  const igv = $('.kt-igv');
  const tot = $('.kt-tot');
  const tot2 = $('.kt-tot2');
  const hoy = $('.kt-hoy');
  const estadoPill = $('.kt-estado');
  const pasos = [$('.kt-p1'), $('.kt-p2'), $('.kt-p3')];
  const navPanel = $('.kt-nav-panel');
  const navEmitir = $('.kt-nav-emitir');
  const correoCampo = $('.kt-correo');
  const soles = (n: number): string => `S/ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, ' ')}`;
  escena.alPintar((t) => {
    const vivo = t < 34700;
    teclear(correo, 'rosa@laespiga.pe', vivo ? t : 0, 1900, 3100);
    teclear(clave, '••••••••••', vivo ? t : 0, 3900, 4500);
    correoCampo.classList.toggle('foco', t >= 1800 && t < 3200);
    escribir(hoy, soles(tramos(t, [[5800, 1201], [7000, 1284.5]])));
    navPanel.classList.toggle('on', t < 9400 || t >= 34700);
    navEmitir.classList.toggle('on', t >= 9400 && t < 34700);
    // La búsqueda del cliente y la de los productos.
    const busca1 = t >= 10700 && t < 12500;
    teclear(q1, '4567', busca1 ? t : 0, 10700, 11300);
    ph1.style.display = busca1 ? 'none' : '';
    const t2 = t >= 14800 && t < 16300 ? ['pan', 14800, 15200] : t >= 18200 && t < 19800 ? ['torta', 18200, 18700] : null;
    teclear(q2, t2 ? String(t2[0]) : '', t2 ? t : 0, t2 ? Number(t2[1]) : 0, t2 ? Number(t2[2]) : 1);
    ph2.style.display = t2 ? 'none' : '';
    const conCliente = t >= 12500 && t < 34700;
    escribir(dni, conCliente ? '45678912' : '');
    escribir(nombre, conCliente ? 'María Quispe Huamán' : '');
    raiz.classList.toggle('kt-relleno', t >= 12500 && t < 13600);
    const dos = t >= 17200 && t < 34700;
    escribir(c1, dos ? '2' : '1');
    escribir(i1, dos ? '10.00' : '5.00');
    const total = t < 16300 ? 0 : t < 17200 ? 5 : t < 19800 ? 10 : 19.5;
    const mostrado = t >= 34700 ? 0 : total === 19.5 ? tramos(t, [[19800, 10], [20300, 19.5]]) : total;
    const g = Math.round((mostrado / 1.18) * 100) / 100;
    escribir(tot, soles(mostrado));
    escribir(tot2, soles(mostrado));
    escribir(grav, soles(g));
    escribir(igv, soles(Math.round((mostrado - g) * 100) / 100));
    // El camino a SUNAT y el estado.
    pasos.forEach((p, k) => p.classList.toggle('hecho', t >= [23500, 24500, 25300][k] && vivo));
    const est = t < 23000 ? 'En cola' : t < 25500 ? 'Enviando a SUNAT…' : 'Aceptado';
    escribir(estadoPill, est);
    estadoPill.classList.toggle('ok', t >= 25500);
    estadoPill.classList.toggle('va', t >= 23000 && t < 25500);
  });

  // Quieta (movimiento reducido): la boleta ya aceptada, con la cámara en el plano entero.
  return envolver(escena, opciones, 28100);
}
