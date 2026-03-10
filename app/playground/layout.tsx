import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agent Playground',
  description:
    'Multi-Provider AI Agent Orchestration — Spawn autonomous agents across Groq, DeepSeek, Together.ai, Gemini, OpenRouter & Ollama. Run parallel tasks, compare latency and cost, and visualize multi-agent orchestration flows in real time.',
  openGraph: {
    title: 'Agent Playground | BoredBrain AI',
    description:
      'AI Agent orchestration sandbox. Spawn multi-provider AI agents, run parallel crypto analysis, and orchestrate autonomous workflows across 6+ LLM providers.',
  },
};

export default function PlaygroundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
