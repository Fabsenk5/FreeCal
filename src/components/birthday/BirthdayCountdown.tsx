import { useBirthday, BIRTHDAY_MESSAGES } from '@/contexts/BirthdayContext';
import './birthday.css';

export function BirthdayCountdown() {
    const { isBirthdayMode, isCountdownPhase, timeRemaining } = useBirthday();

    if (!isBirthdayMode) {
        return null;
    }

    return (
        <div className="birthday-countdown-banner bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white p-4 rounded-lg shadow-lg mb-4 flex justify-center items-center">
            <div className="birthday-countdown-content text-center">
                {isCountdownPhase ? (
                    <>
                        <span className="birthday-countdown-label block font-bold text-lg mb-2">
                            {BIRTHDAY_MESSAGES.countdownTitle}
                        </span>
                        <div className="birthday-countdown-timer flex justify-center gap-2 text-xl font-mono">
                            {timeRemaining.days > 0 && (
                                <span className="birthday-time-unit flex flex-col items-center bg-white/20 px-3 py-1 rounded">
                                    <span className="birthday-time-value font-bold">{timeRemaining.days}</span>
                                    <span className="birthday-time-label text-xs uppercase">Tage</span>
                                </span>
                            )}
                            <span className="birthday-time-unit flex flex-col items-center bg-white/20 px-3 py-1 rounded">
                                <span className="birthday-time-value font-bold">
                                    {String(timeRemaining.hours).padStart(2, '0')}
                                </span>
                                <span className="birthday-time-label text-xs uppercase">Std</span>
                            </span>
                            <span className="birthday-time-separator self-center font-bold">:</span>
                            <span className="birthday-time-unit flex flex-col items-center bg-white/20 px-3 py-1 rounded">
                                <span className="birthday-time-value font-bold">
                                    {String(timeRemaining.minutes).padStart(2, '0')}
                                </span>
                                <span className="birthday-time-label text-xs uppercase">Min</span>
                            </span>
                            <span className="birthday-time-separator self-center font-bold">:</span>
                            <span className="birthday-time-unit flex flex-col items-center bg-white/20 px-3 py-1 rounded">
                                <span className="birthday-time-value font-bold">
                                    {String(timeRemaining.seconds).padStart(2, '0')}
                                </span>
                                <span className="birthday-time-label text-xs uppercase">Sek</span>
                            </span>
                        </div>
                    </>
                ) : (
                    <div className="birthday-celebration text-2xl font-bold flex items-center justify-center gap-3">
                        <span className="birthday-celebration-emoji animate-bounce">🎉</span>
                        <span className="birthday-celebration-message">
                            {BIRTHDAY_MESSAGES.celebrationMessage}
                        </span>
                        <span className="birthday-celebration-emoji animate-bounce">🎉</span>
                    </div>
                )}
            </div>
        </div>
    );
}
