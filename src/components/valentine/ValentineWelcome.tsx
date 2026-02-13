import { useState, useEffect } from 'react';
import { useValentine, VALENTINE_MESSAGES } from '@/contexts/ValentineContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';

const WELCOME_SHOWN_KEY = 'freecal_valentine_welcome_2026';

export function ValentineWelcome() {
    const { isValentineMode, isCountdownPhase } = useValentine();
    const [isOpen, setIsOpen] = useState(false);

    // Only show welcome popup after countdown reaches zero
    const shouldShow = isValentineMode && !isCountdownPhase;

    useEffect(() => {
        if (!shouldShow) return;

        // Check if already shown this session
        const wasShown = sessionStorage.getItem(WELCOME_SHOWN_KEY);
        if (!wasShown) {
            // Small delay to let the app settle
            const timer = setTimeout(() => {
                setIsOpen(true);
                sessionStorage.setItem(WELCOME_SHOWN_KEY, 'true');
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [shouldShow]);

    if (!shouldShow) {
        return null;
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="valentine-modal max-w-md">
                <DialogHeader>
                    <DialogTitle className="valentine-modal-title">
                        <Heart className="w-6 h-6 text-pink-500 animate-pulse inline mr-2" />
                        {VALENTINE_MESSAGES.welcomeTitle}
                        <Heart className="w-6 h-6 text-pink-500 animate-pulse inline ml-2" />
                    </DialogTitle>
                </DialogHeader>

                <div className="valentine-modal-content">
                    <div className="valentine-modal-hearts">
                        {[...'💕💖💗💓💘'].map((emoji, i) => (
                            <span
                                key={i}
                                className="valentine-modal-heart"
                                style={{ animationDelay: `${i * 0.2}s` }}
                            >
                                {emoji}
                            </span>
                        ))}
                    </div>

                    <p className="valentine-modal-message">
                        {VALENTINE_MESSAGES.welcomeMessage}
                    </p>

                    <div className="valentine-modal-rose">
                        🌹
                    </div>
                </div>

                <Button
                    onClick={() => setIsOpen(false)}
                    className="valentine-modal-button"
                >
                    Danke, mein Schatz! 💕
                </Button>
            </DialogContent>
        </Dialog>
    );
}
