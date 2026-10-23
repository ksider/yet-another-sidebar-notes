import '../styles/main.scss';
import { StorageService } from '../services/storage/storage';
import type { Draft, Note, Theme } from '../services/storage/types';

const store = new StorageService();
const app = document.querySelector<HTMLElement>('#app')!;
let currentTab: 'editor' | 'archive' | 'settings' = 'editor';
let notes: Note[] = [];
let draft: Draft = { content: '' };
let theme: Theme = 'system';
let search = '';
let saveTimer: number | undefined;
let undoTimer: number | undefined;
let searchFrame: number | undefined;
let deletedNote: Note | null = null;

const titleFor = (content: string) => content.split(/\r?\n/).find((line) => line.trim())?.trim().slice(0, 90) || 'Untitled note';
const previewFor = (content: string) => content.replace(/\s+/g, ' ').trim().slice(0, 130);
const icon = (name: 'archive' | 'settings' | 'more' | 'copy' | 'edit' | 'trash' | 'back' | 'book' | 'check' | 'search' | 'download' | 'upload') => ({
  archive: '<path d="M3 5h18M5 5l1 15h12l1-15M9 9h6"/><path d="M10 13h4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.1 2.1-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V20h-3v-.08A1.7 1.7 0 0 0 10.7 18.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.1-2.1.06-.06A1.7 1.7 0 0 0 7.06 15 1.7 1.7 0 0 0 5.5 14H5v-3h.5a1.7 1.7 0 0 0 1.56-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.1-2.1.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 11.73 4.8V4h3v.8a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.1 2.1-.06.06A1.7 1.7 0 0 0 19.4 10 1.7 1.7 0 0 0 21 11v3a1.7 1.7 0 0 0-1.6 1Z"/>',
  more: '<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="1"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  edit: '<path d="m4 20 4.3-1 10.9-10.9a2.1 2.1 0 0 0-3-3L5.3 16 4 20Z"/><path d="m14.7 6.7 3 3"/>',
  trash: '<path d="M4 7h16M10 11v5M14 11v5M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M8.5 7.5H16M8.5 11H14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3"/>',
  upload: '<path d="M12 16V4m-4 4 4-4 4 4M4 17v3h16v-3"/>'
}[name]);
const svg = (name: Parameters<typeof icon>[0]) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icon(name)}</svg>`;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));

function relativeDate(value: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}d`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function applyTheme(): void {
  document.documentElement.dataset.theme = theme;
}

function shell(content: string): string {
  return `<section class="app-shell">
    <header class="topbar">
      <span class="brand">${svg('book')}<span>Notes</span></span>
      <div class="top-actions"><span class="local-label"><i></i>Локально</span><button class="icon-button" data-action="settings" aria-label="Настройки">${svg('settings')}</button></div>
    </header>
    <nav class="tabs" aria-label="Разделы" role="tablist">
      <button class="tab ${currentTab === 'editor' ? 'is-active' : ''}" data-tab="editor" role="tab" aria-selected="${currentTab === 'editor'}">Новая запись</button>
      <button class="tab ${currentTab === 'archive' ? 'is-active' : ''}" data-tab="archive" role="tab" aria-selected="${currentTab === 'archive'}">Архив${notes.length ? `<span class="count">${notes.length}</span>` : ''}</button>
    </nav>${content}</section>`;
}

function render(): void {
  if (currentTab === 'editor') renderEditor();
  else if (currentTab === 'archive') renderArchive();
  else renderSettings();
}

function renderEditor(): void {
  const isEditing = !!draft.editingId;
  app.innerHTML = shell(`<section class="panel editor-view">
    ${isEditing ? '<div class="editing-strip"><span>Редактирование записи</span><button data-action="back-to-archive">К архиву</button></div>' : ''}
    <textarea id="editor" aria-label="${isEditing ? 'Текст архивной заметки' : 'Новая заметка'}" spellcheck="true" placeholder="Начните писать…">${escapeHtml(draft.content)}</textarea>
    <footer class="editor-footer"><span id="save-status">${svg('check')}<span>${draft.content ? 'Черновик сохранён' : 'Локальный черновик'}</span></span>
      <div class="editor-actions"><div class="format-tools" aria-label="Разметка"><button data-format="bold" title="Жирный (Ctrl/Cmd+B)" aria-label="Жирный"><strong>B</strong></button><button data-format="italic" title="Курсив (Ctrl/Cmd+I)" aria-label="Курсив"><em>I</em></button><button data-format="list" title="Маркированный список" aria-label="Маркированный список">•≡</button></div>
      ${isEditing ? '<span class="edit-updated">Сохраняется автоматически</span>' : `<button class="archive-button" data-action="archive" ${!draft.content.trim() ? 'disabled' : ''}>${svg('archive')} В архив</button>`}</div>
    </footer>
  </section>`);
  bindShell();
  const editor = document.querySelector<HTMLTextAreaElement>('#editor')!;
  editor.addEventListener('input', () => {
    draft.content = editor.value;
    if (draft.editingId) {
      const index = notes.findIndex((note) => note.id === draft.editingId);
      if (index !== -1) notes[index] = { ...notes[index], content: draft.content, updatedAt: new Date().toISOString() };
    }
    const archive = document.querySelector<HTMLButtonElement>('[data-action="archive"]');
    if (archive) archive.disabled = !draft.content.trim();
    document.querySelector('#save-status')!.innerHTML = `${svg('check')}<span>Сохранение…</span>`;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(async () => {
      await store.saveDraft(draft);
      const status = document.querySelector('#save-status');
      if (status) status.innerHTML = `${svg('check')}<span>Изменения сохранены</span>`;
    }, 350);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-format]').forEach((button) => {
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => applyFormat(editor, button.dataset.format as 'bold' | 'italic' | 'list'));
  });
  editor.addEventListener('keydown', (event) => {
    if (!(event.metaKey || event.ctrlKey)) return;
    if (event.key.toLowerCase() === 'b') { event.preventDefault(); applyFormat(editor, 'bold'); }
    if (event.key.toLowerCase() === 'i') { event.preventDefault(); applyFormat(editor, 'italic'); }
  });
  requestAnimationFrame(() => editor.focus());
}

