// Única fuente de números del demo. Ajustar "más rápido / más lento" es cambiar aquí, nunca lógica.
// origen: 'propio' = decisión de diseño; 'doc' = valor canónico de la documentación de Anime.js.

// LA ENTRADA DEL LOGO manda sobre el reloj, no al revés. Estos dos números NO se eligen aquí: son
// los del original de yoiber.com, leídos de AnimatedLogo.tsx y copiados en effects/logo-intro.ts
// (que los lleva escritos a mano, porque es un port literal). Se repiten aquí porque hay dos cosas
// que tienen que cuadrar con ellos: cuánto dura el tramo INTRO del maestro y cuándo se pide el
// trozo 3D. Si alguien toca la coreografía, esto se mueve con ella.
const LOGO = {
  arranque: 300,   // ms de espera desde el montaje hasta que arranca la entrada
  entrada: 4800,   // ms de coreografía: la barra aterriza en 4,5 s y el ajuste del SVG cierra en 4,8
};

export const P = {
  scroll: {
    sync: 0.9, // suavizado del scroll (más cerca de 0, más tarda en alcanzar la posición)
    // La intro corre por tiempo y el resto por scroll. Dura EXACTAMENTE lo que la entrada del logo:
    // el tramo INTRO es "el logo entrando", así que se acaban a la vez. Antes eran 4 000 ms con un
    // título de texto partido que duraba eso; ahora manda la coreografía de yoiber.com.
    introDuration: LOGO.arranque + LOGO.entrada, // 5100
    alturas: { HERO_OUT: 2, GALERIA: 10, COMO: 5, CIERRE: 2 } as Record<string, number>, // en alturas de viewport; 1 altura = 1000 unidades del maestro
    // El suavizado lo hace core/scroller.ts con un Timer propio por tiempo (no el `sync` de
    // onScroll: ver allí por qué). `sync` sigue siendo el factor; estos dos son su mecánica.
    suavizado: {
      fotograma: 1000 / 60, // ms: el fotograma para el que está definido el factor de la librería
      umbral: 0.5,          // unidades del maestro: por debajo se clava en el objetivo y el Timer se para
    },
    origen: 'propio',
  },
  // El hero: el logo (GSAP, effects/logo-intro.ts + logo-salida.ts) y el texto de debajo
  // (Anime.js, effects/hero.ts). Ver effects/hero.ts para por qué el texto entra tan tarde.
  intro: {
    on: 300,
    logo: LOGO,
    // El texto entra cuando el logo YA está montado. La medida está tomada del propio port: con
    // `power4.out` las formas llegan a escala 1,027 a los 2,5 s y a 1,000 a los 3,5 s, así que a
    // los 3,2 s de reloj (2,9 s después de INTRO_ON) el logo está visualmente quieto.
    texto: { delay: 2900, duration: 800, stagger: 150, y: 12 },
    // Cuánto del tramo HERO_OUT ocupa cada retirada, en tanto por uno. El texto se va un poco más
    // tarde que el logo: el logo despeja el centro y el texto se lo lleva mientras el motor sube.
    salidaTexto: 0.6,
    salidaLogo: 0.55,
    // EL FONDO VIVO DE LA INTRO (effects/fondo-intro.ts): un anillo de marcas detrás del logo, como
    // el bisel de un instrumento, y un barrido que le da la vuelta. Medido antes: de +3 s a +11 s
    // el hero no cambiaba un píxel salvo la flotación del logo (fila 15 del informe).
    fondo: {
      marcas: 72,          // marcas del anillo, una cada 5°
      cadaLarga: 6,        // una de cada tantas es larga: 12 marcas largas, como las horas de una esfera
      opacidad: 0.35,      // tope de opacidad de todo el anillo: NUNCA compite con el logo
      // El encendido va DENTRO del maestro, con el texto (INTRO_ON + texto.delay): cada marca 12 ms
      // después de la anterior, en el sentido de las agujas. 72 x 12 + 500 = 1 364 ms, y acaba a
      // 4 564 < 5 100 (INTRO_END): se enciende entero antes de que la intro por tiempo termine.
      encendido: { duration: 500, stagger: 12 },
      // Los dos bucles FUERA del maestro (reloj del navegador, no del scroll). El barrido es el que
      // pone píxeles en movimiento: un arco de 60° que da una vuelta cada 12 s (30°/s). El anillo
      // de marcas gira en sentido contrario y muy despacio: una vuelta cada 4 min (1,5°/s), lo justo
      // para que la esfera no parezca pintada.
      barrido: { vuelta: 12000, arco: 60, grosor: 7 }, // ms por vuelta; grados del arco; grosor en unidades del viewBox (radio 100)
      giro: { vuelta: 240000 },                        // ms por vuelta del anillo de marcas, al revés que el barrido
      // Geometría en unidades del viewBox (radio 100): las marcas van de `interior` al borde.
      radio: { marca: 91, larga: 85, barrido: 79 },
    },
    origen: 'propio',
  },
  // LA CABECERA FIJA (effects/cabecera.ts). Entra con el texto del hero (mismo instante y ease:
  // INTRO_ON + intro.texto.delay) y se queda toda la página. `dentro`: "Por dentro" lleva al 30 %
  // de COMO, que es donde el despiece ya está abierto y con rótulos (antes del 30 % el motor
  // todavía se está separando).
  cabecera: { dentro: 0.3, origen: 'propio' },
  panel: {
    entrada: { rotateX: 70, y: '70vh', scale: 0.6 },
    galeria: { rotateY: 18 },
    como: { rotateX: 45, z: 160, giro: -180 },
    cierre: { rotateX: 100, y: '35vh' },
    origen: 'propio',
  },
  tema: { margen: 250, origen: 'propio' }, // los colores viven en base.css (:root y html.is-light); la transición, en CSS
  // El motor 3D: cuándo se pide, con qué calidad y con cuánto lienzo. Ver src/core/capacidad.ts.
  motor: {
    // ESTOS TRES SON LA RED, NO EL DISPARADOR. Quien pide el trozo 3D en la vida real es el propio
    // logo: `alTerminar` de effects/logo-intro.ts llama a `escena.pedirMotor()` en cuanto la entrada
    // se ensambla (ver main.ts). Los temporizadores solo cubren el caso de que ese aviso no llegue
    // nunca —el SVG no está en el marcado, o el navegador tumba la pestaña a mitad de la entrada—.
    // Por eso el suelo se ha subido: analizar 610 kB de JS, construir ~40 geometrías y renderizar
    // el maestro entero dos veces (lo que hace tl.init()) es una tarea larga, y ahora la entrada
    // del logo ocupa hasta los 5,1 s (LOGO.arranque + LOGO.entrada). El motor no hace falta hasta
    // HERO_OUT; si el visitante baja antes, `alBajar` lo pide en el acto.
    esperaMinima: LOGO.arranque + LOGO.entrada + 400,   // 5500 ms: no se pide el trozo antes de esto
    esperaOciosa: 700,    // ms de margen que se le da a requestIdleCallback a partir de esperaMinima
    esperaMaxima: 7500,   // ms: tope duro; se pide aunque el navegador no esté ocioso
    relevo: 420,          // ms del cruce entre el escenario CSS y el lienzo (también en base.css)
    // EL TELÓN del lienzo, en unidades del maestro por encima de HERO_OUT. El reloj se PARA justo
    // en HERO_OUT cuando la intro por tiempo termina (INTRO_END == HERO_OUT), así que hace falta un
    // margen para distinguir "la intro ha acabado" de "el visitante ha empezado a bajar".
    // Son DOS umbrales y no uno porque el telón sube y baja: con uno solo, arrastrar el scroll justo
    // encima de la frontera encadenaría cruces de 420 ms. 60 y 20 de 2000 son el 3 % y el 1 % del
    // tramo; con una ventana de 900 px, una banda de unos 18 px.
    // 600 y 400, no 60 y 20. Con 60 (el 3 % del tramo) el telón subía a 40 px de scroll: el motor
    // aparecía despiezado en cuarenta tubos detrás de un logo que todavía no se había movido. El
    // logo tarda el 55 % del tramo en irse, así que a 600 (30 %) ya está claramente saliendo y el
    // motor se descubre a medio ensamblar, que se lee mucho mejor que en su estado de partida.
    telonSube: 600,
    telonBaja: 400,
    // Espera antes de pedir el trozo 3D tras ensamblarse el logo, en ms. La flotación arranca a los
    // 500 ms; con 1400 lleva casi un segundo a la vista cuando llega la parada del analizador.
    esperaTrasIntro: 1400,
    vetoNucleos: 2,       // hardwareConcurrency <= esto: ni se intenta
    vetoMemoria: 2,       // deviceMemory (GB) <= esto: ni se intenta
    minNucleos: 4,        // por debajo: calidad baja
    minMemoria: 4,        // por debajo: calidad baja
    // 12, no 8. Con 8 hilos lógicos —cualquier portátil moderno— el nivel alto era el camino por
    // defecto de la mayoría del escritorio, y medido son 90 132 triángulos en el grafo frente a
    // 64 460 del medio: un 40 % más de trabajo para una diferencia que no se ve (48 tubos en vez
    // de 36 y 128 segmentos de revolución en vez de 96).
    altaNucleos: 12,      // desde aquí y sin puntero grueso: calidad alta
    dprMax: 2,            // tope de relación de píxeles en sobremesa
    dprMaxTactil: 1.5,    // tope con puntero grueso
    dprMin: 0.8,          // suelo al repartir el presupuesto en pantallas enormes
    // Dos presupuestos. Con 2,6 M para todos, un escritorio de 2560x1440 salía a 0,84 de dpr, o
    // sea por debajo de la resolución nativa y con la imagen visiblemente blanda, y eso con solo
    // 43 llamadas de dibujo. En un móvil, en cambio, el relleno es exactamente lo que duele.
    presupuestoPx: 4000000,       // píxeles de dibujo como mucho, con ratón
    presupuestoPxTactil: 2000000, // ...y con puntero grueso
    muestrasFps: 90,      // frames que se miden antes de decidir si degradar
    ventanaFps: 1500,     // ...o ese tiempo, lo que llegue antes (a 8 fps, 90 frames son 11 s)
    saltoFps: 500,        // ms: por encima no es lentitud, es un salto (pestaña, GC, depurador)
    msLento: 22,          // ~45 fps: baja un escalón
    msInsufrible: 34,     // ~29 fps: segundo aviso -> se rinde y vuelve al CSS
    ventanasBuenas: 4,    // ventanas seguidas por encima de msLento para SUBIR un peldaño otra vez
    sinFotogramas: 1500,  // ms sin un solo fotograma dibujado -> se rinde (ver core/escena.ts)
    origen: 'propio',
  },
  // LA GALERÍA. `arranque` es la fracción del capítulo que se le regala al motor para que se
  // aparte ANTES de que entre la primera tarjeta. Sin él, la tarjeta aparece encima de la campana:
  // el desvío del motor empieza al 10 % del tramo y las tarjetas empezaban al 0 %.
  // `margenBajar`: "Ver los proyectos" (#bajar) aterriza en la PRIMERA TARJETA, no al principio de
  // GALERIA. Estas unidades por encima de `arranque` caen justo PASADO el cruce de entrada, que dura
  // min(500, 14 % del paso) = 230 unidades (galeria.ts): así se llega con la tarjeta ya entera. Con
  // 60 se caía al 26 % del cruce y, con su `out(3)`, la tarjeta se quedaba a opacidad 0,6 (medido).
  galeria: {
    arranque: 0.18,
    margenBajar: 250,
    // LA MINI-SECUENCIA DE CADA TARJETA (effects/galeria.ts). Antes la tarjeta entraba en bloque
    // (opacidad + 26 px); ahora cada pieza entra por su turno: título, captura destapándose de
    // arriba abajo, los tres párrafos escalonados, y el acceso y el aviso al final.
    // TODO EN FRACCIONES DEL CRUCE, no en unidades: el cruce sigue siendo min(500, 14 % del paso)
    // (230 unidades con cinco tarjetas en 10 alturas), así que el reparto y `indice()` no cambian y
    // el contador sigue diciendo lo mismo. Con el cruce nominal de 500, un stagger de 0,16 son los
    // 80 ms del informe; con el de hoy, 37. Cada pieza acaba como muy tarde en 1,0 (la entrada) y
    // la salida es más corta (0,7 del cruce) y en orden inverso: lo último que entró es lo primero
    // que se va, y el título es lo último que queda.
    secuencia: {
      // El contenedor de la tarjeta se enciende en esta fracción del cruce al empezar la entrada y
      // se apaga en la misma al acabar la salida (el porqué, en galeria.ts): 11 unidades de hoy.
      contenedor: 0.05,
      entrada: {
        titulo:   { ini: 0,    dur: 0.55, y: 28, ease: 'out(3)' },
        captura:  { ini: 0.10, dur: 0.60, ease: 'out(4)' },                      // opacidad + clip-path de arriba abajo
        parrafos: { ini: 0.22, dur: 0.42, y: 18, stagger: 0.16, ease: 'out(3)' }, // .que, .pila, .detalle: el último acaba en 0,96
        acceso:   { ini: 0.56, dur: 0.30, y: 18, stagger: 0.14, ease: 'out(3)' }, // .acceso, .aviso: el aviso acaba en 1,00
      },
      salida: {
        acceso:   { ini: 0,    dur: 0.26, y: 12, stagger: 0.06, ease: 'in(2)' },
        parrafos: { ini: 0.06, dur: 0.28, y: 12, stagger: 0.08, ease: 'in(2)' }, // al revés: detalle, pila, que
        captura:  { ini: 0.18, dur: 0.36, ease: 'in(2)' },
        titulo:   { ini: 0.30, dur: 0.40, y: 28, ease: 'in(2)' },                 // acaba en 0,70
      },
      // EL ESQUEMA (el <svg class="esquema"> entre la pila y el detalle) entra y sale como un
      // párrafo más, pero con SUS PROPIOS tweens y no metido en el stagger de `parrafos`: así los
      // tres párrafos siguen entrando cuando entraban. Entra a mitad de camino entre la pila
      // (0,22 + 0,16 = 0,38) y el detalle (0,54) y sale entre el detalle (0,06) y la pila (0,14).
      esquema: {
        entrada: { ini: 0.46, dur: 0.42, y: 18, ease: 'out(3)' },   // acaba en 0,88 < 1,00
        salida:  { ini: 0.10, dur: 0.28, y: 12, ease: 'in(2)' },    // acaba en 0,38 < 0,70
      },
    },
    // LOS ESQUEMAS VIVOS (effects/esquemas.ts, fila 21 del informe: "la galería son cinco capturas
    // JPG; nada avanza con el scroll dentro de la tarjeta"). Cada tarjeta lleva un dibujo pequeño
    // que el SCROLL traza mientras la tarjeta está delante: en el TRAMO QUIETO, del final del cruce
    // de entrada al principio del de salida (1 640 − 2 · 230 = 1 180 unidades con cinco tarjetas en
    // diez alturas), así que es reversible al subir y no se cruza con las entradas.
    //
    // Cada pieza del dibujo tiene su VENTANA en fracciones [desde, hasta] de ese tramo quieto. Las
    // formas (rect, line, path, polyline, circle) se trazan de '0 0' a '0 1' (createDrawable); los
    // rótulos <text> y las piezas con data-fundido se encienden en opacidad; el punto con data-ruta
    // recorre la polilínea .ruta de su esquema en la ventana `viaje`. Todo lineal: a mitad de su
    // ventana una pieza está exactamente a la mitad, que es lo que se mide en el QA. Las ventanas
    // se solapan a propósito (la línea del flujo avanza mientras aparecen las cajas): lo que se ve
    // es una secuencia, no cinco cosas apareciendo de golpe. El nombre de cada clave es el
    // data-paso del elemento en index.html; una clave sin elemento no hace nada, y al revés igual.
    esquemas: {
      // 1) SysRRHH: tres cajas en fila unidas por una línea, y un tic al final. La línea va por
      //    DEBAJO de las cajas (que tapan con el color del fondo): se dibuja de un tirón y se ve
      //    asomar entre caja y caja, como una tubería que va llegando a cada etapa.
      flujo: {
        caja1: [0.00, 0.16], r1: [0.08, 0.18],
        linea: [0.06, 0.72],
        caja2: [0.28, 0.44], r2: [0.36, 0.46],
        caja3: [0.50, 0.66], r3: [0.58, 0.68],
        tic:   [0.76, 0.90],
      },
      // 2) KUIDY-CORE: un formulario que se construye solo: tres campos cuyos bordes se trazan
      //    uno tras otro, y un botón que se traza y luego se rellena.
      formulario: {
        campo1: [0.00, 0.20], r1: [0.12, 0.22],
        campo2: [0.22, 0.42], r2: [0.34, 0.44],
        campo3: [0.44, 0.64], r3: [0.56, 0.66],
        boton:  [0.68, 0.82], relleno: [0.82, 0.92], r4: [0.86, 0.96],
      },
      // 3) TechDocAPI: tres rutas de arriba abajo: el punto, el rótulo y la línea hasta el "200".
      rutas: {
        punto1: [0.00, 0.06], r1: [0.06, 0.16], linea1: [0.10, 0.28],
        punto2: [0.30, 0.36], r2: [0.36, 0.46], linea2: [0.40, 0.58],
        punto3: [0.60, 0.66], r3: [0.66, 0.76], linea3: [0.70, 0.88],
      },
      // 4) API financiera reactiva: el BFF a la izquierda, dos servicios a la derecha, dos flechas
      //    en paralelo y la vuelta; luego el identificador de correlación (el punto) recorre la
      //    ruta: sale del BFF, llega a un servicio y vuelve por la línea de abajo.
      correlacion: {
        nodoA: [0.00, 0.12], rA: [0.06, 0.14],
        flecha1: [0.12, 0.30], flecha2: [0.12, 0.30],
        nodoB: [0.26, 0.38], nodoC: [0.26, 0.38], rB: [0.32, 0.40], rC: [0.32, 0.40],
        vuelta: [0.38, 0.52],
        id: [0.52, 0.56], viaje: [0.54, 0.96],
      },
      // 5) Kip-Up Comandas: mesa -> cocina -> caja con dos flechas, y el ticket (el rectángulo
      //    con el borde dentado y tres rayas) aparece al final.
      comandas: {
        mesa: [0.00, 0.14], r1: [0.08, 0.16],
        flecha1: [0.16, 0.28],
        cocina: [0.28, 0.42], r2: [0.36, 0.44],
        flecha2: [0.44, 0.56],
        caja: [0.56, 0.70], r3: [0.64, 0.72],
        ticket: [0.74, 0.86], rayas: [0.86, 0.94],
      },
    } as Record<string, Record<string, [number, number]>>,
    origen: 'propio',
  },

  // EL TITULAR DE CAPÍTULO (effects/titulo.ts): el gesto con que entra cuando cambia el nombre.
  // Va fuera del maestro (es la reacción a un cambio de estado, no un instante del reloj).
  titulo: {
    gesto: {
      duration: 380,   // ms: más corto que el cruce más corto del maestro (500), para no pisar el siguiente cambio
      y: 14,           // px que sube al entrar
      ease: 'out(3)',
    },
    origen: 'propio',
  },

  // EL PIE DE PÁGINA (effects/pie.ts). `tapa`: cuando el borde inferior de #capitulos sube por
  // encima de esta fracción de la ventana ya manda el "Yoiber" del pie y el titular se vacía.
  // `entrada`: los bloques suben de 0 a 1 con scrub exacto mientras el pie asoma (sync: true).
  pie: {
    tapa: 0.6,
    entrada: {
      y: 24,            // px que sube cada bloque
      duration: 600,    // ms nominales: con sync el reloj es el scroll, así que solo cuenta la proporción con el stagger
      stagger: 90,      // ms entre bloque y bloque (4 bloques: el último arranca al 45 % del recorrido)
      ease: 'out(3)',
      // Umbrales en el orden de v4: '<borde del contenedor> <borde del objetivo>'.
      enter: 'bottom top',   // el borde inferior de la ventana toca el borde superior del pie: asoma
      leave: 'center top',   // el borde superior del pie llega al centro de la ventana: ya está entero
    },
    origen: 'propio',
  },

  subnav: { visible: [0.02, 0.98] as [number, number], origen: 'propio' },
};
