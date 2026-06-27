import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { convertNoteContent, formatNoteForPreview } from "@notesync/note-domain";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Platform } from "react-native";
import type { NoteFormat } from "@notesync/shared-types";

export type ExportTarget = "markdown" | "html" | "rtf" | "pdf" | "docx";

interface ExportPayload {
  title: string;
  content: string;
  format: NoteFormat;
}

export async function exportNoteDocument(
  payload: ExportPayload,
  target: ExportTarget
): Promise<string> {
  const filenameBase = sanitizeFilename(payload.title || "notesync-note");

  if (target === "pdf") {
    const pdfBytes = await buildPdf(payload);
    const filename = `${filenameBase}.pdf`;
    await saveBinaryFile(filename, "application/pdf", pdfBytes);
    return filename;
  }

  if (target === "docx") {
    const docxBytes = await buildDocx(payload);
    const filename = `${filenameBase}.docx`;
    await saveBinaryFile(
      filename,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      docxBytes
    );
    return filename;
  }

  const extension = target === "markdown" ? "md" : target;
  const mimeType = target === "markdown"
    ? "text/markdown"
    : target === "html"
      ? "text/html"
      : "application/rtf";
  const content = serializeTextExport(payload, target);
  const filename = `${filenameBase}.${extension}`;
  await saveTextFile(filename, mimeType, content);
  return filename;
}

function serializeTextExport(payload: ExportPayload, target: "markdown" | "html" | "rtf"): string {
  if (target === "markdown") {
    return convertNoteContent(payload.content, payload.format, "markdown");
  }

  if (target === "html") {
    return wrapHtmlDocument(payload.title, formatNoteForPreview(payload.content, payload.format));
  }

  return convertNoteContent(payload.content, payload.format, "rtf");
}

async function buildPdf(payload: ExportPayload): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const lines = convertNoteContent(payload.content, payload.format, "markdown").split("\n");

  page.drawText(payload.title || "NoteSync note", {
    x: 48,
    y: 790,
    size: 20,
    font: titleFont,
    color: rgb(0.18, 0.16, 0.13)
  });

  let y = 760;
  for (const line of lines) {
    const text = line || " ";
    page.drawText(text, {
      x: 48,
      y,
      size: 11,
      font,
      color: rgb(0.22, 0.2, 0.17),
      maxWidth: 500
    });
    y -= 16;

    if (y < 60) {
      y = 780;
      const nextPage = pdf.addPage([595, 842]);
      nextPage.drawText(payload.title || "NoteSync note", {
        x: 48,
        y: 790,
        size: 20,
        font: titleFont,
        color: rgb(0.18, 0.16, 0.13)
      });
    }
  }

  return pdf.save();
}

async function buildDocx(payload: ExportPayload): Promise<Uint8Array> {
  const markdown = convertNoteContent(payload.content, payload.format, "markdown");
  const paragraphs = markdown.split(/\n{2,}/).map((block) => {
    return new Paragraph({
      children: [
        new TextRun({
          text: block.replace(/\n/g, "\n"),
          break: 0
        })
      ]
    });
  });

  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: payload.title || "NoteSync note",
            heading: "Title"
          }),
          ...paragraphs
        ]
      }
    ]
  });

  return new Uint8Array(await Packer.toArrayBuffer(document));
}

async function saveTextFile(filename: string, mimeType: string, content: string): Promise<void> {
  if (Platform.OS === "web") {
    downloadInBrowser(filename, mimeType, content);
    return;
  }

  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8
  });
  await shareNativeFile(uri, mimeType);
}

async function saveBinaryFile(
  filename: string,
  mimeType: string,
  bytes: Uint8Array
): Promise<void> {
  if (Platform.OS === "web") {
    downloadInBrowser(filename, mimeType, bytes);
    return;
  }

  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, uint8ToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64
  });
  await shareNativeFile(uri, mimeType);
}

async function shareNativeFile(uri: string, mimeType: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    return;
  }

  await Sharing.shareAsync(uri, {
    mimeType,
    dialogTitle: "Export note"
  });
}

function downloadInBrowser(
  filename: string,
  mimeType: string,
  content: string | Uint8Array
): void {
  const blobContent = typeof content === "string"
    ? content
    : new Uint8Array(content);
  const blob = new Blob([blobContent], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function wrapHtmlDocument(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title || "NoteSync note")}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 32px; color: #2e2921; }
      h1 { margin-bottom: 24px; }
      p, li { line-height: 1.6; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title || "NoteSync note")}</h1>
    ${body}
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitizeFilename(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "notesync-note";
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}
