import assert from "node:assert/strict";
import test from "node:test";
import {
  readLocalDraft,
  removeLocalDraft,
  writeLocalDraft,
} from "../../src/lib/local-draft";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

type Draft = { notes: string };
const isDraft = (value: unknown): value is Draft =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Draft).notes === "string";

test("local drafts round-trip and can be removed", () => {
  const storage = new MemoryStorage();

  assert.equal(writeLocalDraft(storage, "draft", { notes: "Treino A" }), true);
  assert.deepEqual(readLocalDraft(storage, "draft", isDraft), {
    notes: "Treino A",
  });

  removeLocalDraft(storage, "draft");
  assert.equal(readLocalDraft(storage, "draft", isDraft), null);
});

test("invalid or corrupt drafts are discarded", () => {
  const storage = new MemoryStorage();
  storage.setItem("invalid", JSON.stringify({ version: 99, data: {} }));
  storage.setItem("corrupt", "not-json");

  assert.equal(readLocalDraft(storage, "invalid", isDraft), null);
  assert.equal(storage.getItem("invalid"), null);
  assert.equal(readLocalDraft(storage, "corrupt", isDraft), null);
  assert.equal(storage.getItem("corrupt"), null);
});

test("storage failures never break the form", () => {
  const broken = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };

  assert.equal(writeLocalDraft(broken, "draft", { notes: "x" }), false);
  assert.equal(readLocalDraft(broken, "draft", isDraft), null);
  assert.doesNotThrow(() => removeLocalDraft(broken, "draft"));
});
