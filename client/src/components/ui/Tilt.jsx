import { createContext, useContext } from 'react';
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';

// The curriculum's artwork behaves like the physical thing it is.
//
// Every piece of CREATE art in this app was printed before it was pixels: the
// medals are awarded, the stickers are die-cut vinyl, the level shots are
// photographs off a wall poster. Flat on a page they read as clip art. Given a
// perspective, a tilt that follows the pointer and a spring that overshoots on
// the way back, they read as objects sitting on the card.
//
// This started life inside the sticker album (session 48) and is here because
// the same treatment now runs across the curriculum. Three rules came out of
// building it and all three are load-bearing:
//
//   1. The tilt is jumped to flat on pointer down, not sprung. A click that
//      starts a shared-element (`layoutId`) flight measures the element's box,
//      and a box still mid-tilt measures skewed.
//   2. Anything carrying a `layoutId` must not be sitting on a translateZ when
//      that measurement happens, because under a perspective a translateZ IS a
//      scale. `TiltLayer` rides the same spring, so pointer down flattens the
//      float too.
//   3. `transform-style: preserve-3d` on the tilting element is what puts the
//      layers in its 3D space; `transformPerspective` is what makes the depth
//      visible. Neither works alone.
//
// Under `prefers-reduced-motion` the whole thing is inert: no tilt, no float,
// no glare, and layers render with no transform at all.

const SPRING = { stiffness: 260, damping: 20, mass: 0.4 };

const TiltContext = createContext(null);

export function Tilt({
  // Degrees of rotation at the far corner. 13 on a sticker, less on something
  // whose edges are straight and would show the skew.
  amount = 10,
  // Resting 2D rotation, for art already pinned to the page at an angle.
  rest = 0,
  scale = 1.03,
  glare = false,
  perspective = 800,
  disabled = false,
  as: Component = motion.div,
  className = '',
  style,
  children,
  ...props
}) {
  const reduced = useReducedMotion();
  const off = disabled || reduced;

  const rotateX = useSpring(0, SPRING);
  const rotateY = useSpring(0, SPRING);
  const lift = useSpring(0, SPRING);
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  const scaleV = useTransform(lift, [0, 1], [1, scale]);
  const glareBg = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.85), rgba(255,255,255,0) 62%)`;

  const onPointerMove = (e) => {
    // A touch has no hover: it would tilt on tap and stay tilted, since there
    // is no leave to put it back.
    if (off || e.pointerType === 'touch') return;
    const box = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - box.left) / box.width;
    const py = (e.clientY - box.top) / box.height;
    rotateY.set((px - 0.5) * amount * 2);
    rotateX.set((0.5 - py) * amount * 2);
    lift.set(1);
    glareX.set(px * 100);
    glareY.set(py * 100);
  };

  const settle = () => {
    rotateX.set(0);
    rotateY.set(0);
    lift.set(0);
  };

  const flatten = () => {
    rotateX.jump(0);
    rotateY.jump(0);
    lift.jump(0);
  };

  return (
    <TiltContext.Provider value={{ lift, off }}>
      <Component
        onPointerMove={onPointerMove}
        onPointerLeave={settle}
        onPointerDown={flatten}
        onBlur={settle}
        className={className}
        style={off
          ? { rotate: rest, ...style }
          : {
            rotate: rest,
            rotateX,
            rotateY,
            scale: scaleV,
            transformPerspective: perspective,
            transformStyle: 'preserve-3d',
            ...style,
          }}
        {...props}
      >
        {glare && !off && (
          <motion.span
            aria-hidden="true"
            style={{ backgroundImage: glareBg, opacity: lift }}
            className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-soft-light"
          />
        )}
        {children}
      </Component>
    </TiltContext.Provider>
  );
}

// A plane inside a Tilt, floating `depth` pixels above the card while the
// pointer is on it. This is what sells the depth: without it a tilt is a flat
// card being skewed, and the eye reads it as a wobble rather than an object.
export function TiltLayer({ depth = 30, as: Component = motion.div, className = '', style, children, ...rest }) {
  const ctx = useContext(TiltContext);
  const idle = useMotionValue(0);
  const z = useTransform(ctx?.lift ?? idle, [0, 1], [0, depth]);
  const off = !ctx || ctx.off;
  return (
    <Component className={className} style={off ? style : { z, ...style }} {...rest}>
      {children}
    </Component>
  );
}

export default Tilt;
