import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface LenisWrapperProps {
  children: React.ReactNode;
}

const LenisWrapper = ({ children }: LenisWrapperProps) => {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // Inicializar Lenis con configuración optimizada
    lenisRef.current = new Lenis({
      autoRaf: true,
      lerp: 0.08, // Ligeramente más rápido
      wheelMultiplier: 0.8, // Menos sensible
      gestureOrientation: 'vertical',
      smoothWheel: true
    });

    // Integrar con ScrollTrigger de forma optimizada
    const updateScrollTrigger = () => {
      requestAnimationFrame(() => {
        ScrollTrigger.update();
      });
    };
    
    lenisRef.current.on('scroll', updateScrollTrigger);
    
    // Refresh inicial
    ScrollTrigger.refresh();

    // Cleanup mejorado
    return () => {
      if (lenisRef.current) {
        lenisRef.current.off('scroll', updateScrollTrigger);
        lenisRef.current.destroy();
      }
    };
  }, []);

  return <>{children}</>;
};

export default LenisWrapper;