// Allowlisted metadata only: never log request URLs, headers, bodies, provider errors, or customer scope.
export function log(event: string, meta: { runId?: string; date?: string; code?: string; count?: number } = {}) {
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...meta }));
}
export function errorCode(error: unknown) {
  return error instanceof Error && /^[A-Z][A-Z0-9_]{2,60}$/.test(error.message) ? error.message : 'INTERNAL_ERROR';
}
