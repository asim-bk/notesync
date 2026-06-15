function createExcerpt(content) {
    return content.replace(/\s+/g, " ").trim().slice(0, 96);
}
function normalizeTitle(title) {
    const trimmed = title.trim();
    return trimmed.length > 0 ? trimmed : "Untitled note";
}
export function createEmptyDraft(format = "markdown") {
    return {
        title: "",
        content: "",
        format
    };
}
export function buildCreateNoteInput(encryptedContent, draft) {
    return {
        title: normalizeTitle(draft.title),
        format: draft.format,
        encryptedContent
    };
}
export function applyNoteUpdate(note, input) {
    return {
        ...note,
        title: input.title ? normalizeTitle(input.title) : note.title,
        format: input.format ?? note.format,
        encryptedContent: input.encryptedContent ?? note.encryptedContent,
        status: input.status ?? note.status,
        updatedAt: new Date().toISOString(),
        syncState: nextSyncState(note.syncState)
    };
}
function nextSyncState(current) {
    if (current === "local-only") {
        return "local-only";
    }
    return "pending-sync";
}
export function toNoteSummary(note, decryptedContent) {
    return {
        id: note.id,
        title: normalizeTitle(note.title),
        excerpt: createExcerpt(decryptedContent),
        format: note.format,
        updatedAt: note.updatedAt,
        syncState: note.syncState,
        encrypted: true
    };
}
export function canAccessShare(policy, currentViews, now = new Date()) {
    if (policy.expiresAt && new Date(policy.expiresAt).getTime() <= now.getTime()) {
        return { allowed: false, reason: "share-expired" };
    }
    if (typeof policy.maxViews === "number" && currentViews >= policy.maxViews) {
        return { allowed: false, reason: "share-view-limit-reached" };
    }
    return { allowed: true };
}
export function sortNotesByUpdatedAt(notes) {
    return [...notes].sort((left, right) => {
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
}
