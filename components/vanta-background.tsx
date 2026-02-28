'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface VantaBackgroundProps {
  isStreaming?: boolean;
}

export function VantaBackground({ isStreaming = false }: VantaBackgroundProps) {
  const vantaRef = useRef<HTMLDivElement>(null);
  const [vantaEffect, setVantaEffect] = useState<any>(null);

  useEffect(() => {
    if (vantaEffect) return;

    let mounted = true;

    const loadVanta = async () => {
      try {
        const THREE = await import('three');
        const HALO = (await import('vanta/dist/vanta.halo.min')).default;

        if (!mounted || !vantaRef.current) return;

        const effect = HALO({
          el: vantaRef.current,
          THREE,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          mouseEase: true,
          minHeight: 200,
          minWidth: 200,
          scale: 1,
          scaleMobile: 1,
          speed: 1,
          amplitudeFactor: 0.5,
          ringFactor: 1,
          rotationFactor: 1,
          backgroundColor: 0x414518,
          baseColor: 0x1a59,
          color2: 0xf2e735,
          backgroundAlpha: 1,
          size: 1,
          xOffset: 0,
          yOffset: 0,
        });

        if (mounted) {
          setVantaEffect(effect);
        }
      } catch (e) {
        console.warn('Vanta.js failed to load:', e);
      }
    };

    loadVanta();

    return () => {
      mounted = false;
    };
  }, [vantaEffect]);

  // React to streaming state — boost speed & amplitude when AI is active
  useEffect(() => {
    if (!vantaEffect) return;
    try {
      if (isStreaming) {
        vantaEffect.setOptions({
          speed: 2.5,
          amplitudeFactor: 1.2,
          size: 1.5,
        });
      } else {
        vantaEffect.setOptions({
          speed: 1,
          amplitudeFactor: 0.5,
          size: 1,
        });
      }
    } catch {
      // vanta may not support setOptions for all params
    }
  }, [isStreaming, vantaEffect]);

  useEffect(() => {
    return () => {
      if (vantaEffect) {
        vantaEffect.destroy();
      }
    };
  }, [vantaEffect]);

  return (
    <div
      ref={vantaRef}
      className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-1000"
      style={{ opacity: isStreaming ? 0.45 : 0.25 }}
      aria-hidden="true"
    />
  );
}
