import { useEffect, useLayoutEffect, useRef, useCallback } from "react";
import gsap from "gsap";

interface AnimatedLogoProps {
  className?: string;
  autoPlay?: boolean;
  /** Ancho del logo como longitud CSS (px, clamp(), vw...). El alto se calcula solo. */
  size?: string;
  onAnimationComplete?: () => void;
}

const AnimatedLogo = ({
  className = "",
  autoPlay = true,
  size = "200px",
  onAnimationComplete,
}: AnimatedLogoProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<SVGSVGElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const floatingTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const floatingDelayRef = useRef<gsap.core.Tween | null>(null);
  const hasPlayedRef = useRef(false);

  const getShapes = () => {
    const svg = logoRef.current;
    if (!svg) return null;
    return {
      triangle: svg.querySelector(".triangle"),
      trapezoid: svg.querySelector(".trapezoid"),
      diagonalBar: svg.querySelector(".diagonal-bar"),
    };
  };

  // Coloca las formas fuera de pantalla, en tamaño enorme, antes de animar.
  const resetAnimation = useCallback(() => {
    if (timelineRef.current) timelineRef.current.kill();
    const shapes = getShapes();
    if (!shapes || !logoRef.current) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    gsap.set(shapes.triangle, { x: -vw * 1.5, y: -vh * 1.2, scale: 15, rotation: -45, opacity: 0.9 });
    gsap.set(shapes.trapezoid, { x: -vw * 1.8, y: vh * 1.5, scale: 18, rotation: 90, opacity: 0.9 });
    gsap.set(shapes.diagonalBar, { x: vw * 1.8, y: -vh * 1.3, scale: 20, rotation: -60, opacity: 0.9 });
    gsap.set(logoRef.current, { filter: "blur(0px) brightness(1)", scale: 1 });
  }, []);

  const stopFloatingAnimation = useCallback(() => {
    floatingDelayRef.current?.kill();
    floatingDelayRef.current = null;
    floatingTimelineRef.current?.kill();
    floatingTimelineRef.current = null;
  }, []);

  const startFloatingAnimation = useCallback(() => {
    const shapes = getShapes();
    if (!shapes) return;
    stopFloatingAnimation();

    floatingTimelineRef.current = gsap.timeline({ repeat: -1 });
    floatingTimelineRef.current
      .to(shapes.triangle, { duration: 3, y: -8, rotation: "+=2", ease: "power2.inOut", yoyo: true, repeat: 1 }, 0)
      .to(shapes.trapezoid, { duration: 2.5, y: 6, rotation: "-=1.5", ease: "power2.inOut", yoyo: true, repeat: 1 }, 0.5)
      .to(shapes.diagonalBar, { duration: 3.5, y: -5, rotation: "+=1", ease: "power2.inOut", yoyo: true, repeat: 1 }, 1);
  }, [stopFloatingAnimation]);

  const playAnimation = useCallback(() => {
    const shapes = getShapes();
    if (!shapes || !logoRef.current) return;

    stopFloatingAnimation();
    resetAnimation();

    timelineRef.current = gsap.timeline({
      onComplete: () => {
        hasPlayedRef.current = true;
        onAnimationComplete?.();
        floatingDelayRef.current = gsap.delayedCall(0.5, startFloatingAnimation);
      },
    });

    // Las formas aparecen enormes desde fuera de la pantalla y convergen en el logo.
    timelineRef.current
      .to(shapes.triangle, { duration: 3.5, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, ease: "power4.out" })
      .to(shapes.trapezoid, { duration: 3.8, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, ease: "power4.out" }, "-=3.3")
      .to(shapes.diagonalBar, { duration: 4, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, ease: "power4.out" }, "-=3.5")
      .to(logoRef.current, { duration: 0.8, filter: "blur(0px) brightness(1)", scale: 1, ease: "power2.out" }, "-=0.5");
  }, [resetAnimation, stopFloatingAnimation, startFloatingAnimation, onAnimationComplete]);

  // Estado inicial antes del primer pintado: evita que el logo se vea montado
  // durante un instante y luego "salte" al arrancar la animación.
  useLayoutEffect(() => {
    if (!hasPlayedRef.current) resetAnimation();
  }, [resetAnimation]);

  useEffect(() => {
    if (!autoPlay || hasPlayedRef.current) return;
    const timer = setTimeout(playAnimation, 300);
    return () => clearTimeout(timer);
  }, [autoPlay, playAnimation]);

  useEffect(() => {
    return () => {
      timelineRef.current?.kill();
      stopFloatingAnimation();
    };
  }, [stopFloatingAnimation]);

  // Si cambia el tamaño de la ventana durante la entrada, se recalcula desde el principio.
  useEffect(() => {
    const handleResize = () => {
      if (timelineRef.current?.isActive()) playAnimation();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [playAnimation]);

  return (
    <div
      ref={containerRef}
      className={`flex items-center justify-center ${className}`}
      style={{ overflow: "visible", position: "relative", zIndex: 10, transformOrigin: "center" }}
    >
      <svg
        ref={logoRef}
        className="logo-svg"
        viewBox="0 0 439 523"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Logo de yoiberdev"
        style={{ width: size, height: "auto", transformOrigin: "center", overflow: "visible" }}
      >
        {/* opacity 0 inicial: nada visible hasta que GSAP toma el control */}
        <path
          className="triangle"
          d="M204.77 0C235.539 0 254.787 33.2885 239.437 59.9551L141.891 229.411L8.98075 65.1621C-12.183 39.0082 6.43132 0.000141945 40.0755 0H204.77Z"
          fill="#8F8F8F"
          style={{ transformOrigin: "center", opacity: 0 }}
        />
        <path
          className="trapezoid"
          d="M218.56 324.158C236.233 345.998 270.324 343.292 284.33 318.938L287.17 314H287.248L178.507 502.841C171.367 515.239 158.15 522.881 143.844 522.881H41.9276C11.1516 522.881 -8.09548 489.579 7.26839 462.912L141.839 229.348L218.56 324.158Z"
          fill="#626262"
          style={{ transformOrigin: "center", opacity: 0 }}
        />
        <path
          className="diagonal-bar"
          d="M398.846 0.0380859C400.995 0.0380805 403.088 0.200518 405.117 0.511719C431.98 4.79989 447.501 35.2121 433.279 59.9414L284.33 318.938C270.324 343.292 236.234 345.998 218.561 324.158L141.84 229.347L262.418 20.0693C269.559 7.67596 282.774 0.0390986 297.077 0.0390625L398.846 0.0380859Z"
          fill="white"
          style={{ transformOrigin: "center", opacity: 0 }}
        />
      </svg>
    </div>
  );
};

export default AnimatedLogo;
