import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";

interface AnimatedTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  /** Segundos antes de que entren las letras */
  delay?: number;
  /** Separación entre la entrada de cada letra */
  staggerDelay?: number;
  /** Segundos hasta el primer giro de la "i" */
  flipDelay?: number;
  /** Segundos entre giros de la "i" */
  flipInterval?: number;
  /** Índice a partir del cual se usa el color secundario */
  colorSplit?: number;
  primaryColor?: string;
  secondaryColor?: string;
}

const AnimatedText = ({
  text,
  className = "",
  style,
  delay = 0.5,
  staggerDelay = 0.06,
  flipDelay = 1.6,
  flipInterval = 3,
  colorSplit = 6,
  primaryColor = "text-white",
  secondaryColor = "text-cyan-400",
}: AnimatedTextProps) => {
  const textRef = useRef<HTMLHeadingElement>(null);

  // useLayoutEffect: el estado inicial se fija antes del primer pintado.
  useLayoutEffect(() => {
    const root = textRef.current;
    if (!root) return;

    const letters = root.querySelectorAll<HTMLElement>(".hero-letter");
    const iLetters = root.querySelectorAll<HTMLElement>(".hero-letter-i");
    let flipTimeline: gsap.core.Timeline | null = null;

    gsap.set(letters, { y: 48, opacity: 0, rotateX: -50, filter: "blur(10px)" });

    // Entrada: las letras suben, se enfocan y se enderezan con stagger.
    const enter = gsap.timeline({ delay });
    enter.to(letters, {
      y: 0,
      opacity: 1,
      rotateX: 0,
      filter: "blur(0px)",
      duration: 0.9,
      ease: "expo.out",
      stagger: staggerDelay,
    });

    // La "i" hace una vuelta completa (360°) cada flipInterval segundos.
    // Siempre termina en 0°, así nunca se queda del revés ni desaparece.
    if (iLetters.length) {
      flipTimeline = gsap.timeline({ repeat: -1, repeatDelay: flipInterval, delay: flipDelay });
      flipTimeline
        .fromTo(
          iLetters,
          { rotateX: 0 },
          { rotateX: 360, duration: 1.1, ease: "back.inOut(1.4)", transformOrigin: "50% 50% -0.15em" },
        )
        .fromTo(
          iLetters,
          { textShadow: "0 0 0px rgba(34,211,238,0)" },
          { textShadow: "0 0 28px rgba(34,211,238,0.85)", duration: 0.45, ease: "power2.out", yoyo: true, repeat: 1 },
          0.2,
        );
    }

    return () => {
      enter.kill();
      flipTimeline?.kill();
    };
  }, [text, delay, staggerDelay, flipDelay, flipInterval]);

  return (
    <h1 ref={textRef} className={`hero-title ${className}`} style={style} aria-label={text}>
      {text.split("").map((letter, index) => {
        const color = colorSplit && index >= colorSplit ? secondaryColor : primaryColor;
        const isI = letter === "i";
        return (
          <span
            key={index}
            aria-hidden="true"
            className={`hero-letter ${isI ? "hero-letter-i" : ""} ${color}`}
            style={{ opacity: 0 }}
          >
            {letter}
          </span>
        );
      })}
    </h1>
  );
};

export default AnimatedText;
