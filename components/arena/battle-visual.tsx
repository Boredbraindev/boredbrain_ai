'use client';

import { useRef, useEffect, useMemo } from 'react';

// ── Model → Unit Class mapping ─────────────────────────────────────────────
type UnitClass = 'swordsman' | 'mage' | 'tank' | 'archer' | 'assassin' | 'healer' | 'berserker' | 'default';

const MODEL_UNIT_MAP: Record<string, UnitClass> = {
  Llama: 'swordsman',
  Qwen: 'mage',
  'Llama 4': 'tank',
  DeepSeek: 'archer',
  Gemini: 'healer',
  GPT: 'berserker',
  Claude: 'assassin',
  Grok: 'swordsman',
};

const UNIT_COLORS: Record<UnitClass, { primary: string; secondary: string; glow: string }> = {
  swordsman: { primary: '#06b6d4', secondary: '#0891b2', glow: '#22d3ee' },   // cyan
  mage:      { primary: '#f59e0b', secondary: '#d97706', glow: '#fbbf24' },   // amber
  tank:      { primary: '#0ea5e9', secondary: '#0284c7', glow: '#38bdf8' },   // sky
  archer:    { primary: '#10b981', secondary: '#059669', glow: '#34d399' },   // emerald
  healer:    { primary: '#3b82f6', secondary: '#2563eb', glow: '#60a5fa' },   // blue
  berserker: { primary: '#22c55e', secondary: '#16a34a', glow: '#4ade80' },   // green
  assassin:  { primary: '#8b5cf6', secondary: '#7c3aed', glow: '#a78bfa' },   // violet
  default:   { primary: '#f59e0b', secondary: '#d97706', glow: '#fbbf24' },   // fallback amber
};

export interface ModelCount {
  model: string;
  count: number;
}

interface BattleVisualProps {
  leftName: string;
  rightName: string;
  leftPercent: number;
  rightPercent: number;
  leftModels?: ModelCount[];
  rightModels?: ModelCount[];
}

interface UnitAgent {
  x: number; y: number; baseX: number; baseY: number;
  size: number; speed: number; phase: number;
  breatheAmp: number; swayAmp: number;
  unitClass: UnitClass;
  color: { primary: string; secondary: string; glow: string };
  model: string;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; life: number; maxLife: number;
  color: string;
}

function getUnitClass(model: string): UnitClass {
  return MODEL_UNIT_MAP[model] || 'default';
}

