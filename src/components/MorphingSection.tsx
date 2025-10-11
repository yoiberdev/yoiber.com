import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const MorphingSection = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const morphShapeRef = useRef<SVGPathElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const fragmentsRef = useRef<HTMLDivElement[]>([]);

  const concepts = [
    {
      title: "Code as Poetry",
      description: "Cada línea de código es un verso en la sinfonía digital que construye realidades virtuales",
      fragments: ["syntax", "semantics", "elegance", "flow"]
    },
    {
      title: "Digital Consciousness", 
      description: "Explorando la frontera donde la lógica computacional se encuentra con la intuición creativa",
      fragments: ["neural", "patterns", "emergence", "cognition"]
    },
    {
      title: "Temporal Architecture",
      description: "Diseñando estructuras que existen en múltiples dimensiones temporales simultáneamente",
      fragments: ["time", "space", "dimension", "reality"]
    }
  ];

  useEffect(() => {
    if (!containerRef.current || !morphShapeRef.current) return;

    const container = containerRef.current;
    const morphShape = morphShapeRef.current;
    const textContainer = textRef.current;
    const fragments = fragmentsRef.current;

    // Formas simplificadas para mejor rendimiento
    const shapes = [
      "M200,50 Q300,100 400,50 Q350,150 400,250 Q300,200 200,250 Q250,150 200,50",
      "M150,100 Q250,50 350,100 Q400,200 350,300 Q250,350 150,300 Q100,200 150,100"
    ];

    let isAnimating = false;

    // Animación de morphing simplificada
    const morphTL = gsap.timeline({
      repeat: -1,
      yoyo: true,
      ease: "power1.inOut",
      paused: true
    });

    shapes.forEach((shape) => {
      morphTL.to(morphShape, {
        attr: { d: shape },
        duration: 4,
        ease: "power2.inOut"
      });
    });

    // Solo iniciar morphing cuando está visible
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !isAnimating) {
          morphTL.play();
          isAnimating = true;
        } else if (!entry.isIntersecting && isAnimating) {
          morphTL.pause();
          isAnimating = false;
        }
      });
    }, { threshold: 0.1 });

    observer.observe(container);

    // Scroll trigger optimizado
    ScrollTrigger.create({
      trigger: container,
      start: "top 80%",
      end: "bottom 20%",
      scrub: 1,
      onUpdate: (self) => {
        const progress = self.progress;
        
        // Animación simplificada del título
        if (textContainer) {
          const titleElement = textContainer.querySelector('.morph-title');
          if (titleElement) {
            const letters = titleElement.querySelectorAll('.letter');
            letters.forEach((letter, letterIndex) => {
              const offset = letterIndex * 0.1;
              const wave = Math.sin((progress + offset) * Math.PI * 2);
              
              gsap.set(letter, {
                y: wave * 10,
                rotation: wave * 5,
                scale: 1 + wave * 0.1
              });
            });
          }

          // Fragmentos simplificados
          fragments.forEach((fragment, fragIndex) => {
            if (fragment) {
              const phase = (progress + fragIndex * 0.2) * Math.PI;
              gsap.set(fragment, {
                x: Math.sin(phase) * 30,
                y: Math.cos(phase) * 20,
                opacity: 0.5 + Math.sin(phase) * 0.3
              });
            }
          });
        }
      }
    });

    // Efecto de brillo suave en lugar de ruido
    const glowAnimation = gsap.to(morphShape, {
      filter: "brightness(1.2) hue-rotate(10deg)",
      duration: 3,
      ease: "power2.inOut",
      yoyo: true,
      repeat: -1
    });

    return () => {
      observer.disconnect();
      ScrollTrigger.getAll().forEach(trigger => {
        if (trigger.trigger === container) {
          trigger.kill();
        }
      });
      morphTL.kill();
      glowAnimation.kill();
    };
  }, []);

  const splitTextToLetters = (text: string) => {
    return text.split('').map((letter, index) => (
      <span key={index} className="letter inline-block" style={{ willChange: 'transform' }}>
        {letter === ' ' ? '\u00A0' : letter}
      </span>
    ));
  };

  const generateShapeParticles = () => {
    const particles = [];
    for (let i = 0; i < 6; i++) {
      particles.push(
        <div
          key={`shape-particle-${i}`}
          className="shape-particle absolute w-1 h-1 bg-cyan-400/40 rounded-full"
          style={{ 
            willChange: 'transform',
            left: `${20 + i * 10}%`,
            top: `${30 + (i % 3) * 20}%`
          }}
        />
      );
    }
    return particles;
  };

  return (
    <div 
      ref={containerRef}
      className="min-h-screen relative overflow-hidden bg-gradient-to-b from-black via-gray-900 to-black flex items-center justify-center"
      style={{ willChange: 'transform' }}
    >
      {/* Shape morphing principal */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg 
          width="500" 
          height="400" 
          viewBox="0 0 500 400"
          className="opacity-20"
          style={{ willChange: 'transform' }}
        >
          <defs>
            <linearGradient id="morphGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.4" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <path
            ref={morphShapeRef}
            d="M200,50 Q300,100 400,50 Q350,150 400,250 Q300,200 200,250 Q250,150 200,50"
            fill="url(#morphGradient)"
            filter="url(#glow)"
            style={{ willChange: 'transform' }}
          />
        </svg>

        {/* Partículas que siguen la forma */}
        {generateShapeParticles()}
      </div>

      {/* Contenido textual fragmentado */}
      <div 
        ref={textRef}
        className="relative z-10 text-center max-w-4xl mx-auto px-8"
        style={{ willChange: 'transform' }}
      >
        <h2 className="morph-title text-6xl md:text-8xl font-black text-white mb-8">
          {splitTextToLetters("CREATIVE CODE")}
        </h2>

        <div className="relative h-32 mb-12">
          {concepts[0].fragments.map((fragment, index) => (
            <div
              key={fragment}
              ref={(el) => { if (el) fragmentsRef.current[index] = el; }}
              className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-2xl font-bold text-cyan-300"
              style={{ willChange: 'transform' }}
            >
              {fragment}
            </div>
          ))}
        </div>

        <p className="text-xl md:text-2xl text-gray-300 leading-relaxed opacity-80">
          Donde la programación trasciende la funcionalidad para convertirse en expresión artística.
          Cada algoritmo es un pincel, cada función una nota musical en la composición digital.
        </p>
      </div>

      {/* Elementos decorativos */}
      <div className="absolute top-1/4 left-10 w-32 h-32 border-2 border-purple-500/30 rounded-full animate-spin-slow" 
           style={{ animationDuration: '20s' }} />
      <div className="absolute bottom-1/4 right-10 w-24 h-24 border-2 border-cyan-500/30 rounded-full animate-spin-slow" 
           style={{ animationDuration: '15s', animationDirection: 'reverse' }} />

      {/* Grid distorsionado */}
      <div className="absolute inset-0 opacity-5">
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `
              radial-gradient(circle at 50% 50%, rgba(6,182,212,0.3) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            transform: 'perspective(500px) rotateX(20deg)',
            willChange: 'transform'
          }}
        />
      </div>
    </div>
  );
};

export default MorphingSection;