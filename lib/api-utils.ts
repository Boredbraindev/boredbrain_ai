import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/**
 * Return a consistent JSON error response.
 */
export function apiError(message: string, status: number = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * Return a consistent JSON success response.
 */
export function apiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json({ success: true, ...data as Record<string, unknown> }, { status });
}

// ---------------------------------------------------------------------------
// String sanitisation
// ---------------------------------------------------------------------------

/**
 * Trim whitespace and truncate to `maxLength`.  Returns empty string for
 * non-string inputs.
 */
export function sanitizeString(value: unknown, maxLength: number = 500): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

/**
 * Validate that a value looks like an Ethereum address (0x + 40 hex chars).
 */
export function isValidEthAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

/**
 * Validate that a value is a safe URL string (http/https only, no javascript: etc).
 */
export function isValidUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Body validation
// ---------------------------------------------------------------------------

type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface FieldSchema {
  type: FieldType;
  required?: boolean;
  maxLength?: number;        // for strings
  min?: number;              // for numbers
  max?: number;              // for numbers
  enum?: readonly string[];  // allowed values
}

export type Schema = Record<string, FieldSchema>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  /** Sanitised copy of the body with strings trimmed/truncated. */
  sanitized: Record<string, unknown>;
}

/**
 * Validate a request body against a simple schema.
 *
 * - Checks required fields exist
 * - Checks types
 * - Enforces string maxLength, number min/max, enum values
 * - Returns a sanitised copy with trimmed strings
 */
export function validateBody(
  body: Record<string, unknown>,
  schema: Schema,
): ValidationResult {
  const errors: string[] = [];
  const sanitized: Record<string, unknown> = { ...body };

  for (const [field, rule] of Object.entries(schema)) {
    const value = body[field];

    // Required check
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }

    // Skip optional missing fields
    if (value === undefined || value === null) continue;

    // Type check
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== rule.type) {
      errors.push(`${field} must be of type ${rule.type}`);
      continue;
    }

    // String-specific
    if (rule.type === 'string' && typeof value === 'string') {
      const maxLen = rule.maxLength ?? 1000;
      sanitized[field] = sanitizeString(value, maxLen);
    }

    // Number-specific
    if (rule.type === 'number' && typeof value === 'number') {
      if (!Number.isFinite(value)) {
        errors.push(`${field} must be a finite number`);
        continue;
      }
      if (rule.min !== undefined && value < rule.min) {
        errors.push(`${field} must be at least ${rule.min}`);
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push(`${field} must be at most ${rule.max}`);
      }
    }

    // Enum check
    if (rule.enum && typeof value === 'string' && !rule.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rule.enum.join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors, sanitized };
}

// ---------------------------------------------------------------------------
// Safe JSON parse from request
// ---------------------------------------------------------------------------

/**
 * Safely parse JSON from a Request, returning an apiError response on failure.
 */
export async function parseJsonBody<T = Record<string, unknown>>(
  request: Request,
): Promise<{ data: T } | { error: ReturnType<typeof apiError> }> {
  try {
    const data = await request.json();
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return { error: apiError('Request body must be a JSON object') };
    }
    return { data: data as T };
  } catch {
    return { error: apiError('Invalid or missing JSON body') };
  }
}
