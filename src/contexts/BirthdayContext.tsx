import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';

interface TimeRemaining {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    total: number;
}

/**
 * Slow-changing state: event-window flags, target date and dev-mode controls.
 * Consumers of this context never re-render for the per-second countdown ticks.
 */
interface BirthdayModeContextType {
    isBirthdayMode: boolean;
    isCountdownPhase: boolean;
    countdownTarget: Date;
    // Dev mode: force enable for testing
    devModeEnabled: boolean;
    toggleDevMode: () => void;
}

/**
 * Backwards-compatible combined shape (mode + ticking countdown value).
 * Prefer `useBirthdayMode` unless you actually render the countdown.
 */
interface BirthdayContextType extends BirthdayModeContextType {
    timeRemaining: TimeRemaining;
}

const BirthdayModeContext = createContext<BirthdayModeContextType | undefined>(undefined);
const BirthdayCountdownContext = createContext<TimeRemaining | undefined>(undefined);

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

    // Check if we're in Birthday mode
    const isBirthdayMode = devModeEnabled || (
        currentTime >= BIRTHDAY_START && currentTime <= BIRTHDAY_END
    );

    // Check if we're in countdown phase (before birthday)
    const isCountdownPhase = devModeEnabled
        ? timeRemaining.total > 0
        : (currentTime >= BIRTHDAY_START && currentTime < BIRTHDAY_COUNTDOWN_END);

    // The mode flags only change at the window boundaries, so instead of
    // ticking every second we schedule a single re-evaluation for the next
    // upcoming boundary. Outside the event window no timer runs at all.
    useEffect(() => {
        const nextBoundary = [BIRTHDAY_START, BIRTHDAY_COUNTDOWN_END, BIRTHDAY_END]
            .map((d) => d.getTime())
            .filter((t) => t > Date.now())
            .sort((a, b) => a - b)[0];

        if (nextBoundary === undefined) {
            return;
        }

        const timeout = setTimeout(() => setCurrentTime(new Date()), nextBoundary - Date.now());
        return () => clearTimeout(timeout);
    }, [currentTime]);

    // Tick the countdown once per second, but only while the countdown is
    // actually visible (isCountdownPhase). The interval stops when the
    // countdown target passes and pauses while the tab is hidden.
    useEffect(() => {
        if (!isCountdownPhase) {
            // Settle the value once (e.g. clamp to zero after the target passed).
            setTimeRemaining(calculateTimeRemaining(BIRTHDAY_COUNTDOWN_END));
            return;
        }

        let interval: ReturnType<typeof setInterval> | null = null;

        const tick = () => setTimeRemaining(calculateTimeRemaining(BIRTHDAY_COUNTDOWN_END));
        const start = () => {
            if (interval === null) {
                tick();
                interval = setInterval(tick, 1000);
            }
        };
        const stop = () => {
            if (interval !== null) {
                clearInterval(interval);
                interval = null;
            }
        };
        const handleVisibilityChange = () => {
            if (document.hidden) {
                stop();
            } else {
                start();
            }
        };

        start();
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            stop();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isCountdownPhase]);

    const toggleDevMode = useCallback(() => {
        setDevModeEnabled(prev => !prev);
    }, []);

    const modeValue = useMemo<BirthdayModeContextType>(() => ({
        isBirthdayMode,
        isCountdownPhase,
        countdownTarget: BIRTHDAY_COUNTDOWN_END,
        devModeEnabled,
        toggleDevMode,
    }), [isBirthdayMode, isCountdownPhase, devModeEnabled, toggleDevMode]);

    return (
        <BirthdayModeContext.Provider value={modeValue}>
            <BirthdayCountdownContext.Provider value={timeRemaining}>
                {children}
            </BirthdayCountdownContext.Provider>
        </BirthdayModeContext.Provider>
    );
}

/**
 * Mode/data-only hook — subscribes solely to the slow context, so consumers
 * never re-render for the per-second countdown ticks.
 */
export function useBirthdayMode(): BirthdayModeContextType {
    const context = useContext(BirthdayModeContext);
    if (context === undefined) {
        throw new Error('useBirthdayMode must be used within a BirthdayProvider');
    }
    return context;
}

/**
 * Ticking countdown value — updates once per second while the countdown is
 * visible. Only the countdown UI should use this hook.
 */
export function useBirthdayCountdown(): TimeRemaining {
    const context = useContext(BirthdayCountdownContext);
    if (context === undefined) {
        throw new Error('useBirthdayCountdown must be used within a BirthdayProvider');
    }
    return context;
}

/**
 * Backwards-compatible combined hook. Note: it subscribes to BOTH contexts,
 * so consumers re-render with every countdown tick while the countdown is
 * active. Consumers that only need the mode flags should use `useBirthdayMode`.
 */
export function useBirthday(): BirthdayContextType {
    const mode = useBirthdayMode();
    const timeRemaining = useBirthdayCountdown();
    return { ...mode, timeRemaining };
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
