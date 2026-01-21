import type { AppState, ReadingProgress, UserSettings, Book } from '../types';

const STORAGE_KEY = 'book-library-state';

const defaultState: AppState = {
    myBooks: [],
    bookMetadata: {},
    readingProgress: {},
    settings: {
        fontSize: 18,
        brightness: 100,
    },
};

export function getAppState(): AppState {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return { ...defaultState, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.error('Failed to load app state:', e);
    }
    return defaultState;
}

export function saveAppState(state: AppState): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Failed to save app state:', e);
    }
}

export function getReadingProgress(bookId: string): ReadingProgress | null {
    const state = getAppState();
    return state.readingProgress[bookId] || null;
}

export function saveReadingProgress(progress: ReadingProgress): void {
    const state = getAppState();
    state.readingProgress[progress.bookId] = progress;
    saveAppState(state);
}

export function addToMyBooks(book: Book): void {
    const state = getAppState();
    if (!state.myBooks.includes(book.id)) {
        state.myBooks.push(book.id);
    }
    // Create a copy of the book to avoid mutating the original object that might be used in UI
    const bookToSave = { ...book };

    // If cover is a large Data URI, strip it from localStorage metadata
    // It is already saved in IndexedDB via cacheBook()
    if (bookToSave.cover && bookToSave.cover.startsWith('data:image')) {
        bookToSave.cover = ''; // BookCard will verify cache via useBookCover
    }

    state.bookMetadata[book.id] = bookToSave;
    saveAppState(state);
}

export function removeFromMyBooks(bookId: string): void {
    const state = getAppState();
    state.myBooks = state.myBooks.filter(id => id !== bookId);
    // Optional: Keep metadata/progress or clean it up? 
    // Usually better to keep small metadata in case of re-add, but maybe clean progress?
    // Let's keep it simple for now and just remove from the list.
    saveAppState(state);
}

export function getBookMetadata(bookId: string): Book | undefined {
    return getAppState().bookMetadata[bookId];
}

export function isInMyBooks(bookId: string): boolean {
    const state = getAppState();
    return state.myBooks.includes(bookId);
}

export function getMyBookIds(): string[] {
    return getAppState().myBooks;
}

export function getSettings(): UserSettings {
    return getAppState().settings;
}

export function saveSettings(settings: UserSettings): void {
    const state = getAppState();
    state.settings = settings;
    saveAppState(state);
}
