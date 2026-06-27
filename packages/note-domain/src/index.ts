import type {
  CreateNoteInput,
  NoteDraft,
  NoteFormat,
  NoteRecord,
  NoteSummary,
  SharePolicy,
  SyncState,
  UpdateNoteInput
} from "@notesync/shared-types";

function createExcerpt(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 96);
}

function normalizeTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : "Untitled note";
}

export function createEmptyDraft(format: NoteFormat = "markdown"): NoteDraft {
  return {
    title: "",
    content: "",
    format
  };
}

export function buildCreateNoteInput(
  encryptedContent: CreateNoteInput["encryptedContent"],
  draft: NoteDraft,
  syncEnabled = false
): CreateNoteInput {
  return {
    title: normalizeTitle(draft.title),
    format: draft.format,
    encryptedContent,
    syncEnabled
  };
}

export function applyNoteUpdate(
  note: NoteRecord,
  input: UpdateNoteInput
): NoteRecord {
  return {
    ...note,
    title: input.title ? normalizeTitle(input.title) : note.title,
    format: input.format ?? note.format,
    encryptedContent: input.encryptedContent ?? note.encryptedContent,
    status: input.status ?? note.status,
    updatedAt: new Date().toISOString(),
    syncState: nextSyncState(note.syncState, input.syncEnabled ?? note.syncEnabled),
    syncEnabled: input.syncEnabled ?? note.syncEnabled
  };
}

function nextSyncState(current: SyncState, syncEnabled: boolean): SyncState {
  if (!syncEnabled) {
    return "local-only";
  }

  if (current === "local-only") {
    return "pending-sync";
  }

  return "pending-sync";
}

export function toNoteSummary(
  note: NoteRecord,
  decryptedContent: string
): NoteSummary {
  return {
    id: note.id,
    title: normalizeTitle(note.title),
    excerpt: createExcerpt(decryptedContent),
    format: note.format,
    updatedAt: note.updatedAt,
    syncState: note.syncState,
    syncEnabled: note.syncEnabled,
    encrypted: true
  };
}

export function canAccessShare(
  policy: SharePolicy,
  currentViews: number,
  now: Date = new Date()
): { allowed: boolean; reason?: string } {
  if (policy.expiresAt && new Date(policy.expiresAt).getTime() <= now.getTime()) {
    return { allowed: false, reason: "share-expired" };
  }

  if (typeof policy.maxViews === "number" && currentViews >= policy.maxViews) {
    return { allowed: false, reason: "share-view-limit-reached" };
  }

  return { allowed: true };
}

export function sortNotesByUpdatedAt(notes: NoteSummary[]): NoteSummary[] {
  return [...notes].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

export function convertNoteContent(
  content: string,
  from: NoteFormat,
  to: NoteFormat
): string {
  if (from === to) {
    return content;
  }

  const markdown = toMarkdown(content, from);
  if (to === "markdown") {
    return markdown;
  }

  if (to === "html") {
    return markdownToHtml(markdown);
  }

  return markdownToRtf(markdown);
}

export function formatNoteForPreview(content: string, format: NoteFormat): string {
  if (format === "html") {
    return markdownToHtml(toMarkdown(content, "html"));
  }

  if (format === "rtf") {
    return markdownToHtml(toMarkdown(content, "rtf"));
  }

  return markdownToHtml(content);
}

function toMarkdown(content: string, format: NoteFormat): string {
  if (format === "markdown") {
    return content;
  }

  if (format === "html") {
    return htmlToMarkdown(content);
  }

  return rtfToMarkdown(content);
}

function markdownToHtml(markdown: string): string {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const withInline = escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");

  return withInline
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) {
        return "";
      }

      if (trimmed.startsWith("- ")) {
        const items = trimmed
          .split("\n")
          .map((line) => line.replace(/^- /, "").trim())
          .map((line) => `<li>${line}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }

      return `<p>${trimmed.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");
}

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<em>(.*?)<\/em>/gi, "*$1*")
    .replace(/<code>(.*?)<\/code>/gi, "`$1`")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function markdownToRtf(markdown: string): string {
  const plainText = markdown
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1");

  const escaped = plainText
    .replace(/\\/g, "\\\\")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/\n/g, "\\par\n");

  return `{\\rtf1\\ansi\\deff0\n${escaped}\n}`;
}

function rtfToMarkdown(rtf: string): string {
  return rtf
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\'[0-9a-fA-F]{2}/g, "")
    .replace(/\\[a-z]+\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
