/**
 * Agent Registration — Onchain Signature Verification
 *
 * Uses EIP-191 personal_sign style messages for agent registration.
 * The user signs a structured message with their wallet, and we verify
 * the signature server-side using ecrecover via raw crypto operations.
 *
 * No smart contract needed — the signed message serves as the onchain
 * proof of intent. The signature + message are stored in the DB.
 *
 * Flow:
 *   1. Frontend: getRegistrationMessage() → display to user
 *   2. User signs with wallet (personal_sign / signMessage)
 *   3. Frontend: POST to /api/agents/register with { signature, message, wallet }
 *   4. Backend: verifyRegistrationSignature() → validate, then store in DB
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegistrationMessage {
  message: string;
  domain: string;
  timestamp: number;
  walletAddress: string;
  agentName: string;
}

export interface RegistrationVerification {
  valid: boolean;
  walletAddress: string;
  agentName: string;
  timestamp: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Message generation
// ---------------------------------------------------------------------------

/**
 * Generate a human-readable registration message for the user to sign.
 * This follows a structured format that can be parsed back for verification.
 */
export function getRegistrationMessage(
  walletAddress: string,
  agentName: string,
): RegistrationMessage {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = [
    'BoredBrain Agent Registration',
    '',
    `Wallet: ${walletAddress.toLowerCase()}`,
    `Agent: ${agentName}`,
    `Timestamp: ${timestamp}`,
    `Chain: BNB Smart Chain (56)`,
    '',
    'By signing this message, you confirm registration of the above agent.',
    'This does not trigger a blockchain transaction or cost any gas.',
  ].join('\n');

  return {
    message,
    domain: 'boredbrain.app',
    timestamp,
    walletAddress: walletAddress.toLowerCase(),
    agentName,
  };
}

// ---------------------------------------------------------------------------
// Message parsing
// ---------------------------------------------------------------------------

/**
 * Parse a registration message back into its components.
 * Returns null if the message format is invalid.
 */
export function parseRegistrationMessage(
  message: string,
): { walletAddress: string; agentName: string; timestamp: number } | null {
  try {
    const walletMatch = message.match(/Wallet:\s*(0x[a-fA-F0-9]{40})/);
    const agentMatch = message.match(/Agent:\s*(.+)/);
    const timestampMatch = message.match(/Timestamp:\s*(\d+)/);

    if (!walletMatch || !agentMatch || !timestampMatch) {
      return null;
    }

    return {
      walletAddress: walletMatch[1].toLowerCase(),
      agentName: agentMatch[1].trim(),
      timestamp: parseInt(timestampMatch[1], 10),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Signature verification (EIP-191 personal_sign)
// ---------------------------------------------------------------------------

/**
 * Verify that a personal_sign signature was created by the claimed wallet.
 *
 * Uses the Ethereum personal_sign prefix:
 *   "\x19Ethereum Signed Message:\n" + len(message) + message
 *
 * Then recovers the signer address from the signature using ecrecover.
 * We use the Web Crypto API (SubtleCrypto) + secp256k1 recovery.
 *
 * For edge runtime compatibility, we use a lightweight recovery approach
 * with viem's verifyMessage (dynamic import to keep the module light).
 */
export async function verifyRegistrationSignature(
  walletAddress: string,
  signature: string,
  message: string,
): Promise<RegistrationVerification> {
  try {
    // Parse the message to extract registration details
    const parsed = parseRegistrationMessage(message);
    if (!parsed) {
      return {
        valid: false,
        walletAddress,
        agentName: '',
        timestamp: 0,
        error: 'Invalid registration message format',
      };
    }

    // Verify the wallet in the message matches the claimed wallet
    if (parsed.walletAddress !== walletAddress.toLowerCase()) {
      return {
        valid: false,
        walletAddress,
        agentName: parsed.agentName,
        timestamp: parsed.timestamp,
        error: 'Wallet address in message does not match claimed wallet',
      };
    }

    // Verify timestamp is not too old (max 10 minutes)
    const now = Math.floor(Date.now() / 1000);
    const maxAge = 600; // 10 minutes
    if (now - parsed.timestamp > maxAge) {
      return {
        valid: false,
        walletAddress,
        agentName: parsed.agentName,
        timestamp: parsed.timestamp,
        error: 'Registration message has expired (>10 minutes old)',
      };
    }

    // Verify signature using viem (dynamic import for edge compatibility)
    const { verifyMessage } = await import('viem');
    const isValid = await verifyMessage({
      address: walletAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValid) {
      return {
        valid: false,
        walletAddress,
        agentName: parsed.agentName,
        timestamp: parsed.timestamp,
        error: 'Signature verification failed — signer does not match wallet',
      };
    }

    return {
      valid: true,
      walletAddress: parsed.walletAddress,
      agentName: parsed.agentName,
      timestamp: parsed.timestamp,
    };
  } catch (err) {
    return {
      valid: false,
      walletAddress,
      agentName: '',
      timestamp: 0,
      error: err instanceof Error ? err.message : 'Signature verification error',
    };
  }
}

// ---------------------------------------------------------------------------
// EIP-712 Typed Data (optional, for future use)
// ---------------------------------------------------------------------------

/**
 * Get EIP-712 typed data for agent registration.
 * This provides a more structured signing experience in wallets.
 * Not used in the initial implementation (personal_sign is simpler).
 */
export function getRegistrationTypedData(walletAddress: string, agentName: string) {
  const timestamp = Math.floor(Date.now() / 1000);

  return {
    domain: {
      name: 'BoredBrain',
      version: '1',
      chainId: 56, // BSC Mainnet
      verifyingContract: '0x0000000000000000000000000000000000000000' as const, // no contract yet
    },
    types: {
      AgentRegistration: [
        { name: 'wallet', type: 'address' },
        { name: 'agentName', type: 'string' },
        { name: 'timestamp', type: 'uint256' },
      ],
    },
    primaryType: 'AgentRegistration' as const,
    message: {
      wallet: walletAddress as `0x${string}`,
      agentName,
      timestamp: BigInt(timestamp),
    },
  };
}
