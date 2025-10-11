import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const HorizontalScrollSection = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement[]>([]);

  const projects = [
    {
      id: 'neural-interface',
      title: 'Neural Interface Design',
      subtitle: 'Brain-Computer Interaction',
      description: 'Diseño de interfaces que interpretan señales neuronales para control directo de sistemas digitales',
      tech: ['Neural Networks', 'Signal Processing', 'Real-time Computing'],
      color: 'from-purple-600 via-pink-600 to-red-500',
      complexity: 'Experimental'
    },
    {
      id: 'quantum-web',
      title: 'Quantum Web Architecture',
      subtitle: 'Post-Classical Computing',
      description: 'Arquitectura web distribuida usando principios de computación cuántica para procesamiento paralelo',
      tech: ['Quantum Computing', 'Distributed Systems', 'Cryptography'],
      color: 'from-cyan-500 via-blue-600 to-indigo-700',
      complexity: 'Theoretical'
    },
    {
      id: 'bio-adaptive',
      title: 'Bio-Adaptive Algorithms',
      subtitle: 'Living System Integration',
      description: 'Algoritmos que se adaptan en tiempo real basados en respuestas biológicas del usuario',
      tech: ['Bioinformatics', 'Machine Learning', 'Sensor Networks'],
      color: 'from-green-500 via-emerald-600 to-teal-700',
      complexity: 'Advanced'
    },
    {
      id: 'temporal-ui',
      title: 'Temporal UI Framework',
      subtitle: 'Time-Aware Interfaces',
      description: 'Framework de interfaces que evolucionan y se adaptan según patrones temporales de uso',
      tech: ['Temporal Logic', 'Predictive Analytics', 'Adaptive UI'],
      color: 'from-orange-500 via-red-600 to-pink-700',
      complexity: 'Research'
    },
    {
      id: 'meta-reality',
      title: 'Meta-Reality Engine',
      subtitle: 'Multidimensional Experiences',
      description: 'Motor de realidad que combina múltiples capas de percepción para experiencias inmersivas',
      tech: ['Spatial Computing', '3D Graphics', 'Haptic Feedback'],
      color: 'from-violet-600 via-purple-700 to-indigo-800',
      complexity: 'Visionary'
    }
  ];

  useEffect(() => {
    if (!containerRef.current || !scrollContainerRef.current) return;

    const container = containerRef.current;
    const scrollContainer = scrollContainerRef.current;
    const cards = cardsRef.current.filter(Boolean);

    // Limpiar animaciones anteriores
    ScrollTrigger.getAll().forEach(trigger => {
      if (trigger.trigger === container || cards.includes(trigger.trigger as HTMLDivElement)) {
        trigger.kill();
      }
    });

    // Configurar el contenedor horizontal de forma simple
    const cardWidth = window.innerWidth;
    const totalWidth = cards.length * cardWidth;
    
    gsap.set(scrollContainer, {
      width: totalWidth,
      display: 'flex'
    });

    gsap.set(cards, {
      width: cardWidth,
      flexShrink: 0
    });

    // Scroll horizontal principal simplificado
    const horizontalTween = gsap.to(scrollContainer, {
      x: () => -(totalWidth - window.innerWidth),
      ease: "none",
      scrollTrigger: {
        trigger: container,
        start: "top top",
        end: () => `+=${totalWidth - window.innerWidth}`,
        scrub: 1,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        refreshPriority: -1
      }
    });

    // Animaciones simples para cada tarjeta
    cards.forEach((card, index) => {
      if (!card) return;

      // Fade in simple cuando la tarjeta está visible
      ScrollTrigger.create({
        trigger: card,
        start: "left 90%",
        end: "right 10%",
        scrub: 0.5,
        onUpdate: (self) => {
          const progress = self.progress;
          
          // Fade in/out suave
          gsap.set(card, {
            opacity: progress > 0.1 && progress < 0.9 ? 1 : 0.3 + (progress * 0.7)
          });

          // Escala sutil
          gsap.set(card.querySelector('.card-content'), {
            scale: 0.95 + (progress * 0.05)
          });
        }
      });

      // Animación de aparición para el contenido
      const content = card.querySelector('.card-content');
      const title = card.querySelector('.card-title');
      const subtitle = card.querySelector('.card-subtitle');
      const description = card.querySelector('.card-description');
      const tech = card.querySelector('.card-tech');

      if (content && title && subtitle && description && tech) {
        // Estado inicial
        gsap.set([title, subtitle, description, tech], {
          opacity: 0,
          y: 30
        });

        // Animación de entrada cuando la tarjeta está centrada
        ScrollTrigger.create({
          trigger: card,
          start: "left 70%",
          end: "right 30%",
          onEnter: () => {
            const tl = gsap.timeline();
            tl.to(title, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" })
              .to(subtitle, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, "-=0.4")
              .to(description, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, "-=0.3")
              .to(tech, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, "-=0.2");
          },
          onLeave: () => {
            gsap.to([title, subtitle, description, tech], {
              opacity: 0,
              y: -30,
              duration: 0.3,
              ease: "power2.in"
            });
          },
          onEnterBack: () => {
            const tl = gsap.timeline();
            tl.to(title, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" })
              .to(subtitle, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, "-=0.4")
              .to(description, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, "-=0.3")
              .to(tech, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, "-=0.2");
          },
          onLeaveBack: () => {
            gsap.to([title, subtitle, description, tech], {
              opacity: 0,
              y: 30,
              duration: 0.3,
              ease: "power2.in"
            });
          }
        });
      }
    });

    // Manejar resize
    const handleResize = () => {
      const newCardWidth = window.innerWidth;
      const newTotalWidth = cards.length * newCardWidth;
      
      gsap.set(scrollContainer, { width: newTotalWidth });
      gsap.set(cards, { width: newCardWidth });
      
      ScrollTrigger.refresh();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      horizontalTween.kill();
      ScrollTrigger.getAll().forEach(trigger => {
        if (trigger.trigger === container || cards.includes(trigger.trigger as HTMLDivElement)) {
          trigger.kill();
        }
      });
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="horizontal-scroll-section h-screen overflow-hidden bg-black"
    >
      <div 
        ref={scrollContainerRef}
        className="flex h-full"
      >
        {projects.map((project, index) => (
          <div
            key={project.id}
            ref={(el) => { if (el) cardsRef.current[index] = el; }}
            className="relative w-screen h-full flex-shrink-0 flex items-center justify-center p-8"
          >
            {/* Fondo con gradiente */}
            <div 
              className={`absolute inset-0 bg-gradient-to-br ${project.color} opacity-10`}
            />

            {/* Contenido principal */}
            <div className="card-content relative z-10 max-w-4xl mx-auto text-center">
              {/* Título */}
              <h2 className="card-title text-5xl md:text-7xl font-black text-white mb-6">
                {project.title}
              </h2>

              {/* Subtítulo */}
              <h3 className="card-subtitle text-xl md:text-2xl text-cyan-300 mb-8 font-medium">
                {project.subtitle}
              </h3>

              {/* Descripción */}
              <p className="card-description text-lg md:text-xl text-gray-300 leading-relaxed mb-12 max-w-3xl mx-auto">
                {project.description}
              </p>

              {/* Tecnologías */}
              <div className="card-tech flex flex-wrap justify-center gap-4 mb-8">
                {project.tech.map((tech) => (
                  <span
                    key={tech}
                    className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white font-medium border border-white/20 text-sm md:text-base"
                  >
                    {tech}
                  </span>
                ))}
              </div>

              {/* Indicador de complejidad */}
              <div className="text-sm text-gray-400 uppercase tracking-widest font-bold">
                {project.complexity}
              </div>
            </div>

            {/* Indicador de posición */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
              <div className="flex space-x-2">
                {projects.map((_, dotIndex) => (
                  <div
                    key={dotIndex}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      dotIndex === index ? 'bg-cyan-400 scale-125' : 'bg-white/30'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HorizontalScrollSection;