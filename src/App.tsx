import { useState } from "react";
import AnimatedText from "./components/AnimatedText";
import AnimatedLogo from "./components/AnimatedLogo";

const App = () => {
  const [showText, setShowText] = useState(false);

  return (
    <main className="h-screen w-screen relative overflow-hidden flex items-center justify-center">
      {/* Fondo con gradiente */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-black to-black" aria-hidden="true"></div>

      {/* Lockup: logo arriba, nombre debajo. El grupo entero queda centrado. */}
      <div className="hero relative z-10 flex flex-col items-center">
        <AnimatedLogo size="clamp(170px, 42vmin, 320px)" onAnimationComplete={() => setShowText(true)} />

        {/* Altura reservada para que el logo no salte cuando aparece el texto */}
        <div className="hero-text px-4 max-w-full">
          {showText && (
            <AnimatedText
              text="yoiberdev"
              delay={0.2}
              staggerDelay={0.06}
              flipDelay={1.6}
              flipInterval={3}
              colorSplit={6}
              primaryColor="text-white"
              secondaryColor="text-cyan-400"
            />
          )}
        </div>
      </div>
    </main>
  );
};

export default App;
