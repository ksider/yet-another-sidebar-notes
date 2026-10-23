import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from './storage';

let data: Record<string, unknown> = {};
vi.stubGlobal('chrome', { storage: { local: {
  get: vi.fn(async (keys: string | string[]) => Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map((key) => [key, data[key]]))),
  set: vi.fn(async (value: Record<string, unknown>) => { data = { ...data, ...value }; }),
  remove: vi.fn(async (key: string) => { delete data[key]; })
} } });
vi.stubGlobal('crypto', { randomUUID: () => 'note-1' });

describe('StorageService', () => {
  beforeEach(() => { data = {}; vi.clearAllMocks(); });
  it('restores a saved draft', async () => { const storage = new StorageService(); await storage.saveDraft({ content: 'Unfinished thought' }); expect((await storage.getState()).draft.content).toBe('Unfinished thought'); });
  it('migrates the legacy monolithic record once', async () => { data['sidebar-notes'] = { version: 1, notes: [{ id: 'legacy', content: 'Old', createdAt: '2026-01-01', updatedAt: '2026-01-01', archivedAt: '2026-01-01' }], draft: { content: 'Draft' }, settings: { theme: 'dark' } }; const state = await new StorageService().getState(); expect(state.notes[0].id).toBe('legacy'); expect(state.draft.content).toBe('Draft'); expect(data['sidebar-notes']).toBeUndefined(); });
  it('archives a draft and edits it without duplication', async () => { const storage = new StorageService(); await storage.saveDraft({ content: 'First line\nbody' }); const note = await storage.archiveDraft(); expect(note?.id).toBe('note-1'); await storage.edit(note!); await storage.saveDraft({ content: 'Changed', editingId: note!.id }); await storage.archiveDraft(); const state = await storage.getState(); expect(state.notes).toHaveLength(1); expect(state.notes[0].content).toBe('Changed'); });
  it('validates imports and deduplicates IDs', async () => { const storage = new StorageService(); await expect(storage.importJson('{bad')).rejects.toThrow('valid JSON'); const payload = JSON.stringify({ notes: [{ id: 'a', content: 'Saved', createdAt: '2026-01-01', updatedAt: '2026-01-01', archivedAt: '2026-01-01' }] }); expect(await storage.importJson(payload)).toEqual({ added: 1, skipped: 0 }); expect(await storage.importJson(payload)).toEqual({ added: 0, skipped: 1 }); });
});
