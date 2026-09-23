// Liquid Chrome, from React Bits (https://reactbits.dev), MIT + Commons Clause,
// copyright David Haz. Licence text in ./LICENSE.md, which must travel with it.
//
// Changed from the original for a hero that sits behind text on every device:
//   - it renders at a fraction of the element's size and lets CSS scale it up.
//     A liquid is soft anyway, and the original's 3x3 supersample at full size
//     is nine shader passes per pixel across a full-width hero.
//   - it stops drawing while it is off screen or the tab is hidden.
//   - under prefers-reduced-motion it draws one still frame and stops.
//   - the canvas fills the box with CSS, so it never sets the page's height.
import { useEffect, useRef } from 'react';
import { Mesh, Program, Renderer, Triangle } from 'ogl';

const VERTEX = `
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT = `
  precision highp float;
  uniform float uTime;
  uniform vec3 uResolution;
  uniform vec3 uBaseColor;
  uniform float uAmplitude;
  uniform float uFrequencyX;
  uniform float uFrequencyY;
  uniform vec2 uMouse;
  varying vec2 vUv;

  void main() {
    vec2 fragCoord = vUv * uResolution.xy;
    vec2 uv = (2.0 * fragCoord - uResolution.xy) / min(uResolution.x, uResolution.y);

    for (float i = 1.0; i < 10.0; i++) {
      uv.x += uAmplitude / i * cos(i * uFrequencyX * uv.y + uTime + uMouse.x * 3.14159);
      uv.y += uAmplitude / i * cos(i * uFrequencyY * uv.x + uTime + uMouse.y * 3.14159);
    }

    vec2 diff = (vUv - uMouse);
    float dist = length(diff);
    float falloff = exp(-dist * 20.0);
    float ripple = sin(10.0 * dist - uTime * 2.0) * 0.03;
    uv += (diff / (dist + 0.0001)) * ripple * falloff;

    vec3 color = uBaseColor / abs(sin(uTime - uv.y - uv.x));
    gl_FragColor = vec4(color, 1.0);
  }
`;

export default function LiquidChrome({
  baseColor = [0.1, 0.1, 0.1],
  speed = 0.2,
  amplitude = 0.3,
  frequencyX = 3,
  frequencyY = 3,
  interactive = true,
  resolution = 0.5,
  className = '',
  style,
}) {
  const containerRef = useRef(null);
  const [r, g, b] = baseColor;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let renderer;
    try {
      renderer = new Renderer({ antialias: false, dpr: 1 });
    } catch {
      return undefined; // No WebGL: whatever sits behind the canvas stays.
    }
    const { gl } = renderer;
    gl.clearColor(0, 0, 0, 0);
    Object.assign(gl.canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });

    const program = new Program(gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new Float32Array([1, 1, 1]) },
        uBaseColor: { value: new Float32Array([r, g, b]) },
        uAmplitude: { value: amplitude },
        uFrequencyX: { value: frequencyX },
        uFrequencyY: { value: frequencyY },
        uMouse: { value: new Float32Array([0, 0]) },
      },
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const draw = () => renderer.render({ scene: mesh });

    const resize = () => {
      const w = Math.max(1, Math.round(container.offsetWidth * resolution));
      const h = Math.max(1, Math.round(container.offsetHeight * resolution));
      renderer.setSize(w, h);
      Object.assign(gl.canvas.style, { width: '100%', height: '100%' });
      const res = program.uniforms.uResolution.value;
      res[0] = gl.canvas.width;
      res[1] = gl.canvas.height;
      res[2] = gl.canvas.width / gl.canvas.height;
      draw();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const setMouse = (clientX, clientY) => {
      const rect = container.getBoundingClientRect();
      const m = program.uniforms.uMouse.value;
      m[0] = (clientX - rect.left) / rect.width;
      m[1] = 1 - (clientY - rect.top) / rect.height;
    };
    const onMouse = (e) => setMouse(e.clientX, e.clientY);
    const onTouch = (e) => { if (e.touches.length) setMouse(e.touches[0].clientX, e.touches[0].clientY); };

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let visible = true;
    const loop = (t) => {
      frame = requestAnimationFrame(loop);
      program.uniforms.uTime.value = t * 0.001 * speed;
      draw();
    };
    const start = () => { if (!still && !frame && visible && !document.hidden) frame = requestAnimationFrame(loop); };
    const stop = () => { cancelAnimationFrame(frame); frame = 0; };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start(); else stop();
    });
    io.observe(container);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);

    if (interactive && !still) {
      container.addEventListener('mousemove', onMouse);
      container.addEventListener('touchmove', onTouch, { passive: true });
    }

    container.appendChild(gl.canvas);
    resize();
    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      container.removeEventListener('mousemove', onMouse);
      container.removeEventListener('touchmove', onTouch);
      gl.canvas.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [r, g, b, speed, amplitude, frequencyX, frequencyY, interactive, resolution]);

  return <div ref={containerRef} aria-hidden="true" className={`relative ${className}`} style={style} />;
}
