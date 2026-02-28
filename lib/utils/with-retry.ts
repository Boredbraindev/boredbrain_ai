/**
 * Retry wrapper with exponential backoff and timeout for tool execution.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    timeoutMs?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {},
): Promise<T> {
  const { maxRetries = 2, baseDelayMs = 500, timeoutMs = 30000, onRetry } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)), timeoutMs),
        ),
      ]);
      return result;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = baseDelayMs * Math.pow(2, attempt);
      onRetry?.(attempt + 1, error as Error);
      console.warn(`[Retry ${attempt + 1}/${maxRetries}] ${(error as Error).message} — retrying in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Unreachable');
}

/**
 * Fetch with timeout — wraps native fetch with an AbortController timeout.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 15000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
