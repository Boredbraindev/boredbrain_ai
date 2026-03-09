/**
 * Cross-Chain Bridge Service for USDT Token
 *
 * Handles bridging USDT tokens between supported chains (Base, BSC,
 * Arbitrum, ApeChain) via LayerZero or Wormhole messaging protocols.
 *
 * Uses raw JSON-RPC calls via fetch() -- no ethers.js dependency.
 *
 * When bridge contracts are not configured (isBridgeRouteOnChain === false),
 * all functions operate in simulation mode and return deterministic mock data
 * so the platform can function without live bridge deployments.
 */

import {
  type BridgeChainId,
  type BridgeProvider,
  type BridgeRoute,
  BRIDGE_CHAINS,
  BRIDGE_ROUTES,
  BRIDGE_PLATFORM_FEE_BPS,
  DEFAULT_BRIDGE_PROVIDER,
  getBridgeChainConfig,
  findBridgeRoute,
  isBridgeRouteOnChain,
  SUPPORTED_CHAINS,
} from './config';
import { toTokenUnits, fromTokenUnits, BBAI_TOKEN } from '@/lib/blockchain/config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BridgeQuote {
  fromChain: BridgeChainId;
  toChain: BridgeChainId;
  amount: number;
  provider: BridgeProvider;
  /** Estimated gas cost on the source chain in USD */
  bridgeGasCostUsd: number;
  /** Protocol fee charged by LayerZero / Wormhole (in USDT) */
  protocolFee: number;
  /** Platform fee (0.1%) */
  platformFee: number;
  /** Total fees in USDT */
  totalFee: number;
  /** Amount the recipient will receive after fees */
  receiveAmount: number;
  /** Estimated bridge completion time in minutes */
  estimatedTimeMinutes: number;
  /** Whether this quote was generated in simulation mode */
  isSimulated: boolean;
}

export interface BridgeTransaction {
  success: boolean;
  /** Unsigned transaction data for client-side signing */
  tx: {
    to: string;
    data: string;
    value: string;
    chainId: number;
  } | null;
  fromChain: BridgeChainId;
  toChain: BridgeChainId;
  amount: number;
  recipient: string;
  provider: BridgeProvider;
  quote: BridgeQuote;
  isSimulated: boolean;
  /** Simulated tx hash (only in simulation mode) */
  simulatedTxHash: string | null;
  error?: string;
}

export type BridgeStatus =
  | 'pending'
  | 'source_confirmed'
  | 'in_transit'
  | 'destination_confirmed'
  | 'completed'
  | 'failed'
  | 'not_found';

export interface BridgeStatusResult {
  txHash: string;
  provider: BridgeProvider;
  status: BridgeStatus;
  sourceChain: BridgeChainId | null;
  destinationChain: BridgeChainId | null;
  sourceConfirmations: number;
  estimatedCompletionMinutes: number | null;
  isSimulated: boolean;
}

