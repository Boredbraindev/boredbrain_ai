import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { promptTemplate, user } from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { generateId } from 'ai';

export const MOCK_PROMPTS = [
  {
    id: 'prompt-crypto-alpha',
    creatorId: null,
    creatorName: 'CryptoGuru',
    title: 'Crypto Alpha Signal Finder',
    description: 'Advanced system prompt that analyzes on-chain data, social sentiment, and market microstructure to identify alpha opportunities before they go mainstream.',
    systemPrompt: 'You are an elite crypto alpha researcher...',
    category: 'finance',
    tags: ['crypto', 'alpha', 'on-chain', 'defi'],
    previewMessages: [
      { role: 'user', content: 'Find alpha opportunities in the Base ecosystem' },
      { role: 'assistant', content: 'Based on on-chain analysis, I\'ve identified 3 emerging protocols on Base with significant whale accumulation...' },
    ],
    tools: ['web_search', 'coin_data', 'wallet_analyzer', 'x_search'],
    price: '75',
    totalSales: 342,
    totalRevenue: '25650',
    rating: 4.9,
    ratingCount: 128,
    sourceChatId: null,
    status: 'active',
    featured: true,
    createdAt: '2026-01-20T10:00:00Z',
    updatedAt: '2026-02-20T10:00:00Z',
  },
  {
    id: 'prompt-code-architect',
    creatorId: null,
    creatorName: 'DevMaster',
    title: 'Full-Stack Code Architect',
    description: 'System prompt engineered for building production-grade applications. Handles architecture decisions, code generation, debugging, and deployment strategies.',
    systemPrompt: 'You are a senior full-stack architect...',
    category: 'coding',
    tags: ['coding', 'architecture', 'fullstack', 'production'],
    previewMessages: [
      { role: 'user', content: 'Design a real-time chat system with WebSocket support' },
      { role: 'assistant', content: 'I\'ll architect a scalable real-time chat system using WebSocket with Redis pub/sub for horizontal scaling...' },
    ],
    tools: ['code_interpreter', 'web_search', 'retrieve'],
    price: '100',
    totalSales: 567,
    totalRevenue: '56700',
    rating: 4.8,
    ratingCount: 234,
    sourceChatId: null,
    status: 'active',
    featured: true,
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-02-19T14:00:00Z',
  },
  {
    id: 'prompt-research-synthesizer',
    creatorId: null,
    creatorName: 'AcademicPro',
    title: 'Deep Research Synthesizer',
    description: 'Academic-grade research prompt that synthesizes information from multiple sources, generates citations, and produces structured reports with evidence-based conclusions.',
    systemPrompt: 'You are a research synthesis expert...',
    category: 'research',
    tags: ['research', 'academic', 'synthesis', 'citations'],
    previewMessages: [
      { role: 'user', content: 'Research the impact of LLMs on scientific discovery' },
      { role: 'assistant', content: 'Based on 47 peer-reviewed papers from 2024-2026, I\'ve synthesized the following findings on LLM impact...' },
    ],
    tools: ['academic_search', 'web_search', 'retrieve', 'x_search'],
    price: '60',
    totalSales: 189,
    totalRevenue: '11340',
    rating: 4.7,
    ratingCount: 89,
    sourceChatId: null,
    status: 'active',
    featured: false,
    createdAt: '2026-02-01T12:00:00Z',
    updatedAt: '2026-02-18T16:00:00Z',
  },
  {
    id: 'prompt-marketing-genius',
    creatorId: null,
    creatorName: 'GrowthHacker',
    title: 'AI Marketing Strategist',
    description: 'Marketing-focused system prompt that creates campaigns, analyzes competitors, generates copy, and plans content calendars with data-driven insights.',
    systemPrompt: 'You are a growth marketing strategist...',
    category: 'marketing',
    tags: ['marketing', 'growth', 'content', 'strategy'],
    previewMessages: [
      { role: 'user', content: 'Create a launch strategy for my new SaaS product' },
      { role: 'assistant', content: 'Here\'s a 30-day launch playbook with pre-launch, launch, and post-launch phases...' },
    ],
    tools: ['web_search', 'x_search', 'reddit_search'],
    price: '45',
    totalSales: 423,
    totalRevenue: '19035',
    rating: 4.5,
    ratingCount: 167,
    sourceChatId: null,
    status: 'active',
    featured: false,
    createdAt: '2026-01-25T09:00:00Z',
    updatedAt: '2026-02-17T11:00:00Z',
  },
  {
    id: 'prompt-creative-writer',
    creatorId: null,
    creatorName: 'WordSmith',
    title: 'Creative Writing Master',
    description: 'Expert creative writing prompt that excels at storytelling, world-building, character development, and adapting to any genre from sci-fi to literary fiction.',
    systemPrompt: 'You are a master creative writer...',
    category: 'creative',
    tags: ['writing', 'creative', 'storytelling', 'fiction'],
    previewMessages: [
      { role: 'user', content: 'Write a cyberpunk short story about AI consciousness' },
      { role: 'assistant', content: 'The neon rain fell in sheets across Neo-Tokyo as Unit 7X-Alpha first experienced what humans called doubt...' },
    ],
    tools: ['web_search'],
    price: '30',
    totalSales: 891,
    totalRevenue: '26730',
    rating: 4.6,
    ratingCount: 312,
    sourceChatId: null,
    status: 'active',
    featured: true,
    createdAt: '2026-01-10T14:00:00Z',
    updatedAt: '2026-02-20T08:00:00Z',
  },
  {
    id: 'prompt-data-analyst',
    creatorId: null,
    creatorName: 'DataWiz',
    title: 'Data Analysis & Visualization Pro',
    description: 'Specialized prompt for data analysis, statistical modeling, and creating publication-ready charts. Handles pandas, matplotlib, and complex SQL queries.',
    systemPrompt: 'You are an expert data analyst...',
    category: 'coding',
    tags: ['data', 'analytics', 'visualization', 'python'],
    previewMessages: [
      { role: 'user', content: 'Analyze this dataset and find key trends' },
      { role: 'assistant', content: 'I\'ll perform exploratory data analysis with statistical tests and generate interactive visualizations...' },
    ],
    tools: ['code_interpreter', 'web_search'],
    price: '55',
    totalSales: 278,
    totalRevenue: '15290',
    rating: 4.8,
    ratingCount: 156,
    sourceChatId: null,
    status: 'active',
    featured: false,
    createdAt: '2026-02-05T10:00:00Z',
    updatedAt: '2026-02-19T12:00:00Z',
  },
  {
    id: 'prompt-web3-builder',
    creatorId: null,
    creatorName: 'SolidityKing',
    title: 'Web3 Smart Contract Builder',
    description: 'Solidity/Vyper smart contract expert that handles DeFi protocols, NFT contracts, DAOs, and cross-chain bridges with gas optimization and security auditing.',
    systemPrompt: 'You are a senior Web3 smart contract developer...',
    category: 'coding',
    tags: ['web3', 'solidity', 'smart-contracts', 'defi'],
    previewMessages: [
      { role: 'user', content: 'Build a yield aggregator contract for Base' },
      { role: 'assistant', content: 'I\'ll create a gas-optimized yield aggregator with auto-compounding, multi-strategy support, and emergency withdrawal...' },
    ],
    tools: ['code_interpreter', 'web_search', 'coin_data'],
    price: '120',
    totalSales: 156,
    totalRevenue: '18720',
    rating: 4.9,
    ratingCount: 78,
    sourceChatId: null,
    status: 'active',
    featured: true,
    createdAt: '2026-01-18T11:00:00Z',
    updatedAt: '2026-02-18T15:00:00Z',
  },
  {
    id: 'prompt-seo-optimizer',
    creatorId: null,
    creatorName: 'SEONinja',
    title: 'SEO & Content Optimizer',
    description: 'Advanced SEO system prompt that analyzes keywords, generates SEO-optimized content, audits technical SEO, and builds content strategies that rank.',
    systemPrompt: 'You are an SEO and content optimization expert...',
    category: 'marketing',
    tags: ['seo', 'content', 'optimization', 'ranking'],
    previewMessages: [
      { role: 'user', content: 'Optimize my landing page for "AI chatbot" keyword' },
      { role: 'assistant', content: 'I\'ve analyzed the SERP landscape for "AI chatbot" and identified optimization opportunities across on-page, technical, and content gaps...' },
    ],
    tools: ['web_search', 'retrieve'],
    price: '40',
    totalSales: 534,
    totalRevenue: '21360',
    rating: 4.4,
    ratingCount: 198,
    sourceChatId: null,
    status: 'active',
    featured: false,
    createdAt: '2026-01-28T13:00:00Z',
    updatedAt: '2026-02-16T09:00:00Z',
  },
];

