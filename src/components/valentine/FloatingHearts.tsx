import { useEffect, useState } from 'react';
import { useValentine } from '@/contexts/ValentineContext';

interface Heart {
    id: number;
    emoji: string;
    left: number;
    size: number;
    duration: number;
    delay: number;
}

const HEART_EMOJIS = ['❤️', '💕', '💖', '💗', '💓', '💘', '💝', '🌹', '✨'];

export function FloatingHearts() {
    const { isValentineMode } = useValentine();
    const [hearts, setHearts] = useState<Heart[]>([]);

    useEffect(() => {
        if (!isValentineMode) {
            setHearts([]);
            return;
        }

        // Generate initial hearts
        const initialHearts: Heart[] = Array.from({ length: 15 }, (_, i) => ({
            id: i,
            emoji: HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)],
            left: Math.random() * 100,
            size: 16 + Math.random() * 24,
            duration: 8 + Math.random() * 12,
            delay: Math.random() * 10,
        }));

        setHearts(initialHearts);

        // Continuously add new hearts
        const interval = setInterval(() => {
            setHearts(prev => {
                // Keep max 20 hearts for performance
                const filtered = prev.length > 20 ? prev.slice(-15) : prev;
                return [
                    ...filtered,
                    {
                        id: Date.now(),
                        emoji: HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)],
                        left: Math.random() * 100,
                        size: 16 + Math.random() * 24,
                        duration: 8 + Math.random() * 12,
                        delay: 0,
                    },
                ];
            });
        }, 3000);

        return () => clearInterval(interval);
    }, [isValentineMode]);

    if (!isValentineMode || hearts.length === 0) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 pointer-events-none overflow-hidden z-50"
            aria-hidden="true"
        >
            {hearts.map(heart => (
                <span
                    key={heart.id}
                    className="absolute animate-float-heart"
                    style={{
                        left: `${heart.left}%`,
                        fontSize: `${heart.size}px`,
                        animationDuration: `${heart.duration}s`,
                        animationDelay: `${heart.delay}s`,
                        bottom: '-50px',
                    }}
                >
                    {heart.emoji}
                </span>
            ))}
        </div>
    );
}
