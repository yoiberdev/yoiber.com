// LOS CASOS QUE SE CUENTAN CON CAPTURAS. Hasta el 27/09/2026 esta entrada solo empaquetaba la hoja y
// las fuentes; ahora monta también el kit de los casos (casos/kit.ts): cifras que cuentan, recorridos
// en pestañas, capturas anotadas con acercamiento y, en Kuantera, la simulación en modo guía. Lo que
// no esté en el marcado de una página, simplemente no se monta.
import '@fontsource-variable/instrument-sans';
import '@fontsource/fragment-mono';
import '../styles/pagina.css';
import { sugerirIdioma } from '../comun/idioma';
import { montarKit } from './kit';

// El aviso de «esta página también está en…», si el navegador pide el otro idioma.
sugerirIdioma();

montarKit();
