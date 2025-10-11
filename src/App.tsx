import { useState } from "react";
import AnimatedText from "./components/AnimatedText";
import AnimatedLogo from "./components/AnimatedLogo";

const App = () => {
  const [showText, setShowText] = useState(false);

  const handleLogoComplete = () => {
    // Mostrar el texto después de que termine la animación del logo
    setShowText(true);
  };

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      {/* Fondo con gradiente */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-black to-black"></div>

      {/* Contenido centrado */}
      <div className="relative h-full w-full flex flex-col items-center justify-center" style={{ overflow: 'visible' }}>
        {/* Logo animado - tamaño más grande para el efecto Netflix */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ overflow: 'visible' }}>
          <AnimatedLogo
            size={400}
            onAnimationComplete={handleLogoComplete}
          />
        </div>

        {/* Texto animado que aparece después del logo */}
        {showText && (
          <div className="relative z-10">
            <AnimatedText
              text="yoiberdev"
              className="text-9xl font-bold"
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
    </div>
  );
};

export default App;