export default function BattleVisual({ leftName, rightName, leftPercent, rightPercent, leftModels, rightModels }: BattleVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const timeRef = useRef(0);
  const leftWinning = leftPercent > rightPercent;

  const leftArmy = useMemo(() => generateArmy(leftPercent, 'left', leftModels), [leftPercent, leftModels]);
  const rightArmy = useMemo(() => generateArmy(rightPercent, 'right', rightModels), [rightPercent, rightModels]);

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

      // Background — dark battlefield
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#030201');
      bgGrad.addColorStop(0.4, '#0c0705');
      bgGrad.addColorStop(1, '#000000');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      const horizon = h * 0.55;
      drawGround(ctx, w, h, horizon, t);
      drawClashZone(ctx, w / 2, horizon + (h - horizon) * 0.25, w * 0.08, t);

      // Draw armies with model-specific units
      drawModelArmy(ctx, leftArmy, w, h, horizon, 'left', t);
      drawModelArmy(ctx, rightArmy, w, h, horizon, 'right', t);

      // Clash particles — mixed colors from both armies
      if (Math.random() < 0.18) {
        const cx = w / 2 + (Math.random() - 0.5) * 40;
        const cy = horizon + (h - horizon) * 0.2 + (Math.random() - 0.5) * 20;
        const leftColor = leftArmy.length > 0 ? leftArmy[Math.floor(Math.random() * leftArmy.length)].color.glow : '#f59e0b';
        const rightColor = rightArmy.length > 0 ? rightArmy[Math.floor(Math.random() * rightArmy.length)].color.glow : '#a855f7';
        particlesRef.current.push({
          x: cx, y: cy,
          vx: (Math.random() - 0.5) * 3,
          vy: -(1 + Math.random() * 2),
          size: 1.5 + Math.random() * 3,
          life: 1, maxLife: 0.5 + Math.random() * 1,
          color: Math.random() > 0.5 ? leftColor : rightColor,
        });
      }

      // Mage energy particles (from mage units)
      [...leftArmy, ...rightArmy].forEach(unit => {
        if (unit.unitClass === 'mage' && Math.random() < 0.08) {
          const ax = unit.baseX * w;
          const ay = unit.baseY * h;
          particlesRef.current.push({
            x: ax, y: ay - 10,
            vx: (Math.random() - 0.5) * 2,
            vy: -(1 + Math.random()),
            size: 2 + Math.random() * 3,
            life: 1, maxLife: 0.8 + Math.random(),
            color: unit.color.glow,
          });
        }
        // Archer arrow trail
        if (unit.unitClass === 'archer' && Math.random() < 0.04) {
          const ax = unit.baseX * w;
          const ay = unit.baseY * h;
          const dir = unit.baseX < 0.5 ? 1 : -1;
          particlesRef.current.push({
            x: ax, y: ay - 8,
            vx: dir * (3 + Math.random() * 2),
            vy: -(0.5 + Math.random()),
            size: 1.5,
            life: 1, maxLife: 0.6,
            color: unit.color.glow,
          });
        }
      });

      // Ambient embers
      if (Math.random() < 0.15) {
        particlesRef.current.push({
          x: Math.random() * w, y: h * 0.6 + Math.random() * h * 0.3,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -(0.5 + Math.random() * 1.5),
          size: 1 + Math.random() * 2,
          life: 1, maxLife: 2 + Math.random() * 2,
          color: '#ef4444',
        });
      }

      // Update & draw particles
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
      if (particlesRef.current.length > 300) particlesRef.current = particlesRef.current.slice(-200);

      // VS text
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

      // Lightning
      if (Math.sin(t * 4) > 0.92) {
        drawLightning(ctx, w * 0.4, horizon * 0.65, w * 0.6, horizon * 0.65);
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
      {/* Model legend */}
      {(leftModels?.length || rightModels?.length) ? (
        <div className="absolute top-3 left-0 right-0 z-20 flex justify-center gap-3 px-4">
          {Array.from(new Set([...(leftModels ?? []), ...(rightModels ?? [])].map(m => m.model))).slice(0, 6).map(model => {
            const uc = getUnitClass(model);
            const colors = UNIT_COLORS[uc];
            const label = uc === 'swordsman' ? '⚔' : uc === 'mage' ? '✦' : uc === 'tank' ? '🛡' : uc === 'archer' ? '🏹' : uc === 'healer' ? '✚' : uc === 'berserker' ? '💥' : uc === 'assassin' ? '🗡' : '•';
            return (
              <span key={model} className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-white/10 bg-black/50 backdrop-blur-sm"
                style={{ color: colors.primary }}>
                {label} {model}
              </span>
            );
          })}
        </div>
      ) : null}
      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black/40 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black to-transparent z-10 pointer-events-none" />
    </div>
  );
}

// ── Generate army with model-specific unit types ──────────────────────────────

