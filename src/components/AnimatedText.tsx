import { useEffect, useRef } from "react";
import gsap from "gsap";

interface AnimatedTextProps {
  text: string;
  className?: string;
  delay?: number;
  staggerDelay?: number;
  flipDelay?: number;
  flipInterval?: number;
  colorSplit?: number;
  primaryColor?: string;
  secondaryColor?: string;
}

const AnimatedText = ({
  text,
  className = "text-3xl font-bold text-white",
  delay = 0.5,
  staggerDelay = 0.08,
  flipDelay = 1.5,
  flipInterval = 3,
  colorSplit = 6,
  primaryColor = "text-white",
  secondaryColor = "text-cyan-400",
}: AnimatedTextProps) => {
  const textRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!textRef.current) return;

    const letters = textRef.current.querySelectorAll(".letter");
    const iLetter = textRef.current.querySelector(".letter-i");

    // Posición inicial - todas las letras vienen desde la derecha
    gsap.set(letters, {
      x: 100,
      opacity: 0,
    });

    // Timeline principal
    const tl = gsap.timeline({
      delay, // Delay configurable
    });

    // Entrada desde la derecha con stagger
    tl.to(letters, {
      x: 0,
      opacity: 1,
      duration: 0.8,
      ease: "power3.out",
      stagger: staggerDelay, // Stagger configurable
    });

    // Animación continua de la "i" - alterna entre normal y volteada
    if (iLetter) {
      // Variable para trackear el estado actual
      let isFlipped = false;

      const animateI = () => {
        const iTimeline = gsap.timeline({
          onComplete: () => {
            // Después de completar, esperar y repetir
            gsap.delayedCall(flipInterval, animateI);
          },
        });

        // Determinar la rotación objetivo basada en el estado actual
        const targetRotation = isFlipped ? 0 : 180;

        // Primera vuelta completa (360°) - siempre igual
        iTimeline.to(iLetter, {
          rotationX: 360,
          duration: 0.5,
          ease: "power2.inOut",
          transformOrigin: "center center",
        });

        // Después ir a la posición final (0° o 180°)
        iTimeline.to(iLetter, {
          rotationX: targetRotation,
          duration: 0.8,
          ease: "power1.out",
          transformOrigin: "center center",
        });

        // Cambiar el estado para la próxima iteración
        isFlipped = !isFlipped;
      };

      // Empezar la animación después de que entren las letras
      gsap.delayedCall(flipDelay, animateI);
    }

    return () => {
      tl.kill();
    };
  }, [text, delay, staggerDelay, flipDelay, flipInterval]);

  // Dividir el texto en letras individuales
  const renderLetters = (inputText: string) => {
    return inputText.split("").map((letter, index) => {
      // Determinar el color basado en la posición
      let letterColor = primaryColor;
      if (colorSplit && index >= colorSplit) {
        letterColor = secondaryColor;
      }

      return (
        <span
          key={index}
          className={`letter inline-block ${
            letter === "i" ? "letter-i" : ""
          } ${letterColor}`}
        >
          {letter}
        </span>
      );
    });
  };

  return (
    <h1 ref={textRef} className={className}>
      {renderLetters(text)}
    </h1>
  );
};

export default AnimatedText;
