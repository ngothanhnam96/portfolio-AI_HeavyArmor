import test from "node:test";
import assert from "node:assert/strict";
import { esc } from "../src/core/text.js";

test("esc neutralises all five html-sensitive characters", () => {
  assert.equal(esc(`<b class="x">hello & 'you'</b>`), "&lt;b class=&quot;x&quot;&gt;hello &amp; &#39;you&#39;&lt;/b&gt;");
  assert.equal(esc(null), "");
  assert.equal(esc(undefined), "");
  assert.equal(esc(123), "123");
});
