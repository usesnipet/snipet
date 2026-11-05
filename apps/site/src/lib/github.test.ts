import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { loadStars } from "./github.ts";

test("hits GitHub once per window and keeps the last good value when it fails", async () => {
  mock.timers.enable({ apis: ["Date"] });
  let response = new Response(JSON.stringify({ stargazers_count: 5 }));
  const fetchMock = mock.method(globalThis, "fetch", async () => response);

  assert.deepEqual(await Promise.all([loadStars(), loadStars()]), [5, 5]);
  assert.equal(fetchMock.mock.callCount(), 1);

  mock.timers.tick(15 * 60 * 1000);
  response = new Response(null, { status: 429 });
  assert.equal(await loadStars(), 5);
  assert.equal(await loadStars(), 5);
  assert.equal(fetchMock.mock.callCount(), 2);
});
