import { useState } from "react";
import AnimatedText from "./components/AnimatedText";
import AnimatedLogo from "./components/AnimatedLogo";

const App = () => {
  const [showText, setShowText] = useState(false);

  return (
    <main className="h-screen w-screen relative overflow-hidden">
      {/* Fondo con gradiente */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-black to-black" aria-hidden="true"></div>

      <div className="relative h-full w-full flex flex-col items-center justify-center" style={{ overflow: "visible" }}>
        {/* Logo animado: el texto se muestra cuando termina su animación */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ overflow: "visible" }}>
          <AnimatedLogo size={400} onAnimationComplete={() => setShowText(true)} />
        </div>

        {showText && (
          <div className="relative z-10 px-4 max-w-full">
            <AnimatedText
              text="yoiberdev"
              className="font-bold whitespace-nowrap leading-none"
              // Escala con el ancho de pantalla: 128px en escritorio, sin recortarse en móvil
              style={{ fontSize: "clamp(2.75rem, 12vw, 8rem)" }}
              delay={0.5}
              staggerDelay={0.08}
              flipDelay={1.5}
              flipInterval={3}
              colorSplit={6}
              primaryColor="text-white"
              secondaryColor="text-cyan-400"
            />
          </div>
        )}
      </div>
    </main>
  );
};

export default App;
