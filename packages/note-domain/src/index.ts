import type { NoteFormat } from "@notesync/shared-types";

export interface NoteEntity {
  id: string;
  title: string;
  content: string;
  format: NoteFormat;
  encrypted: boolean;
}
