import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRawReply,
  normalizeMessageId,
  rePrefix,
  parseAddress,
} from "../google/gmail.js";

test("normalizeMessageId wraps bare ids", () => {
  assert.equal(normalizeMessageId("abc@example.com"), "<abc@example.com>");
  assert.equal(normalizeMessageId("<abc@example.com>"), "<abc@example.com>");
  assert.equal(normalizeMessageId(""), "");
  assert.equal(normalizeMessageId("  <x@y>  "), "<x@y>");
});

test("rePrefix dedups Re: chains case-insensitively", () => {
  assert.equal(rePrefix("Hello"), "Re: Hello");
  assert.equal(rePrefix("Re: Hello"), "Re: Hello");
  assert.equal(rePrefix("RE: Hello"), "Re: Hello");
  assert.equal(rePrefix("re:Hello"), "Re: Hello");
  assert.equal(rePrefix("Fwd: Hello"), "Re: Hello");
  assert.equal(rePrefix("FW: Hello"), "Re: Hello");
});

test("parseAddress handles common forms", () => {
  assert.deepEqual(parseAddress('"Nick" <nick@example.com>'), { name: "Nick", email: "nick@example.com" });
  assert.deepEqual(parseAddress("Nick <nick@example.com>"), { name: "Nick", email: "nick@example.com" });
  assert.deepEqual(parseAddress("nick@example.com"), { email: "nick@example.com" });
  assert.deepEqual(parseAddress("<nick@example.com>"), { email: "nick@example.com" });
  assert.equal(parseAddress(""), null);
  assert.equal(parseAddress(undefined), null);
});

test("buildRawReply produces correct threading headers", () => {
  const raw = buildRawReply({
    threadId: "t1",
    to: { name: "Guest", email: "g@x.com" },
    subject: "Re: Tour",
    inReplyTo: "abc@mail.x.com", // no brackets — must be wrapped
    references: "<earlier@mail.x.com>",
    from: { name: "Nick", email: "nick@example.com" },
    bodyText: "hi",
  });
  assert.match(raw, /^From: Nick <nick@example\.com>\r\n/);
  assert.match(raw, /To: Guest <g@x\.com>/);
  assert.match(raw, /Subject: Re: Tour\r\n/); // no double Re:
  assert.match(raw, /In-Reply-To: <abc@mail\.x\.com>/); // wrapped
  assert.match(raw, /References: <earlier@mail\.x\.com> <abc@mail\.x\.com>/);
  assert.match(raw, /\r\n\r\nhi$/);
});

test("buildRawReply RFC 2047 encodes non-ASCII subject", () => {
  const raw = buildRawReply({
    threadId: "t1",
    to: { email: "g@x.com" },
    subject: "Café — schedule?",
    inReplyTo: "<abc@x>",
    references: "",
    from: { email: "nick@example.com" },
    bodyText: "hi",
  });
  assert.match(raw, /Subject: =\?UTF-8\?B\?[^?]+\?=/);
});

test("buildRawReply RFC 2047 encodes non-ASCII display names", () => {
  const raw = buildRawReply({
    threadId: "t1",
    to: { name: "Mëlanië", email: "m@x.com" },
    subject: "Hi",
    inReplyTo: "<abc@x>",
    references: "",
    from: { email: "nick@example.com" },
    bodyText: "hi",
  });
  assert.match(raw, /To: =\?UTF-8\?B\?[^?]+\?= <m@x\.com>/);
});

test("buildRawReply formats Cc with structured addresses", () => {
  const raw = buildRawReply({
    threadId: "t1",
    to: { email: "g@x.com" },
    cc: [
      { name: "Smith, John", email: "j@x.com" },
      { name: "Mëlanië", email: "m@x.com" },
    ],
    subject: "Hi",
    inReplyTo: "<abc@x>",
    references: "",
    from: { email: "nick@example.com" },
    bodyText: "hi",
  });
  assert.match(raw, /Cc: "Smith, John" <j@x\.com>, =\?UTF-8\?B\?[^?]+\?= <m@x\.com>/);
});

test("buildRawReply omits Cc header when none provided", () => {
  const raw = buildRawReply({
    threadId: "t1",
    to: { email: "g@x.com" },
    subject: "Hi",
    inReplyTo: "<abc@x>",
    references: "",
    from: { email: "nick@example.com" },
    bodyText: "hi",
  });
  assert.doesNotMatch(raw, /^Cc:/m);
});

test("buildRawReply quotes names with commas/angle brackets", () => {
  const raw = buildRawReply({
    threadId: "t1",
    to: { name: "Smith, John", email: "j@x.com" },
    subject: "Hi",
    inReplyTo: "<abc@x>",
    references: "",
    from: { email: "nick@example.com" },
    bodyText: "hi",
  });
  assert.match(raw, /To: "Smith, John" <j@x\.com>/);
});
