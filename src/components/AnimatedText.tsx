import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";

interface AnimatedTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
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
  style,
  delay = 0.5,
  staggerDelay = 0.08,
  flipDelay = 1.5,
  flipInterval = 3,
  colorSplit = 6,
  primaryColor = "text-white",
  secondaryColor = "text-cyan-400",
}: AnimatedTextProps) => {
  const textRef = useRef<HTMLHeadingElement>(null);

  // useLayoutEffect: el estado inicial se fija antes del primer pintado,
  // así las letras no aparecen ya colocadas durante un instante.
  useLayoutEffect(() => {
    if (!textRef.current) return;

    const letters = textRef.current.querySelectorAll(".letter");
    const iLetter = textRef.current.querySelector(".letter-i");
    const pending: gsap.core.Tween[] = [];
    let iTimeline: gsap.core.Timeline | null = null;

    gsap.set(letters, { x: 100, opacity: 0 });

    const tl = gsap.timeline({ delay });
    tl.to(letters, { x: 0, opacity: 1, duration: 0.8, ease: "power3.out", stagger: staggerDelay });

    // La "i" alterna entre normal y volteada cada flipInterval segundos.
    if (iLetter) {
      let isFlipped = false;

      const animateI = () => {
        iTimeline = gsap.timeline({
          onComplete: () => {
            pending.push(gsap.delayedCall(flipInterval, animateI));
          },
        });
        const targetRotation = isFlipped ? 0 : 180;
        iTimeline
          .to(iLetter, { rotationX: 360, duration: 0.5, ease: "power2.inOut", transformOrigin: "center center" })
          .to(iLetter, { rotationX: targetRotation, duration: 0.8, ease: "power1.out", transformOrigin: "center center" });
        isFlipped = !isFlipped;
      };

      pending.push(gsap.delayedCall(flipDelay, animateI));
    }

    return () => {
      tl.kill();
      iTimeline?.kill();
      pending.forEach((d) => d.kill());
    };
  }, [text, delay, staggerDelay, flipDelay, flipInterval]);

  const renderLetters = (inputText: string) =>
    inputText.split("").map((letter, index) => {
      const letterColor = colorSplit && index >= colorSplit ? secondaryColor : primaryColor;
      return (
        <span
          key={index}
          className={`letter inline-block ${letter === "i" ? "letter-i" : ""} ${letterColor}`}
          style={{ opacity: 0 }}
        >
          {letter}
        </span>
      );
    });

  return (
    <h1 ref={textRef} className={className} style={style}>
      {renderLetters(text)}
    </h1>
  );
};

export default AnimatedText;
