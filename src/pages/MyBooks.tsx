import { useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus } from 'lucide-react';
import type { Book } from '../types';
import { books } from '../data/books';
import { getMyBookIds, getReadingProgress, getBookMetadata, addToMyBooks } from '../utils/storage';
import { ProgressBar } from '../components/ProgressBar';
import { ImageWithLoader } from '../components/ImageWithLoader';
import { parseBookData } from '../services/flibustaApi';
import { cacheBook } from '../utils/cache';

export function MyBooks() {
    const [myBookIds, setMyBookIds] = useState(getMyBookIds());
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const myBooks = useMemo(() => {
        return myBookIds
            .map((id) => {
                // Try to find in static file, otherwise look in storage metadata
                const book = books.find((b) => b.id === id) || getBookMetadata(id);
                const progress = getReadingProgress(id);
                return book ? { book, progress } : null;
            })
            .filter(Boolean)
            .sort((a, b) => (b?.progress?.lastRead || 0) - (a?.progress?.lastRead || 0));
    }, [myBookIds]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const buffer = await file.arrayBuffer();
            const { text, cover, title, author, description } = await parseBookData(buffer);

            const newBookId = `local-${Date.now()}`;

            // Cache the book content
            await cacheBook(newBookId, text, cover || '');

            // Create book metadata
            const newBook: Book = {
                id: newBookId,
                title: title || file.name.replace(/\.fb2(\.zip)?$/i, ''),
                author: author || 'Unknown Author',
                cover: cover || 'https://placehold.co/300x450?text=Wait...',
                description: description || '',
                genre: 'Local',
                contentUrl: 'local',
            };

            // Save to storage
            addToMyBooks(newBook);

            // Update UI
            setMyBookIds(getMyBookIds());

        } catch (error) {
            console.error('Failed to upload book:', error);
            alert('Не удалось открыть файл. Убедитесь, что это корректный FB2 или FB2.ZIP.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="min-h-screen bg-black pb-24 pt-[env(safe-area-inset-top)] relative">
            <div className="px-5 pt-8">
                {/* Header */}
                <header className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Мои книги</h1>
                        {myBooks.length > 0 && (
                            <p className="text-gray-500 mt-1">{myBooks.length} книг</p>
                        )}
                    </div>
                </header>

                {/* Book List */}
                {myBooks.length > 0 ? (
                    <div className="space-y-4">
                        {myBooks.map((item) => (
                            <BookListItem key={item!.book.id} book={item!.book} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16">
                        <BookOpen size={48} className="text-gray-600 mb-4" />
                        <p className="text-gray-500 text-center">
                            Здесь пока пусто<br />
                            Начните читать книгу или добавьте свою
                        </p>
                    </div>
                )}
            </div>

            {/* Upload Button */}
            <div className="fixed bottom-24 right-5 z-20">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".fb2,.zip,.fb2.zip"
                    className="hidden"
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-lg shadow-white/10 active:scale-90 transition-transform disabled:opacity-50"
                >
                    {isUploading ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-black border-t-transparent" />
                    ) : (
                        <Plus size={28} />
                    )}
                </button>
            </div>
        </div>
    );
}

function BookListItem({ book }: { book: Book }) {
    const navigate = useNavigate();
    const progress = getReadingProgress(book.id);

    // Calculate percentage based on scroll if available, otherwise fallback (legacy)
    const percentage = progress?.scrollPercentage ?? (
        progress && progress.totalPages > 0
            ? Math.round(((progress.currentPage + 1) / progress.totalPages) * 100)
            : 0
    );

    return (
        <button
            onClick={() => navigate(`/reader/${book.id}`)}
            className="w-full flex gap-4 p-4 bg-[#1C1C1E] rounded-2xl transition-all duration-200 active:scale-[0.98] active:bg-[#2C2C2E]"
        >
            <ImageWithLoader
                src={book.cover}
                alt={book.title}
                loading="lazy"
                className="w-16 h-24 rounded-lg object-cover flex-shrink-0"
                wrapperClassName="w-16 h-24 rounded-lg flex-shrink-0 bg-[#2C2C2E]"
            />
            <div className="flex-1 flex flex-col justify-between text-left py-1">
                <div>
                    <h3 className="font-semibold text-white line-clamp-2">{book.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{book.author}</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex-1">
                        <ProgressBar percentage={percentage} height={4} />
                    </div>
                    <span className="text-xs text-gray-400 font-medium">{percentage}%</span>
                </div>
            </div>
        </button>
    );
}
