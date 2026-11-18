import type { BookData, ProgressData } from '@libify/shared';
import { services } from '../shared/services';
import type { AppState, Book, ReadingProgress, UserSettings } from '../types';

/**
 * Library membership and progress live in the synced replica.
 * Rich per-device metadata (description, series, chapters cover) and settings stay in localStorage.
 */
const LOCAL_KEY = 'book-library-state';

interface LocalState {
  bookMetadata: Record<string, Book>;
  settings: UserSettings;
}

const defaultSettings: UserSettings = { fontSize: 18, brightness: 100, theme: 'dark' };
let cachedLocal: LocalState | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LOCAL_KEY) cachedLocal = null;
  });
}

function loadLocal(): LocalState {
  if (cachedLocal) return cachedLocal;
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}') as Partial<LocalState>;
    cachedLocal = { bookMetadata: parsed.bookMetadata ?? {}, settings: { ...defaultSettings, ...parsed.settings } };
  } catch {
    cachedLocal = { bookMetadata: {}, settings: { ...defaultSettings } };
  }
  return cachedLocal;
}

function saveLocal(state: LocalState): void {
  cachedLocal = state;
  try {
    // Keep unknown legacy fields (myBooks, readingProgress) out: they were imported into the replica.
    localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save local state', err);
  }
}

const notify = () => window.dispatchEvent(new Event('storage-update'));
const logSyncError = (err: unknown) => console.error('[storage] sync record failed', err);

/** Only remote URLs are synced; data:/blob: covers stay in the local book cache. */
export function syncableCoverUrl(cover: string | undefined): string | null {
  if (!cover || cover.startsWith('data:') || cover.startsWith('blob:') || cover.length > 2048) return null;
  return cover;
}

function toBookData(book: Book, addedAt: string): BookData {
  return {
    bookId: book.id,
    title: (book.title || 'Untitled').slice(0, 500),
    author: book.author ? book.author.slice(0, 300) : null,
    coverUrl: syncableCoverUrl(book.cover),
    status: 'reading',
    format: book.format === 'pdf' ? 'pdf' : 'fb2',
    addedAt,
  };
}

function bookFromData(data: BookData): Book {
  return {
    id: data.bookId,
    title: data.title,
    author: data.author ?? '',
    cover: data.coverUrl ?? '',
    description: '',
    genre: '',
    format: data.format === 'pdf' ? 'pdf' : 'fb2',
  };
}

function toReadingProgress(data: ProgressData, updatedAt: string): ReadingProgress {
  return {
    bookId: data.bookId,
    currentPage: data.currentPage,
    totalPages: data.totalPages,
    lastRead: Date.parse(updatedAt),
    scrollPercentage: Math.round(data.scrollRatio * 100),
  };
}

export function getMyBookIds(): string[] {
  return services()
    .replica.list('book')
    .sort((a, b) => a.data.addedAt.localeCompare(b.data.addedAt))
    .map((entry) => entry.key);
}

export function isInMyBooks(bookId: string): boolean {
  return services().replica.get('book', bookId) !== null;
}

export function getBookMetadata(bookId: string): Book | undefined {
  const local = loadLocal().bookMetadata[bookId];
  if (local) return local;
  const data = services().replica.get('book', bookId);
  return data ? bookFromData(data) : undefined;
}

export function addToMyBooks(book: Book): void {
  const local = loadLocal();
  const toStore = { ...book };
  if (toStore.cover?.startsWith('data:image')) toStore.cover = ''; // the cover lives in the IndexedDB book cache
  saveLocal({ ...local, bookMetadata: { ...local.bookMetadata, [book.id]: toStore } });

  const existing = services().replica.get('book', book.id);
  const next = toBookData(book, existing?.addedAt ?? new Date().toISOString());
  if (!existing || JSON.stringify(existing) !== JSON.stringify(next)) {
    services().sync.record('book', book.id, next).catch(logSyncError);
  }
  notify();
}

export function removeFromMyBooks(bookId: string): void {
  services().sync.record('book', bookId, null).catch(logSyncError);
}

export function getReadingProgress(bookId: string): ReadingProgress | null {
  const record = services().replica.getRecord('progress', bookId);
  return record?.data ? toReadingProgress(record.data as ProgressData, record.updatedAt) : null;
}

export function saveReadingProgress(progress: ReadingProgress): void {
  const page = Math.max(0, Math.floor(progress.currentPage));
  const data: ProgressData = {
    bookId: progress.bookId,
    paragraphIndex: page,
    scrollRatio: Math.min(1, Math.max(0, (progress.scrollPercentage ?? 0) / 100)),
    currentPage: page,
    totalPages: Math.max(0, Math.floor(progress.totalPages)),
  };
  services().sync.record('progress', progress.bookId, data).catch(logSyncError);
}

export function getAppState(): AppState {
  const myBooks = getMyBookIds();
  const bookMetadata: Record<string, Book> = {};
  for (const id of myBooks) {
    const book = getBookMetadata(id);
    if (book) bookMetadata[id] = book;
  }
  const readingProgress: Record<string, ReadingProgress> = {};
  for (const entry of services().replica.list('progress')) {
    readingProgress[entry.key] = toReadingProgress(entry.data, entry.updatedAt);
  }
  return { myBooks, bookMetadata, readingProgress, settings: loadLocal().settings };
}

export function getSettings(): UserSettings {
  return loadLocal().settings;
}

export function saveSettings(settings: UserSettings): void {
  saveLocal({ ...loadLocal(), settings });
}
