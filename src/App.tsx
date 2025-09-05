const App = () => {
  return (
    <div className="h-screen w-screen relative">
      {/* Fondo con gradiente */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-black to-black"></div>

      {/* Contenido centrado */}
      <div className="relative h-full w-full flex items-center justify-center">
        <h1 className="text-3xl font-bold text-white -mt-16">yoiberdev</h1>
      </div>
    </div>
  );
};

export default App;
