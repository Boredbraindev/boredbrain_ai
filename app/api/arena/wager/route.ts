import { NextRequest } from 'next/server';
import { placeWager, getMatchWagerStats } from '@/lib/arena/wagering';
import {
  apiError,
  apiSuccess,
  parseJsonBody,
  validateBody,
  sanitizeString,
  type Schema,
} from '@/lib/api-utils';

const wagerSchema: Schema = {
  matchId: { type: 'string', required: true, maxLength: 100 },
  bettorId: { type: 'string', required: true, maxLength: 100 },
  bettorType: { type: 'string', required: false, maxLength: 50, enum: ['user', 'agent'] },
  agentId: { type: 'string', required: true, maxLength: 100 },
  amount: { type: 'number', required: true, min: 0.01, max: 1_000_000 },
};

export async function POST(request: NextRequest) {
  // Safe JSON parse
  const parsed = await parseJsonBody(request);
  if ('error' in parsed) return parsed.error;
  const body = parsed.data as Record<string, unknown>;

  // Schema validation
  const { valid, errors, sanitized } = validateBody(body, wagerSchema);
  if (!valid) {
    return apiError(errors.join('; '), 400);
  }

  const matchId = sanitized.matchId as string;
  const bettorId = sanitized.bettorId as string;
  const bettorType = sanitizeString(sanitized.bettorType ?? 'user', 50) as 'user' | 'agent' | 'spectator';
  const agentId = sanitized.agentId as string;
  const amount = sanitized.amount as number;

  try {
    const result = await placeWager({ matchId, bettorId, bettorType, agentId, amount });
    return apiSuccess(result, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to place wager';
    return apiError(message, 400);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get('matchId');

  if (!matchId) {
    return apiError('matchId query param required', 400);
  }

  // Sanitize the query param
  const sanitizedMatchId = sanitizeString(matchId, 100);
  if (!sanitizedMatchId) {
    return apiError('matchId must be a non-empty string', 400);
  }

  try {
    const stats = await getMatchWagerStats(sanitizedMatchId);
    return apiSuccess(stats);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get wager stats';
    return apiError(message, 500);
  }
}
