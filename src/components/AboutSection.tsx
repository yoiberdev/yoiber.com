import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const AboutSection = () => {
  const sectionRef = useRef<HTMLSectionElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const skillsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const section = sectionRef.current;
    const title = titleRef.current;
    const content = contentRef.current;
    const skills = skillsRef.current;
    const skillItems = skills?.querySelectorAll('.skill-item');

    // Animación del título
    gsap.fromTo(title,
      { 
        y: 100, 
        opacity: 0 
      },
      {
        y: 0,
        opacity: 1,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: title,
          start: "top 80%",
          end: "bottom 20%",
          toggleActions: "play none none reverse"
        }
      }
    );

    // Animación del contenido
    gsap.fromTo(content,
      { 
        y: 80, 
        opacity: 0 
      },
      {
        y: 0,
        opacity: 1,
        duration: 1,
        delay: 0.3,
        ease: "power3.out",
        scrollTrigger: {
          trigger: content,
          start: "top 80%",
          end: "bottom 20%",
          toggleActions: "play none none reverse"
        }
      }
    );

    // Animación de skills con stagger
    if (skillItems) {
      gsap.fromTo(skillItems,
        { 
          y: 60, 
          opacity: 0,
          scale: 0.8
        },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.8,
          stagger: 0.1,
          ease: "back.out(1.7)",
          scrollTrigger: {
            trigger: skills,
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse"
          }
        }
      );
    }

    // Parallax effect en la sección
    gsap.to(section, {
      yPercent: -50,
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        scrub: true
      }
    });

  }, []);

  const skills = [
    'React', 'TypeScript', 'Node.js', 'Python', 
    'GSAP', 'Three.js', 'MongoDB', 'PostgreSQL'
  ];

  return (
    <section 
      ref={sectionRef}
      id="about"
      className="min-h-screen flex items-center justify-center py-20 px-6 relative"
      style={{ willChange: 'transform' }}
    >
      <div className="max-w-4xl mx-auto text-center">
        <h2 
          ref={titleRef}
          className="text-6xl md:text-8xl font-bold text-white mb-8"
          style={{ willChange: 'transform' }}
        >
          Sobre mí
        </h2>
        
        <div 
          ref={contentRef}
          className="text-xl md:text-2xl text-gray-300 leading-relaxed mb-16 max-w-3xl mx-auto"
          style={{ willChange: 'transform' }}
        >
          <p className="mb-6">
            Soy un desarrollador full-stack apasionado por crear experiencias web únicas 
            y funcionales. Me especializo en tecnologías modernas y siempre busco 
            la innovación en cada proyecto.
          </p>
          <p>
            Con experiencia en frontend y backend, disfruto construyendo aplicaciones 
            que no solo funcionen perfectamente, sino que también brinden una 
            experiencia visual memorable.
          </p>
        </div>

        <div 
          ref={skillsRef}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto"
          style={{ willChange: 'transform' }}
        >
          {skills.map((skill, index) => (
            <div
              key={skill}
              className="skill-item bg-white/10 backdrop-blur-sm rounded-lg px-6 py-4 border border-white/20 hover:border-cyan-400/50 transition-colors duration-300 interactive"
              style={{ willChange: 'transform' }}
            >
              <span className="text-white font-medium">{skill}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AboutSection;