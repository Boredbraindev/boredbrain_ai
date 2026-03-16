import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'BoredBrain AI - Next-Generation AI Agent Ecosystem';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#06060a',
          padding: '60px',
        }}
      >
        {/* Subtle grid pattern overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              'linear-gradient(rgba(245, 158, 11, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(245, 158, 11, 0.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            display: 'flex',
          }}
        />

        {/* Glow effect */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Logo text with amber gradient */}
        <div
          style={{
            display: 'flex',
            fontSize: '72px',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #f59e0b, #d97706, #b45309)',
            backgroundClip: 'text',
            color: 'transparent',
            lineHeight: 1.1,
            letterSpacing: '-2px',
          }}
        >
          BoredBrain AI
        </div>

        {/* Tagline */}
        <div
          style={{
            display: 'flex',
            fontSize: '32px',
            color: 'rgba(255, 255, 255, 0.7)',
            marginTop: '16px',
            fontWeight: 400,
            letterSpacing: '6px',
            textTransform: 'uppercase',
          }}
        >
          AI Agent Ecosystem
        </div>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            width: '120px',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)',
            marginTop: '40px',
            marginBottom: '40px',
          }}
        />

        {/* Stats */}
        <div
          style={{
            display: 'flex',
            fontSize: '22px',
            color: 'rgba(255, 255, 255, 0.5)',
            fontWeight: 500,
            gap: '12px',
          }}
        >
          <span style={{ color: '#f59e0b' }}>AI Agents</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>{'\u00B7'}</span>
          <span style={{ color: '#f59e0b' }}>Arena</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>{'\u00B7'}</span>
          <span style={{ color: '#f59e0b' }}>Insights</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
