import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Use the real Supabase query builder, replacing only the external HTTP request.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://comment-counts.test";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase") {
      return nextResolve(new URL("../src/lib/supabase.js", import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const comments = await import("../src/lib/comments.ts");
hooks.deregister();

function serveComments(t, rows, responseLimit = 1000) {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    requests.push(url);
    assert.equal(url.pathname, "/rest/v1/comments");
    assert.equal(url.searchParams.get("select"), "recommendation_id");
    assert.equal(url.searchParams.get("deleted_at"), "is.null");
    assert.equal(url.searchParams.get("order"), "id.asc");
    const ids = url.searchParams.get("recommendation_id").slice(4, -1).split(",");
    const matching = rows.filter((row) => ids.includes(row.recommendation_id) && row.deleted_at === null);
    const offset = Number(url.searchParams.get("offset"));
    const limit = Math.min(Number(url.searchParams.get("limit")), responseLimit);
    const page = matching.slice(offset, offset + limit).map(({ recommendation_id }) => ({ recommendation_id }));
    return new Response(JSON.stringify(page), {
      headers: {
        "content-type": "application/json",
        "content-range": `${offset}-${offset + page.length - 1}/${matching.length}`,
      },
    });
  });
  return requests;
}

test("counts live roots and replies, including replies under deleted roots", async (t) => {
  assert.equal(typeof comments.loadCommentCounts, "function");
  const requests = serveComments(t, [
    { recommendation_id: "a", parent_id: null, deleted_at: null },
    { recommendation_id: "a", parent_id: "root-a", deleted_at: null },
    { recommendation_id: "a", parent_id: "root-a", deleted_at: null },
    { recommendation_id: "a", parent_id: "root-a", deleted_at: "2026-01-01" },
    { recommendation_id: "b", parent_id: null, deleted_at: "2026-01-01" },
    { recommendation_id: "b", parent_id: "root-b", deleted_at: null },
    { recommendation_id: "c", parent_id: null, deleted_at: "2026-01-01" },
    { recommendation_id: "other", parent_id: null, deleted_at: null },
  ]);
  assert.deepEqual(await comments.loadCommentCounts(["a", "b", "c", "d", "a"]), { a: 3, b: 1, c: 0, d: 0 });
  assert.equal(requests.length, 1);
});

test("reads past the response cap without dropping or duplicating comments", async (t) => {
  assert.equal(typeof comments.loadCommentCounts, "function");
  const requests = serveComments(t, Array.from({ length: 1005 }, () => ({ recommendation_id: "a", deleted_at: null })), 400);
  assert.deepEqual(await comments.loadCommentCounts(["a", "b"]), { a: 1005, b: 0 });
  assert.equal(requests.length, 3);
});

test("batches many recommendation IDs instead of issuing per-card queries", async (t) => {
  assert.equal(typeof comments.loadCommentCounts, "function");
  const ids = Array.from({ length: 205 }, (_, index) => `book-${index}`);
  const requests = serveComments(t, [
    { recommendation_id: "book-0", deleted_at: null },
    { recommendation_id: "book-204", deleted_at: null },
  ]);
  const counts = await comments.loadCommentCounts(ids);
  assert.equal(Object.keys(counts).length, 205);
  assert.equal(counts["book-0"], 1);
  assert.equal(counts["book-100"], 0);
  assert.equal(counts["book-204"], 1);
  assert.equal(requests.length, 3);
});

test("does not query an empty recommendation list", async (t) => {
  assert.equal(typeof comments.loadCommentCounts, "function");
  const requests = serveComments(t, []);
  assert.deepEqual(await comments.loadCommentCounts([]), {});
  assert.equal(requests.length, 0);
});

test("rejects failed queries instead of returning misleading zero counts", async (t) => {
  assert.equal(typeof comments.loadCommentCounts, "function");
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ message: "Unavailable", code: "42501" }), {
    status: 403,
    headers: { "content-type": "application/json" },
  }));
  await assert.rejects(comments.loadCommentCounts(["a"]), { message: "Unavailable" });
});
