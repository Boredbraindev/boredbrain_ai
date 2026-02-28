'use client';

import { useEffect, useRef, useState } from 'react';

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const pos = useRef({ x: 0, y: 0 });
  const trailPos = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Only show custom cursor on desktop with pointer device
    const mq = window.matchMedia('(pointer: fine)');
    if (!mq.matches) return;

    const handleMove = (e: MouseEvent) => {
      pos.current = { x: e.clientX, y: e.clientY };
      if (!visible) setVisible(true);
    };

    const handleLeave = () => setVisible(false);
    const handleEnter = () => setVisible(true);

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseleave', handleLeave);
    document.addEventListener('mouseenter', handleEnter);

    // Smooth trail animation
    const animate = () => {
      trailPos.current.x += (pos.current.x - trailPos.current.x) * 0.15;
      trailPos.current.y += (pos.current.y - trailPos.current.y) * 0.15;

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px)`;
      }
      if (trailRef.current) {
        trailRef.current.style.transform = `translate(${trailPos.current.x}px, ${trailPos.current.y}px)`;
      }

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseleave', handleLeave);
      document.removeEventListener('mouseenter', handleEnter);
      cancelAnimationFrame(rafRef.current);
    };
  }, [visible]);

  // Don't render on mobile/touch
  if (typeof window !== 'undefined' && !window.matchMedia('(pointer: fine)').matches) {
    return null;
  }

  return (
    <>
      {/* Glow trail — follows with delay */}
      <div
        ref={trailRef}
        className="pointer-events-none fixed top-0 left-0 z-[9999] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        aria-hidden="true"
      >
        <div className="h-8 w-8 rounded-full bg-amber-500/20 blur-xl" />
      </div>
      {/* Cursor dot */}
      <div
        ref={cursorRef}
        className="pointer-events-none fixed top-0 left-0 z-[9999] -translate-x-1/2 -translate-y-1/2 mix-blend-difference transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
        aria-hidden="true"
      >
        <div className="h-2.5 w-2.5 rounded-full bg-white" />
      </div>
    </>
  );
}