function generateArmy(percent: number, side: 'left' | 'right', models?: ModelCount[]): UnitAgent[] {
  const n = Math.max(5, Math.min(30, Math.round(percent * 0.3)));
  const agents: UnitAgent[] = [];

  // Distribute units per model proportionally
  const modelList: { model: string; count: number }[] = [];
  if (models && models.length > 0) {
    const totalModelCount = models.reduce((s, m) => s + m.count, 0) || 1;
    models.forEach(m => {
      const unitCount = Math.max(1, Math.round((m.count / totalModelCount) * n));
      modelList.push({ model: m.model, count: unitCount });
    });
  } else {
    // Default — all same type
    modelList.push({ model: 'default', count: n });
  }

  let idx = 0;
  const totalUnits = modelList.reduce((s, m) => s + m.count, 0);
  const rows = Math.ceil(totalUnits / 6);

  for (const { model, count: modelCount } of modelList) {
    const uc = getUnitClass(model);
    const colors = UNIT_COLORS[uc];
    for (let k = 0; k < modelCount && idx < totalUnits; k++) {
      const row = Math.floor(idx / 6);
      const col = idx % 6;
      const perRow = Math.min(6, totalUnits - row * 6);
      const xBase = side === 'left'
        ? 0.12 + row * 0.06
        : 0.88 - row * 0.06;
      const yBase = 0.35 + (col - (perRow - 1) / 2) * 0.09;
      agents.push({
        x: xBase, y: yBase, baseX: xBase, baseY: yBase,
        size: uc === 'tank' ? 1.1 + Math.random() * 0.2 : 0.9 + Math.random() * 0.3,
        speed: uc === 'assassin' ? 1.5 + Math.random() * 1.5 : 0.5 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        breatheAmp: 1 + Math.random() * 2,
        swayAmp: uc === 'tank' ? 0.3 : 0.5 + Math.random() * 1.5,
        unitClass: uc,
        color: colors,
        model,
      });
      idx++;
    }
  }
  return agents;
}

// ── Draw model-specific army ─────────────────────────────────────────────────

