import AnimatedText from './components/AnimatedText';

const App = () => {
  return (
    <div className="h-screen w-screen relative">
      {/* Fondo con gradiente */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-black to-black"></div>
      
      {/* Contenido centrado */}
      <div className="relative h-full w-full flex items-center justify-center">
        <AnimatedText 
          text="yoiberdev"
          className="text-3xl font-bold -mt-16"
          delay={0.5}
          staggerDelay={0.08}
          flipDelay={1.5}
          flipInterval={3}
          colorSplit={6}
          primaryColor="text-white"
          secondaryColor="text-cyan-400"
        />
      </div>
    </div>
  );
};

export default App;