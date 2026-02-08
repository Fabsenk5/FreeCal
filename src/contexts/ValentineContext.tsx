import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface TimeRemaining {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    total: number;
}

interface ValentineContextType {
    isValentineMode: boolean;
    isCountdownPhase: boolean;
    timeRemaining: TimeRemaining;
    countdownTarget: Date;
    // Dev mode: force enable for testing
    devModeEnabled: boolean;
    toggleDevMode: () => void;
}

const ValentineContext = createContext<ValentineContextType | undefined>(undefined);

// Valentine's Day 2026 dates (Central European Time)
const VALENTINE_START = new Date('2026-02-13T18:00:00+01:00'); // Feb 13, 6PM CET
const VALENTINE_COUNTDOWN_END = new Date('2026-02-14T13:00:00+01:00'); // Feb 14, 1PM CET
const VALENTINE_END = new Date('2026-02-15T23:00:00+01:00'); // Feb 15, 11PM CET

function calculateTimeRemaining(target: Date): TimeRemaining {
    const now = new Date();
    const total = Math.max(0, target.getTime() - now.getTime());

    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));

    return { days, hours, minutes, seconds, total };
}

export function ValentineProvider({ children }: { children: ReactNode }) {
    const [devModeEnabled, setDevModeEnabled] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(() =>
        calculateTimeRemaining(VALENTINE_COUNTDOWN_END)
    );
    const [currentTime, setCurrentTime] = useState(() => new Date());

    // Update time every second
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
            setTimeRemaining(calculateTimeRemaining(VALENTINE_COUNTDOWN_END));
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Check if we're in Valentine mode (Feb 13 6PM - Feb 15 11PM)
    const isValentineMode = devModeEnabled || (
        currentTime >= VALENTINE_START && currentTime <= VALENTINE_END
    );

    // Check if we're in countdown phase (before Feb 14 1PM)
    const isCountdownPhase = devModeEnabled
        ? timeRemaining.total > 0
        : (currentTime >= VALENTINE_START && currentTime < VALENTINE_COUNTDOWN_END);

    const toggleDevMode = useCallback(() => {
        setDevModeEnabled(prev => !prev);
    }, []);

    return (
        <ValentineContext.Provider
            value={{
                isValentineMode,
                isCountdownPhase,
                timeRemaining,
                countdownTarget: VALENTINE_COUNTDOWN_END,
                devModeEnabled,
                toggleDevMode,
            }}
        >
            {children}
        </ValentineContext.Provider>
    );
}

export function useValentine() {
    const context = useContext(ValentineContext);
    if (context === undefined) {
        throw new Error('useValentine must be used within a ValentineProvider');
    }
    return context;
}

// German romantic messages for the special event
export const VALENTINE_MESSAGES = {
    eventTitle: '💕 Ein besonderer Tag für uns 💕',
    eventDescription: `Mein Schatz,

Heute ist unser Tag – ein Tag voller Liebe und Zärtlichkeit. 
Du machst mein Leben jeden Tag schöner und ich bin so dankbar, dich an meiner Seite zu haben.

Mit dir ist jeder Moment ein Geschenk. 💖

In Liebe,
Dein Schatz`,
    welcomeTitle: 'Frohen Valentinstag, meine Liebe! 💕',
    welcomeMessage: 'Du bist das Beste, was mir je passiert ist. Heute feiern wir unsere Liebe! 🌹',
    countdownTitle: 'Countdown zu unserem besonderen Moment',
    celebrationMessage: 'Jetzt ist unser Moment! Ich liebe dich! 💖',
};
