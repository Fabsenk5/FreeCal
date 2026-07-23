import { Router } from 'express';
import { register, getMe } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';

const router = Router();

// Auth routes
import { forgotPassword, resetPassword } from '../controllers/passwordResetController';

// NOTE: there is no /login endpoint. The frontend authenticates via Supabase
// Auth directly; the auth middleware verifies Supabase access tokens.

router.post('/register', authLimiter, register);
router.get('/me', authenticateToken, getMe);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

export default router;