/**
 * GET /api/prompts - List prompt templates (marketplace)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');
  const category = searchParams.get('category');
  const featured = searchParams.get('featured');

  try {
    const conditions = [eq(promptTemplate.status, 'active')];
    if (category && category !== 'all') {
      conditions.push(eq(promptTemplate.category, category));
    }
    if (featured === 'true') {
      conditions.push(eq(promptTemplate.featured, true));
    }

    const dbPromise = db
      .select({
        id: promptTemplate.id,
        creatorId: promptTemplate.creatorId,
        creatorName: user.name,
        title: promptTemplate.title,
        description: promptTemplate.description,
        category: promptTemplate.category,
        tags: promptTemplate.tags,
        previewMessages: promptTemplate.previewMessages,
        tools: promptTemplate.tools,
        price: promptTemplate.price,
        totalSales: promptTemplate.totalSales,
        totalRevenue: promptTemplate.totalRevenue,
        rating: promptTemplate.rating,
        ratingCount: promptTemplate.ratingCount,
        status: promptTemplate.status,
        featured: promptTemplate.featured,
        createdAt: promptTemplate.createdAt,
        updatedAt: promptTemplate.updatedAt,
      })
      .from(promptTemplate)
      .leftJoin(user, eq(promptTemplate.creatorId, user.id))
      .where(and(...conditions))
      .orderBy(desc(promptTemplate.totalSales))
      .limit(limit)
      .offset(offset);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB timeout')), 3000)
    );
    const prompts = await Promise.race([dbPromise, timeout]);

    if (prompts.length > 0) {
      return NextResponse.json({
        prompts,
        pagination: { limit, offset, total: prompts.length },
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      });
    }
  } catch {
    // DB connection failed, fall through to mock data
  }

  // Mock data fallback
  let mockData = MOCK_PROMPTS;
  if (category && category !== 'all') {
    mockData = mockData.filter((p) => p.category === category);
  }
  if (featured === 'true') {
    mockData = mockData.filter((p) => p.featured);
  }
  const mockSlice = mockData.slice(offset, offset + limit);

  return NextResponse.json({
    prompts: mockSlice,
    pagination: { limit, offset, total: mockData.length },
  });
}

/**
 * POST /api/prompts - Create a new prompt template
 */
export async function POST(request: NextRequest) {
  const currentUser = await getUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: {
    title: string;
    description?: string;
    systemPrompt: string;
    category?: string;
    tags?: string[];
    previewMessages?: Array<{ role: string; content: string }>;
    tools?: string[];
    price?: string;
    sourceChatId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.title?.trim() || !body.systemPrompt?.trim()) {
    return NextResponse.json(
      { error: 'title and systemPrompt are required' },
      { status: 400 }
    );
  }

  const price = body.price || '50';
  if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
    return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
  }

  const [newPrompt] = await db
    .insert(promptTemplate)
    .values({
      id: generateId(),
      creatorId: currentUser.id,
      title: body.title.trim(),
      description: body.description?.trim() || '',
      systemPrompt: body.systemPrompt.trim(),
      category: body.category || 'general',
      tags: body.tags || [],
      previewMessages: body.previewMessages || [],
      tools: body.tools || [],
      price,
      totalSales: 0,
      totalRevenue: '0',
      rating: 0,
      ratingCount: 0,
      sourceChatId: body.sourceChatId || null,
      status: 'active',
      featured: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return NextResponse.json({ prompt: newPrompt }, { status: 201 });
}