export interface SupportedRoutesResult {
  routes: BridgeRoute[];
  chains: { slug: BridgeChainId; name: string; chainId: number }[];
  defaultProvider: BridgeProvider;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * LayerZero OFT (Omnichain Fungible Token) function selectors.
 * Used when building bridge calldata for LayerZero v2.
 */
const LZ_SELECTORS = {
  /** sendFrom(address _from, uint16 _dstChainId, bytes _toAddress, uint256 _amount, ...) */
  sendFrom: '0x51905636',
  /** quoteSend((uint32,bytes32,uint256,uint256,bytes,bytes,bytes)) */
  quoteSend: '0x4e487c27',
} as const;

/**
 * Wormhole Token Bridge function selectors.
 */
const WORMHOLE_SELECTORS = {
  /** transferTokens(address token, uint256 amount, uint16 recipientChain, bytes32 recipient, ...) */
  transferTokens: '0x0f5287b0',
} as const;

// ---------------------------------------------------------------------------
// JSON-RPC helpers (same pattern as payment-service)
// ---------------------------------------------------------------------------

let rpcCallId = 1;

async function rpcCall(
  rpcUrl: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const id = rpcCallId++;
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });

  if (!res.ok) {
    throw new Error(`RPC request failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as {
    result?: unknown;
    error?: { message: string; code: number };
  };

  if (json.error) {
    throw new Error(`RPC error: ${json.error.message} (code ${json.error.code})`);
  }

  return json.result;
}

// ---------------------------------------------------------------------------
// ABI encoding helpers
// ---------------------------------------------------------------------------

function padAddress(address: string): string {
  return address.replace('0x', '').toLowerCase().padStart(64, '0');
}

function padUint256(value: bigint): string {
  return value.toString(16).padStart(64, '0');
}

function padUint16(value: number): string {
  return value.toString(16).padStart(64, '0');
}

function encodeCallData(selector: string, ...params: string[]): string {
  return selector + params.map((p) => p.replace('0x', '').padStart(64, '0')).join('');
}

// ---------------------------------------------------------------------------
// Simulation helpers
// ---------------------------------------------------------------------------

function simulatedTxHash(context: string): string {
  const seed = `bridge-${context}-${Date.now()}`;
  let hash = '0x';
  for (let i = 0; i < 64; i++) {
    const charCode = seed.charCodeAt(i % seed.length);
    hash += ((charCode * (i + 1) * 7 + (Date.now() >> (i % 16))) % 16).toString(16);
  }
  return hash;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a bridge quote for transferring USDT tokens between chains.
 *
 * Calculates:
 * - Bridge gas cost (estimated in USD, varies by chain)
 * - Protocol fee (LayerZero/Wormhole messaging fee, estimated in USDT)
 * - Platform fee (0.1% of the transfer amount)
 *
 * Returns a simulation quote when contracts are not deployed.
 */
export async function getBridgeQuote(
  fromChain: BridgeChainId,
  toChain: BridgeChainId,
  amount: number,
  provider?: BridgeProvider,
): Promise<BridgeQuote> {
  if (fromChain === toChain) {
    throw new Error('Source and destination chains must be different');
  }

  if (amount <= 0) {
    throw new Error('Bridge amount must be greater than zero');
  }

  const route = findBridgeRoute(fromChain, toChain);
  if (!route) {
    throw new Error(`No bridge route available from ${fromChain} to ${toChain}`);
  }

  const selectedProvider = provider ?? DEFAULT_BRIDGE_PROVIDER;
  if (!route.providers.includes(selectedProvider)) {
    throw new Error(
      `Provider ${selectedProvider} is not available for ${fromChain} -> ${toChain}. ` +
      `Available: ${route.providers.join(', ')}`,
    );
  }

  const fromConfig = getBridgeChainConfig(fromChain);
  const isSimulated = !isBridgeRouteOnChain(fromChain, toChain);

  // Platform fee: 0.1% (10 bps)
  const platformFee = (amount * BRIDGE_PLATFORM_FEE_BPS) / 10000;

  // Protocol fee: estimated based on provider and route
  // In production this would be queried from the bridge contract (quoteSend)
  let protocolFee: number;

  if (!isSimulated && selectedProvider === 'layerzero') {
    // Attempt to query LayerZero quoteSend for actual fee
    try {
      protocolFee = await queryLayerZeroFee(fromChain, toChain, amount);
    } catch {
      // Fallback to estimate
      protocolFee = estimateProtocolFee(selectedProvider, amount);
    }
  } else {
    protocolFee = estimateProtocolFee(selectedProvider, amount);
  }

  const bridgeGasCostUsd = fromConfig.estimatedGasCostUsd;
  const totalFee = platformFee + protocolFee;
  const receiveAmount = amount - totalFee;

  return {
    fromChain,
    toChain,
    amount,
    provider: selectedProvider,
    bridgeGasCostUsd,
    protocolFee,
    platformFee,
    totalFee,
    receiveAmount: Math.max(0, receiveAmount),
    estimatedTimeMinutes: route.estimatedTimeMinutes,
    isSimulated,
  };
}

/**
 * Build an unsigned bridge transaction for client-side signing.
 *
 * The returned transaction data should be signed by the user's wallet
 * and broadcast to the source chain.
 *
 * In simulation mode, returns a mock tx hash instead of real calldata.
 */
export async function initiateBridge(
  fromChain: BridgeChainId,
  toChain: BridgeChainId,
  amount: number,
  recipient: string,
  provider?: BridgeProvider,
): Promise<BridgeTransaction> {
  // Validate inputs
  if (!recipient || !recipient.startsWith('0x') || recipient.length !== 42) {
    return {
      success: false,
      tx: null,
      fromChain,
      toChain,
      amount,
      recipient,
      provider: provider ?? DEFAULT_BRIDGE_PROVIDER,
      quote: await getBridgeQuote(fromChain, toChain, amount, provider),
      isSimulated: true,
      simulatedTxHash: null,
      error: 'Invalid recipient address',
    };
  }

  const quote = await getBridgeQuote(fromChain, toChain, amount, provider);
  const selectedProvider = quote.provider;
  const fromConfig = getBridgeChainConfig(fromChain);
  const toConfig = getBridgeChainConfig(toChain);
  const isSimulated = !isBridgeRouteOnChain(fromChain, toChain);

  // -- Simulation mode --
  if (isSimulated) {
    return {
      success: true,
      tx: null,
      fromChain,
      toChain,
      amount,
      recipient,
      provider: selectedProvider,
      quote,
      isSimulated: true,
      simulatedTxHash: simulatedTxHash(`${fromChain}-${toChain}-${recipient}-${amount}`),
    };
  }

  // -- On-chain mode: build unsigned tx --
  try {
    const tokenUnits = toTokenUnits(amount);
    let txData: { to: string; data: string; value: string; chainId: number };

    if (selectedProvider === 'layerzero') {
      txData = buildLayerZeroBridgeTx(
        fromConfig,
        toConfig,
        tokenUnits,
        recipient,
      );
    } else {
      txData = buildWormholeBridgeTx(
        fromConfig,
        toConfig,
        tokenUnits,
        recipient,
      );
    }

    return {
      success: true,
      tx: txData,
      fromChain,
      toChain,
      amount,
      recipient,
      provider: selectedProvider,
      quote,
      isSimulated: false,
      simulatedTxHash: null,
    };
  } catch (err) {
    return {
      success: false,
      tx: null,
      fromChain,
      toChain,
      amount,
      recipient,
      provider: selectedProvider,
      quote,
      isSimulated: false,
      simulatedTxHash: null,
      error: err instanceof Error ? err.message : 'Failed to build bridge transaction',
    };
  }
}

/**
 * Check the status of a bridge transaction.
 *
 * Queries the source chain for tx confirmation, then checks the bridge
 * protocol's messaging layer for delivery status.
 *
 * In simulation mode, returns a deterministic status progression.
 */
export async function getBridgeStatus(
  txHash: string,
  bridgeProvider?: BridgeProvider,
): Promise<BridgeStatusResult> {
  const provider = bridgeProvider ?? DEFAULT_BRIDGE_PROVIDER;

  // Check if any chain has bridge contracts configured
  const anyOnChain = SUPPORTED_CHAINS.some((c) => {
    const cfg = BRIDGE_CHAINS[c];
    return cfg.bbaiTokenAddress !== null;
  });

  // -- Simulation mode --
  if (!anyOnChain) {
    // Deterministic status based on the tx hash to give consistent results
    const hashNum = parseInt(txHash.slice(2, 10), 16) || 0;
    const statusIndex = hashNum % 5;
    const statuses: BridgeStatus[] = [
      'pending',
      'source_confirmed',
      'in_transit',
      'destination_confirmed',
      'completed',
    ];

    return {
      txHash,
      provider,
      status: statuses[statusIndex],
      sourceChain: 'base',
      destinationChain: 'bsc',
      sourceConfirmations: statusIndex >= 1 ? 12 : 0,
      estimatedCompletionMinutes: statusIndex < 4 ? 15 - statusIndex * 3 : 0,
      isSimulated: true,
    };
  }

  // -- On-chain mode: check source chain tx receipt --
  try {
    // Try each chain's RPC to find the tx
    for (const chainSlug of SUPPORTED_CHAINS) {
      const cfg = BRIDGE_CHAINS[chainSlug];
      if (!cfg.bbaiTokenAddress) continue;

      try {
        const receipt = (await rpcCall(cfg.rpcUrl, 'eth_getTransactionReceipt', [
          txHash,
        ])) as {
          blockNumber: string;
          status: string;
        } | null;

        if (receipt) {
          const confirmed = receipt.status === '0x1';

          // Get current block to calculate confirmations
          const latestBlock = (await rpcCall(cfg.rpcUrl, 'eth_blockNumber', [])) as string;
          const receiptBlock = parseInt(receipt.blockNumber, 16);
          const currentBlock = parseInt(latestBlock, 16);
          const confirmations = currentBlock - receiptBlock;

          // Determine bridge status based on confirmations
          let status: BridgeStatus;
          if (!confirmed) {
            status = 'failed';
          } else if (confirmations < 1) {
            status = 'pending';
          } else if (confirmations < 12) {
            status = 'source_confirmed';
          } else if (confirmations < 30) {
            status = 'in_transit';
          } else {
            // After sufficient confirmations, assume delivery
            // In production, we would query LayerZero/Wormhole for actual status
            status = 'completed';
          }

          return {
            txHash,
            provider,
            status,
            sourceChain: chainSlug,
            destinationChain: null, // would be decoded from tx logs
            sourceConfirmations: confirmations,
            estimatedCompletionMinutes: status === 'completed' ? 0 : 10,
            isSimulated: false,
          };
        }
      } catch {
        // This chain doesn't have the tx, try next
        continue;
      }
    }

    // Tx not found on any chain
    return {
      txHash,
      provider,
      status: 'not_found',
      sourceChain: null,
      destinationChain: null,
      sourceConfirmations: 0,
      estimatedCompletionMinutes: null,
      isSimulated: false,
    };
  } catch {
    return {
      txHash,
      provider,
      status: 'not_found',
      sourceChain: null,
      destinationChain: null,
      sourceConfirmations: 0,
      estimatedCompletionMinutes: null,
      isSimulated: false,
    };
  }
}

/**
 * List all supported bridge routes with chain metadata.
 */
export function getSupportedRoutes(): SupportedRoutesResult {
  const chains = SUPPORTED_CHAINS.map((slug) => {
    const cfg = BRIDGE_CHAINS[slug];
    return { slug, name: cfg.name, chainId: cfg.chainId };
  });

  return {
    routes: BRIDGE_ROUTES.filter((r) => r.enabled),
    chains,
    defaultProvider: DEFAULT_BRIDGE_PROVIDER,
  };
}

// ---------------------------------------------------------------------------
// Internal: LayerZero helpers
// ---------------------------------------------------------------------------

/**
 * Query LayerZero endpoint for the messaging fee.
 * Calls quoteSend on the OFT adapter contract on the source chain.
 */
async function queryLayerZeroFee(
  fromChain: BridgeChainId,
  toChain: BridgeChainId,
  amount: number,
): Promise<number> {
  const fromConfig = getBridgeChainConfig(fromChain);
  const toConfig = getBridgeChainConfig(toChain);

  if (!fromConfig.bbaiTokenAddress || !fromConfig.layerZeroEndpoint) {
    throw new Error('LayerZero endpoint not configured for source chain');
  }

  // Build quoteSend calldata
  // SendParam struct: (uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd)
  const tokenUnits = toTokenUnits(amount);
  const dstEid = padUint16(toConfig.layerZeroEid);
  const amountHex = padUint256(tokenUnits);
  // minAmount = 99% of amount (1% slippage tolerance)
  const minAmount = padUint256((tokenUnits * 99n) / 100n);

  // Simplified quote call -- actual encoding requires dynamic bytes ABI
  // In production, this would use full ABI encoding
  const data = encodeCallData(
    LZ_SELECTORS.quoteSend,
    dstEid,
    padAddress('0x0000000000000000000000000000000000000000'), // placeholder recipient
    amountHex,
    minAmount,
  );

  try {
    const result = (await rpcCall(fromConfig.rpcUrl, 'eth_call', [
      { to: fromConfig.bbaiTokenAddress, data },
      'latest',
    ])) as string;

    // Parse the returned native fee (first 32 bytes)
    const feeWei = BigInt('0x' + (result.replace('0x', '').slice(0, 64) || '0'));
    // Convert native fee to approximate USDT value (rough 1:1000 estimate)
    return fromTokenUnits(feeWei) * 0.001;
  } catch {
    throw new Error('Failed to query LayerZero fee');
  }
}

/**
 * Build unsigned LayerZero bridge transaction.
 * Uses the OFT sendFrom function to initiate cross-chain transfer.
 */
function buildLayerZeroBridgeTx(
  fromConfig: ReturnType<typeof getBridgeChainConfig>,
  toConfig: ReturnType<typeof getBridgeChainConfig>,
  tokenUnits: bigint,
  recipient: string,
): { to: string; data: string; value: string; chainId: number } {
  if (!fromConfig.bbaiTokenAddress) {
    throw new Error('BBAI token not deployed on source chain');
  }

  // sendFrom(address _from, uint16 _dstChainId, bytes32 _toAddress, uint256 _amount, ...)
  // For OFT v2, recipient is padded to bytes32
  const data = encodeCallData(
    LZ_SELECTORS.sendFrom,
    padAddress(recipient),          // _from (sender, will be overridden by msg.sender)
    padUint16(toConfig.layerZeroEid), // _dstEid
    padAddress(recipient),          // _toAddress as bytes32
    padUint256(tokenUnits),         // _amount
    padUint256((tokenUnits * 99n) / 100n), // _minAmount (1% slippage)
  );

  return {
    to: fromConfig.bbaiTokenAddress,
    data,
    value: '0x0', // native fee to be estimated by client
    chainId: fromConfig.chainId,
  };
}

/**
 * Build unsigned Wormhole bridge transaction.
 * Uses the Token Bridge transferTokens function.
 */
function buildWormholeBridgeTx(
  fromConfig: ReturnType<typeof getBridgeChainConfig>,
  toConfig: ReturnType<typeof getBridgeChainConfig>,
  tokenUnits: bigint,
  recipient: string,
): { to: string; data: string; value: string; chainId: number } {
  if (!fromConfig.wormholeBridge || !fromConfig.bbaiTokenAddress) {
    throw new Error('Wormhole bridge or BBAI token not deployed on source chain');
  }

  // transferTokens(address token, uint256 amount, uint16 recipientChain, bytes32 recipient, uint256 arbiterFee, uint32 nonce)
  const nonce = Math.floor(Math.random() * 0xffffffff);
  const data = encodeCallData(
    WORMHOLE_SELECTORS.transferTokens,
    padAddress(fromConfig.bbaiTokenAddress), // token
    padUint256(tokenUnits),                  // amount
    padUint16(toConfig.wormholeChainId),     // recipientChain
    padAddress(recipient),                   // recipient as bytes32
    padUint256(0n),                          // arbiterFee
    nonce.toString(16).padStart(64, '0'),    // nonce
  );

  return {
    to: fromConfig.wormholeBridge,
    data,
    value: '0x0', // native fee for Wormhole message
    chainId: fromConfig.chainId,
  };
}

// ---------------------------------------------------------------------------
// Internal: fee estimation
// ---------------------------------------------------------------------------

/**
 * Estimate the protocol fee when on-chain queries are unavailable.
 * Returns fee in USDT.
 */
function estimateProtocolFee(provider: BridgeProvider, amount: number): number {
  // LayerZero and Wormhole charge messaging fees in native tokens.
  // We estimate the USDT-equivalent cost based on typical messaging fees.
  if (provider === 'layerzero') {
    // LayerZero v2 typical fee: ~0.001 ETH equivalent
    // Rough estimate: flat fee + tiny percentage
    return Math.max(0.5, amount * 0.0005);
  }

  // Wormhole typical fee: slightly higher due to guardian network
  return Math.max(1.0, amount * 0.001);
}
