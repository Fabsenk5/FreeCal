import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface TimeRemaining {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    total: number;
}

interface BirthdayContextType {
    isBirthdayMode: boolean;
    isCountdownPhase: boolean;
    timeRemaining: TimeRemaining;
    countdownTarget: Date;
    // Dev mode: force enable for testing
    devModeEnabled: boolean;
    toggleDevMode: () => void;
}

const BirthdayContext = createContext<BirthdayContextType | undefined>(undefined);

// Birthday 2026 dates (Central European Time)
const BIRTHDAY_START = new Date('2026-07-17T12:00:00+02:00'); // Start showing 2 days before
const BIRTHDAY_COUNTDOWN_END = new Date('2026-07-19T00:00:00+02:00'); // July 19, midnight CET (Birthday, Sunday)
const BIRTHDAY_END = new Date('2026-07-20T00:00:00+02:00'); // Monday after the weekend

function calculateTimeRemaining(target: Date): TimeRemaining {
    const now = new Date();
    const total = Math.max(0, target.getTime() - now.getTime());

    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));

    return { days, hours, minutes, seconds, total };
}

export function BirthdayProvider({ children }: { children: ReactNode }) {
    const [devModeEnabled, setDevModeEnabled] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(() =>
        calculateTimeRemaining(BIRTHDAY_COUNTDOWN_END)
    );
    const [currentTime, setCurrentTime] = useState(() => new Date());

    // Update time every second
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
            setTimeRemaining(calculateTimeRemaining(BIRTHDAY_COUNTDOWN_END));
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Check if we're in Birthday mode
    const isBirthdayMode = devModeEnabled || (
        currentTime >= BIRTHDAY_START && currentTime <= BIRTHDAY_END
    );

    // Check if we're in countdown phase (before birthday)
    const isCountdownPhase = devModeEnabled
        ? timeRemaining.total > 0
        : (currentTime >= BIRTHDAY_START && currentTime < BIRTHDAY_COUNTDOWN_END);

    const toggleDevMode = useCallback(() => {
        setDevModeEnabled(prev => !prev);
    }, []);

    return (
        <BirthdayContext.Provider
            value={{
                isBirthdayMode,
                isCountdownPhase,
                timeRemaining,
                countdownTarget: BIRTHDAY_COUNTDOWN_END,
                devModeEnabled,
                toggleDevMode,
            }}
        >
            {children}
        </BirthdayContext.Provider>
    );
}

export function useBirthday() {
    const context = useContext(BirthdayContext);
    if (context === undefined) {
        throw new Error('useBirthday must be used within a BirthdayProvider');
    }
    return context;
}

export const BIRTHDAY_MESSAGES = {
    event1Title: 'Geburtstagswochenende mit mir 🎂',
    event1Description: 'Wir starten in dein Wochenende in Düsseldorf! Auf dich! 🥂',
    event2Title: 'Brunch & Konzert mit den Mädels 🎉',
    event2Description: 'Brunch ab 13 Uhr und anschließend Konzert! Feiert schön! 🌇',
    welcomeTitle: 'Happy Birthday, Kristina! 🎉',
    welcomeMessage: 'Pack die Koffer für Düsseldorf! Erst feiern wir beide, und dann gehts weiter mit den Mädels zum Konzert! 🥂🌇',
    countdownTitle: '🎂 Countdown zu deinem Geburtstagswochenende!',
    celebrationMessage: 'Happy Birthday! Lass dich heute richtig feiern! 🎉🥂',
};
