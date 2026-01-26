import { useEffect, useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';

interface ColdStartLoaderProps {
    message?: string;
    retryAttempt?: number;
    maxRetries?: number;
}

export function ColdStartLoader({
    message = 'Waking up server...',
    retryAttempt = 0,
    maxRetries = 3
}: ColdStartLoaderProps) {
    const [elapsedTime, setElapsedTime] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setElapsedTime((prev) => prev + 1);
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
            <div className="w-full max-w-md space-y-6 text-center">
                {/* Animated Calendar Icon */}
                <div className="flex justify-center mb-4">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-elegant animate-pulse">
                            <Calendar className="w-10 h-10 text-primary-foreground" />
                        </div>
                        <div className="absolute -bottom-2 -right-2">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        </div>
                    </div>
                </div>

                {/* Main Message */}
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-foreground">{message}</h2>
                    <p className="text-sm text-muted-foreground">
                        {elapsedTime}s elapsed
                    </p>
                </div>

                {/* Retry Information */}
                {retryAttempt > 0 && (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                        <p className="text-sm text-primary">
                            Retry attempt {retryAttempt} of {maxRetries}
                        </p>
                    </div>
                )}

                {/* Explanation */}
                <div className="bg-card rounded-lg p-4 space-y-2 border border-border">
                    <p className="text-sm text-muted-foreground">
                        <strong className="text-foreground">First visit after inactivity?</strong>
                    </p>
                    <p className="text-xs text-muted-foreground">
                        The server and database need 20-30 seconds to wake up.
                        Subsequent visits will be much faster (1-2 seconds).
                    </p>
                </div>

                {/* Progress Indicator */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Connecting...</span>
                        <span>{Math.min(100, Math.floor((elapsedTime / 30) * 100))}%</span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                        <div
                            className="bg-primary h-full transition-all duration-1000 ease-linear"
                            style={{ width: `${Math.min(100, (elapsedTime / 30) * 100)}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
