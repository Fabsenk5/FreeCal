import { useValentine, VALENTINE_MESSAGES } from '@/contexts/ValentineContext';

export function ValentineCountdown() {
    const { isValentineMode, isCountdownPhase, timeRemaining } = useValentine();

    if (!isValentineMode) {
        return null;
    }

    return (
        <div className="valentine-countdown-banner">
            <div className="valentine-countdown-content">
                {isCountdownPhase ? (
                    <>
                        <span className="valentine-countdown-label">
                            {VALENTINE_MESSAGES.countdownTitle}
                        </span>
                        <div className="valentine-countdown-timer">
                            {timeRemaining.days > 0 && (
                                <span className="valentine-time-unit">
                                    <span className="valentine-time-value">{timeRemaining.days}</span>
                                    <span className="valentine-time-label">Tage</span>
                                </span>
                            )}
                            <span className="valentine-time-unit">
                                <span className="valentine-time-value">
                                    {String(timeRemaining.hours).padStart(2, '0')}
                                </span>
                                <span className="valentine-time-label">Std</span>
                            </span>
                            <span className="valentine-time-separator">:</span>
                            <span className="valentine-time-unit">
                                <span className="valentine-time-value">
                                    {String(timeRemaining.minutes).padStart(2, '0')}
                                </span>
                                <span className="valentine-time-label">Min</span>
                            </span>
                            <span className="valentine-time-separator">:</span>
                            <span className="valentine-time-unit">
                                <span className="valentine-time-value">
                                    {String(timeRemaining.seconds).padStart(2, '0')}
                                </span>
                                <span className="valentine-time-label">Sek</span>
                            </span>
                        </div>
                    </>
                ) : (
                    <div className="valentine-celebration">
                        <span className="valentine-celebration-emoji">💖</span>
                        <span className="valentine-celebration-message">
                            {VALENTINE_MESSAGES.celebrationMessage}
                        </span>
                        <span className="valentine-celebration-emoji">💖</span>
                    </div>
                )}
            </div>
        </div>
    );
}
