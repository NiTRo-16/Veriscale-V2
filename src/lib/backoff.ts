/** Wait before retry number `attempt` (1-based): 1s, 2s, 4s … capped at 30s. */
export function backoffDelay(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, attempt - 1));
}
