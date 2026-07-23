import rateLimit from 'express-rate-limit';

// Strict limit for auth endpoints (register, forgot/reset password) to slow
// down brute force and credential stuffing attempts.
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
});

// Moderate limit for push endpoints (per IP)
export const pushLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
});
