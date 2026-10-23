import type { Draft, ImportResult, Note, NotesState, Theme } from './types';
import { STORAGE_VERSION } from './types';

const LEGACY_KEY = 'sidebar-notes';
const VERSION_KEY = 'sidebar-notes:version';
const NOTES_KEY = 'sidebar-notes:notes';
const DRAFT_KEY = 'sidebar-notes:draft';
const SETTINGS_KEY = 'sidebar-notes:settings';

const initialState = (): NotesState => ({ version: STORAGE_VERSION, notes: [], draft: { content: '' }, settings: { theme: 'system' } });

/** Persistent state boundary. Draft writes never serialize the whole archive. */
export class StorageService {
  private migration: Promise<void> | undefined;

  private async migrate(): Promise<void> {
    if (!this.migration) this.migration = this.performMigration();
    await this.migration;
  }

  private async performMigration(): Promise<void> {
    const stored = await chrome.storage.local.get([VERSION_KEY, LEGACY_KEY]);
    if (stored[VERSION_KEY] === STORAGE_VERSION) return;
    const legacy = normalizeState(stored[LEGACY_KEY]);
    await chrome.storage.local.set({ [VERSION_KEY]: STORAGE_VERSION, [NOTES_KEY]: legacy.notes, [DRAFT_KEY]: legacy.draft, [SETTINGS_KEY]: legacy.settings });
    // Avoid keeping an old, duplicate copy of a potentially large archive.
    await chrome.storage.local.remove(LEGACY_KEY);
  }

  private async readNotes(): Promise<Note[]> {
    await this.migrate();
    const stored = await chrome.storage.local.get(NOTES_KEY);
    return Array.isArray(stored[NOTES_KEY]) ? stored[NOTES_KEY].filter(isValidNote) : [];
  }

  async getState(): Promise<NotesState> {
    await this.migrate();
    const stored = await chrome.storage.local.get([NOTES_KEY, DRAFT_KEY, SETTINGS_KEY]);
    return {
      version: STORAGE_VERSION,
      notes: Array.isArray(stored[NOTES_KEY]) ? stored[NOTES_KEY].filter(isValidNote) : [],
      draft: isDraft(stored[DRAFT_KEY]) ? stored[DRAFT_KEY] : { content: '' },
      settings: { theme: isTheme(stored[SETTINGS_KEY]?.theme) ? stored[SETTINGS_KEY].theme : 'system' }
    };
  }

  async saveDraft(draft: Draft): Promise<void> {
    await this.migrate();
    if (!draft.editingId) { await chrome.storage.local.set({ [DRAFT_KEY]: draft }); return; }
    // Editing an archive item is less frequent; only then update the note list.
    const notes = await this.readNotes();
    const index = notes.findIndex((note) => note.id === draft.editingId);
    if (index !== -1) notes[index] = { ...notes[index], content: draft.content, updatedAt: new Date().toISOString() };
    await chrome.storage.local.set({ [NOTES_KEY]: notes, [DRAFT_KEY]: draft });
  }

  async archiveDraft(): Promise<Note | null> {
    await this.migrate();
    const stored = await chrome.storage.local.get(DRAFT_KEY);
    const draft = isDraft(stored[DRAFT_KEY]) ? stored[DRAFT_KEY] : { content: '' };
    const content = draft.content.trim();
    if (!content) return null;
    const notes = await this.readNotes();
    const now = new Date().toISOString();
    let note: Note;
    if (draft.editingId) {
      const index = notes.findIndex((item) => item.id === draft.editingId);
      if (index === -1) return null;
      note = { ...notes[index], content: draft.content, updatedAt: now };
      notes[index] = note;
    } else {
      note = { id: crypto.randomUUID(), content: draft.content, createdAt: now, updatedAt: now, archivedAt: now };
      notes.unshift(note);
    }
    await chrome.storage.local.set({ [NOTES_KEY]: notes, [DRAFT_KEY]: { content: '' } });
    return note;
  }

  async edit(note: Note): Promise<void> { await this.migrate(); await chrome.storage.local.set({ [DRAFT_KEY]: { content: note.content, editingId: note.id } }); }

  async delete(id: string): Promise<Note | null> {
    const notes = await this.readNotes();
    const note = notes.find((item) => item.id === id) ?? null;
    if (!note) return null;
    await chrome.storage.local.set({ [NOTES_KEY]: notes.filter((item) => item.id !== id) });
    return note;
  }

  async restore(note: Note): Promise<void> {
    const notes = await this.readNotes();
    if (!notes.some((item) => item.id === note.id)) await chrome.storage.local.set({ [NOTES_KEY]: [note, ...notes] });
  }

  async setTheme(theme: Theme): Promise<void> { await this.migrate(); await chrome.storage.local.set({ [SETTINGS_KEY]: { theme } }); }
  async exportJson(): Promise<string> { return JSON.stringify({ version: STORAGE_VERSION, notes: await this.readNotes() }, null, 2); }

  async importJson(raw: string): Promise<ImportResult> {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new Error('The file is not valid JSON.'); }
    const candidates = Array.isArray(parsed) ? parsed : (parsed as { notes?: unknown })?.notes;
    if (!Array.isArray(candidates)) throw new Error('Expected a notes array.');
    const valid = candidates.filter(isValidNote);
    if (!valid.length && candidates.length) throw new Error('The file contains no valid notes.');
    const notes = await this.readNotes();
    const known = new Set(notes.map((note) => note.id));
    const additions = valid.filter((note) => !known.has(note.id));
    await chrome.storage.local.set({ [NOTES_KEY]: [...notes, ...additions].sort((a, b) => b.archivedAt.localeCompare(a.archivedAt)) });
    return { added: additions.length, skipped: valid.length - additions.length };
  }
}

function normalizeState(value: unknown): NotesState {
  if (!value || typeof value !== 'object') return initialState();
  const legacy = value as Partial<NotesState>;
  return { version: STORAGE_VERSION, notes: Array.isArray(legacy.notes) ? legacy.notes.filter(isValidNote) : [], draft: isDraft(legacy.draft) ? legacy.draft : { content: '' }, settings: { theme: isTheme(legacy.settings?.theme) ? legacy.settings.theme : 'system' } };
}
function isTheme(value: unknown): value is Theme { return value === 'system' || value === 'light' || value === 'dark'; }
function isDraft(value: unknown): value is Draft { return !!value && typeof value === 'object' && typeof (value as Draft).content === 'string'; }
function isValidNote(value: unknown): value is Note {
  if (!value || typeof value !== 'object') return false;
  const note = value as Note;
  return ['id', 'content', 'createdAt', 'updatedAt', 'archivedAt'].every((key) => typeof note[key as keyof Note] === 'string');
}
