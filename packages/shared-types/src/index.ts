export type NoteFormat = "markdown" | "html" | "rtf";

export interface NoteSummary {
  id: string;
  title: string;
  format: NoteFormat;
  updatedAt: string;
}
