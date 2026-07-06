import { useState, useEffect } from 'react';
import { useBirthday, BIRTHDAY_MESSAGES } from '@/contexts/BirthdayContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PartyPopper } from 'lucide-react';
import './birthday.css';

const WELCOME_SHOWN_KEY = 'freecal_birthday_welcome_2026';

export function BirthdayWelcome() {
    const { isBirthdayMode, isCountdownPhase } = useBirthday();
    const [isOpen, setIsOpen] = useState(false);

    // Only show welcome popup after countdown reaches zero (i.e. on the birthday and weekend)
    const shouldShow = isBirthdayMode && !isCountdownPhase;

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
            <DialogContent className="birthday-modal max-w-md">
                <DialogHeader>
                    <DialogTitle className="birthday-modal-title">
                        <PartyPopper className="w-6 h-6 text-fuchsia-500 animate-bounce inline mr-2" />
                        {BIRTHDAY_MESSAGES.welcomeTitle}
                        <PartyPopper className="w-6 h-6 text-fuchsia-500 animate-bounce inline ml-2" />
                    </DialogTitle>
                </DialogHeader>

                <div className="birthday-modal-content">
                    <div className="birthday-modal-emojis">
                        {[...'🥂🎂🎉🎊🎁'].map((emoji, i) => (
                            <span
                                key={i}
                                className="birthday-modal-emoji"
                                style={{ animationDelay: `${i * 0.2}s` }}
                            >
                                {emoji}
                            </span>
                        ))}
                    </div>

                    <p className="birthday-modal-message">
                        {BIRTHDAY_MESSAGES.welcomeMessage}
                    </p>

                    <div className="birthday-modal-cake">
                        🎂
                    </div>
                </div>

                <Button
                    onClick={() => setIsOpen(false)}
                    className="birthday-modal-button bg-fuchsia-500 hover:bg-fuchsia-600 text-white"
                >
                    Los geht's! 🎉
                </Button>
            </DialogContent>
        </Dialog>
    );
}
