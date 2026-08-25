/**
 * Advisory locking for cron routes. Every cron job MUST run under a lock:
 * Vercel Cron re-invokes on failure and the every-minute outbox drain
 * WILL overlap itself under load.
 *
 * The in-memory provider is per-instance only — correct offline and a
 * best-effort guard in a single warm serverless instance. Phase 2 swaps
 * in Postgres advisory locks (`pg_try_advisory_lock(hashtext($name))` on
 * the service-role connection, released in a finally) behind the same
 * interface. No DB client here (standing rule).
 */

export interface LockProvider {
  tryLock(name: string): Promise<boolean>;
  unlock(name: string): Promise<void>;
}

const held = new Set<string>();

export const memoryLocks: LockProvider = {
  async tryLock(name) {
    if (held.has(name)) return false;
    held.add(name);
    return true;
  },
  async unlock(name) {
    held.delete(name);
  },
};

export type LockedRun<T> = { ran: true; result: T } | { ran: false; reason: "lock_held" };

export async function withLock<T>(provider: LockProvider, name: string, fn: () => Promise<T>): Promise<LockedRun<T>> {
  if (!(await provider.tryLock(name))) return { ran: false, reason: "lock_held" };
  try {
    return { ran: true, result: await fn() };
  } finally {
    await provider.unlock(name);
  }
}

export function getLockProvider(): LockProvider {
  // Phase 2: return the Postgres-advisory-lock provider when DATA_BACKEND=supabase.
  return memoryLocks;
}
