import { test } from "node:test";
import assert from "node:assert/strict";
import { parseUnsubHeaders } from "../flows/unsubscribe.js";

function mkMsg(headers: { name: string; value: string }[]) {
  return { payload: { headers } } as Parameters<typeof parseUnsubHeaders>[0];
}

test("parseUnsubHeaders extracts one-click URL when RFC 8058 advertised", () => {
  const info = parseUnsubHeaders(
    mkMsg([
      { name: "List-Unsubscribe", value: "<https://x.example/u/123>, <mailto:u@x.example>" },
      { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" },
    ]),
  );
  assert.equal(info.oneClickUrl, "https://x.example/u/123");
  assert.equal(info.mailtoUrl, "mailto:u@x.example");
});

test("parseUnsubHeaders returns mailto-only when Post header absent", () => {
  const info = parseUnsubHeaders(
    mkMsg([{ name: "List-Unsubscribe", value: "<mailto:u@x.example>" }]),
  );
  assert.equal(info.oneClickUrl, undefined);
  assert.equal(info.mailtoUrl, "mailto:u@x.example");
});

test("parseUnsubHeaders returns empty when no List-Unsubscribe header", () => {
  const info = parseUnsubHeaders(mkMsg([]));
  assert.deepEqual(info, {});
});

test("parseUnsubHeaders is case-insensitive on header name", () => {
  const info = parseUnsubHeaders(
    mkMsg([
      { name: "list-unsubscribe", value: "<https://x.example/u/9>" },
      { name: "list-unsubscribe-post", value: "List-Unsubscribe=one-click" },
    ]),
  );
  assert.equal(info.oneClickUrl, "https://x.example/u/9");
});
