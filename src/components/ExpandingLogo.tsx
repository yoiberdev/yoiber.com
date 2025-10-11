import { useEffect, useRef, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface ExpandingLogoProps {
  className?: string;
  autoPlay?: boolean;
  size?: number;
  onAnimationComplete?: () => void;
}

const ExpandingLogo = ({ 
  className = "", 
  autoPlay = true, 
  size = 200,
  onAnimationComplete 
}: ExpandingLogoProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<SVGSVGElement>(null);
  const bgLogoRef = useRef<SVGSVGElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const hasPlayedRef = useRef(false);

  const resetAnimation = useCallback(() => {
    if (timelineRef.current) timelineRef.current.kill();
    
    if (!logoRef.current || !containerRef.current || !bgLogoRef.current) return;
    
    const triangle = logoRef.current.querySelector(".triangle");
    const trapezoid = logoRef.current.querySelector(".trapezoid");
    const diagonalBar = logoRef.current.querySelector(".diagonal-bar");
    
    const bgTriangle = bgLogoRef.current.querySelector(".bg-triangle");
    const bgTrapezoid = bgLogoRef.current.querySelector(".bg-trapezoid");
    const bgDiagonalBar = bgLogoRef.current.querySelector(".bg-diagonal-bar");
    
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    
    // Logo principal - estado inicial
    gsap.set([triangle, trapezoid, diagonalBar], {
      x: 0, y: 0, scale: 1, rotation: 0, opacity: 1
    });

    // Logo de fondo - invisible inicialmente
    gsap.set(bgLogoRef.current, {
      scale: 1,
      opacity: 0,
      position: 'fixed',
      top: '50%',
      left: '50%',
      xPercent: -50,
      yPercent: -50,
      zIndex: -1
    });

    gsap.set([bgTriangle, bgTrapezoid, bgDiagonalBar], {
      scale: 1,
      opacity: 0.3
    });
  }, []);

  const createScrollAnimation = useCallback(() => {
    if (!logoRef.current || !containerRef.current || !bgLogoRef.current) return;

    const bgLogo = bgLogoRef.current;
    const bgTriangle = bgLogo.querySelector(".bg-triangle");
    const bgTrapezoid = bgLogo.querySelector(".bg-trapezoid");
    const bgDiagonalBar = bgLogo.querySelector(".bg-diagonal-bar");

    // Crear la animación principal de scroll
    const scrollTL = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: "center center",
        end: "bottom top",
        scrub: 1.5,
        pin: false,
        onUpdate: (self) => {
          const progress = self.progress;
          
          // Fade out del logo original
          gsap.to(logoRef.current, {
            opacity: 1 - progress * 2,
            duration: 0.1
          });

          // Fade in y scale del logo de fondo
          gsap.to(bgLogo, {
            opacity: progress,
            scale: 1 + progress * 25, // Escala hasta 25x el tamaño
            duration: 0.1
          });

          // Animaciones individuales de las formas del fondo
          gsap.to(bgTriangle, {
            opacity: 0.1 + progress * 0.4,
            rotation: progress * 45,
            duration: 0.1
          });

          gsap.to(bgTrapezoid, {
            opacity: 0.1 + progress * 0.3,
            rotation: progress * -30,
            duration: 0.1
          });

          gsap.to(bgDiagonalBar, {
            opacity: 0.1 + progress * 0.5,
            rotation: progress * 60,
            duration: 0.1
          });
        }
      }
    });

    // Animación de las formas cuando el logo se expande completamente
    ScrollTrigger.create({
      trigger: containerRef.current,
      start: "bottom center",
      end: "bottom top",
      scrub: 2,
      onUpdate: (self) => {
        const progress = self.progress;
        
        // Morphing avanzado de las formas
        gsap.to(bgTriangle, {
          x: Math.sin(progress * Math.PI * 4) * 200,
          y: Math.cos(progress * Math.PI * 3) * 150,
          rotation: progress * 180,
          duration: 0.1
        });

        gsap.to(bgTrapezoid, {
          x: Math.cos(progress * Math.PI * 5) * 180,
          y: Math.sin(progress * Math.PI * 4) * 120,
          rotation: progress * -200,
          duration: 0.1
        });

        gsap.to(bgDiagonalBar, {
          x: Math.sin(progress * Math.PI * 6) * 220,
          y: Math.cos(progress * Math.PI * 5) * 180,
          rotation: progress * 270,
          duration: 0.1
        });
      }
    });

  }, []);

  const playInitialAnimation = useCallback(() => {
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
        createScrollAnimation();
      }
    });
    
    // Posicionar las formas fuera de pantalla inicialmente
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    
    gsap.set(triangle, {
      x: -vw,
      y: -vh,
      scale: 8,
      rotation: -45,
      opacity: 0.9
    });
    
    gsap.set(trapezoid, {
      x: -vw * 1.2,
      y: vh,
      scale: 10,
      rotation: 90,
      opacity: 0.9
    });
    
    gsap.set(diagonalBar, {
      x: vw * 1.2,
      y: -vh * 0.8,
      scale: 12,
      rotation: -60,
      opacity: 0.9
    });
    
    // Animación de convergencia al centro
    timelineRef.current
      .to(triangle, {
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        opacity: 1,
        duration: 3,
        ease: "power3.out"
      })
      .to(trapezoid, {
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        opacity: 1,
        duration: 3.2,
        ease: "power3.out"
      }, "-=2.8")
      .to(diagonalBar, {
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        opacity: 1,
        duration: 3.4,
        ease: "power3.out"
      }, "-=3");

  }, [resetAnimation, onAnimationComplete, createScrollAnimation]);

  useEffect(() => {
    if (autoPlay && !hasPlayedRef.current) {
      const timer = setTimeout(() => {
        playInitialAnimation();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [autoPlay, playInitialAnimation]);

  useEffect(() => {
    return () => {
      if (timelineRef.current) timelineRef.current.kill();
      ScrollTrigger.getAll().forEach(trigger => {
        if (trigger.trigger === containerRef.current) {
          trigger.kill();
        }
      });
    };
  }, []);

  return (
    <>
      {/* Logo principal */}
      <div 
        ref={containerRef}
        className={`flex items-center justify-center ${className}`}
        style={{ 
          overflow: 'visible',
          position: 'relative',
          zIndex: 10
        }}
      >
        <svg 
          ref={logoRef}
          className="logo-svg"
          width={size} 
          height={size * 1.19}
          viewBox="-1000 -1000 2439 2523" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          style={{ 
            transformOrigin: "center",
            overflow: 'visible'
          }}
        >
          <g transform="translate(719.5, 761.5)">
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
          </g>
        </svg>
      </div>

      {/* Logo de fondo que se expande */}
      <svg 
        ref={bgLogoRef}
        className="background-logo"
        width={size} 
        height={size * 1.19}
        viewBox="-1000 -1000 2439 2523" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        style={{ 
          transformOrigin: "center",
          overflow: 'visible',
          position: 'fixed',
          pointerEvents: 'none'
        }}
      >
        <g transform="translate(719.5, 761.5)">
          <path 
            className="bg-triangle" 
            d="M204.77 0C235.539 0 254.787 33.2885 239.437 59.9551L141.891 229.411L8.98075 65.1621C-12.183 39.0082 6.43132 0.000141945 40.0755 0H204.77Z" 
            fill="#1a1a1a"
            style={{ transformOrigin: "center" }}
          />
          <path 
            className="bg-trapezoid" 
            d="M218.56 324.158C236.233 345.998 270.324 343.292 284.33 318.938L287.17 314H287.248L178.507 502.841C171.367 515.239 158.15 522.881 143.844 522.881H41.9276C11.1516 522.881 -8.09548 489.579 7.26839 462.912L141.839 229.348L218.56 324.158Z" 
            fill="#0a0a0a"
            style={{ transformOrigin: "center" }}
          />
          <path 
            className="bg-diagonal-bar" 
            d="M398.846 0.0380859C400.995 0.0380805 403.088 0.200518 405.117 0.511719C431.98 4.79989 447.501 35.2121 433.279 59.9414L284.33 318.938C270.324 343.292 236.234 345.998 218.561 324.158L141.84 229.347L262.418 20.0693C269.559 7.67596 282.774 0.0390986 297.077 0.0390625L398.846 0.0380859Z" 
            fill="#2a2a2a"
            style={{ transformOrigin: "center" }}
          />
        </g>
      </svg>
    </>
  );
};

export default ExpandingLogo;