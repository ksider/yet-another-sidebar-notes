export const STORAGE_VERSION = 2;

export type Theme = 'system' | 'light' | 'dark';

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string;
  sourceUrl?: string;
}

export interface Draft {
  content: string;
  /** An archived note being edited; undefined means a fresh, unarchived draft. */
  editingId?: string;
}

export interface NotesState {
  version: number;
  notes: Note[];
  draft: Draft;
  settings: { theme: Theme };
}

export type ImportResult = { added: number; skipped: number };
