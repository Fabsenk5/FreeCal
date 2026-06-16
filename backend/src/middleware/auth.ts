import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

interface AuthRequest extends Request {
    user?: any;
}

const supabaseUrl = process.env.SUPABASE_URL || '';
// Use either service role or anon key, both work for verifying JWTs via .getUser()
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        res.sendStatus(401);
        return;
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            console.error('JWT verification failed:', error?.message);
            res.sendStatus(403);
            return;
        }
        req.user = user;
        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        res.sendStatus(403);
        return;
    }
};
