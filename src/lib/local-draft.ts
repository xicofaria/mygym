const DRAFT_VERSION = 1;

type DraftEnvelope<T> = {
  version: typeof DRAFT_VERSION;
  savedAt: string;
  data: T;
};

export function readLocalDraft<T>(
  storage: Pick<Storage, "getItem" | "removeItem">,
  key: string,
  isValid: (value: unknown) => value is T,
): T | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<DraftEnvelope<unknown>>;
    if (parsed.version !== DRAFT_VERSION || !isValid(parsed.data)) {
      removeLocalDraft(storage, key);
      return null;
    }

    return parsed.data;
  } catch {
    removeLocalDraft(storage, key);
    return null;
  }
}

export function writeLocalDraft<T>(
  storage: Pick<Storage, "setItem">,
  key: string,
  data: T,
): boolean {
  try {
    const envelope: DraftEnvelope<T> = {
      version: DRAFT_VERSION,
      savedAt: new Date().toISOString(),
      data,
    };
    storage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

export function removeLocalDraft(
  storage: Pick<Storage, "removeItem">,
  key: string,
): void {
  try {
    storage.removeItem(key);
  } catch {
    // Storage may be unavailable in private browsing. Draft persistence is
    // best-effort and must never stop a form from working online.
  }
}
