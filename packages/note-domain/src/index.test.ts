import assert from "node:assert/strict";
import test from "node:test";
import { canAccessShare, convertNoteContent, formatNoteForPreview } from "./index";

test("markdown converts to html and keeps structure", () => {
  const markdown = "**Title**\n\n- one\n- two";
  const html = convertNoteContent(markdown, "markdown", "html");

  assert.match(html, /<strong>Title<\/strong>/);
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
});

test("html converts back to markdown", () => {
  const html = "<p>Hello <strong>world</strong></p><ul><li>one</li><li>two</li></ul>";
  const markdown = convertNoteContent(html, "html", "markdown");

  assert.match(markdown, /Hello \*\*world\*\*/);
  assert.match(markdown, /- one/);
  assert.match(markdown, /- two/);
});

test("rtf roundtrip produces readable markdown", () => {
  const markdown = "Alpha\n\nBeta";
  const rtf = convertNoteContent(markdown, "markdown", "rtf");
  const backToMarkdown = convertNoteContent(rtf, "rtf", "markdown");

  assert.match(rtf, /\\rtf1/);
  assert.match(backToMarkdown, /Alpha/);
  assert.match(backToMarkdown, /Beta/);
});

test("share access policy blocks expired and exhausted shares", () => {
  const expired = canAccessShare(
    {
      passwordProtected: true,
      expiresAt: "2024-01-01T00:00:00.000Z"
    },
    0,
    new Date("2026-01-01T00:00:00.000Z")
  );
  const exhausted = canAccessShare(
    {
      passwordProtected: true,
      maxViews: 1
    },
    1
  );
  const preview = formatNoteForPreview("**Hi**", "markdown");

  assert.equal(expired.allowed, false);
  assert.equal(expired.reason, "share-expired");
  assert.equal(exhausted.allowed, false);
  assert.equal(exhausted.reason, "share-view-limit-reached");
  assert.match(preview, /<strong>Hi<\/strong>/);
});
