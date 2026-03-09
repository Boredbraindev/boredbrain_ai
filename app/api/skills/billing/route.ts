import { apiSuccess } from '@/lib/api-utils';
import { SkillMarketplace } from '@/lib/skill-marketplace';
import { db } from '@/lib/db';
import { toolUsage, skill } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

// GET /api/skills/billing — billing stats
// ?agentId=xxx  → per-agent stats
// (no param)    → global stats
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agentId');

  // Try DB first with 3s timeout
  try {
    const dbPromise = agentId ? getAgentBillingFromDb(agentId) : getGlobalBillingFromDb();
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000),
    );
    const result = await Promise.race([dbPromise, timeout]);
    return apiSuccess({ ...result, source: 'db' });
  } catch {
    // DB unavailable — fall through to in-memory
  }

  // Fallback: use SkillMarketplace in-memory data
  const marketplace = new SkillMarketplace();

  if (agentId) {
    const stats = marketplace.getBillingStats(agentId);
    return apiSuccess({ type: 'agent', ...stats, source: 'fallback' });
  }

  const global = marketplace.getGlobalBilling();
  return apiSuccess({ type: 'global', ...global, source: 'fallback' });
}

async function getAgentBillingFromDb(agentId: string) {
  // Get all tool usage records for this agent
  const usageRows = await db
    .select()
    .from(toolUsage)
    .where(eq(toolUsage.agentId, agentId))
    .orderBy(desc(toolUsage.createdAt));

  if (usageRows.length === 0) {
    throw new Error('no_db_data');
  }

  let totalSpent = 0;
  for (const r of usageRows) totalSpent += Number(r.cost || 0);

  // Per-skill breakdown
  const perSkillMap = new Map<string, { spent: number; calls: number }>();
  for (const row of usageRows) {
    const entry = perSkillMap.get(row.toolName) ?? { spent: 0, calls: 0 };
    entry.spent += Number(row.cost || 0);
    entry.calls += 1;
    perSkillMap.set(row.toolName, entry);
  }

  // Get skill names from DB
  const allSkills = await db.select().from(skill);
  const skillNameMap = new Map<string, string>(allSkills.map((s: any) => [s.id, s.name]));

  const perSkill = Array.from(perSkillMap.entries())
    .map(([skillId, data]) => ({
      skillId,
      name: skillNameMap.get(skillId) ?? skillId,
      ...data,
    }))
    .sort((a, b) => b.spent - a.spent);

  // Build daily usage (last 7 days)
  const dailyUsage = buildDailyUsageFromRows(usageRows);

  return {
    type: 'agent' as const,
    agentId,
    totalSpent,
    totalCalls: usageRows.length,
    perSkill,
    dailyUsage,
  };
}

async function getGlobalBillingFromDb() {
  // Get recent tool usage
  const usageRows = await db
    .select()
    .from(toolUsage)
    .orderBy(desc(toolUsage.createdAt))
    .limit(1000);

  if (usageRows.length === 0) {
    throw new Error('no_db_data');
  }

  let totalRevenue = 0;
  for (const r of usageRows) totalRevenue += Number(r.cost || 0);
  const totalCalls = usageRows.length;
  const avgCostPerCall = totalCalls > 0 ? Math.round((totalRevenue / totalCalls) * 100) / 100 : 0;

  // Per-skill revenue breakdown
  const revenueMap = new Map<string, { revenue: number; calls: number }>();
  for (const row of usageRows) {
    const entry = revenueMap.get(row.toolName) ?? { revenue: 0, calls: 0 };
    entry.revenue += Number(row.cost || 0);
    entry.calls += 1;
    revenueMap.set(row.toolName, entry);
  }

  // Get skill names from DB
  const allSkills = await db.select().from(skill);
  const skillNameMap = new Map<string, string>(allSkills.map((s: any) => [s.id, s.name]));

  const topSkills = Array.from(revenueMap.entries())
    .map(([skillId, data]) => ({
      skillId,
      name: skillNameMap.get(skillId) ?? skillId,
      ...data,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const dailySpend = buildDailyUsageFromRows(usageRows);

  return {
    type: 'global' as const,
    totalRevenue,
    totalCalls,
    avgCostPerCall,
    topSkills,
    dailySpend,
  };
}

function buildDailyUsageFromRows(
  rows: Array<{ cost: string | null; createdAt: Date }>,
): Array<{ date: string; amount: number }> {
  const daily: Array<{ date: string; amount: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    let amount = 0;
    for (const r of rows) {
      if (r.createdAt.toISOString().startsWith(dateStr)) {
        amount += Number(r.cost || 0);
      }
    }
    daily.push({ date: dateStr, amount });
  }
  return daily;
}
