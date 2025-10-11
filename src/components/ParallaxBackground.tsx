import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const ParallaxBackground = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const layer1Ref = useRef<HTMLDivElement>(null);
  const layer2Ref = useRef<HTMLDivElement>(null);
  const layer3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const layer1 = layer1Ref.current;
    const layer2 = layer2Ref.current;
    const layer3 = layer3Ref.current;

    // Parallax para diferentes capas con velocidades distintas
    if (layer1) {
      gsap.to(layer1, {
        yPercent: -50,
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: true
        }
      });
    }

    if (layer2) {
      gsap.to(layer2, {
        yPercent: -30,
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: true
        }
      });
    }

    if (layer3) {
      gsap.to(layer3, {
        yPercent: -20,
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: true
        }
      });
    }

    // Animación de partículas flotantes
    const particles = containerRef.current.querySelectorAll('.particle');
    particles.forEach((particle, index) => {
      gsap.to(particle, {
        y: -200,
        rotation: 360,
        duration: 10 + index * 2,
        repeat: -1,
        ease: "none",
        delay: index * 0.5
      });

      gsap.to(particle, {
        x: 'random(-100, 100)',
        duration: 8 + index,
        repeat: -1,
        yoyo: true,
        ease: "power1.inOut",
        delay: index * 0.3
      });
    });

  }, []);

  // Generar partículas aleatorias
  const generateParticles = () => {
    const particles = [];
    for (let i = 0; i < 20; i++) {
      particles.push(
        <div
          key={i}
          className="particle absolute w-1 h-1 bg-white/20 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            willChange: 'transform'
          }}
        />
      );
    }
    return particles;
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ willChange: 'transform' }}
    >
      {/* Layer 1 - Gradient más lejano */}
      <div
        ref={layer1Ref}
        className="absolute inset-0 opacity-40"
        style={{ willChange: 'transform' }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-transparent to-cyan-900/30" />
      </div>

      {/* Layer 2 - Gradient medio */}
      <div
        ref={layer2Ref}
        className="absolute inset-0 opacity-60"
        style={{ willChange: 'transform' }}
      >
        <div className="absolute inset-0 bg-gradient-to-tl from-transparent via-slate-800/20 to-transparent" />
      </div>

      {/* Layer 3 - Partículas */}
      <div
        ref={layer3Ref}
        className="absolute inset-0"
        style={{ willChange: 'transform' }}
      >
        {generateParticles()}
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-10">
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px',
            willChange: 'transform'
          }}
        />
      </div>

      {/* Gradiente principal */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-black to-black" />
    </div>
  );
};

export default ParallaxBackground;