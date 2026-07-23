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
interface ValentineModeContextType {
    isValentineMode: boolean;
    isCountdownPhase: boolean;
    countdownTarget: Date;
    // Dev mode: force enable for testing
    devModeEnabled: boolean;
    toggleDevMode: () => void;
}

/**
 * Backwards-compatible combined shape (mode + ticking countdown value).
 * Prefer `useValentineMode` unless you actually render the countdown.
 */
interface ValentineContextType extends ValentineModeContextType {
    timeRemaining: TimeRemaining;
}

const ValentineModeContext = createContext<ValentineModeContextType | undefined>(undefined);
const ValentineCountdownContext = createContext<TimeRemaining | undefined>(undefined);

// Valentine's Day 2026 dates (Central European Time)
const VALENTINE_START = new Date('2026-02-13T12:00:00+01:00'); // Feb 13, 12PM CET
const VALENTINE_COUNTDOWN_END = new Date('2026-02-14T00:00:00+01:00'); // Feb 14, midnight CET
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

    // Check if we're in Valentine mode (Feb 13 12PM - Feb 15 11PM)
    const isValentineMode = devModeEnabled || (
        currentTime >= VALENTINE_START && currentTime <= VALENTINE_END
    );

    // Check if we're in countdown phase (before Feb 14 midnight)
    const isCountdownPhase = devModeEnabled
        ? timeRemaining.total > 0
        : (currentTime >= VALENTINE_START && currentTime < VALENTINE_COUNTDOWN_END);

    // The mode flags only change at the window boundaries, so instead of
    // ticking every second we schedule a single re-evaluation for the next
    // upcoming boundary. Outside the event window no timer runs at all.
    useEffect(() => {
        const nextBoundary = [VALENTINE_START, VALENTINE_COUNTDOWN_END, VALENTINE_END]
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
            setTimeRemaining(calculateTimeRemaining(VALENTINE_COUNTDOWN_END));
            return;
        }

        let interval: ReturnType<typeof setInterval> | null = null;

        const tick = () => setTimeRemaining(calculateTimeRemaining(VALENTINE_COUNTDOWN_END));
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

    const modeValue = useMemo<ValentineModeContextType>(() => ({
        isValentineMode,
        isCountdownPhase,
        countdownTarget: VALENTINE_COUNTDOWN_END,
        devModeEnabled,
        toggleDevMode,
    }), [isValentineMode, isCountdownPhase, devModeEnabled, toggleDevMode]);

    return (
        <ValentineModeContext.Provider value={modeValue}>
            <ValentineCountdownContext.Provider value={timeRemaining}>
                {children}
            </ValentineCountdownContext.Provider>
        </ValentineModeContext.Provider>
    );
}

/**
 * Mode/data-only hook — subscribes solely to the slow context, so consumers
 * never re-render for the per-second countdown ticks.
 */
export function useValentineMode(): ValentineModeContextType {
    const context = useContext(ValentineModeContext);
    if (context === undefined) {
        throw new Error('useValentineMode must be used within a ValentineProvider');
    }
    return context;
}

/**
 * Ticking countdown value — updates once per second while the countdown is
 * visible. Only the countdown UI should use this hook.
 */
export function useValentineCountdown(): TimeRemaining {
    const context = useContext(ValentineCountdownContext);
    if (context === undefined) {
        throw new Error('useValentineCountdown must be used within a ValentineProvider');
    }
    return context;
}

/**
 * Backwards-compatible combined hook. Note: it subscribes to BOTH contexts,
 * so consumers re-render with every countdown tick while the countdown is
 * active. Consumers that only need the mode flags should use `useValentineMode`.
 */
export function useValentine(): ValentineContextType {
    const mode = useValentineMode();
    const timeRemaining = useValentineCountdown();
    return { ...mode, timeRemaining };
}

// German romantic messages for the special event
export const VALENTINE_MESSAGES = {
    eventTitle: '💕 Ein besonderer Tag für uns 💕',
    eventDescription: `Unser Valentinstag 💖

Heute feiern wir uns – du und ich.
Danke, dass du mein Leben so wunderbar machst.

In Liebe`,
    welcomeTitle: 'Happy Valentinstag, mein Schatz! 💕',
    welcomeMessage: 'Schön, dass es dich gibt. Heute gehört ganz uns! 🌹',
    countdownTitle: '💗 Countdown zu unserem besonderen Tag',
    celebrationMessage: 'Happy Valentinstag! Ich liebe dich! 💖',
};
