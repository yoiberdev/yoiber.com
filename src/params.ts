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
      // ms que tarda el scroller en pasar de su suavizado a ir CLAVADO al scroll cuando empieza un
      // viaje (core/viaje.ts). Con el paso de golpe, el maestro recuperaba en UN fotograma todo el
      // retraso que llevara (medido: 436 a 1 128 unidades al soltar el imán o al hacer clic justo
      // después de la rueda). Con la rampa, el mayor paso es el del suavizado de siempre.
      rampa: 200,
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
    // EL LEMA SE ESCRIBE LETRA A LETRA (tanda 4, effects/hero.ts). El presupuesto manda: el texto
    // empieza a los 3 200 ms y la intro por tiempo acaba a los 5 100, y lo que se pase cae en
    // HERO_OUT y ya lo movería el scroll. Con 53 letras un escalón fijo no cabe, así que el escalón
    // es un RANGO: la última letra arranca `rango` ms después de la primera, repartidas con
    // `reparto`. Lema entero a los 3 200 + 700 + 600 = 4 500 ms, a la vez que acaba de encenderse el
    // anillo del fondo (4 564): la presentación se lee como una sola acción.
    // La nota y el enlace esperan `resto` ms: entran cuando el lema va por la mitad, no antes.
    lema: { x: '0.35em', duracion: 600, rango: 700, ease: 'out(4)', reparto: 'inOut(2)', resto: 450 },
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
      // El apagado en HERO_OUT, de la última marca a la primera. `duration` es lo que tarda CADA
      // marca; el escalón entre ellas no va aquí, se calcula para que la última acabe con el velo
      // (1 200 unidades hoy: 71 escalones de 10 más 480). `barrido`: fracción del velo que tarda
      // en irse el barrido, que va solo y sin escalón.
      apagado: { duration: 480, barrido: 0.5 },
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
  // «Por dentro» aterriza al 40 % de COMO: con el giro nuevo, ahí están los nueve rótulos abiertos y
  // el despiece a mitad de su vuelta (antes 0,30, con los rótulos aún abriéndose).
  cabecera: { dentro: 0.4, origen: 'propio' },
  panel: {
    entrada: { rotateX: 70, y: '70vh', scale: 0.6 },
    galeria: { rotateY: 18 },
    como: { rotateX: 45, z: 160, giro: -180 },
    // La lista de piezas del escenario CSS (core/escenario.ts), en fracciones de COMO. Las nueve
    // entradas acaban en 0,05 + 8 × 0,03 + 0,08 = 0,37, con el panel ya abierto; la salida empieza
    // en 0,84 y la última acaba en 0,84 + 8 × 0,01 + 0,06 = 0,98, antes de CIERRE.
    lista: { x: -16, desde: 0.05, entra: 0.08, escalon: 0.03, hasta: 0.84, sale: 0.06, escalonSalida: 0.01 },
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
  // Dónde aterrizan "Ver los proyectos", el enlace Proyectos y la parada de la sub-nav ya no es un
  // número de aquí: lo calcula galeria.ts (tiempoConVida), en la primera tarjeta con su esquema
  // trazado y la vida encendida. Antes era `margenBajar: 250`, que caía con el esquema al 1,6 % y
  // la tarjeta muerta al llegar (medido: 0 %/s).
  galeria: {
    // EL ARCO DEL CONTADOR en segmentos (galeria.ts, tanda 5): grados de hueco entre uno y otro.
    arco: { hueco: 14 },
    arranque: 0.18,
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
      // EL TÍTULO PARTIDO (tanda 5): cada trozo dura esta fracción del tramo del título y el resto es
      // el escalón entre el primero y el último, así que el título entra y sale en el mismo tiempo.
      // `desde` y `hasta`: más de un 100 % porque la máscara mide más que el trozo (el aire de los
      // descendentes) y las letras asomaban como rayas de 1 px al principio y al final.
      tituloPartido: { trozo: 0.6, desde: '115%', hasta: '-125%' },
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
    // LA VIDA DEL ESQUEMA (effects/vida-esquemas.ts): lo único de la galería que corre con el
    // reloj del NAVEGADOR y no con el del scroll. Sin esto, con el scroll parado la tarjeta
    // cambiaba el 0 % de sus píxeles por segundo mientras el motor cambiaba el 9,5 %.
    vida: {
      salto: 420,      // ms que tarda el foco en pasar de una caja a la siguiente (duración PERCIBIDA del muelle)
      espera: 900,     // ms que se queda en cada caja, de media; por debajo de ~700 parece nervioso
      // LA CADENA DEL FOCO (tanda 5). Cada espera es `espera` por un factor al azar de `azar`, con
      // una semilla fija por tarjeta (`semilla` + su índice): no se repite la misma vuelta, pero dos
      // cargas dan la misma secuencia y el QA es repetible. El orden de las cajas NO cambia: es un
      // registro que avanza por etapas.
      azar: [0.55, 1.5] as [number, number],
      semilla: 17,
      // El salto llega con un muelle y se pasa un poco: con bounce 0,27 el amortiguamiento es 0,73 y el
      // sobrepaso ronda el 3,5 % del recorrido. Más de un 5 % y el marco se salía por el hueco de 16
      // unidades entre cajas.
      muelle: 0.27,
      // LA CAJA QUE REACCIONA: mientras el foco está en ella, su trazo engorda (`--toque` de 0 a 1,
      // base.css). En ms: lo que tarda en encenderse al llegar el foco y en apagarse al irse.
      toque: { entra: 260, sale: 520 },
      aire: 3,         // unidades del viewBox que el foco se infla sobre la caja, para no tapar el rótulo
      opacidad: 0.55,  // el foco acompaña, no compite con el dibujo que traza el scroll
      viaje: 820,      // ms que tarda la chispa en recorrer 100 unidades de línea
      respiro: 500,    // ms apagado entre una vuelta y la siguiente
      chispa: 34,      // unidades del viewBox que mide el trazo encendido; con 3,2 (un punto) no se veía
      escalon: 420,    // ms entre la chispa de una ruta y la de la siguiente
      // EL ENCENDIDO. La vida arranca donde acaba de trazarse la última pieza (galeria.ts,
      // finDelDibujo(): hoy 0,342 del tramo quieto) y llega a opacidad 1 tras `entraLargo` más de
      // tramo, siguiendo al scroll. Con 0,05 son ~62 unidades del maestro, unos 55 px de rueda:
      // se ve encenderse sin que parezca un parpadeo.
      entraLargo: 0.05,
      // Cuánto más allá del encendido completo aterrizan los enlaces a Proyectos: un margen para
      // que el suavizado del scroll no deje la vida a medio encender al llegar.
      aterrizaAire: 0.03,
      // EL BRILLO DE LA BARRA (tanda 4): en los teléfonos bajos el esquema no se ve y la tarjeta se
      // quedaba sin nada vivo. Un destello de `largo` (fracción de la barra) la recorre en `viaje`
      // ms y vuelve a empezar SIN pausa, a propósito: con 250 ms de respiro y 1,7 s de viaje había
      // segundos en que solo cambiaba el 0,23 % de la fila de abajo de la tarjeta (medido en el
      // iPhone 13), y la tarjeta volvía a parecer una foto.
      // `largo` 0,5 y con meseta (base.css): la barra mide 2 px y no admite halo (su destape la
      // recorta), así que la señal tiene que salir de la propia barra; con 0,3 y sin meseta había
      // segundos con el 0,27 % de la tarjeta cambiando.
      brillo: { largo: 0.5, viaje: 1400, respiro: 0, ease: 'inOut(2)' },
    },
    // Qué fracción del tramo quieto de la tarjeta ocupa el DIBUJO del esquema. El resto queda para
    // la capa de vida. Con 1 (como estaba) el dibujo acababa cuando la tarjeta ya se iba, y no
    // había ni un instante con el esquema entero delante; con 0,38 el dibujo sigue durando ~410
    // unidades del maestro (unos 370 px de rueda) y la vida se queda con el 58 % del tramo.
    dibujo: 0.38,

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
    // LA BARRA DE AVANCE de la captura (<span class="avance">, effects/esquemas.ts). Es la otra
    // mitad de la fila 21: el esquema vive en una fila propia y el detalle con sus cifras está
    // oculto en vertical, así que en los teléfonos por debajo de 900 px de alto no quedaba nada
    // avanzando con el scroll dentro de la tarjeta. La barra ocupa el TRAMO QUIETO ENTERO, en las
    // mismas fracciones que las ventanas de arriba: [0, 1] es "empieza cuando la tarjeta acaba de
    // entrar y llega al final justo cuando empieza a irse", que es lo que se mide (al 20/50/80 %
    // del tramo la barra vale 0,2/0,5/0,8). No es un paso del dibujo: no va en `esquemas`, que se
    // busca por el data-esquema de cada svg.
    avance: [0, 1] as [number, number],
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
    // EL PULSO del segmento del arco al cambiar de proyecto (tanda 5): el trazo pasa de 2 a `pico` en
    // `sube` ms y vuelve en `baja`. Es el único acento del cambio de tarjeta.
    pulso: { pico: 4, sube: 50, baja: 100 },
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

  // EL CIERRE (effects/cierre.ts, tanda 4): la frase del despegue, en fracciones del tramo CIERRE.
  // Entra con el penacho (PM.coreo.cierre.penacho empieza en 0,14) y la última pieza acaba de
  // entrar en 0,10 + 0,03·2 + 0,13 = 0,29; se va y la última acaba en 0,59 + 0,02·2 + 0,10 = 0,73,
  // antes del fundido a negro (0,74). Entre medias, casi la mitad del tramo, quieta y legible.
  cierre: {
    entra: 0.1,
    pieza: 0.13,         // lo que tarda en entrar cada pieza (titular, frase, enlace)
    escalon: 0.03,
    sale: 0.59,
    piezaSalida: 0.1,
    escalonSalida: 0.02,
    y: 24,               // px que sube cada pieza al entrar (y otros tantos al irse)
    origen: 'propio',
  },

  // EL VIAJE (core/viaje.ts, tanda 3): todos los saltos de la página —cabecera, «Ver los
  // proyectos», paradas y clic en la sub-nav, «Volver arriba»— son un tween propio del scroll y no un
  // scrollTo de un fotograma. La duración crece con la RAÍZ de las pantallas recorridas: una
  // pantalla son 750 ms, del hero al despiece (unas 12) el tope de 1 800. Con la raíz y no lineal,
  // porque en lineal los saltos cortos se arrastraban o los largos se volvían eternos.
  viaje: {
    base: 350,          // ms fijos de cualquier viaje
    porRaiz: 400,       // ms por la raíz cuadrada de las pantallas recorridas
    min: 500,
    max: 1800,
    ease: 'inOut(2)',
    // Lo que cuenta como «el visitante ha movido el scroll por su cuenta» y cancela el viaje: si el
    // scroll está a más de estos px de lo último que escribió el tween (barra de scroll, búsqueda
    // en la página, un ancla...), el viaje se suelta en ese mismo fotograma.
    desvio: 3,
    // ...salvo en el arranque: si el navegador aún está animando SU scroll (AvPág, Espacio, flechas
    // y la rueda suave duran 150-400 ms, y un scrollTo instantáneo no los detiene), ese movimiento
    // venía de antes del clic y el viaje lo absorbe en vez de soltarse. Hasta que el scroll pase un
    // fotograma sin moverse por su cuenta, y como mucho estos ms. Sin esto, el clic se perdía.
    gracia: 500,
    reciente: 250,      // ms: cuánto antes del viaje cuenta un gesto como «el que aún se mueve»
    origen: 'propio',
  },

  subnav: {
    visible: [0.02, 0.98] as [number, number],
    // EL TECLADO del cursor (role=slider): flechas un 2 % con un tween corto que responde ya
    // (out, no inOut: con la tecla mantenida cada repetición arranca desde parado y un inOut no
    // llegaba a acelerar nunca); RePag/AvPag, de parada en parada con el viaje de siempre.
    tecla: { paso: 0.02, duracion: 320, ease: 'out(3)' },
    // EL IMÁN al soltar el cursor: a menos de estos px de barra de una estación (las rayitas), el
    // scroll viaja hasta ella. Más lejos, se queda donde se soltó.
    iman: 10,
    // EL AGARRE (el cursor mide 4 px): escala de la marca al pasar el ratón y al agarrarla. Va en un
    // hijo del cursor, porque el cursor lo mueve el Draggable con su propio transform.
    agarre: { hover: [1.5, 1.1] as [number, number], agarrado: [2, 1.3] as [number, number], ms: 250, ease: 'out(3)' },
    origen: 'propio',
  },
};
