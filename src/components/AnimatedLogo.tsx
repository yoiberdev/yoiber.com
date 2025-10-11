import { useEffect, useRef, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Registrar el plugin
gsap.registerPlugin(ScrollTrigger);

interface AnimatedLogoProps {
  className?: string;
  autoPlay?: boolean;
  size?: number;
  onAnimationComplete?: () => void;
  onScrollAnimationComplete?: () => void;
}

const AnimatedLogo = ({ 
  className = "", 
  autoPlay = true, 
  size = 200,
  onAnimationComplete,
  onScrollAnimationComplete 
}: AnimatedLogoProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<SVGSVGElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const scrollTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const floatingTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const hasPlayedRef = useRef(false);
  const scrollTriggerRef = useRef<ScrollTrigger | null>(null);

  const resetAnimation = useCallback(() => {
    if (timelineRef.current) timelineRef.current.kill();
    
    if (!logoRef.current || !containerRef.current) return;
    
    const triangle = logoRef.current.querySelector(".triangle");
    const trapezoid = logoRef.current.querySelector(".trapezoid");
    const diagonalBar = logoRef.current.querySelector(".diagonal-bar");
    
    // Obtener las dimensiones de la ventana para posicionar fuera de pantalla
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    
    // Posicionar las formas fuera de toda la pantalla en tamaños enormes
    gsap.set(triangle, {
      x: -vw * 1.5,
      y: -vh * 1.2,
      scale: 15,
      rotation: -45,
      opacity: 0.9
    });
    
    gsap.set(trapezoid, {
      x: -vw * 1.8,
      y: vh * 1.5,
      scale: 18,
      rotation: 90,
      opacity: 0.9
    });
    
    gsap.set(diagonalBar, {
      x: vw * 1.8,
      y: -vh * 1.3,
      scale: 20,
      rotation: -60,
      opacity: 0.9
    });
    
    gsap.set(logoRef.current, {
      filter: "blur(0px) brightness(1)",
      scale: 1
    });
  }, []);

  const startFloatingAnimation = useCallback(() => {
    if (!logoRef.current) return;
    
    const triangle = logoRef.current.querySelector(".triangle");
    const trapezoid = logoRef.current.querySelector(".trapezoid");
    const diagonalBar = logoRef.current.querySelector(".diagonal-bar");
    
    // Crear timeline para flotación
    floatingTimelineRef.current = gsap.timeline({ repeat: -1 });
    
    floatingTimelineRef.current
      .to(triangle, {
        duration: 3,
        y: -8,
        rotation: "+=2",
        ease: "power2.inOut",
        yoyo: true,
        repeat: 1
      }, 0)
      .to(trapezoid, {
        duration: 2.5,
        y: 6,
        rotation: "-=1.5",
        ease: "power2.inOut",
        yoyo: true,
        repeat: 1
      }, 0.5)
      .to(diagonalBar, {
        duration: 3.5,
        y: -5,
        rotation: "+=1",
        ease: "power2.inOut",
        yoyo: true,
        repeat: 1
      }, 1);
  }, []);

  const stopFloatingAnimation = useCallback(() => {
    if (floatingTimelineRef.current) {
      floatingTimelineRef.current.kill();
      floatingTimelineRef.current = null;
    }
  }, []);

  const setupScrollAnimation = useCallback(() => {
    if (!containerRef.current || !logoRef.current) return;

    // Limpiar animaciones de scroll previas
    if (scrollTriggerRef.current) {
      scrollTriggerRef.current.kill();
    }
    if (scrollTimelineRef.current) {
      scrollTimelineRef.current.kill();
    }

    // Crear timeline para la animación de scroll
    scrollTimelineRef.current = gsap.timeline({
      paused: true,
      onStart: () => {
        stopFloatingAnimation();
      },
      onComplete: () => {
        onScrollAnimationComplete?.();
      },
      onReverseComplete: () => {
        startFloatingAnimation();
      }
    });

    // Calcular posición final (esquina superior izquierda)
    const finalX = -window.innerWidth * 0.35;
    const finalY = -window.innerHeight * 0.35;
    const finalScale = 0.3;

    // Animación del logo completo
    scrollTimelineRef.current
      .to(containerRef.current, {
        duration: 1,
        x: finalX,
        y: finalY,
        scale: finalScale,
        ease: "power3.inOut"
      })
      .to(logoRef.current, {
        duration: 1,
        rotation: 720, // 2 vueltas completas
        ease: "power3.inOut"
      }, 0) // Comenzar al mismo tiempo
      .set(containerRef.current, {
        position: "fixed",
        top: "5%",
        left: "5%",
        zIndex: 1000,
        transform: "none"
      });

    // Crear ScrollTrigger
    scrollTriggerRef.current = ScrollTrigger.create({
      trigger: "body",
      start: "top top",
      end: "+=600", // 600px de scroll para completar la animación
      scrub: 1.2, // Animación suave ligada al scroll
      animation: scrollTimelineRef.current,
      onUpdate: (self) => {
        // Cuando el scroll esté completo, fijar el logo
        if (self.progress === 1 && containerRef.current) {
          gsap.set(containerRef.current, {
            position: "fixed",
            top: "5%",
            left: "5%",
            zIndex: 1000,
            transform: "scale(0.3)"
          });
        }
      },
      onLeave: () => {
        // Asegurar que el logo quede fijo al salir del trigger
        if (containerRef.current) {
          gsap.set(containerRef.current, {
            position: "fixed",
            top: "5%",
            left: "5%",
            zIndex: 1000,
            transform: "scale(0.3)"
          });
        }
      },
      onEnterBack: () => {
        // Restaurar posición relativa cuando volvemos
        if (containerRef.current) {
          gsap.set(containerRef.current, {
            position: "relative",
            top: "auto",
            left: "auto",
            zIndex: 10,
            transform: "none"
          });
        }
      }
    });
  }, [stopFloatingAnimation, startFloatingAnimation, onScrollAnimationComplete]);

  const playAnimation = useCallback(() => {
    if (!logoRef.current || !containerRef.current) return;
    
    resetAnimation();
    
    const triangle = logoRef.current.querySelector(".triangle");
    const trapezoid = logoRef.current.querySelector(".trapezoid");
    const diagonalBar = logoRef.current.querySelector(".diagonal-bar");
    
    timelineRef.current = gsap.timeline({ 
      ease: "power2.inOut",
      onComplete: () => {
        hasPlayedRef.current = true;
        onAnimationComplete?.();
        // Iniciar animación de flotación después de la animación principal
        setTimeout(() => {
          startFloatingAnimation();
          // Configurar scroll animation después de la animación inicial
          setTimeout(() => {
            setupScrollAnimation();
          }, 1000);
        }, 500);
      }
    });
    
    // FASE 1: Las formas aparecen enormes desde toda la pantalla y convergen
    timelineRef.current
      .to(triangle, {
        duration: 3.5,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        opacity: 1,
        ease: "power4.out"
      })
      .to(trapezoid, {
        duration: 3.8,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        opacity: 1,
        ease: "power4.out"
      }, "-=3.3")
      .to(diagonalBar, {
        duration: 4,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        opacity: 1,
        ease: "power4.out"
      }, "-=3.5")
      
      // FASE 2: Finalización suave y minimalista
      .to(logoRef.current, {
        duration: 0.8,
        filter: "blur(0px) brightness(1)",
        scale: 1,
        ease: "power2.out"
      }, "-=0.5");
  }, [resetAnimation, onAnimationComplete, startFloatingAnimation, setupScrollAnimation]);

  // Effect para autoPlay
  useEffect(() => {
    if (autoPlay && !hasPlayedRef.current) {
      const timer = setTimeout(() => {
        playAnimation();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [autoPlay, playAnimation]);

  // Effect para cleanup
  useEffect(() => {
    return () => {
      if (timelineRef.current) timelineRef.current.kill();
      if (scrollTimelineRef.current) scrollTimelineRef.current.kill();
      if (floatingTimelineRef.current) floatingTimelineRef.current.kill();
      if (scrollTriggerRef.current) scrollTriggerRef.current.kill();
    };
  }, []);

  // Effect para detectar cambios de tamaño de ventana
  useEffect(() => {
    const handleResize = () => {
      if (timelineRef.current && timelineRef.current.isActive()) {
        resetAnimation();
        playAnimation();
      }
      // Reconfigurar scroll animation en resize
      if (hasPlayedRef.current) {
        setupScrollAnimation();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [resetAnimation, playAnimation, setupScrollAnimation]);

  return (
    <div 
      ref={containerRef}
      className={`flex items-center justify-center ${className}`}
      style={{ 
        overflow: 'visible',
        position: 'relative',
        zIndex: 10,
        transformOrigin: "center"
      }}
    >
      <svg 
        ref={logoRef}
        className="logo-svg"
        width={size} 
        height={size * 1.19}
        viewBox="0 0 439 523" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        style={{ 
          transformOrigin: "center",
          overflow: 'visible'
        }}
      >
        <path 
          className="triangle" 
          d="M204.77 0C235.539 0 254.787 33.2885 239.437 59.9551L141.891 229.411L8.98075 65.1621C-12.183 39.0082 6.43132 0.000141945 40.0755 0H204.77Z" 
          fill="#8F8F8F"
          style={{ transformOrigin: "center" }}
        />
        <path 
          className="trapezoid" 
          d="M218.56 324.158C236.233 345.998 270.324 343.292 284.33 318.938L287.17 314H287.248L178.507 502.841C171.367 515.239 158.15 522.881 143.844 522.881H41.9276C11.1516 522.881 -8.09548 489.579 7.26839 462.912L141.839 229.348L218.56 324.158Z" 
          fill="#626262"
          style={{ transformOrigin: "center" }}
        />
        <path 
          className="diagonal-bar" 
          d="M398.846 0.0380859C400.995 0.0380805 403.088 0.200518 405.117 0.511719C431.98 4.79989 447.501 35.2121 433.279 59.9414L284.33 318.938C270.324 343.292 236.234 345.998 218.561 324.158L141.84 229.347L262.418 20.0693C269.559 7.67596 282.774 0.0390986 297.077 0.0390625L398.846 0.0380859Z" 
          fill="white"
          style={{ transformOrigin: "center" }}
        />
      </svg>
    </div>
  );
};

export default AnimatedLogo;