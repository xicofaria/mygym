import assert from "node:assert/strict";
import test from "node:test";
import { deleteOwnedRecord } from "../../src/lib/owned-resource";

test("deletes a record only after confirming ownership", async () => {
  const calls: string[] = [];

  const result = await deleteOwnedRecord({
    id: 42,
    userId: 2,
    findOwnedId: async (id, userId) => {
      calls.push(`find:${id}:${userId}`);
      return id;
    },
    deleteOwned: async (id, userId) => {
      calls.push(`delete:${id}:${userId}`);
    },
  });

  assert.equal(result, "deleted");
  assert.deepEqual(calls, ["find:42:2", "delete:42:2"]);
});

test("does not delete a record owned by another user", async () => {
  let deleteCalled = false;

  const result = await deleteOwnedRecord({
    id: 42,
    userId: 2,
    findOwnedId: async () => null,
    deleteOwned: async () => {
      deleteCalled = true;
    },
  });

  assert.equal(result, "not-found");
  assert.equal(deleteCalled, false);
});

test("rejects invalid record ids before querying the database", async () => {
  for (const id of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    let queried = false;
    let deleteCalled = false;

    const result = await deleteOwnedRecord({
      id,
      userId: 2,
      findOwnedId: async () => {
        queried = true;
        return null;
      },
      deleteOwned: async () => {
        deleteCalled = true;
      },
    });

    assert.equal(result, "invalid-id");
    assert.equal(queried, false);
    assert.equal(deleteCalled, false);
  }
});

test("rejects an invalid authenticated user id", async () => {
  let queried = false;

  const result = await deleteOwnedRecord({
    id: 42,
    userId: 0,
    findOwnedId: async () => {
      queried = true;
      return 42;
    },
    deleteOwned: async () => undefined,
  });

  assert.equal(result, "invalid-id");
  assert.equal(queried, false);
});
