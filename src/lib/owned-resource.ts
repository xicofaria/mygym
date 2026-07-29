type DeleteOwnedRecordOptions = {
  id: number;
  userId: number;
  findOwnedId: (id: number, userId: number) => Promise<number | null>;
  deleteOwned: (id: number, userId: number) => Promise<void>;
};

export type DeleteOwnedRecordResult = "deleted" | "invalid-id" | "not-found";

function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

/**
 * Shared authorization workflow for destructive actions. Callers must still
 * authenticate before invoking it and keep the user predicate in deleteOwned.
 */
export async function deleteOwnedRecord({
  id,
  userId,
  findOwnedId,
  deleteOwned,
}: DeleteOwnedRecordOptions): Promise<DeleteOwnedRecordResult> {
  if (!isPositiveInteger(id) || !isPositiveInteger(userId)) {
    return "invalid-id";
  }

  const ownedId = await findOwnedId(id, userId);
  if (ownedId !== id) return "not-found";

  await deleteOwned(id, userId);
  return "deleted";
}
