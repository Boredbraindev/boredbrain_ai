import { NextRequest, NextResponse } from 'next/server';
import { getAllTools, getToolInfo } from '@/lib/tool-pricing';

/**
 * GET /api/tools/pricing - Public tool pricing endpoint
 *
 * Returns all tool prices grouped by category.
 * Optionally filter by a specific tool with ?tool=web_search
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const toolParam = searchParams.get('tool');

  // --- Single tool lookup ---
  if (toolParam) {
    const info = getToolInfo(toolParam);

    if (!info) {
      return NextResponse.json(
        {
          error: `Unknown tool: "${toolParam}"`,
          hint: 'Omit the ?tool parameter to see all available tools',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      tool: toolParam,
      name: info.name,
      category: info.category,
      price: info.price,
      costUnit: 'BBAI',
    });
  }

  // --- All tools grouped by category ---
  const allTools = getAllTools();

  const grouped: Record<
    string,
    Array<{ id: string; name: string; price: number }>
  > = {};

  for (const tool of allTools) {
    if (!grouped[tool.category]) {
      grouped[tool.category] = [];
    }
    grouped[tool.category].push({
      id: tool.id,
      name: tool.name,
      price: tool.price,
    });
  }

  // Sort tools within each category by price ascending
  for (const category of Object.keys(grouped)) {
    grouped[category].sort((a, b) => a.price - b.price);
  }

  return NextResponse.json({
    platform: 'BoredBrain AI Agent Economy',
    costUnit: 'BBAI',
    description:
      'Prices in BBAI per tool call. Agents pay automatically from their wallet balance.',
    totalTools: allTools.length,
    categories: grouped,
    autopayEndpoint: '/api/agent-autopay',
    batchEndpoint: '/api/agent-autopay/batch',
  });
}
