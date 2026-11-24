import type { BookData, ProgressData } from '@libify/shared';
import { services } from '@/shared/services';
import { LEGACY_SYNCED_FIELDS } from '@/shared/sync/legacyImport';
import type { AppState, Book, ReadingProgress, UserSettings } from '@/entities/book/model/types';
import { decodeEntities } from '@/shared/catalog/decodeEntities';

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
    if (e.key !== LOCAL_KEY) return;
    cachedLocal = null;
    notify(); // another tab changed book metadata: let this tab's lists re-read it
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

function readStoredObject(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function saveLocal(state: LocalState): void {
  cachedLocal = state;
  try {
    // Pre-v2 fields (myBooks, readingProgress) must survive until importLegacyState moves them to the replica.
    const legacy: Record<string, unknown> = {};
    const stored = readStoredObject();
    for (const field of LEGACY_SYNCED_FIELDS) if (field in stored) legacy[field] = stored[field];
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...legacy, ...state }));
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
    paragraphOffset: data.paragraphOffset ?? 0,
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

/** Repairs titles saved before entity decoding existed (e.g. `&laquo;…&raquo;`). */
function decodeBookText(book: Book): Book {
  const title = decodeEntities(book.title);
  const author = decodeEntities(book.author);
  const series = book.series && decodeEntities(book.series);
  if (title === book.title && author === book.author && series === book.series) return book;
  return { ...book, title, author, series };
}

export function getBookMetadata(bookId: string): Book | undefined {
  const local = loadLocal().bookMetadata[bookId];
  const data = local ? undefined : services().replica.get('book', bookId);
  const book = local ?? (data ? bookFromData(data) : undefined);
  return book && decodeBookText(book);
}

export function addToMyBooks(book: Book): void {
  const local = loadLocal();
  const toStore = { ...book };
  if (toStore.cover?.startsWith('data:image')) toStore.cover = ''; // the cover lives in the IndexedDB book cache
  saveLocal({ ...local, bookMetadata: { ...local.bookMetadata, [book.id]: toStore } });

  const existing = services().replica.get('book', book.id);
  const next = toBookData(book, existing?.addedAt ?? new Date().toISOString());
  if (!existing || JSON.stringify(existing) !== JSON.stringify(next)) {
    // The replica change itself emits 'storage-update' (see services.ts).
    services().sync.record('book', book.id, next).catch(logSyncError);
  } else {
    notify(); // only the local metadata changed
  }
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
    paragraphOffset: Math.min(1, Math.max(0, progress.paragraphOffset ?? 0)),
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

/** Reader settings saved by older versions; read once to seed the reader settings store. */
export function getSettings(): UserSettings {
  return loadLocal().settings;
}
