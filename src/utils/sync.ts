import { supabase } from '../lib/supabase';
import { getAppState, saveAppState } from './storage';

export async function syncData(userId: string) {
    if (!userId) return;

    try {
        // 1. Sync Books
        // Fetch cloud books
        const { data: cloudBooks, error: booksError } = await supabase
            .from('user_books')
            .select('*')
            .eq('user_id', userId);

        if (booksError) throw booksError;

        // Get local state
        const localState = getAppState();

        // Merge Strategy: Cloud is source of truth for presence, but if local has newer books, push them?
        // Simple strategy: 
        // - Allow local books to be "uploaded" (inserted) to cloud if missing
        // - Download missing cloud books to local

        // A. Push local -> Cloud
        const localBookIds = localState.myBooks;
        const cloudBookIds = cloudBooks?.map(b => b.book_id) || [];

        const p1 = localBookIds.filter(id => !cloudBookIds.includes(id)).map(async (id) => {
            const book = localState.bookMetadata[id];
            if (!book) return;

            await supabase.from('user_books').upsert({
                user_id: userId,
                book_id: book.id,
                title: book.title || 'Untitled',
                author: book.author || 'Unknown',
                cover: book.cover || '',
                status: 'reading',
                format: book.format || 'fb2'
            }, { onConflict: 'user_id, book_id', ignoreDuplicates: true });
        });

        // B. Pull Cloud -> Local
        const p2 = cloudBooks?.filter(b => !localBookIds.includes(b.book_id)).map(async (b) => {
            // Update local metadata
            localState.bookMetadata[b.book_id] = {
                id: b.book_id,
                title: b.title,
                author: b.author,
                cover: b.cover,
                description: '', // Cloud might not store full description yet
                genre: 'Cloud',
                format: b.format as any || 'fb2'
            };
            // Add to myBooks list
            localState.myBooks.push(b.book_id);
        });

        await Promise.all([...p1, ...(p2 || [])]);
        saveAppState(localState);

        // 2. Sync Progress
        // Similar logic... fetch cloud progress, compare with local
        const { data: cloudProgress } = await supabase
            .from('reading_progress')
            .select('*')
            .eq('user_id', userId);

        // Merge progress
        // If cloud timestamp > local timestamp (last_read), update local.
        // Else update cloud.
        cloudProgress?.forEach(cp => {
            const lp = localState.readingProgress[cp.book_id];
            // If local doesn't exist or cloud is newer
            // Ensure we handle potentially missing lastRead in local state
            const localLastRead = lp?.lastRead || 0;
            const cloudLastRead = cp.last_read || 0;

            if (!lp || (cloudLastRead > localLastRead)) {
                localState.readingProgress[cp.book_id] = {
                    bookId: cp.book_id,
                    currentPage: cp.current_page,
                    totalPages: cp.total_pages,
                    lastRead: cloudLastRead,
                    scrollPercentage: cp.scroll_percentage
                };
            }
        });

        // Push newer local progress to cloud
        const progressUpdates = Object.values(localState.readingProgress).map(async (lp) => {
            const cp = cloudProgress?.find(p => p.book_id === lp.bookId);
            const localLastRead = lp.lastRead || 0;
            const cloudLastRead = cp?.last_read || 0;

            if (!cp || (localLastRead > cloudLastRead)) {
                await supabase.from('reading_progress').upsert({
                    user_id: userId,
                    book_id: lp.bookId,
                    current_page: lp.currentPage,
                    total_pages: lp.totalPages,
                    last_read: localLastRead,
                    scroll_percentage: lp.scrollPercentage || 0
                }, { onConflict: 'user_id, book_id' });
            }
        });

        await Promise.all(progressUpdates);
        saveAppState(localState); // Final save

    } catch (error) {
        console.error('Sync failed:', error);
    }
}

export async function removeBookFromCloud(userId: string, bookId: string) {
    if (!userId || !bookId) return;

    try {
        const { error } = await supabase
            .from('user_books')
            .delete()
            .match({ user_id: userId, book_id: bookId });

        if (error) throw error;
    } catch (error) {
        console.error('Failed to remove book from cloud:', error);
    }
}
