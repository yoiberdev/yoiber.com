import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const PortfolioSection = () => {
  const sectionRef = useRef<HTMLSectionElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const projectsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const section = sectionRef.current;
    const title = titleRef.current;
    const projects = projectsRef.current;
    const projectItems = projects?.querySelectorAll('.project-item');

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

    // Animación de proyectos con reveal effect
    if (projectItems) {
      projectItems.forEach((item, index) => {
        gsap.fromTo(item,
          { 
            y: 120, 
            opacity: 0,
            rotationX: 45
          },
          {
            y: 0,
            opacity: 1,
            rotationX: 0,
            duration: 1.2,
            delay: index * 0.2,
            ease: "power3.out",
            scrollTrigger: {
              trigger: item,
              start: "top 85%",
              end: "bottom 15%",
              toggleActions: "play none none reverse"
            }
          }
        );

        // Hover effect
        const handleMouseEnter = () => {
          gsap.to(item, {
            scale: 1.05,
            y: -10,
            duration: 0.4,
            ease: "power2.out"
          });
        };

        const handleMouseLeave = () => {
          gsap.to(item, {
            scale: 1,
            y: 0,
            duration: 0.4,
            ease: "power2.out"
          });
        };

        item.addEventListener('mouseenter', handleMouseEnter);
        item.addEventListener('mouseleave', handleMouseLeave);
      });
    }

    // Parallax effect
    gsap.to(section, {
      yPercent: -30,
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        scrub: true
      }
    });

  }, []);

  const projects = [
    {
      title: "E-Commerce Platform",
      description: "Plataforma completa con React, Node.js y MongoDB",
      tech: ["React", "Node.js", "MongoDB", "Stripe"],
      color: "from-purple-500 to-pink-500"
    },
    {
      title: "Task Management App",
      description: "Aplicación de gestión de tareas con tiempo real",
      tech: ["Next.js", "PostgreSQL", "Socket.io", "Tailwind"],
      color: "from-blue-500 to-cyan-500"
    },
    {
      title: "3D Portfolio Site",
      description: "Portafolio interactivo con animaciones 3D",
      tech: ["Three.js", "GSAP", "React", "TypeScript"],
      color: "from-green-500 to-teal-500"
    }
  ];

  return (
    <section 
      ref={sectionRef}
      id="portfolio"
      className="min-h-screen flex items-center justify-center py-20 px-6 relative"
      style={{ willChange: 'transform' }}
    >
      <div className="max-w-6xl mx-auto">
        <h2 
          ref={titleRef}
          className="text-6xl md:text-8xl font-bold text-white text-center mb-16"
          style={{ willChange: 'transform' }}
        >
          Portfolio
        </h2>
        
        <div 
          ref={projectsRef}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          style={{ willChange: 'transform' }}
        >
          {projects.map((project, index) => (
            <div
              key={project.title}
              className="project-item bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10 hover:border-white/30 transition-colors duration-300 interactive"
              style={{ 
                willChange: 'transform',
                transformStyle: 'preserve-3d',
                perspective: '1000px'
              }}
            >
              <div className={`w-full h-48 bg-gradient-to-br ${project.color} rounded-lg mb-6 opacity-80`} />
              
              <h3 className="text-2xl font-bold text-white mb-4">
                {project.title}
              </h3>
              
              <p className="text-gray-300 mb-6 leading-relaxed">
                {project.description}
              </p>
              
              <div className="flex flex-wrap gap-2">
                {project.tech.map((tech) => (
                  <span
                    key={tech}
                    className="px-3 py-1 bg-cyan-400/20 text-cyan-300 rounded-full text-sm border border-cyan-400/30"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PortfolioSection;