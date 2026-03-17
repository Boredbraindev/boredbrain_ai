/**
 * BSC Payment Verification — verify USDT and BNB transactions on BSC Mainnet
 *
 * Uses raw JSON-RPC fetch() calls (no ethers/viem dependency).
 * Follows the same rpcCall pattern as payment-service.ts and settlement-service.ts.
 *
 * Two main verification flows:
 *   1. verifyUsdtPayment() — check ERC-20 Transfer log for USDT to platform wallet
 *   2. verifyBnbPayment()  — check native BNB transfer value to platform wallet
 *   3. verifyBscTransaction() — generic tx receipt fetcher
 */

import { BSC_MAINNET as BSC_CONFIG } from './config';
import {
  PLATFORM_WALLET,
  BSC_USDT_ADDRESS,
  PRO_SUBSCRIPTION_MIN_RAW,
  TRANSFER_EVENT_TOPIC,
} from './bsc-mainnet';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TxVerificationResult {
  valid: boolean;
  from: string;
  to: string;
  value: string;
  token?: string; // 'USDT' | 'BNB' | undefined
  blockNumber?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// JSON-RPC helper (same pattern as payment-service.ts)
// ---------------------------------------------------------------------------

let rpcId = 1;

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const res = await fetch(BSC_CONFIG.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`BSC RPC error: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as {
      result?: unknown;
      error?: { message: string; code: number };
    };

    if (json.error) {
      throw new Error(`BSC RPC: ${json.error.message} (${json.error.code})`);
    }

    return json.result;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Generic transaction verification
// ---------------------------------------------------------------------------

/**
 * Fetch and verify a BSC transaction by hash.
 * Returns the sender, recipient, value, and confirmation status.
 */
export async function verifyBscTransaction(txHash: string): Promise<TxVerificationResult> {
  try {
    // Fetch transaction receipt (confirmed only)
    const receipt = (await rpcCall('eth_getTransactionReceipt', [txHash])) as {
      status: string;
      from: string;
      to: string;
      blockNumber: string;
      logs: Array<{
        address: string;
        topics: string[];
        data: string;
      }>;
    } | null;

    if (!receipt) {
      // Check if tx exists but is pending
      const tx = (await rpcCall('eth_getTransactionByHash', [txHash])) as {
        from: string;
        to: string;
        value: string;
      } | null;

      if (tx) {
        return {
          valid: false,
          from: tx.from || '',
          to: tx.to || '',
          value: tx.value || '0x0',
          error: 'Transaction is pending (not yet confirmed)',
        };
      }

      return {
        valid: false,
        from: '',
        to: '',
        value: '0x0',
        error: 'Transaction not found on BSC',
      };
    }

    // Check status (0x1 = success)
    if (receipt.status !== '0x1') {
      return {
        valid: false,
        from: receipt.from,
        to: receipt.to || '',
        value: '0x0',
        blockNumber: Number(BigInt(receipt.blockNumber)),
        error: 'Transaction reverted',
      };
    }

    // Fetch the actual transaction for value
    const tx = (await rpcCall('eth_getTransactionByHash', [txHash])) as {
      from: string;
      to: string;
      value: string;
    } | null;

    // Check if this is a USDT transfer by looking at logs
    let token: string | undefined;
    for (const log of receipt.logs || []) {
      if (
        log.address.toLowerCase() === BSC_USDT_ADDRESS.toLowerCase() &&
        log.topics[0] === TRANSFER_EVENT_TOPIC
      ) {
        token = 'USDT';
        break;
      }
    }

    // For native BNB transfers, value > 0 and no USDT token
    const txValue = tx?.value || '0x0';
    if (!token && BigInt(txValue) > BigInt(0)) {
      token = 'BNB';
    }

    return {
      valid: true,
      from: receipt.from,
      to: receipt.to || '',
      value: txValue,
      token,
      blockNumber: Number(BigInt(receipt.blockNumber)),
    };
  } catch (err) {
    return {
      valid: false,
      from: '',
      to: '',
      value: '0x0',
      error: err instanceof Error ? err.message : 'Verification failed',
    };
  }
}

// ---------------------------------------------------------------------------
// USDT payment verification
// ---------------------------------------------------------------------------

/**
 * Verify that a BSC transaction is a USDT transfer to the platform wallet
 * with an amount >= the expected amount.
 *
 * Checks:
 *   1. Transaction is confirmed (status: 0x1)
 *   2. Contains a Transfer event from BSC USDT contract
 *   3. Recipient (topics[2]) is the platform wallet
 *   4. Amount (data) >= expectedAmount
 *
 * @param txHash - BSC transaction hash
 * @param expectedAmountRaw - Expected amount in raw 18-decimal units (default: PRO_SUBSCRIPTION_MIN_RAW)
 */
export async function verifyUsdtPayment(
  txHash: string,
  expectedAmountRaw: string = PRO_SUBSCRIPTION_MIN_RAW,
): Promise<{
  valid: boolean;
  from?: string;
  amount?: string;
  amountHuman?: number;
  error?: string;
}> {
  try {
    const receipt = (await rpcCall('eth_getTransactionReceipt', [txHash])) as {
      status: string;
      from: string;
      blockNumber: string;
      logs: Array<{
        address: string;
        topics: string[];
        data: string;
      }>;
    } | null;

    if (!receipt) {
      return { valid: false, error: 'Transaction not found or still pending' };
    }

    if (receipt.status !== '0x1') {
      return { valid: false, error: 'Transaction reverted' };
    }

    // Find the USDT Transfer log
    const transferLog = (receipt.logs || []).find((log) => {
      return (
        log.address.toLowerCase() === BSC_USDT_ADDRESS.toLowerCase() &&
        log.topics[0] === TRANSFER_EVENT_TOPIC &&
        log.topics.length >= 3
      );
    });

    if (!transferLog) {
      return { valid: false, error: 'No USDT Transfer event found in transaction' };
    }

    // Decode Transfer(address from, address to, uint256 value)
    // topics[1] = from (padded to 32 bytes)
    // topics[2] = to (padded to 32 bytes)
    // data = value (uint256)
    const toAddress = '0x' + transferLog.topics[2].slice(26); // last 20 bytes
    const transferAmount = BigInt(transferLog.data);

    // Verify recipient is our platform wallet
    if (toAddress.toLowerCase() !== PLATFORM_WALLET.toLowerCase()) {
      return {
        valid: false,
        error: `USDT sent to ${toAddress}, expected platform wallet ${PLATFORM_WALLET}`,
      };
    }

    // Verify amount
    const expectedAmount = BigInt(expectedAmountRaw);
    if (transferAmount < expectedAmount) {
      const amountHuman = Number(transferAmount) / 1e18;
      const expectedHuman = Number(expectedAmount) / 1e18;
      return {
        valid: false,
        error: `USDT amount ${amountHuman} is less than required ${expectedHuman}`,
        amount: transferAmount.toString(),
        amountHuman,
      };
    }

    // Decode sender from topics[1]
    const fromAddress = '0x' + transferLog.topics[1].slice(26);
    const amountHuman = Number(transferAmount) / 1e18;

    return {
      valid: true,
      from: fromAddress,
      amount: transferAmount.toString(),
      amountHuman,
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'USDT verification failed',
    };
  }
}

// ---------------------------------------------------------------------------
// BNB payment verification
// ---------------------------------------------------------------------------

/**
 * Verify a native BNB payment to the platform wallet.
 * Used as an alternative to USDT for Pro subscription.
 *
 * @param txHash - BSC transaction hash
 * @param minValueWei - Minimum BNB value in wei (caller must convert USD to BNB)
 */
export async function verifyBnbPayment(
  txHash: string,
  minValueWei: string,
): Promise<{
  valid: boolean;
  from?: string;
  value?: string;
  valueHuman?: number;
  error?: string;
}> {
  try {
    const receipt = (await rpcCall('eth_getTransactionReceipt', [txHash])) as {
      status: string;
      from: string;
      to: string;
      blockNumber: string;
    } | null;

    if (!receipt) {
      return { valid: false, error: 'Transaction not found or still pending' };
    }

    if (receipt.status !== '0x1') {
      return { valid: false, error: 'Transaction reverted' };
    }

    // Verify recipient
    if (receipt.to?.toLowerCase() !== PLATFORM_WALLET.toLowerCase()) {
      return {
        valid: false,
        error: `BNB sent to ${receipt.to}, expected platform wallet ${PLATFORM_WALLET}`,
      };
    }

    // Fetch tx for value
    const tx = (await rpcCall('eth_getTransactionByHash', [txHash])) as {
      from: string;
      to: string;
      value: string;
    } | null;

    if (!tx) {
      return { valid: false, error: 'Could not fetch transaction details' };
    }

    const value = BigInt(tx.value);
    const minValue = BigInt(minValueWei);

    if (value < minValue) {
      const valueHuman = Number(value) / 1e18;
      const minHuman = Number(minValue) / 1e18;
      return {
        valid: false,
        error: `BNB amount ${valueHuman} is less than required ${minHuman}`,
        value: value.toString(),
        valueHuman,
      };
    }

    return {
      valid: true,
      from: tx.from,
      value: value.toString(),
      valueHuman: Number(value) / 1e18,
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'BNB verification failed',
    };
  }
}
