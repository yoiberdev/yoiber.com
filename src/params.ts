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
    alturas: { HERO_OUT: 2, DESPEGUE: 1.25 } as Record<string, number>, // en alturas de viewport; 1 altura = 1000 unidades del maestro. Desde el 09/10/2026 el maestro es solo la portada: los proyectos van en flujo, después
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
    // Y por arriba: se tapa a `telonTapa` unidades del final del maestro (el final de DESPEGUE, donde
    // el fundido del motor termina), y no vuelve a subir hasta `telonHolgura` más atrás, para que
    // arrastrar en el borde no lo haga parpadear.
    telonTapa: 40,
    telonHolgura: 120,
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
};
