import { apiSuccess, apiError, parseJsonBody, validateBody } from '@/lib/api-utils';
import { generateProof, verifyProof } from '@/lib/openclaw';

// POST /api/openclaw/verify — Generate and verify iden3 ZK proof (Poseidon + EdDSA)
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

  // Validate Ethereum address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return apiError('Invalid Ethereum address format', 400);
  }

  // Generate real iden3 ZK proof using Poseidon hash + EdDSA signature
  const proof = generateProof(address);
  const verified = verifyProof(proof);

  return apiSuccess({
    address,
    verified,
    proof,
    crypto: {
      poseidonHash: proof.poseidonHash,
      identityCommitment: proof.identityCommitment,
      eddsaVerified: verified,
      algorithm: 'Poseidon + Baby JubJub EdDSA',
      library: '@iden3/js-crypto v1.3.2',
    },
  });
}
