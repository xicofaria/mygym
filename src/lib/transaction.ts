/**
 * Deliberate rollback of an open database transaction.
 *
 * Drizzle only rolls back when the callback throws, so a "this link is no
 * longer valid" path has to signal itself with an error. Throwing this class
 * keeps that signal distinguishable from a real failure, which must still
 * propagate.
 */
export class TransactionRollback extends Error {}

/** `.catch(ignoreRollback)`: swallows a deliberate rollback, rethrows the rest. */
export function ignoreRollback(error: unknown): void {
  if (!(error instanceof TransactionRollback)) throw error;
}
