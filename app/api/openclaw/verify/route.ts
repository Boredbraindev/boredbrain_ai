import { apiSuccess, apiError, parseJsonBody, validateBody } from '@/lib/api-utils';
import { generateProof, verifyProof } from '@/lib/openclaw';

// POST /api/openclaw/verify — Verify identity and return iden3 ZK proof
export async function POST(request: Request) {
  const parsed = await parseJsonBody<{ address: string }>(request);

  if ('error' in parsed) return parsed.error;

  const { valid, errors, sanitized } = validateBody(
    parsed.data as Record<string, unknown>,
    { address: { type: 'string', required: true, maxLength: 100 } },
  );

  if (!valid) {
    return apiError(errors.join(', '), 400);
  }

  const address = sanitized.address as string;

  // Generate iden3 ZK proof for the address
  const proof = generateProof(address);
  const verified = verifyProof(proof);

  return apiSuccess({
    address,
    verified,
    proof,
  });
}
