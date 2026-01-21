
import { supabase } from '../lib/supabase';
import type { Quote, Favorite } from '../types';

// --- Quotes Service ---

export async function addQuote(quote: Omit<Quote, 'id' | 'created_at' | 'user_id'>) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('User not logged in');

    const { data, error } = await supabase
        .from('quotes')
        .insert({
            user_id: userData.user.id,
            book_id: quote.book_id,
            book_title: quote.book_title,
            book_author: quote.book_author,
            text: quote.text,
            note: quote.note,
            color: quote.color
        })
        .select()
        .single();

    if (error) throw error;
    return data as Quote;
}

export async function deleteQuote(id: string) {
    const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

export async function getQuotes(bookId?: string) {
    let query = supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });

    if (bookId) {
        query = query.eq('book_id', bookId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Quote[];
}

// --- Favorites Service ---

export async function addFavorite(book: { id: string, title: string, author: string, cover: string }) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('User not logged in');

    const { data, error } = await supabase
        .from('favorites')
        .insert({
            user_id: userData.user.id,
            book_id: book.id,
            book_title: book.title,
            book_author: book.author,
            book_cover: book.cover
        })
        .select()
        .single();

    if (error) {
        // Prepare failure if duplicate - although UI should handle this
        if (error.code === '23505') return null; // Unique constraint violation
        throw error;
    }
    return data as Favorite;
}

export async function removeFavorite(bookId: string) {
    const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('book_id', bookId);

    if (error) throw error;
}

export async function getFavorites() {
    const { data, error } = await supabase
        .from('favorites')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Favorite[];
}

export async function isBookFavorite(bookId: string) {
    const { data, error } = await supabase
        .from('favorites')
        .select('id')
        .eq('book_id', bookId)
        .maybeSingle();

    if (error) throw error;
    return !!data;
}
