import { useEffect, useRef } from 'react';
import { Quote, X } from 'lucide-react';
import { usePresence } from '@/shared/ui/usePresence';

interface QuoteMenuProps {
    isVisible: boolean;
    position: { x: number; y: number };
    selectedText: string;
    onSave: () => void;
    onClose: () => void;
}

export function QuoteMenu({ isVisible, position, selectedText, onSave, onClose }: QuoteMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const { mounted, visible } = usePresence(isVisible, 150);

    // Position adjustment to keep menu in viewport
    useEffect(() => {
        if (isVisible && menuRef.current) {
            const menu = menuRef.current;
            const rect = menu.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Adjust horizontal position
            if (rect.right > viewportWidth - 10) {
                menu.style.left = `${viewportWidth - rect.width - 10}px`;
            }
            if (rect.left < 10) {
                menu.style.left = '10px';
            }

            // Adjust vertical position
            if (rect.bottom > viewportHeight - 10) {
                menu.style.top = `${position.y - rect.height - 10}px`;
            }
        }
    }, [isVisible, position]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        if (isVisible) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside as unknown as EventListener);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside as unknown as EventListener);
        };
    }, [isVisible, onClose]);

    if (!selectedText.trim() || !mounted) return null;

    return (
                <div
                    ref={menuRef}
                    className={`fixed z-50 bg-[#2C2C2E] rounded-xl shadow-xl border border-white/10 overflow-hidden origin-top transition-[opacity,transform] duration-150 ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-1'}`}
                    style={{
                        left: position.x,
                        top: position.y,
                        maxWidth: 'calc(100vw - 20px)'
                    }}
                >
                    {/* Preview of selected text */}
                    <div className="px-3 py-2 max-w-xs bg-black/20">
                        <p className="text-xs text-gray-400 line-clamp-2 italic">
                            "{selectedText.slice(0, 100)}{selectedText.length > 100 ? '...' : ''}"
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between px-2 py-1.5 gap-2">
                        <button
                            onClick={onSave}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors flex-1"
                        >
                            <Quote size={16} />
                            <span className="text-sm font-medium">Сохранить цитату</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-gray-400 hover:bg-white/10 transition-colors"
                            aria-label="Закрыть"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
    );
}
