import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const CustomCursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const followerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    const follower = followerRef.current;
    
    if (!cursor || !follower) return;

    let mouseX = 0;
    let mouseY = 0;

    // Configurar posición inicial
    gsap.set(cursor, { xPercent: -50, yPercent: -50 });
    gsap.set(follower, { xPercent: -50, yPercent: -50 });

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      
      // Cursor principal - movimiento instantáneo
      gsap.to(cursor, {
        x: mouseX,
        y: mouseY,
        duration: 0,
        ease: "none"
      });
      
      // Follower - movimiento suave con delay
      gsap.to(follower, {
        x: mouseX,
        y: mouseY,
        duration: 0.3,
        ease: "power2.out"
      });
    };

    const handleMouseEnter = () => {
      gsap.to(cursor, { scale: 1.2, duration: 0.3 });
      gsap.to(follower, { scale: 1.5, duration: 0.3 });
    };

    const handleMouseLeave = () => {
      gsap.to(cursor, { scale: 1, duration: 0.3 });
      gsap.to(follower, { scale: 1, duration: 0.3 });
    };

    // Event listeners
    document.addEventListener('mousemove', handleMouseMove);
    
    // Agregar efectos hover a elementos interactivos
    const interactiveElements = document.querySelectorAll('button, a, .interactive');
    interactiveElements.forEach(el => {
      el.addEventListener('mouseenter', handleMouseEnter);
      el.addEventListener('mouseleave', handleMouseLeave);
    });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      interactiveElements.forEach(el => {
        el.removeEventListener('mouseenter', handleMouseEnter);
        el.removeEventListener('mouseleave', handleMouseLeave);
      });
    };
  }, []);

  return (
    <>
      {/* Cursor principal */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 w-2 h-2 bg-white rounded-full pointer-events-none z-50 mix-blend-difference"
        style={{ willChange: 'transform' }}
      />
      
      {/* Follower */}
      <div
        ref={followerRef}
        className="fixed top-0 left-0 w-8 h-8 border border-white/30 rounded-full pointer-events-none z-40"
        style={{ willChange: 'transform' }}
      />
    </>
  );
};

export default CustomCursor;