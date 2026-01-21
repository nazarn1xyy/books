import { supabase } from '../lib/supabase';
import { getAppState, saveAppState, getPendingDeletions, removeFromPendingDeletions, getPendingUploads, removeFromPendingUploads, removeFromMyBooks } from './storage';
import { getCachedBook, cacheBook } from './cache';

export async function syncData(userId: string) {
    if (!userId) return;

    try {
        // 0. Process Pending Deletions (Robustness for Offline/Mobile)
        const pendingDeletions = getPendingDeletions();
        if (pendingDeletions && pendingDeletions.length > 0) {
            await Promise.all(pendingDeletions.map(async (bookId) => {
                await removeBookFromCloud(userId, bookId);
                removeFromPendingDeletions(bookId);
            }));
        }

        // 0.5. Process Pending Uploads (Robustness for Offline Addition)
        const pendingUploads = getPendingUploads();
        if (pendingUploads && pendingUploads.length > 0) {
            const localStateVerified = getAppState(); // get fresh state
            await Promise.all(pendingUploads.map(async (bookId) => {
                const book = localStateVerified.bookMetadata[bookId];
                if (!book) {
                    // Book vanished? remove from pending
                    removeFromPendingUploads(bookId);
                    return;
                }

                // Hydrate cover from cache if missing
                let coverToUpload = book.cover;
                if (!coverToUpload || coverToUpload === '') {
                    const cached = await getCachedBook(book.id);
                    if (cached?.cover) {
                        coverToUpload = cached.cover;
                    }
                }

                const { error } = await supabase.from('user_books').upsert({
                    user_id: userId,
                    book_id: book.id,
                    title: book.title || 'Untitled',
                    author: book.author || 'Unknown',
                    cover: coverToUpload || '',
                    status: 'reading',
                    format: book.format || 'fb2'
                }, { onConflict: 'user_id, book_id', ignoreDuplicates: true });

                if (!error) {
                    removeFromPendingUploads(bookId);
                }
            }));
        }

        // 1. Sync Books - Fetch Cloud Truth
        const { data: cloudBooks, error: booksError } = await supabase
            .from('user_books')
            .select('*')
            .eq('user_id', userId);

        if (booksError) throw booksError;

        // Get local state
        const localState = getAppState(); // refresh again
        const localBookIds = localState.myBooks;
        const cloudBookIds = cloudBooks?.map(b => b.book_id) || [];
        const pendingUploadsStillActive = getPendingUploads();

        // A. Remove Local books that are NOT in Cloud (and NOT pending upload)
        // This propagates "Cloud deletions" to the device
        localBookIds.forEach(localId => {
            if (!cloudBookIds.includes(localId) && !pendingUploadsStillActive.includes(localId)) {
                // If it's not in cloud, and we are not trying to upload it -> It was deleted remotely
                removeFromMyBooks(localId);
            }
        });

        // B. Pull Cloud -> Local (Download missing books)
        // We refreshing state inside loop ideally but here we can just push to array
        const p2 = cloudBooks?.filter(b => !localBookIds.includes(b.book_id)).map(async (b) => {
            let coverToSave = b.cover;

            // If cloud has a large cover, offload to IndexedDB and strip from LocalStorage
            if (coverToSave && coverToSave.startsWith('data:image')) {
                await cacheBook(b.book_id, '', coverToSave); // Cache it
                coverToSave = ''; // Strip it
            }

            // Update local metadata
            localState.bookMetadata[b.book_id] = {
                id: b.book_id,
                title: b.title,
                author: b.author,
                cover: coverToSave,
                description: '',
                genre: 'Cloud',
                format: b.format as any || 'fb2'
            };
            // Add to myBooks list if not exists (check again to be safe)
            if (!localState.myBooks.includes(b.book_id)) {
                localState.myBooks.push(b.book_id);
            }
        });

        await Promise.all(p2 || []);
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
