import OpenAI from 'openai';
import { errorCode } from '../log';

// Return fixed codes only. Provider messages can contain credentials or customer data.
export function analysisErrorCode(error: unknown): string {
  if (error instanceof OpenAI.APIConnectionTimeoutError) return 'OPENAI_TIMEOUT';
  if (error instanceof OpenAI.APIConnectionError) return 'OPENAI_CONNECTION_FAILED';
  if (error instanceof OpenAI.APIError) {
    if (error.code === 'insufficient_quota' || error.type === 'insufficient_quota' ||
        ['billing_hard_limit_reached','billing_limit_exceeded','project_spend_limit_exceeded','organization_usage_limit_exceeded'].includes(error.code ?? '')) return 'OPENAI_QUOTA_EXCEEDED';
    if (error.status === 401) return 'OPENAI_KEY_INVALID';
    if (error.status === 403) return 'OPENAI_PERMISSION_DENIED';
    if (error.status === 404) return 'OPENAI_MODEL_UNAVAILABLE';
    if (error.status === 429) return 'OPENAI_RATE_LIMITED';
    if (error.status === 400 || error.status === 422) return 'OPENAI_REQUEST_REJECTED';
    if (error.status && error.status >= 500) return 'OPENAI_SERVICE_UNAVAILABLE';
    return 'OPENAI_API_ERROR';
  }
  const known = errorCode(error);
  return known === 'INTERNAL_ERROR' ? 'AI_PROCESSING_ERROR' : known;
}