function applyFormat(editor: HTMLTextAreaElement, format: 'bold' | 'italic' | 'list'): void {
  const value = editor.value;
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  let replacement = '';
  let replacementStart = 0;
  let replacementEnd = 0;
  if (format === 'list') {
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const nextBreak = value.indexOf('\n', end);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const lines = value.slice(lineStart, lineEnd).split('\n');
    replacement = lines.map((line) => line.startsWith('- ') ? line.slice(2) : `- ${line}`).join('\n');
    replacementStart = lineStart;
    replacementEnd = lineStart + replacement.length;
  } else {
    const marker = format === 'bold' ? '**' : '*';
    const selected = value.slice(start, end) || (format === 'bold' ? 'жирный текст' : 'курсив');
    replacement = `${marker}${selected}${marker}`;
    replacementStart = start + marker.length;
    replacementEnd = replacementStart + selected.length;
  }
  const replaceStart = format === 'list' ? value.lastIndexOf('\n', start - 1) + 1 : start;
  const replaceEnd = format === 'list' ? (value.indexOf('\n', end) === -1 ? value.length : value.indexOf('\n', end)) : end;
  editor.value = `${value.slice(0, replaceStart)}${replacement}${value.slice(replaceEnd)}`;
  editor.setSelectionRange(replacementStart, replacementEnd);
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  editor.focus();
}

function renderArchive(): void {
  const filtered = notes.filter((note) => `${titleFor(note.content)} ${note.content}`.toLowerCase().includes(search.toLowerCase()));
  app.innerHTML = shell(`<section class="panel archive-view">
    <div class="archive-search-area"><label class="search">${svg('search')}<input id="search" value="${escapeHtml(search)}" placeholder="Поиск по записям" aria-label="Поиск по записям" /></label></div>
    <div class="list-head"><span>${filtered.length} ${pluralNotes(filtered.length)}</span><span>Сначала новые</span></div>
    <div class="notes-list" aria-live="polite">${filtered.length ? filtered.map(noteRow).join('') : `<div class="empty"><strong>${notes.length ? 'Ничего не найдено' : 'Архив пуст'}</strong><span>${notes.length ? 'Попробуйте изменить запрос.' : 'Создайте заметку и отправьте её в архив.'}</span></div>`}</div>
  </section>`);
  bindShell();
  document.querySelector<HTMLInputElement>('#search')!.addEventListener('input', (event) => {
    search = (event.target as HTMLInputElement).value;
    if (searchFrame !== undefined) window.cancelAnimationFrame(searchFrame);
    searchFrame = window.requestAnimationFrame(() => { renderArchive(); document.querySelector<HTMLInputElement>('#search')!.focus(); });
  });
  // One delegated handler stays constant even for a large archive.
  document.querySelector('.notes-list')?.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const menuButton = target.closest<HTMLButtonElement>('[data-menu]');
    if (menuButton) {
      event.stopPropagation(); document.querySelectorAll('.context-menu').forEach((menu) => menu.remove());
      const id = menuButton.dataset.menu!;
      menuButton.insertAdjacentHTML('afterend', `<div class="context-menu" role="menu"><button data-note-action="edit" data-id="${id}">${svg('edit')} Редактировать</button><button data-note-action="copy" data-id="${id}">${svg('copy')} Копировать</button><button data-note-action="delete" data-id="${id}" class="danger">${svg('trash')} Удалить</button></div>`);
      bindMenu(); return;
    }
    if (target.closest('button')) return;
    const row = target.closest<HTMLElement>('[data-note-id]');
    const note = row && getNote(row.dataset.noteId!); if (!note) return;
    await store.edit(note); draft = { content: note.content, editingId: note.id }; currentTab = 'editor'; render();
  });
}

function noteRow(note: Note): string {
  return `<article class="note-row" data-note-id="${note.id}" tabindex="0"><div class="note-copy"><strong>${escapeHtml(titleFor(note.content))}</strong><p>${escapeHtml(previewFor(note.content))}</p></div><time title="${new Date(note.updatedAt).toLocaleString()}">${relativeDate(note.updatedAt)}</time><button class="icon-button more" data-menu="${note.id}" aria-label="Note actions">${svg('more')}</button></article>`;
}