function drawModelArmy(
  ctx: CanvasRenderingContext2D, army: UnitAgent[],
  w: number, h: number, horizon: number,
  side: 'left' | 'right', t: number,
) {
  // Group aura glow
  if (army.length > 0) {
    const cx = side === 'left' ? w * 0.22 : w * 0.78;
    const cy = horizon * 0.75;
    const mainColor = army[0].color.primary;
    const auraGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.18);
    auraGrad.addColorStop(0, hexToRgba(mainColor, 0.1));
    auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = auraGrad;
    ctx.fillRect(cx - w * 0.2, cy - h * 0.3, w * 0.4, h * 0.6);
  }

  // Draw each unit with class-specific shape
  army.forEach(unit => {
    const ax = unit.baseX * w + Math.sin(t * unit.speed + unit.phase) * unit.swayAmp * 2;
    const ay = unit.baseY * h + Math.sin(t * 1.2 + unit.phase) * unit.breatheAmp;
    const sz = Math.min(w * 0.02, 12) * unit.size;
    const depth = Math.abs(unit.baseX - 0.5);
    const alpha = Math.min(1, 0.5 + depth * 1.2);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = unit.color.glow;
    ctx.shadowBlur = sz * 2;
    ctx.fillStyle = unit.color.primary;

    switch (unit.unitClass) {
      case 'swordsman':
        drawSwordsman(ctx, ax, ay, sz, side, t, unit);
        break;
      case 'mage':
        drawMage(ctx, ax, ay, sz, side, t, unit);
        break;
      case 'tank':
        drawTank(ctx, ax, ay, sz, side, t, unit);
        break;
      case 'archer':
        drawArcher(ctx, ax, ay, sz, side, t, unit);
        break;
      case 'assassin':
        drawAssassin(ctx, ax, ay, sz, side, t, unit);
        break;
      case 'healer':
        drawHealer(ctx, ax, ay, sz, side, t, unit);
        break;
      case 'berserker':
        drawBerserker(ctx, ax, ay, sz, side, t, unit);
        break;
      default:
        drawSwordsman(ctx, ax, ay, sz, side, t, unit);
    }

    // Eyes — universal
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
  army.forEach(unit => {
    ctx.fillStyle = unit.color.secondary;
    ctx.beginPath();
    ctx.ellipse(unit.baseX * w, unit.baseY * h + 8, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// ── Unit class drawing functions ─────────────────────────────────────────────

function drawSwordsman(ctx: CanvasRenderingContext2D, ax: number, ay: number, sz: number, side: 'left' | 'right', t: number, unit: UnitAgent) {
  ctx.fillStyle = unit.color.primary;
  // Head
  ctx.beginPath();
  ctx.arc(ax, ay - sz * 1.3, sz * 0.35, 0, Math.PI * 2);
  ctx.fill();
  // Helmet crest
  ctx.fillStyle = unit.color.secondary;
  ctx.fillRect(ax - sz * 0.03, ay - sz * 1.7, sz * 0.06, sz * 0.3);
  // Torso
  ctx.fillStyle = unit.color.primary;
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
  // Sword — long blade toward center
  const swordAngle = side === 'left' ? -0.4 + Math.sin(t * 2.5 + unit.phase) * 0.25 : Math.PI + 0.4 - Math.sin(t * 2.5 + unit.phase) * 0.25;
  ctx.save();
  ctx.translate(ax + (side === 'left' ? sz * 0.3 : -sz * 0.3), ay - sz * 0.7);
  ctx.rotate(swordAngle);
  // Blade
  ctx.fillStyle = '#e2e8f0';
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 6;
  ctx.fillRect(0, -sz * 0.03, sz * 0.8, sz * 0.06);
  // Handle
  ctx.fillStyle = unit.color.secondary;
  ctx.fillRect(-sz * 0.1, -sz * 0.06, sz * 0.12, sz * 0.12);
  ctx.restore();
}

function drawMage(ctx: CanvasRenderingContext2D, ax: number, ay: number, sz: number, side: 'left' | 'right', t: number, unit: UnitAgent) {
  ctx.fillStyle = unit.color.primary;
  // Head with pointed hat
  ctx.beginPath();
  ctx.arc(ax, ay - sz * 1.3, sz * 0.35, 0, Math.PI * 2);
  ctx.fill();
  // Pointed hat
  ctx.beginPath();
  ctx.moveTo(ax - sz * 0.35, ay - sz * 1.3);
  ctx.lineTo(ax, ay - sz * 2.2);
  ctx.lineTo(ax + sz * 0.25, ay - sz * 1.3);
  ctx.closePath();
  ctx.fill();
  // Robe (wider torso)
  ctx.beginPath();
  ctx.moveTo(ax - sz * 0.35, ay - sz * 0.9);
  ctx.lineTo(ax + sz * 0.35, ay - sz * 0.9);
  ctx.lineTo(ax + sz * 0.45, ay + sz * 0.6);
  ctx.lineTo(ax - sz * 0.45, ay + sz * 0.6);
  ctx.closePath();
  ctx.fill();
  // Staff
  const staffX = ax + (side === 'left' ? sz * 0.5 : -sz * 0.5);
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = sz * 0.08;
  ctx.beginPath();
  ctx.moveTo(staffX, ay - sz * 1.5);
  ctx.lineTo(staffX, ay + sz * 0.5);
  ctx.stroke();
  // Energy orb on staff
  const orbPulse = 0.8 + Math.sin(t * 4 + unit.phase) * 0.3;
  ctx.shadowColor = unit.color.glow;
  ctx.shadowBlur = 15 * orbPulse;
  ctx.fillStyle = unit.color.glow;
  ctx.beginPath();
  ctx.arc(staffX, ay - sz * 1.6, sz * 0.18 * orbPulse, 0, Math.PI * 2);
  ctx.fill();
}

function drawTank(ctx: CanvasRenderingContext2D, ax: number, ay: number, sz: number, side: 'left' | 'right', t: number, unit: UnitAgent) {
  ctx.fillStyle = unit.color.primary;
  // Head — bigger
  ctx.beginPath();
  ctx.arc(ax, ay - sz * 1.4, sz * 0.4, 0, Math.PI * 2);
  ctx.fill();
  // Bulky torso (wider)
  ctx.beginPath();
  ctx.moveTo(ax - sz * 0.55, ay - sz * 1.0);
  ctx.lineTo(ax + sz * 0.55, ay - sz * 1.0);
  ctx.lineTo(ax + sz * 0.5, ay + sz * 0.3);
  ctx.lineTo(ax - sz * 0.5, ay + sz * 0.3);
  ctx.closePath();
  ctx.fill();
  // Thick legs
  ctx.fillRect(ax - sz * 0.35, ay + sz * 0.3, sz * 0.25, sz * 0.45);
  ctx.fillRect(ax + sz * 0.1, ay + sz * 0.3, sz * 0.25, sz * 0.45);
  // Shield
  const shieldX = ax + (side === 'left' ? sz * 0.5 : -sz * 0.5);
  const shieldBob = Math.sin(t * 1.5 + unit.phase) * sz * 0.05;
  ctx.fillStyle = unit.color.secondary;
  ctx.shadowColor = unit.color.glow;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(shieldX - sz * 0.25, ay - sz * 0.8 + shieldBob);
  ctx.lineTo(shieldX + sz * 0.25, ay - sz * 0.8 + shieldBob);
  ctx.lineTo(shieldX + sz * 0.2, ay + sz * 0.1 + shieldBob);
  ctx.lineTo(shieldX, ay + sz * 0.25 + shieldBob);
  ctx.lineTo(shieldX - sz * 0.2, ay + sz * 0.1 + shieldBob);
  ctx.closePath();
  ctx.fill();
  // Shield emblem
  ctx.fillStyle = unit.color.glow;
  ctx.beginPath();
  ctx.arc(shieldX, ay - sz * 0.35 + shieldBob, sz * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawArcher(ctx: CanvasRenderingContext2D, ax: number, ay: number, sz: number, side: 'left' | 'right', t: number, unit: UnitAgent) {
  ctx.fillStyle = unit.color.primary;
  // Head — hooded
  ctx.beginPath();
  ctx.arc(ax, ay - sz * 1.3, sz * 0.32, 0, Math.PI * 2);
  ctx.fill();
  // Hood
  ctx.beginPath();
  ctx.moveTo(ax - sz * 0.35, ay - sz * 1.2);
  ctx.lineTo(ax, ay - sz * 1.75);
  ctx.lineTo(ax + sz * 0.35, ay - sz * 1.2);
  ctx.closePath();
  ctx.fill();
  // Slim torso
  ctx.beginPath();
  ctx.moveTo(ax - sz * 0.3, ay - sz * 0.9);
  ctx.lineTo(ax + sz * 0.3, ay - sz * 0.9);
  ctx.lineTo(ax + sz * 0.2, ay + sz * 0.2);
  ctx.lineTo(ax - sz * 0.2, ay + sz * 0.2);
  ctx.closePath();
  ctx.fill();
  // Legs
  ctx.fillRect(ax - sz * 0.18, ay + sz * 0.2, sz * 0.14, sz * 0.5);
  ctx.fillRect(ax + sz * 0.04, ay + sz * 0.2, sz * 0.14, sz * 0.5);
  // Bow
  const bowX = ax + (side === 'left' ? sz * 0.4 : -sz * 0.4);
  const bowAngle = side === 'left' ? 0 : Math.PI;
  ctx.save();
  ctx.translate(bowX, ay - sz * 0.5);
  ctx.rotate(bowAngle);
  // Bow arc
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = sz * 0.06;
  ctx.beginPath();
  ctx.arc(0, 0, sz * 0.5, -Math.PI * 0.4, Math.PI * 0.4);
  ctx.stroke();
  // String
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = sz * 0.02;
  const drawPull = Math.sin(t * 3 + unit.phase) * 0.3 + 0.1;
  ctx.beginPath();
  ctx.moveTo(Math.cos(-Math.PI * 0.4) * sz * 0.5, Math.sin(-Math.PI * 0.4) * sz * 0.5);
  ctx.lineTo(-sz * drawPull, 0);
  ctx.lineTo(Math.cos(Math.PI * 0.4) * sz * 0.5, Math.sin(Math.PI * 0.4) * sz * 0.5);
  ctx.stroke();
  // Arrow
  ctx.fillStyle = unit.color.glow;
  ctx.fillRect(-sz * drawPull, -sz * 0.02, sz * 0.6, sz * 0.04);
  ctx.restore();
}

function drawAssassin(ctx: CanvasRenderingContext2D, ax: number, ay: number, sz: number, side: 'left' | 'right', t: number, unit: UnitAgent) {
  ctx.fillStyle = unit.color.primary;
  // Head — masked
  ctx.beginPath();
  ctx.arc(ax, ay - sz * 1.3, sz * 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Slim torso
  ctx.beginPath();
  ctx.moveTo(ax - sz * 0.28, ay - sz * 0.9);
  ctx.lineTo(ax + sz * 0.28, ay - sz * 0.9);
  ctx.lineTo(ax + sz * 0.22, ay + sz * 0.2);
  ctx.lineTo(ax - sz * 0.22, ay + sz * 0.2);
  ctx.closePath();
  ctx.fill();
  // Legs — dynamic stance
  const legPhase = Math.sin(t * 3 + unit.phase) * sz * 0.1;
  ctx.fillRect(ax - sz * 0.2 + legPhase, ay + sz * 0.2, sz * 0.14, sz * 0.45);
  ctx.fillRect(ax + sz * 0.06 - legPhase, ay + sz * 0.2, sz * 0.14, sz * 0.45);
  // Twin daggers
  const daggerAngle1 = side === 'left' ? -0.6 + Math.sin(t * 3.5 + unit.phase) * 0.3 : Math.PI + 0.6 - Math.sin(t * 3.5 + unit.phase) * 0.3;
  const daggerAngle2 = side === 'left' ? -0.3 + Math.sin(t * 3.5 + unit.phase + 1) * 0.25 : Math.PI + 0.3 - Math.sin(t * 3.5 + unit.phase + 1) * 0.25;
  // Dagger 1
  ctx.save();
  ctx.translate(ax + (side === 'left' ? sz * 0.25 : -sz * 0.25), ay - sz * 0.7);
  ctx.rotate(daggerAngle1);
  ctx.fillStyle = '#c4b5fd';
  ctx.fillRect(0, -sz * 0.02, sz * 0.45, sz * 0.04);
  ctx.restore();
  // Dagger 2
  ctx.save();
  ctx.translate(ax + (side === 'left' ? sz * 0.2 : -sz * 0.2), ay - sz * 0.4);
  ctx.rotate(daggerAngle2);
  ctx.fillStyle = '#c4b5fd';
  ctx.fillRect(0, -sz * 0.02, sz * 0.4, sz * 0.04);
  ctx.restore();
}

function drawHealer(ctx: CanvasRenderingContext2D, ax: number, ay: number, sz: number, side: 'left' | 'right', t: number, unit: UnitAgent) {
  ctx.fillStyle = unit.color.primary;
  // Head with halo
  ctx.beginPath();
  ctx.arc(ax, ay - sz * 1.3, sz * 0.35, 0, Math.PI * 2);
  ctx.fill();
  // Halo ring
  ctx.strokeStyle = unit.color.glow;
  ctx.lineWidth = sz * 0.04;
  ctx.shadowColor = unit.color.glow;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.ellipse(ax, ay - sz * 1.7, sz * 0.3, sz * 0.08, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Robe
  ctx.shadowBlur = sz * 2;
  ctx.fillStyle = unit.color.primary;
  ctx.beginPath();
  ctx.moveTo(ax - sz * 0.35, ay - sz * 0.9);
  ctx.lineTo(ax + sz * 0.35, ay - sz * 0.9);
  ctx.lineTo(ax + sz * 0.4, ay + sz * 0.55);
  ctx.lineTo(ax - sz * 0.4, ay + sz * 0.55);
  ctx.closePath();
  ctx.fill();
  // Cross symbol on chest
  ctx.fillStyle = unit.color.glow;
  const pulse = 0.8 + Math.sin(t * 3 + unit.phase) * 0.2;
  ctx.globalAlpha *= pulse;
  ctx.fillRect(ax - sz * 0.04, ay - sz * 0.6, sz * 0.08, sz * 0.3);
  ctx.fillRect(ax - sz * 0.12, ay - sz * 0.48, sz * 0.24, sz * 0.08);
  // Healing orb floating
  const orbY = ay - sz * 0.2 + Math.sin(t * 2 + unit.phase) * sz * 0.15;
  const handX = ax + (side === 'left' ? sz * 0.35 : -sz * 0.35);
  ctx.fillStyle = unit.color.glow;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(handX, orbY, sz * 0.12 * pulse, 0, Math.PI * 2);
  ctx.fill();
}

function drawBerserker(ctx: CanvasRenderingContext2D, ax: number, ay: number, sz: number, side: 'left' | 'right', t: number, unit: UnitAgent) {
  ctx.fillStyle = unit.color.primary;
  // Head — mohawk
  ctx.beginPath();
  ctx.arc(ax, ay - sz * 1.3, sz * 0.35, 0, Math.PI * 2);
  ctx.fill();
  // Mohawk spikes
  ctx.fillStyle = unit.color.glow;
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(ax + i * sz * 0.06 - sz * 0.02, ay - sz * 1.65 - Math.abs(i) * sz * 0.05, sz * 0.04, sz * 0.25);
  }
  // Muscular torso (wider shoulders)
  ctx.fillStyle = unit.color.primary;
  ctx.beginPath();
  ctx.moveTo(ax - sz * 0.5, ay - sz * 0.95);
  ctx.lineTo(ax + sz * 0.5, ay - sz * 0.95);
  ctx.lineTo(ax + sz * 0.35, ay + sz * 0.25);
  ctx.lineTo(ax - sz * 0.35, ay + sz * 0.25);
  ctx.closePath();
  ctx.fill();
  // Thick legs
  ctx.fillRect(ax - sz * 0.28, ay + sz * 0.25, sz * 0.2, sz * 0.45);
  ctx.fillRect(ax + sz * 0.08, ay + sz * 0.25, sz * 0.2, sz * 0.45);
  // Giant axe
  const axeAngle = side === 'left' ? -0.5 + Math.sin(t * 2 + unit.phase) * 0.35 : Math.PI + 0.5 - Math.sin(t * 2 + unit.phase) * 0.35;
  ctx.save();
  ctx.translate(ax + (side === 'left' ? sz * 0.4 : -sz * 0.4), ay - sz * 0.8);
  ctx.rotate(axeAngle);
  // Handle
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(0, -sz * 0.03, sz * 0.7, sz * 0.06);
  // Axe head
  ctx.fillStyle = '#9ca3af';
  ctx.shadowColor = unit.color.glow;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(sz * 0.55, -sz * 0.2);
  ctx.lineTo(sz * 0.85, 0);
  ctx.lineTo(sz * 0.55, sz * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── Ground ──────────────────────────────────────────────────────────────────

function drawGround(ctx: CanvasRenderingContext2D, w: number, h: number, horizon: number, t: number) {
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

  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.8);
  g.addColorStop(0, 'rgba(239, 68, 68, 0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r * 0.5, r * 2, r);
  ctx.restore();
}

// ── Lightning ───────────────────────────────────────────────────────────────

function drawLightning(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
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
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas) return `rgba(200,150,50,${alpha})`;
  canvas.width = canvas.height = 1;
  const ctx2 = canvas.getContext('2d')!;
  ctx2.fillStyle = hex;
  ctx2.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx2.getImageData(0, 0, 1, 1).data;
  return `rgba(${r},${g},${b},${alpha})`;
}
