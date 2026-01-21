import { useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import type { Book } from '../types';
import { books } from '../data/books';
import { getMyBookIds, getReadingProgress, getBookMetadata, addToMyBooks, removeFromMyBooks } from '../utils/storage';
import { ProgressBar } from '../components/ProgressBar';
import { ImageWithLoader } from '../components/ImageWithLoader';
import { parseBookData } from '../services/flibustaApi';
import { cacheBook } from '../utils/cache';
import { useAuth } from '../contexts/AuthContext';
import { removeBookFromCloud } from '../utils/sync';

export function MyBooks() {
    const { user } = useAuth();
    const [myBookIds, setMyBookIds] = useState(getMyBookIds());
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const myBooks = useMemo(() => {
        return myBookIds
            .map((id) => {
                const book = books.find((b) => b.id === id) || getBookMetadata(id);
                const progress = getReadingProgress(id);
                return book ? { book, progress } : null;
            })
            .filter(Boolean)
            .sort((a, b) => (b?.progress?.lastRead || 0) - (a?.progress?.lastRead || 0));
    }, [myBookIds]);

    const handleRemove = async (bookId: string) => {
        if (window.confirm('Удалить эту книгу из списка?')) {
            removeFromMyBooks(bookId);
            setMyBookIds(getMyBookIds());
            if (user) {
                await removeBookFromCloud(user.id, bookId);
            }
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const buffer = await file.arrayBuffer();
            const isPdf = file.name.toLowerCase().endsWith('.pdf');
            const newBookId = `local-${Date.now()}`;

            let title = file.name.replace(/\.(fb2(\.zip)?|pdf)$/i, '');
            let author = 'Unknown Author';
            let cover = '';
            let description = '';
            let format: 'fb2' | 'pdf' = 'fb2';
            let text = '';

            if (isPdf) {
                format = 'pdf';
                cover = 'https://placehold.co/300x450?text=PDF';
                await cacheBook(newBookId, '', cover, buffer);
            } else {
                const parsed = await parseBookData(buffer);
                text = parsed.text;
                title = parsed.title || title;
                author = parsed.author || author;
                cover = parsed.cover || 'https://placehold.co/300x450?text=Wait...';
                description = parsed.description || description;

                await cacheBook(newBookId, text, cover);
            }

            const newBook: Book = {
                id: newBookId,
                title,
                author,
                cover,
                description,
                genre: 'Local',
                contentUrl: 'local',
                format
            };

            addToMyBooks(newBook);
            setMyBookIds(getMyBookIds());

        } catch (error) {
            console.error('Failed to upload book:', error);
            alert('Не удалось открыть файл. Поддерживаются FB2, FB2.ZIP и PDF.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="min-h-screen bg-black pb-24 pt-[env(safe-area-inset-top)] relative overflow-hidden">
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
                        <AnimatePresence mode="popLayout">
                            {myBooks.map((item) => (
                                <BookListItem
                                    key={item!.book.id}
                                    book={item!.book}
                                    onRemove={() => handleRemove(item!.book.id)}
                                />
                            ))}
                        </AnimatePresence>
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
            <div className="fixed bottom-32 right-5 z-20 pb-[env(safe-area-inset-bottom)]">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".fb2,.zip,.fb2.zip,.pdf"
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

function BookListItem({ book, onRemove }: { book: Book; onRemove: () => void }) {
    const navigate = useNavigate();
    const progress = getReadingProgress(book.id);

    const percentage = progress?.scrollPercentage ?? (
        progress && progress.totalPages > 0
            ? Math.round(((progress.currentPage + 1) / progress.totalPages) * 100)
            : 0
    );

    const [isDragging, setIsDragging] = useState(false);
    const [swiped, setSwiped] = useState(false);

    const handleDragEnd = (_e: any, info: PanInfo) => {
        setIsDragging(false);
        if (info.offset.x < -100) {
            setSwiped(true);
            // Trigger remove logic
            onRemove();

            // If user cancels, we need to reset, 
            // but the parent handles confirmation.
            // If we didn't remove (cancelled), 
            // we should probably reset the drag position.
            // Since framer-motion 'layout' animation handles removing, 
            // we rely on parent to remount or update list.
        } else {
            setSwiped(false);
        }
    };

    return (
        <div className="relative group">
            {/* Delete Background Layer */}
            <div className="absolute inset-y-0 right-0 w-full bg-red-600 rounded-2xl flex items-center justify-end px-6 z-0">
                <Trash2 className="text-white" size={24} />
            </div>

            {/* Swipeable Card */}
            <motion.div
                layout
                drag="x"
                dragConstraints={{ left: -100, right: 0 }}
                dragElastic={0.1}
                onDragStart={() => setIsDragging(true)}
                onDragEnd={handleDragEnd}
                onClick={() => {
                    if (!isDragging && !swiped) {
                        navigate(`/reader/${book.id}`);
                    }
                }}
                className="relative bg-[#1C1C1E] rounded-2xl z-10 touch-pan-y"
                exit={{ height: 0, opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                whileTap={{ cursor: "grabbing" }}
                style={{ width: '100%' }} // Ensure full width
            >
                <div className="flex gap-4 p-4 pointer-events-none select-none">
                    <ImageWithLoader
                        src={book.cover}
                        alt={book.title}
                        loading="lazy"
                        className="w-16 h-24 rounded-lg object-cover flex-shrink-0"
                        wrapperClassName="w-16 h-24 rounded-lg flex-shrink-0 bg-[#2C2C2E]"
                    />
                    <div className="flex-1 flex flex-col justify-between text-left py-1">
                        <div>
                            <h3 className="font-semibold text-white line-clamp-2">{book.title || 'Без названия'}</h3>
                            <p className="text-sm text-gray-500 mt-0.5">{book.author || 'Неизвестный автор'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <ProgressBar percentage={percentage} height={4} />
                            </div>
                            <span className="text-xs text-gray-400 font-medium">{percentage}%</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
