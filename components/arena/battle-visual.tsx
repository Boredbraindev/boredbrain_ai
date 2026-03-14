'use client';

import { useRef, useEffect, useMemo } from 'react';

interface BattleVisualProps {
  leftName: string;
  rightName: string;
  leftPercent: number;
  rightPercent: number;
}

// Each agent in the army
interface Agent {
  x: number; y: number; baseX: number; baseY: number;
  size: number; speed: number; phase: number;
  breatheAmp: number; swayAmp: number;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; life: number; maxLife: number;
  color: string;
}

export default function BattleVisual({ leftName, rightName, leftPercent, rightPercent }: BattleVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const timeRef = useRef(0);
  const leftWinning = leftPercent > rightPercent;

  // Generate army positions (stable across renders)
  const leftArmy = useMemo(() => generateArmy(leftPercent, 'left'), [leftPercent]);
  const rightArmy = useMemo(() => generateArmy(rightPercent, 'right'), [rightPercent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.getBoundingClientRect().width;
    const H = () => canvas.getBoundingClientRect().height;

    const render = (timestamp: number) => {
      const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
      lastTime = timestamp;
      timeRef.current += dt;
      const t = timeRef.current;
      const w = W();
      const h = H();

      ctx.clearRect(0, 0, w, h);

      // Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#030201');
      bgGrad.addColorStop(0.4, '#0c0705');
      bgGrad.addColorStop(1, '#000000');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Ground plane with perspective
      const horizon = h * 0.55;
      drawGround(ctx, w, h, horizon, t);

      // Center clash zone — energy ring + sparks
      drawClashZone(ctx, w / 2, horizon + (h - horizon) * 0.25, w * 0.08, t);

      // Left army (FOR — amber)
      drawArmy(ctx, leftArmy, w, h, horizon, 'left', t, '#f59e0b', '#ff8c00');

      // Right army (AGAINST — purple)
      drawArmy(ctx, rightArmy, w, h, horizon, 'right', t, '#a855f7', '#9333ea');

      // Clash particles at center
      if (Math.random() < 0.15) {
        const cx = w / 2 + (Math.random() - 0.5) * 40;
        const cy = horizon + (h - horizon) * 0.2 + (Math.random() - 0.5) * 20;
        particlesRef.current.push({
          x: cx, y: cy,
          vx: (Math.random() - 0.5) * 3,
          vy: -(1 + Math.random() * 2),
          size: 1.5 + Math.random() * 3,
          life: 1, maxLife: 0.5 + Math.random() * 1,
          color: Math.random() > 0.5 ? '#f59e0b' : '#a855f7',
        });
      }
      // Ambient embers
      if (Math.random() < 0.2) {
        particlesRef.current.push({
          x: Math.random() * w, y: h * 0.6 + Math.random() * h * 0.3,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -(0.5 + Math.random() * 1.5),
          size: 1 + Math.random() * 2,
          life: 1, maxLife: 2 + Math.random() * 2,
          color: '#ef4444',
        });
      }

      // Update particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.life -= dt / p.maxLife;
        p.x += p.vx;
        p.y += p.vy;
        if (p.life <= 0) return false;
        ctx.save();
        ctx.globalAlpha = p.life * 0.7;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 4;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return true;
      });
      if (particlesRef.current.length > 250) particlesRef.current = particlesRef.current.slice(-180);

      // VS text at center
      ctx.save();
      const vsSize = Math.min(w * 0.05, 32);
      ctx.font = `900 ${vsSize}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 25 + Math.sin(t * 3) * 10;
      ctx.fillStyle = '#ef4444';
      ctx.fillText('VS', w / 2, horizon * 0.7);
      ctx.restore();

      // Team labels
      ctx.save();
      const labelSize = Math.min(w * 0.025, 14);
      ctx.font = `900 ${labelSize}px system-ui, sans-serif`;
      ctx.textAlign = 'center';

      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(leftName, w * 0.25, horizon * 0.45);

      ctx.shadowColor = '#a855f7';
      ctx.fillStyle = '#a855f7';
      ctx.fillText(rightName, w * 0.75, horizon * 0.45);
      ctx.restore();

      // Occasional lightning between armies
      if (Math.sin(t * 4) > 0.92) {
        drawLightning(ctx, w * 0.4, horizon * 0.65, w * 0.6, horizon * 0.65, t);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [leftArmy, rightArmy, leftName, rightName, leftPercent, rightPercent, leftWinning]);

  return (
    <div className="relative w-full overflow-hidden rounded-t-xl" style={{ height: 'clamp(300px, 45vw, 480px)' }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {/* Score bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 sm:px-8 pb-3">
        <div className="relative h-3 rounded-full overflow-hidden bg-black/70 border border-white/[0.08]">
          <div className="h-full flex">
            <div className="h-full transition-all duration-700 rounded-l-full"
              style={{ width: `${leftPercent}%`, background: 'linear-gradient(90deg, #92400e, #f59e0b, #fbbf24)', boxShadow: '0 0 20px rgba(245,158,11,0.5)' }} />
            <div className="w-[3px] bg-white shadow-[0_0_15px_rgba(255,255,255,1)] relative z-10" />
            <div className="h-full transition-all duration-700 rounded-r-full"
              style={{ width: `${rightPercent}%`, background: 'linear-gradient(90deg, #c084fc, #a855f7, #6b21a8)', boxShadow: '0 0 20px rgba(168,85,247,0.5)' }} />
          </div>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className={`text-2xl sm:text-3xl font-black font-mono tabular-nums ${leftWinning ? 'text-amber-400' : 'text-white/25'}`}
            style={leftWinning ? { textShadow: '0 0 24px rgba(245,158,11,0.6)' } : {}}>
            {leftPercent}%
          </span>
          <span className="text-[9px] text-white/20 uppercase tracking-[0.3em] font-mono">POWER CLASH</span>
          <span className={`text-2xl sm:text-3xl font-black font-mono tabular-nums ${!leftWinning ? 'text-purple-400' : 'text-white/25'}`}
            style={!leftWinning ? { textShadow: '0 0 24px rgba(168,85,247,0.6)' } : {}}>
            {rightPercent}%
          </span>
        </div>
      </div>
      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black/40 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black to-transparent z-10 pointer-events-none" />
    </div>
  );
}

// ── Generate army of agents ─────────────────────────────────────────────────

function generateArmy(count: number, side: 'left' | 'right'): Agent[] {
  // count represents percentage, map to visible agents (5-30 range)
  const n = Math.max(5, Math.min(30, Math.round(count * 0.3)));
  const agents: Agent[] = [];
  // Arrange in rows (front line closer to center, back line further)
  const rows = Math.ceil(n / 6);
  let idx = 0;
  for (let row = 0; row < rows && idx < n; row++) {
    const perRow = Math.min(6, n - idx);
    for (let col = 0; col < perRow; col++) {
      const xBase = side === 'left'
        ? 0.12 + row * 0.06
        : 0.88 - row * 0.06;
      const yBase = 0.35 + (col - (perRow - 1) / 2) * 0.09;
      agents.push({
        x: xBase, y: yBase, baseX: xBase, baseY: yBase,
        size: 0.9 + Math.random() * 0.3,
        speed: 0.5 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        breatheAmp: 1 + Math.random() * 2,
        swayAmp: 0.5 + Math.random() * 1.5,
      });
      idx++;
    }
  }
  return agents;
}

// ── Draw army ───────────────────────────────────────────────────────────────

function drawArmy(
  ctx: CanvasRenderingContext2D, army: Agent[],
  w: number, h: number, horizon: number,
  side: 'left' | 'right', t: number,
  color1: string, color2: string,
) {
  // Group aura glow
  const cx = side === 'left' ? w * 0.22 : w * 0.78;
  const cy = horizon * 0.75;
  const auraGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.18);
  auraGrad.addColorStop(0, hexToRgba(color1, 0.12));
  auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = auraGrad;
  ctx.fillRect(cx - w * 0.2, cy - h * 0.3, w * 0.4, h * 0.6);

  // Draw each agent
  army.forEach((agent, i) => {
    const ax = agent.baseX * w + Math.sin(t * agent.speed + agent.phase) * agent.swayAmp * 2;
    const ay = agent.baseY * h + Math.sin(t * 1.2 + agent.phase) * agent.breatheAmp;
    const sz = Math.min(w * 0.02, 12) * agent.size;

    // Perspective: agents further from center (higher row) are smaller/dimmer
    const depth = Math.abs(agent.baseX - 0.5);
    const alpha = 0.5 + depth * 1.2;

    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);

    // Agent glow
    ctx.shadowColor = color1;
    ctx.shadowBlur = sz * 2;

    // Body — simple but effective
    ctx.fillStyle = color1;

    // Head
    ctx.beginPath();
    ctx.arc(ax, ay - sz * 1.3, sz * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Torso
    ctx.beginPath();
    ctx.moveTo(ax - sz * 0.4, ay - sz * 0.9);
    ctx.lineTo(ax + sz * 0.4, ay - sz * 0.9);
    ctx.lineTo(ax + sz * 0.3, ay + sz * 0.2);
    ctx.lineTo(ax - sz * 0.3, ay + sz * 0.2);
    ctx.closePath();
    ctx.fill();

    // Legs
    ctx.fillRect(ax - sz * 0.25, ay + sz * 0.2, sz * 0.18, sz * 0.5);
    ctx.fillRect(ax + sz * 0.07, ay + sz * 0.2, sz * 0.18, sz * 0.5);

    // Weapon arm — raised toward center
    const armAngle = side === 'left' ? -0.5 + Math.sin(t * 2 + agent.phase) * 0.2 : Math.PI + 0.5 - Math.sin(t * 2 + agent.phase) * 0.2;
    ctx.save();
    ctx.translate(ax + (side === 'left' ? sz * 0.3 : -sz * 0.3), ay - sz * 0.7);
    ctx.rotate(armAngle);
    ctx.fillRect(0, 0, sz * 0.6, sz * 0.12);
    // Weapon tip glow
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(sz * 0.6, sz * 0.06, sz * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Glowing eyes
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#fff';
    ctx.fillStyle = '#fff';
    const eyeOff = side === 'left' ? 0.08 : -0.08;
    ctx.beginPath();
    ctx.arc(ax - sz * 0.1 + sz * eyeOff, ay - sz * 1.35, sz * 0.06, 0, Math.PI * 2);
    ctx.arc(ax + sz * 0.1 + sz * eyeOff, ay - sz * 1.35, sz * 0.06, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });

  // Ground shadows
  ctx.save();
  ctx.globalAlpha = 0.15;
  army.forEach(agent => {
    const ax = agent.baseX * w;
    const ay = agent.baseY * h + 8;
    ctx.fillStyle = color2;
    ctx.beginPath();
    ctx.ellipse(ax, ay + 8, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// ── Ground ──────────────────────────────────────────────────────────────────

function drawGround(ctx: CanvasRenderingContext2D, w: number, h: number, horizon: number, t: number) {
  // Perspective grid
  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 12; i++) {
    const y = horizon + i * (h - horizon) / 12;
    const a = (i / 12) * 0.3;
    ctx.strokeStyle = `rgba(239, 68, 68, ${a})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  for (let i = -6; i <= 6; i++) {
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.06)';
    ctx.beginPath();
    ctx.moveTo(w / 2 + (i / 6) * w * 0.05, horizon);
    ctx.lineTo(w / 2 + (i / 6) * w * 0.7, h);
    ctx.stroke();
  }
  ctx.restore();

  // Center dividing line
  ctx.save();
  ctx.strokeStyle = `rgba(239, 68, 68, ${0.2 + Math.sin(t * 2) * 0.1})`;
  ctx.lineWidth = 2;
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 10;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(w / 2, horizon);
  ctx.lineTo(w / 2, h);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ── Center clash zone ───────────────────────────────────────────────────────

function drawClashZone(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number) {
  // Rotating energy ring
  ctx.save();
  ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 + Math.sin(t * 3) * 0.15})`;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 2; a += 0.03) {
    const wobble = 1 + Math.sin(a * 8 + t * 4) * 0.12;
    const x = cx + Math.cos(a + t * 0.8) * r * wobble;
    const y = cy + Math.sin(a + t * 0.8) * r * wobble * 0.4;
    if (a === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  // Inner energy
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.8);
  g.addColorStop(0, 'rgba(239, 68, 68, 0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r * 0.5, r * 2, r);
  ctx.restore();
}

// ── Lightning ───────────────────────────────────────────────────────────────

function drawLightning(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, _t: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    ctx.lineTo(
      x1 + (x2 - x1) * progress,
      y1 + (y2 - y1) * progress + (Math.random() - 0.5) * 25,
    );
  }
  ctx.stroke();
  ctx.restore();
}

// ── Utils ───────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  // Parse hex or named colors to rgba
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas) return `rgba(200,150,50,${alpha})`;
  canvas.width = canvas.height = 1;
  const ctx2 = canvas.getContext('2d')!;
  ctx2.fillStyle = hex;
  ctx2.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx2.getImageData(0, 0, 1, 1).data;
  return `rgba(${r},${g},${b},${alpha})`;
}
