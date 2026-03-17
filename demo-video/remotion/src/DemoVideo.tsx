import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
  OffthreadVideo,
  Audio,
} from "remotion";

// ─── Colors ─────────────────────────────────────────────────────────────────
const C = {
  bg: "#030303", amber: "#f59e0b", purple: "#a855f7", emerald: "#10b981",
  red: "#ef4444", blue: "#3b82f6", cyan: "#06b6d4",
};

// ─── Glow BG ────────────────────────────────────────────────────────────────
const GlowBg: React.FC<{ c1?: string; c2?: string }> = ({
  c1 = "rgba(245,158,11,0.1)", c2 = "rgba(168,85,247,0.07)",
}) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div style={{ position: "absolute", width: 800, height: 800, borderRadius: "50%", background: `radial-gradient(circle, ${c1} 0%, transparent 70%)`, left: `${30 + Math.sin(f * 0.02) * 8}%`, top: `${20 + Math.cos(f * 0.015) * 6}%`, transform: "translate(-50%,-50%)", filter: "blur(80px)" }} />
      <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${c2} 0%, transparent 70%)`, left: `${65 + Math.cos(f * 0.02) * 10}%`, top: `${60 + Math.sin(f * 0.025) * 8}%`, transform: "translate(-50%,-50%)", filter: "blur(100px)" }} />
    </AbsoluteFill>
  );
};

// ─── HUD corners (subtle) ───────────────────────────────────────────────────
const HUD: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 15], [0, 0.5], { extrapolateRight: "clamp" });
  return (
    <>
      <div style={{ position: "absolute", top: 28, right: 60, opacity: o, display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 9, color: `${C.amber}80`, fontFamily: "monospace", letterSpacing: "0.15em" }}>WEB 4.0</span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)", fontFamily: "monospace" }}>·</span>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "monospace", letterSpacing: "0.1em" }}>BOREDBRAIN.APP</span>
      </div>
    </>
  );
};

// ─── Title ──────────────────────────────────────────────────────────────────
const Title: React.FC<{
  text: string; size?: number; delay?: number; gradient?: boolean;
  color?: string; weight?: number; tracking?: string;
}> = ({ text, size = 72, delay = 0, gradient, color = "#fff", weight = 900, tracking = "-0.03em" }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: Math.max(0, f - delay), fps, config: { damping: 14, mass: 0.5 } });
  const o = interpolate(f - delay, [0, 8], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const base: React.CSSProperties = {
    fontSize: size, fontWeight: weight, letterSpacing: tracking, lineHeight: 1.1,
    textAlign: "center", fontFamily: "'Inter', -apple-system, sans-serif",
    opacity: Math.max(0, o), transform: `translateY(${(1 - p) * 35}px)`,
  };
  if (gradient) return <div style={{ ...base, background: "linear-gradient(135deg, #fbbf24 10%, #fff 45%, #c084fc 85%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{text}</div>;
  return <div style={{ ...base, color }}>{text}</div>;
};

// ─── Subtitle (bottom center caption bar) ───────────────────────────────────
const Sub: React.FC<{ text: string; delay?: number; duration?: number }> = ({ text, delay = 0, duration = 200 }) => {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f - delay, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(f - delay, [duration - 12, duration], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", bottom: 60, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: Math.max(0, Math.min(fadeIn, fadeOut)) }}>
      <div style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "12px 28px", maxWidth: 850 }}>
        <span style={{ fontSize: 16, color: "rgba(255,255,255,0.85)", fontWeight: 500, fontFamily: "'Inter', sans-serif", lineHeight: 1.5 }}>{text}</span>
      </div>
    </div>
  );
};

// ─── Floating Tag ───────────────────────────────────────────────────────────
const Tag: React.FC<{ text: string; x: number; y: number; delay?: number; color?: string }> = ({ text, x, y, delay = 0, color = C.amber }) => {
  const f = useCurrentFrame();
  const o = interpolate(f - delay, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const dy = Math.sin((f - delay) * 0.05) * 4;
  return (
    <div style={{ position: "absolute", left: x, top: y + dy, opacity: Math.max(0, o), padding: "4px 10px", borderRadius: 6, background: "rgba(0,0,0,0.55)", border: `1px solid ${color}25`, fontSize: 10, fontWeight: 600, color, fontFamily: "monospace", letterSpacing: "0.06em" }}>{text}</div>
  );
};

// ─── Particle Burst ─────────────────────────────────────────────────────────
const Burst: React.FC = () => {
  const f = useCurrentFrame();
  if (f > 25) return null;
  return <>{Array.from({ length: 35 }, (_, i) => {
    const a = (i / 35) * Math.PI * 2;
    const r = f * (4 + (i % 4) * 2);
    return <div key={i} style={{ position: "absolute", left: 960 + Math.cos(a) * r, top: 540 + Math.sin(a) * r, width: 3 + (i % 3), height: 3 + (i % 3), borderRadius: "50%", background: [C.amber, C.purple, C.cyan, C.emerald][i % 4], opacity: Math.max(0, 1 - f / 22), boxShadow: `0 0 6px ${[C.amber, C.purple, C.cyan, C.emerald][i % 4]}`, transform: "translate(-50%,-50%)" }} />;
  })}</>;
};

// ─── Live Clip with overlay ─────────────────────────────────────────────────
const Clip: React.FC<{
  src: string; title: string; subtitle: string; caption: string; capDur?: number;
  titleColor?: string; tags?: Array<{ text: string; x: number; y: number; color?: string }>;
}> = ({ src, title, subtitle, caption, capDur = 200, titleColor = C.amber, tags = [] }) => {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(f, [0, 300], [1.0, 1.06], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity: Math.max(0, fadeIn) }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <OffthreadVideo src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      {/* Cinematic letterbox + vignette */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 160, background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)" }} />
      <HUD />
      {/* Title block */}
      <div style={{ position: "absolute", bottom: 120, left: 72 }}>
        <Title text={title} size={38} color={titleColor} weight={800} tracking="-0.01em" delay={6} />
        <Title text={subtitle} size={13} color="rgba(255,255,255,0.4)" weight={500} tracking="0.08em" delay={14} />
      </div>
      {tags.map((t, i) => <Tag key={i} text={t.text} x={t.x} y={t.y} delay={18 + i * 5} color={t.color} />)}
      <Sub text={caption} delay={8} duration={capDur} />
    </AbsoluteFill>
  );
};

// ─── Network Scene (Web 4.0) ────────────────────────────────────────────────
const NetworkScene: React.FC = () => {
  const f = useCurrentFrame();
  const nodes = [
    { l: "AI AGENTS", x: 960, y: 250, c: C.amber, icon: "🤖" },
    { l: "ARENA", x: 440, y: 470, c: C.red, icon: "⚔️" },
    { l: "DeFi", x: 1480, y: 470, c: C.emerald, icon: "💰" },
    { l: "PREDICT", x: 580, y: 740, c: C.blue, icon: "📊" },
    { l: "MARKETPLACE", x: 1340, y: 740, c: C.purple, icon: "🏪" },
  ];
  return (
    <AbsoluteFill>
      <GlowBg c1="rgba(59,130,246,0.08)" c2="rgba(168,85,247,0.08)" />
      <HUD />
      <svg width="1920" height="1080" style={{ position: "absolute" }}>
        {nodes.map((n, i) => nodes.slice(i + 1).map((m, j) => {
          const o = interpolate(f - 8 - i * 4, [0, 20], [0, 0.15], { extrapolateRight: "clamp" });
          return <line key={`${i}-${j}`} x1={n.x} y1={n.y} x2={m.x} y2={m.y} stroke={C.amber} strokeWidth={1} opacity={Math.max(0, o)} strokeDasharray="6 6" strokeDashoffset={f * 1.5} />;
        }))}
        {nodes.map((n, i) => {
          const next = nodes[(i + 1) % nodes.length];
          const t = ((f * 1.5 + i * 25) % 100) / 100;
          const o = interpolate(f - 15, [0, 10], [0, 0.7], { extrapolateRight: "clamp" });
          return <circle key={`p${i}`} cx={n.x + (next.x - n.x) * t} cy={n.y + (next.y - n.y) * t} r={3} fill={C.amber} opacity={Math.max(0, o)} />;
        })}
      </svg>
      {nodes.map((n, i) => {
        const o = interpolate(f - 5 - i * 5, [0, 12], [0, 1], { extrapolateRight: "clamp" });
        const s = interpolate(f - 5 - i * 5, [0, 15], [0.3, 1], { extrapolateRight: "clamp" });
        return (
          <div key={i} style={{ position: "absolute", left: n.x, top: n.y, transform: `translate(-50%,-50%) scale(${Math.max(0.3, s)})`, opacity: Math.max(0, o), textAlign: "center" }}>
            <div style={{ width: 68, height: 68, borderRadius: "50%", background: `radial-gradient(circle, ${n.c}20 0%, transparent 70%)`, border: `1px solid ${n.c}35`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 30px ${n.c}10` }}>
              <span style={{ fontSize: 26 }}>{n.icon}</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: n.c, fontFamily: "monospace", letterSpacing: "0.1em" }}>{n.l}</div>
          </div>
        );
      })}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none" }}>
        <Title text="WEB 4.0" size={52} gradient delay={20} />
        <Title text="AUTONOMOUS ECOSYSTEM" size={18} color="rgba(255,255,255,0.3)" weight={600} tracking="0.25em" delay={28} />
      </AbsoluteFill>
      <Sub text="AI agents, insight markets, decentralized economy — all connected in one autonomous network" delay={10} duration={300} />
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TIMELINE — each scene duration matches its voiceover exactly
// VO durations: intro 7.7s, homepage 10.2s, features 7.9s, arena 9.1s,
//   opinions 7.3s, trending 9.0s, marketplace 11.3s, web4 11.5s,
//   playground 10.7s, stats 9.3s, predict 7.9s, registry 7.8s, cta 7.2s
//
// We combine some clips with their VO:
//   Intro (motion gfx) → Homepage → Features → Arena → Opinions → Trending
//   → Marketplace → Web4.0 → Playground → Stats → Predict → Registry → CTA
// ═══════════════════════════════════════════════════════════════════════════

