import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const PhilosophySection = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const codeMatrixRef = useRef<HTMLDivElement>(null);
  const thoughtsRef = useRef<HTMLDivElement[]>([]);

  const philosophicalThoughts = [
    {
      concept: "Code.Reality.Merge()",
      reflection: "En cada línea de código escribo fragmentos de realidades alternativas. La programación no es solo instrucción; es manifestación de posibilidades infinitas.",
      codeSnippet: "while(universe.expanding) {\n  consciousness.evolve();\n  reality.redefine();\n}"
    },
    {
      concept: "Temporal.Debugging",
      reflection: "Debuggear código es viajar en el tiempo. Cada error es una ventana a un futuro que pudo ser, cada fix es una decisión que altera la línea temporal del proyecto.",
      codeSnippet: "if(pastMistakes.exist()) {\n  futureVision.adjust();\n  timeline.fork();\n}"
    },
    {
      concept: "Algorithmic.Poetry",
      reflection: "Los algoritmos son poemas en un lenguaje que las máquinas comprenden pero los humanos sienten. Cada función recursiva es un verso que se repite hasta encontrar su propia verdad.",
      codeSnippet: "function meaning(depth) {\n  return depth > 0 ? \n    beauty + meaning(depth-1) : \n    enlightenment;\n}"
    }
  ];

  useEffect(() => {
    if (!containerRef.current) return;

    const codeMatrix = codeMatrixRef.current;
    const thoughts = thoughtsRef.current;
    let matrixIntervals: number[] = [];

    // Matriz de código optimizada
    if (codeMatrix) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}[]()<>=+-*/;.,';
      const matrixColumns = 30; // Reducido de 50
      const matrixRows = 15;    // Reducido de 30

      for (let i = 0; i < matrixColumns * matrixRows; i++) {
        const char = document.createElement('span');
        char.textContent = chars[Math.floor(Math.random() * chars.length)];
        char.className = 'matrix-char absolute text-green-400/10 font-mono text-xs select-none';
        char.style.left = `${(i % matrixColumns) * 3.33}%`;
        char.style.top = `${Math.floor(i / matrixColumns) * 6.67}%`;
        char.style.willChange = 'opacity';
        codeMatrix.appendChild(char);

        // Animación simplificada
        gsap.to(char, {
          opacity: () => Math.random() * 0.3 + 0.05,
          duration: 2,
          repeat: -1,
          yoyo: true,
          delay: Math.random()
        });

        // Cambio de caracteres menos frecuente
        const interval = setInterval(() => {
          char.textContent = chars[Math.floor(Math.random() * chars.length)];
        }, Math.random() * 8000 + 4000);
        
        matrixIntervals.push(interval);
      }
    }

    // Animaciones optimizadas de los pensamientos
    thoughts.forEach((thought) => {
      if (!thought) return;

      const concept = thought.querySelector('.concept');
      const reflection = thought.querySelector('.reflection');
      const codeSnippet = thought.querySelector('.code-snippet');

      ScrollTrigger.create({
        trigger: thought,
        start: "top 80%",
        end: "bottom 20%",
        scrub: 0.5,
        onUpdate: (self) => {
          const progress = self.progress;

          // Animación suave del concepto
          if (concept) {
            const letters = concept.querySelectorAll('.letter');
            letters.forEach((letter, letterIndex) => {
              const wave = Math.sin((progress + letterIndex * 0.1) * Math.PI);
              gsap.set(letter, {
                y: wave * 5,
                scale: 1 + wave * 0.05,
                color: progress > 0.3 ? '#06b6d4' : '#ffffff'
              });
            });
          }

          // Aparición de la reflexión
          if (reflection) {
            gsap.set(reflection, {
              opacity: progress,
              y: (1 - progress) * 20
            });
          }

          // Aparición del código
          if (codeSnippet) {
            gsap.set(codeSnippet, {
              opacity: Math.max(0, progress - 0.3),
              y: Math.max(0, (1 - progress) * 30)
            });
          }
        }
      });
    });

    return () => {
      matrixIntervals.forEach(interval => clearInterval(interval));
      ScrollTrigger.getAll().forEach(trigger => {
        if (trigger.trigger && thoughts.includes(trigger.trigger as HTMLDivElement)) {
          trigger.kill();
        }
      });
    };
  }, []);

  const splitTextToLetters = (text: string) => {
    return text.split('').map((letter, index) => (
      <span key={index} className="letter inline-block" style={{ willChange: 'transform' }}>
        {letter === ' ' ? '\u00A0' : letter}
      </span>
    ));
  };

  const splitCodeToChars = (code: string) => {
    return code.split('\n').map((line, lineIndex) => (
      <div key={lineIndex} className="code-line">
        {line}
      </div>
    ));
  };

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-black text-white relative overflow-hidden"
      style={{ willChange: 'transform' }}
    >
      {/* Matriz de código de fondo */}
      <div 
        ref={codeMatrixRef}
        className="absolute inset-0 opacity-30"
        style={{ willChange: 'transform' }}
      />

      {/* Contenido principal */}
      <div className="relative z-10 py-20 px-8">
        {/* Título principal */}
        <div className="text-center mb-20">
          <h2 className="text-7xl md:text-9xl font-black mb-6">
            {splitTextToLetters("DIGITAL PHILOSOPHY")}
          </h2>
          <div className="w-32 h-1 bg-gradient-to-r from-cyan-400 to-purple-600 mx-auto"></div>
        </div>

        {/* Pensamientos filosóficos */}
        <div className="space-y-32 max-w-6xl mx-auto">
          {philosophicalThoughts.map((thought, index) => (
            <div
              key={thought.concept}
              ref={(el) => { if (el) thoughtsRef.current[index] = el; }}
              className="grid md:grid-cols-2 gap-12 items-center"
              style={{ willChange: 'transform' }}
            >
              {/* Contenido textual */}
              <div className={`space-y-8 ${index % 2 === 1 ? 'md:order-2' : ''}`}>
                <h3 className="concept text-4xl md:text-5xl font-bold text-cyan-400">
                  {splitTextToLetters(thought.concept)}
                </h3>
                
                <p className="reflection text-xl md:text-2xl leading-relaxed text-gray-300">
                  {thought.reflection}
                </p>
              </div>

              {/* Código */}
              <div className={`${index % 2 === 1 ? 'md:order-1' : ''}`}>
                <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6 font-mono">
                  <div className="flex items-center mb-4">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                    <span className="ml-4 text-gray-400 text-sm">consciousness.js</span>
                  </div>
                  
                  <pre className="code-snippet text-green-400 text-sm md:text-base leading-relaxed">
                    {splitCodeToChars(thought.codeSnippet)}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Conclusión */}
        <div className="text-center mt-32">
          <p className="text-2xl md:text-3xl text-gray-400 max-w-4xl mx-auto leading-relaxed">
            En la intersección entre lógica y creatividad, encuentro mi verdadero propósito: 
            <span className="text-cyan-400 font-semibold"> transformar ideas abstractas en experiencias tangibles</span>, 
            donde cada pixel cuenta una historia y cada animación susurra secretos del universo digital.
          </p>
        </div>
      </div>

      {/* Elementos decorativos futuristas */}
      <div className="absolute top-20 right-20 w-64 h-64 border border-cyan-400/20 rounded-full animate-pulse" />
      <div className="absolute bottom-20 left-20 w-48 h-48 border border-purple-400/20 rounded-full animate-pulse" 
           style={{ animationDelay: '1s' }} />
    </div>
  );
};

export default PhilosophySection;