function pluralNotes(count: number): string {
  const remainder = count % 10; const hundred = count % 100;
  if (remainder === 1 && hundred !== 11) return 'запись';
  if (remainder >= 2 && remainder <= 4 && (hundred < 12 || hundred > 14)) return 'записи';
  return 'записей';
}

function renderSettings(): void {
  app.innerHTML = shell(`<section class="panel settings-view"><div class="view-heading"><button class="icon-button" data-action="close-settings" aria-label="Назад">${svg('back')}</button><h1>Настройки</h1></div>
    <div class="setting-section"><span class="setting-label">Тема оформления</span><div class="choice-list" role="group" aria-label="Тема оформления"><button data-theme-choice="system" class="choice">Системная</button><button data-theme-choice="light" class="choice">Светлая</button><button data-theme-choice="dark" class="choice">Тёмная</button></div></div>
    <div class="setting-section"><span class="setting-label">Резервное копирование</span><div class="settings-actions"><button class="secondary-button" data-action="export">${svg('download')} Экспорт JSON</button><label class="secondary-button file-button">${svg('upload')} Импорт JSON<input id="import" type="file" accept="application/json,.json" /></label></div>
    <p id="settings-message" class="helper">Заметки сохраняются локально в браузере.</p></div>
  </section>`);
  bindShell();
  document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
    button.addEventListener('click', async () => { theme = button.dataset.themeChoice as Theme; applyTheme(); await store.setTheme(theme); renderSettings(); });
  });
  document.querySelector('[data-action="export"]')!.addEventListener('click', exportNotes);
  document.querySelector<HTMLInputElement>('#import')!.addEventListener('change', importNotes);
}

function bindShell(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => button.addEventListener('click', () => { currentTab = button.dataset.tab as 'editor' | 'archive'; render(); }));
  document.querySelector('[data-action="settings"]')?.addEventListener('click', () => { currentTab = 'settings'; render(); });
  document.querySelector('[data-action="close-settings"]')?.addEventListener('click', () => { currentTab = 'editor'; render(); });
  document.querySelector('[data-action="back-to-archive"]')?.addEventListener('click', async () => { window.clearTimeout(saveTimer); await store.saveDraft(draft); draft = { content: '' }; await store.saveDraft(draft); currentTab = 'archive'; render(); });
  document.querySelector('[data-action="archive"]')?.addEventListener('click', archiveCurrent);
}

function bindMenu(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-note-action]').forEach((button) => button.addEventListener('click', async () => {
    const note = getNote(button.dataset.id!); if (!note) return;
    if (button.dataset.noteAction === 'edit') { await store.edit(note); draft = { content: note.content, editingId: note.id }; currentTab = 'editor'; render(); }
    if (button.dataset.noteAction === 'copy') { await navigator.clipboard.writeText(note.content); document.querySelector('.context-menu')?.remove(); }
    if (button.dataset.noteAction === 'delete') await deleteNote(note);
  }));
}

async function archiveCurrent(): Promise<void> {
  window.clearTimeout(saveTimer);
  const saved = await store.archiveDraft();
  if (!saved) return;
  notes = (await store.getState()).notes;
  draft = { content: '' }; currentTab = 'editor'; render();
}

async function deleteNote(note: Note): Promise<void> {
  await store.delete(note.id); notes = notes.filter((item) => item.id !== note.id); deletedNote = note;
  window.clearTimeout(undoTimer); renderArchive();
  app.insertAdjacentHTML('beforeend', `<div class="toast">Запись удалена <button data-action="undo">Отменить</button></div>`);
  document.querySelector('[data-action="undo"]')?.addEventListener('click', async () => { if (deletedNote) { await store.restore(deletedNote); notes.unshift(deletedNote); deletedNote = null; renderArchive(); } });
  undoTimer = window.setTimeout(() => { deletedNote = null; document.querySelector('.toast')?.remove(); }, 5000);
}

async function exportNotes(): Promise<void> {
  const blob = new Blob([await store.exportJson()], { type: 'application/json' });
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `sidebar-notes-${new Date().toISOString().slice(0, 10)}.json` });
  link.click(); URL.revokeObjectURL(link.href);
}

async function importNotes(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
  const message = document.querySelector('#settings-message')!;
  try { const result = await store.importJson(await file.text()); notes = (await store.getState()).notes; message.textContent = `Imported ${result.added}; skipped ${result.skipped} duplicate${result.skipped === 1 ? '' : 's'}.`; }
  catch (error) { message.textContent = error instanceof Error ? error.message : 'Import failed.'; }
  input.value = '';
}

function getNote(id: string): Note | undefined { return notes.find((note) => note.id === id); }

async function init(): Promise<void> {
  const state = await store.getState(); notes = state.notes; draft = state.draft; theme = state.settings.theme; applyTheme(); render();
}

// A pending debounce should not make a fast panel close lose the latest keystrokes.
window.addEventListener('pagehide', () => { void store.saveDraft(draft); });
void init();