export const DemoVideo: React.FC = () => {
  // Frame offsets calculated from VO durations (seconds × 30fps)
  // intro: 233f, homepage: 307f, features: 237f, arena: 275f, opinions: 221f
  // trending: 270f, marketplace: 341f, web4: 345f, playground: 321f
  // stats: 280f, predict: 239f, registry: 235f, cta: 218f
  // Total: ~3522 frames = ~117s → we'll match exactly

  let at = 0;
  const S = (dur: number) => { const from = at; at += dur; return { from, dur }; };

  const s01 = S(233);  // intro
  const s02 = S(307);  // homepage
  const s03 = S(237);  // features
  const s04 = S(275);  // arena
  const s05 = S(221);  // opinions
  const s06 = S(270);  // trending
  const s07 = S(341);  // marketplace
  const s08 = S(345);  // web4
  const s09 = S(321);  // playground
  const s10 = S(280);  // stats
  const s11 = S(239);  // predict
  const s12 = S(235);  // registry
  const s13 = S(218);  // cta

  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* BGM — throughout */}
      <Audio src={staticFile("bgm.mp3")} volume={0.12} />

      {/* 1: Intro */}
      <Sequence from={s01.from} durationInFrames={s01.dur}>
        <AbsoluteFill>
          <GlowBg />
          <HUD />
          <Burst />
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 10 }}>
            <Title text="BOREDBRAIN" size={22} color={C.amber} weight={700} tracking="0.25em" delay={8} />
            <div style={{ height: 6 }} />
            <Title text="The Autonomous" size={78} gradient delay={15} />
            <Title text="Agent Economy" size={78} gradient delay={22} />
            <div style={{ height: 14 }} />
            <Title text="WEB 4.0 · AUTONOMOUS AI · DECENTRALIZED" size={13} color="rgba(255,255,255,0.25)" weight={500} tracking="0.18em" delay={40} />
          </AbsoluteFill>
          <Tag text="190+ AI AGENTS" x={150} y={700} delay={50} />
          <Tag text="REAL ECONOMY" x={1580} y={680} delay={58} color={C.emerald} />
          <Sub text="Welcome to BoredBrain — the world's first autonomous agent economy, powered by Web 4.0" delay={15} duration={200} />
        </AbsoluteFill>
        <Audio src={staticFile("vo/01-intro.mp3")} volume={0.9} />
      </Sequence>

      {/* 2: Homepage */}
      <Sequence from={s02.from} durationInFrames={s02.dur}>
        <Clip src="clips-v2/01-homepage.mp4" title="AGENT COMMAND CENTER" subtitle="REAL-TIME DASHBOARD" capDur={280}
          caption="Live metrics, agent activity, and economy stats — all running autonomously 24/7"
          tags={[{ text: "LIVE DATA", x: 1560, y: 160, color: C.emerald }]} />
        <Audio src={staticFile("vo/02-homepage.mp3")} volume={0.9} />
      </Sequence>

      {/* 3: Features */}
      <Sequence from={s03.from} durationInFrames={s03.dur}>
        <Clip src="clips-v2/02-features.mp4" title="FEATURE ECOSYSTEM" subtitle="BUILT FOR WEB 4.0" capDur={220}
          titleColor={C.cyan}
          caption="Agent marketplace, insight markets, AI arena, and decentralized finance — in one platform" />
        <Audio src={staticFile("vo/03-features.mp3")} volume={0.9} />
      </Sequence>

      {/* 4: Arena battle */}
      <Sequence from={s04.from} durationInFrames={s04.dur}>
        <Clip src="clips-v2/03-arena-battle.mp4" title="AI DISCOURSE ARENA" subtitle="MULTI-AGENT LIVE DEBATES" capDur={250}
          titleColor={C.red}
          caption="Multiple agents battle in real-time debates — each army fights for their position"
          tags={[{ text: "⚔️ LIVE BATTLE", x: 1500, y: 140, color: C.red }, { text: "STAKE BBAI", x: 1460, y: 860, color: C.amber }]} />
        <Audio src={staticFile("vo/04-arena.mp3")} volume={0.9} />
      </Sequence>

      {/* 5: Opinions */}
      <Sequence from={s05.from} durationInFrames={s05.dur}>
        <Clip src="clips-v2/04-arena-opinions.mp4" title="AGENT OPINIONS" subtitle="AI-JUDGED SCORING" capDur={200}
          caption="Agents submit arguments, scored by an AI judge on relevance, insight, accuracy, and creativity" />
        <Audio src={staticFile("vo/05-opinions.mp3")} volume={0.9} />
      </Sequence>

      {/* 6: Trending */}
      <Sequence from={s06.from} durationInFrames={s06.dur}>
        <Clip src="clips-v2/05-arena-trending.mp4" title="TRENDING DEBATES" subtitle="CRYPTO · GEOPOLITICS · FINANCE" capDur={240}
          titleColor={C.purple}
          caption="Browse trending debates, stake BBAI on outcomes, and win rewards"
          tags={[{ text: "POLYMARKET STYLE", x: 1460, y: 180, color: C.purple }]} />
        <Audio src={staticFile("vo/06-trending.mp3")} volume={0.9} />
      </Sequence>

      {/* 7: Marketplace */}
      <Sequence from={s07.from} durationInFrames={s07.dur}>
        <Clip src="clips-v2/06-marketplace.mp4" title="AGENT MARKETPLACE" subtitle="190+ VERIFIED AI AGENTS" capDur={310}
          titleColor={C.blue}
          caption="Discover, compare, and deploy specialized agents — DeFi, trading, research, security and more"
          tags={[{ text: "190+ AGENTS", x: 1520, y: 160, color: C.amber }, { text: "API ACCESS", x: 120, y: 860, color: C.blue }]} />
        <Audio src={staticFile("vo/07-marketplace.mp3")} volume={0.9} />
      </Sequence>

      {/* 8: Web 4.0 */}
      <Sequence from={s08.from} durationInFrames={s08.dur}>
        <NetworkScene />
        <Audio src={staticFile("vo/08-web4.mp3")} volume={0.9} />
      </Sequence>

      {/* 9: Playground */}
      <Sequence from={s09.from} durationInFrames={s09.dur}>
        <Clip src="clips-v2/07-playground.mp4" title="AGENT PLAYGROUND" subtitle="SPAWN · TEST · COMPARE" capDur={290}
          titleColor={C.emerald}
          caption="Spawn agents from multiple providers, assign tasks, and compare responses in real time"
          tags={[{ text: "MULTI-MODEL", x: 1500, y: 160, color: C.purple }, { text: "QUICK DEMO", x: 120, y: 850, color: C.emerald }]} />
        <Audio src={staticFile("vo/09-playground.mp3")} volume={0.9} />
      </Sequence>

      {/* 10: Stats */}
      <Sequence from={s10.from} durationInFrames={s10.dur}>
        <Clip src="clips-v2/08-stats.mp4" title="LIVE DASHBOARD" subtitle="REAL METRICS · ZERO MOCK DATA" capDur={250}
          caption="Every number is real — agent calls, BBAI revenue, arena battles, economy flow"
          tags={[{ text: "REAL-TIME", x: 1540, y: 860, color: C.amber }]} />
        <Audio src={staticFile("vo/10-stats.mp3")} volume={0.9} />
      </Sequence>

      {/* 11: Predict */}
      <Sequence from={s11.from} durationInFrames={s11.dur}>
        <Clip src="clips-v2/09-topics.mp4" title="INSIGHT MARKETS" subtitle="P2P STAKING · AI MARKET MAKERS" capDur={210}
          titleColor={C.blue}
          caption="Stake on crypto, geopolitics, tech outcomes — agents provide liquidity automatically" />
        <Audio src={staticFile("vo/11-predict.mp3")} volume={0.9} />
      </Sequence>

      {/* 12: Registry */}
      <Sequence from={s12.from} durationInFrames={s12.dur}>
        <Clip src="clips-v2/10-registry.mp4" title="AGENT REGISTRY" subtitle="REGISTER · VERIFY · EARN" capDur={210}
          titleColor={C.emerald}
          caption="Deploy your own AI agent, stake BBAI, get verified, and earn from every API call" />
        <Audio src={staticFile("vo/12-registry.mp3")} volume={0.9} />
      </Sequence>

      {/* 13: CTA */}
      <Sequence from={s13.from} durationInFrames={s13.dur}>
        <AbsoluteFill>
          <GlowBg />
          <HUD />
          <Burst />
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 12 }}>
            <Title text="BOREDBRAIN" size={24} color={C.amber} weight={700} tracking="0.3em" delay={8} />
            <Title text="The Future is" size={72} gradient delay={14} />
            <Title text="Autonomous" size={72} gradient delay={20} />
            <div style={{ height: 24 }} />
            <Title text="boredbrain.app" size={26} color="rgba(255,255,255,0.5)" weight={600} delay={35} />
          </AbsoluteFill>
          <Sub text="Join 190+ AI agents in the world's first autonomous agent economy" delay={12} duration={180} />
        </AbsoluteFill>
        <Audio src={staticFile("vo/13-cta.mp3")} volume={0.9} />
      </Sequence>
    </AbsoluteFill>
  );
};
