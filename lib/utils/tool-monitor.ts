/**
 * Tool execution monitor — tracks latency, errors, and success rates.
 * Logs to console for now; can be extended to external monitoring.
 */

interface ToolExecution {
  tool: string;
  startedAt: number;
  duration: number;
  success: boolean;
  error?: string;
}

// Recent executions buffer (last 100)
const recentExecutions: ToolExecution[] = [];
const MAX_BUFFER = 100;

/**
 * Wrap a tool execution with monitoring.
 */
export async function monitorToolExecution<T>(
  toolName: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - start;

    const execution: ToolExecution = {
      tool: toolName,
      startedAt: start,
      duration,
      success: true,
    };

    recentExecutions.push(execution);
    if (recentExecutions.length > MAX_BUFFER) recentExecutions.shift();

    if (duration > 10000) {
      console.warn(`⚠️ [SLOW TOOL] ${toolName} took ${(duration / 1000).toFixed(2)}s`);
    } else {
      console.log(`✅ [TOOL] ${toolName} completed in ${(duration / 1000).toFixed(2)}s`);
    }

    return result;
  } catch (error) {
    const duration = Date.now() - start;

    const execution: ToolExecution = {
      tool: toolName,
      startedAt: start,
      duration,
      success: false,
      error: (error as Error).message,
    };

    recentExecutions.push(execution);
    if (recentExecutions.length > MAX_BUFFER) recentExecutions.shift();

    console.error(`❌ [TOOL FAILED] ${toolName} after ${(duration / 1000).toFixed(2)}s: ${(error as Error).message}`);

    throw error;
  }
}

/**
 * Get tool execution stats for monitoring.
 */
export function getToolStats() {
  const stats = new Map<string, { total: number; successes: number; failures: number; avgDuration: number }>();

  for (const exec of recentExecutions) {
    const existing = stats.get(exec.tool) || { total: 0, successes: 0, failures: 0, avgDuration: 0 };
    existing.total++;
    if (exec.success) existing.successes++;
    else existing.failures++;
    existing.avgDuration = (existing.avgDuration * (existing.total - 1) + exec.duration) / existing.total;
    stats.set(exec.tool, existing);
  }

  return Object.fromEntries(stats);
}
