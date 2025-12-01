import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

interface NavigationProps {
  onSectionChange?: (section: string) => void;
}

const Navigation = ({ onSectionChange }: NavigationProps) => {
  const navRef = useRef<HTMLElement>(null);
  const [activeSection, setActiveSection] = useState('home');
  const [isVisible, setIsVisible] = useState(false);

  const sections = [
    { id: 'home', label: 'Inicio' },
    { id: 'about', label: 'Sobre mí' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'contact', label: 'Contacto' }
  ];

  useEffect(() => {
    // Mostrar navegación después de que se complete la animación del logo
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 6000); // Después de la animación del logo + delay

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!navRef.current || !isVisible) return;

    const nav = navRef.current;
    const items = nav.querySelectorAll('.nav-item');

    // Animación de entrada
    gsap.fromTo(nav, 
      { 
        y: -100, 
        opacity: 0 
      },
      { 
        y: 0, 
        opacity: 1, 
        duration: 1, 
        ease: "power3.out" 
      }
    );

    gsap.fromTo(items,
      { 
        y: -30, 
        opacity: 0 
      },
      { 
        y: 0, 
        opacity: 1, 
        duration: 0.8, 
        stagger: 0.1, 
        delay: 0.3,
        ease: "power2.out" 
      }
    );
  }, [isVisible]);

  const handleSectionClick = (sectionId: string) => {
    setActiveSection(sectionId);
    onSectionChange?.(sectionId);

    // Animación del indicador activo
    const activeItem = navRef.current?.querySelector(`[data-section="${sectionId}"]`);
    if (activeItem) {
      gsap.to(activeItem.querySelector('.nav-indicator'), {
        scale: 1,
        opacity: 1,
        duration: 0.3,
        ease: "power2.out"
      });

      // Ocultar otros indicadores
      const otherItems = navRef.current?.querySelectorAll('.nav-indicator');
      otherItems?.forEach((indicator: Element) => {
        if (indicator !== activeItem.querySelector('.nav-indicator')) {
          gsap.to(indicator, {
            scale: 0,
            opacity: 0,
            duration: 0.3,
            ease: "power2.out"
          });
        }
      });
    }
  };

  if (!isVisible) return null;

  return (
    <nav 
      ref={navRef}
      className="fixed top-8 left-1/2 transform -translate-x-1/2 z-40 bg-black/20 backdrop-blur-md rounded-full px-6 py-3 border border-white/10"
      style={{ willChange: 'transform' }}
    >
      <ul className="flex items-center space-x-8">
        {sections.map((section) => (
          <li key={section.id}>
            <button
              data-section={section.id}
              onClick={() => handleSectionClick(section.id)}
              className={`nav-item relative px-4 py-2 text-sm font-medium transition-colors duration-300 interactive
                ${activeSection === section.id 
                  ? 'text-cyan-400' 
                  : 'text-white hover:text-cyan-300'
                }`}
            >
              {section.label}
              <span 
                className="nav-indicator absolute inset-0 bg-white/10 rounded-full scale-0 opacity-0"
                style={{ willChange: 'transform' }}
              />
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navigation;