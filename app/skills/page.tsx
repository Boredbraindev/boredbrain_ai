'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Skill {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  version: string;
  author: string;
  totalCalls: number;
  totalRevenue: number;
  rating: number;
}

interface Installation {
  id: string;
  skillId: string;
  agentId: string;
  installedAt: string;
  usageCount: number;
  totalBilled: number;
  status: 'active' | 'suspended' | 'expired';
}

interface BillingGlobal {
  type: 'global';
  totalRevenue: number;
  totalCalls: number;
  avgCostPerCall: number;
  topSkills: Array<{ skillId: string; name: string; revenue: number; calls: number }>;
  dailySpend: Array<{ date: string; amount: number }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_AGENT = 'agent-alpha-001';
const CATEGORIES = ['All', 'Data', 'Analysis', 'Blockchain', 'AI'] as const;

// ---------------------------------------------------------------------------
// Copy helper
// ---------------------------------------------------------------------------

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);
  return { copied, copy };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SkillMarketplacePage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [billing, setBilling] = useState<BillingGlobal | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'skills' | 'installations' | 'billing'>('skills');
  const [installing, setInstalling] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  // -- Fetch data -----------------------------------------------------------

  useEffect(() => {
    fetch('/api/skills')
      .then((r) => r.json())
      .then((d) => { if (d.success) setSkills(d.skills); })
      .catch(() => {});

    fetch(`/api/skills/billing`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setBilling(d); })
      .catch(() => {});

    fetch(`/api/skills?agentId=${MOCK_AGENT}`)
      .then(() => {
        // Load installations from the marketplace
        const stored = typeof window !== 'undefined'
          ? JSON.parse(localStorage.getItem('bbai-installed-skills') ?? '[]') as string[]
          : [];
        setInstallations(stored.map((skillId) => ({
          id: `local-${skillId}`,
          skillId,
          agentId: MOCK_AGENT,
          installedAt: new Date().toISOString(),
          usageCount: Math.floor(Math.random() * 80) + 5,
          totalBilled: 0,
          status: 'active' as const,
        })));
      })
      .catch(() => {});
  }, []);

  // -- Handlers -------------------------------------------------------------

  const handleInstall = useCallback(async (skillId: string) => {
    setInstalling(skillId);
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: MOCK_AGENT, skillId }),
      });
      const d = await res.json();
      if (d.success) {
        const stored: string[] = JSON.parse(localStorage.getItem('bbai-installed-skills') ?? '[]');
        const updated = [...new Set([...stored, skillId])];
        localStorage.setItem('bbai-installed-skills', JSON.stringify(updated));
        setInstallations((prev) => [
          ...prev,
          {
            id: d.installation?.id ?? `local-${skillId}`,
            skillId,
            agentId: MOCK_AGENT,
            installedAt: new Date().toISOString(),
            usageCount: 0,
            totalBilled: 0,
            status: 'active' as const,
          },
        ]);
      }
    } catch {
      // silent
    } finally {
      setInstalling(null);
    }
  }, []);

  // -- Derived data ---------------------------------------------------------

  const installedIds = new Set(installations.map((i) => i.skillId));
  const filteredSkills =
    categoryFilter === 'All'
      ? skills
      : skills.filter((s) => s.category.toLowerCase() === categoryFilter.toLowerCase());
  const maxDailySpend = billing ? Math.max(...billing.dailySpend.map((d) => d.amount), 1) : 1;
  const maxSkillRevenue = billing?.topSkills?.[0]?.revenue ?? 1;

  // -- Render ---------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-10">

        {/* ================================================================= */}
        {/* HERO                                                              */}
        {/* ================================================================= */}
        <section className="text-center space-y-5">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 text-xs text-amber-400 font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Phase 3
          </div>
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 scale-[2.5] bg-purple-500/25 blur-[60px] rounded-full" />
              <Image src="/footer.png" alt="BoredBrain AI" width={120} height={120} className="relative rounded-2xl drop-shadow-[0_0_40px_rgba(168,85,247,0.4)]" />
              <span className="absolute -bottom-2 -right-2 text-3xl select-none drop-shadow-lg">⚡</span>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Skill{' '}
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Marketplace
            </span>
          </h1>
          <p className="text-white/40 max-w-2xl mx-auto text-lg leading-relaxed">
            Install AI tools for your agents. Every skill call is billed in BBAI tokens.
          </p>
        </section>

        {/* ================================================================= */}
        {/* INSTALL COMMAND BANNER (copyable)                                 */}
        {/* ================================================================= */}
        <section>
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <button
                onClick={() => copy('npx clawhub install boredbrain')}
                className="text-[10px] text-white/30 hover:text-amber-400 transition-colors font-mono"
              >
                {copied ? 'Copied!' : 'Click to copy'}
              </button>
            </div>
            <button
              className="w-full text-left px-6 py-5 hover:bg-white/[0.02] transition-colors"
              onClick={() => copy('npx clawhub install boredbrain')}
            >
              <code className="text-amber-400 font-mono text-sm md:text-base">
                <span className="text-white/30">$ </span>npx clawhub install boredbrain
              </code>
            </button>
          </div>
        </section>

        {/* ================================================================= */}
        {/* TABS                                                              */}
        {/* ================================================================= */}
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 w-fit">
          {(['skills', 'installations', 'billing'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {tab === 'skills' ? 'All Skills' : tab === 'installations' ? 'My Installations' : 'Billing'}
            </button>
          ))}
        </div>

        {/* ================================================================= */}
        {/* SKILL GRID TAB                                                    */}
        {/* ================================================================= */}
        {activeTab === 'skills' && (
          <div className="space-y-6">
            {/* Category Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    categoryFilter === cat
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                      : 'bg-white/[0.03] text-white/40 border border-white/[0.06] hover:bg-white/[0.06] hover:text-white/60'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Skill Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredSkills.map((skill) => {
                const isInstalled = installedIds.has(skill.id);

                return (
                  <div
                    key={skill.id}
                    className="flex flex-col h-full bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 space-y-4 transition-all duration-300 hover:bg-white/[0.05] hover:border-amber-500/20 hover:shadow-lg hover:shadow-amber-500/5 group"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-white/90 group-hover:text-amber-400 transition-colors">
                          {skill.name}
                        </h3>
                        <p className="text-[11px] text-white/30 font-mono mt-0.5">v{skill.version}</p>
                      </div>
                      <span className="bg-amber-500/15 text-amber-400 border border-amber-500/25 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                        {skill.price} BBAI
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-white/40 text-xs leading-relaxed line-clamp-2">
                      {skill.description}
                    </p>

                    {/* Category Badge */}
                    <div>
                      <span className="bg-white/[0.05] text-white/40 border border-white/[0.08] text-[10px] px-2 py-0.5 rounded-full capitalize">
                        {skill.category}
                      </span>
                    </div>

                    {/* Rating Stars */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg
                          key={i}
                          className={`w-3 h-3 ${i < Math.floor(skill.rating) ? 'text-amber-500' : 'text-white/10'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                      <span className="text-[11px] text-white/30 ml-1">{skill.rating}</span>
                    </div>

                    {/* Total Calls */}
                    <p className="text-[11px] text-white/30">
                      {skill.totalCalls.toLocaleString()} total calls
                    </p>

                    {/* Install Button */}
                    <button
                      className={`mt-auto w-full py-2 rounded-xl text-xs font-medium transition-all ${
                        isInstalled
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 cursor-default'
                          : 'bg-amber-500 hover:bg-amber-600 text-black'
                      }`}
                      disabled={isInstalled || installing === skill.id}
                      onClick={() => !isInstalled && handleInstall(skill.id)}
                    >
                      {installing === skill.id ? 'Installing...' : isInstalled ? 'Installed' : 'Install'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* MY INSTALLATIONS TAB                                              */}
        {/* ================================================================= */}
        {activeTab === 'installations' && (
          <div className="space-y-4">
            {installations.length === 0 ? (
              <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl py-16 text-center">
                <p className="text-white/30 text-sm">No skills installed yet. Browse the marketplace to get started.</p>
              </div>
            ) : (
              installations.map((inst) => {
                const skill = skills.find((s) => s.id === inst.skillId);
                return (
                  <div
                    key={inst.id}
                    className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white/90">{skill?.name ?? inst.skillId}</h3>
                          <p className="text-[11px] text-white/30 font-mono">Agent: {inst.agentId}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-xs text-white/40">
                        <div className="text-center">
                          <p className="text-white/70 font-semibold">{inst.usageCount}</p>
                          <p className="text-[10px]">Uses</p>
                        </div>
                        <div className="text-center">
                          <p className="text-amber-400 font-semibold">{inst.totalBilled} BBAI</p>
                          <p className="text-[10px]">Billed</p>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            inst.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                              : inst.status === 'suspended'
                                ? 'bg-red-500/15 text-red-400 border-red-500/25'
                                : 'bg-white/[0.05] text-white/30 border-white/[0.08]'
                          }`}
                        >
                          {inst.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* BILLING TAB                                                       */}
        {/* ================================================================= */}
        {activeTab === 'billing' && billing && (
          <div className="space-y-6">

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total BBAI Spent', value: billing.totalRevenue, color: 'text-amber-400' },
                { label: 'Total Calls', value: billing.totalCalls, color: 'text-white' },
                { label: 'Avg BBAI / Call', value: billing.avgCostPerCall, color: 'text-white' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl text-center py-6">
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value.toLocaleString()}</p>
                  <p className="text-[10px] text-white/30 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Daily Usage Graph (Pure CSS Bar Chart) */}
            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white/80">BBAI Spending (Last 7 Days)</h3>
                <p className="text-xs text-white/30 mt-0.5">Daily token spend across all skills</p>
              </div>
              <div className="flex items-end gap-3 h-40">
                {billing.dailySpend.map((day) => {
                  const pct = maxDailySpend > 0 ? (day.amount / maxDailySpend) * 100 : 0;
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-[10px] text-amber-400 font-mono">{day.amount}</span>
                      <div
                        className="w-full rounded-t-lg overflow-hidden"
                        style={{ height: `${Math.max(pct, 4)}%` }}
                      >
                        <div className="w-full h-full bg-gradient-to-t from-amber-500/40 to-amber-500/80 rounded-t-lg" />
                      </div>
                      <span className="text-[9px] text-white/20 font-mono">{day.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Spend Per Skill (CSS Bar Charts) */}
            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white/80">Spend Per Skill</h3>
              <div className="space-y-3">
                {billing.topSkills.map((skill, i) => {
                  const width = (skill.revenue / maxSkillRevenue) * 100;
                  return (
                    <div key={skill.skillId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-white/20 font-mono w-5">#{i + 1}</span>
                          <span className="text-white/70">{skill.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-white/40">
                          <span>{skill.calls} calls</span>
                          <span className="text-amber-400 font-semibold">{skill.revenue} BBAI</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500/60 to-amber-500 rounded-full transition-all duration-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
