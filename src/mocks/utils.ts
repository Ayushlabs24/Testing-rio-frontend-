/** Simulated network latency so the mock layer feels like a real API. */
export function mockDelay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let idCounter = 0;

/** Deterministic-enough id generator for mock records (not cryptographic). */
export function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

export function generateMockToken(): string {
  return `mock_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
