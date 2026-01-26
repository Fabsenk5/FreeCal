/**
 * Authentication Context & Provider
 *
 * This file manages the global authentication state for the application.
 * It provides:
 * - User authentication state (logged in/out)
 * - User profile data from database
 * - Sign up, sign in, and sign out methods
 * - Profile update functionality
 * - Automatic session management
 *
 * Usage:
 * ```typescript
 * const { user, profile, signIn, signOut } = useAuth()
 * ```
 *
 * @module AuthContext
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { api, User } from '@/lib/api';
import { toast } from 'sonner';
import { WelcomeDialog } from '@/components/WelcomeDialog';
import { ColdStartLoader } from '@/components/ColdStartLoader';
// import { notifyAdminNewUser } from '@/lib/notifications'; // TODO: Implement backend notification

// Re-export Profile type helper for compatibility, though we should transition to API types
export interface Profile {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  calendar_color: string;
  is_approved: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialize state from localStorage if available (Stale-While-Revalidate)
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem('auth_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      const cached = localStorage.getItem('auth_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  // If we have cached data, we're not "loading" in the blocking sense.
  // We'll still verify in the background.
  const [loading, setLoading] = useState(() => {
    // Only blocking-load if we have a token but no cached user data
    const token = localStorage.getItem('auth_token');
    const hasCachedData = localStorage.getItem('auth_user') && localStorage.getItem('auth_profile');
    return !!token && !hasCachedData;
  });

  const [showWelcome, setShowWelcome] = useState(false);
  const [isColdStart, setIsColdStart] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('auth_token');

    // If no token, we are definitely logged out
    if (!token) {
      setUser(null);
      setProfile(null);
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_profile');
      setLoading(false);
      return;
    }

    try {
      // Detect if this is likely a cold start (first check in awhile)
      const lastCheck = localStorage.getItem('last_auth_check');
      const now = Date.now();
      if (!lastCheck || now - parseInt(lastCheck) > 15 * 60 * 1000) {
        // More than 15 minutes since last check = possible cold start
        setIsColdStart(true);
      }
      localStorage.setItem('last_auth_check', now.toString());

      // Fetch current user details (api.ts will handle retries automatically)
      const { data } = await api.get('/auth/me');

      // Update state
      setUser(data);
      // In our new schema, profile and user are effectively merged or 1:1. 
      setProfile(data as Profile);

      // Update cache
      localStorage.setItem('auth_user', JSON.stringify(data));
      localStorage.setItem('auth_profile', JSON.stringify(data));

      // Success - reset cold start indicators
      setIsColdStart(false);
      setRetryAttempt(0);

    } catch (error: any) {
      console.error('Auth verification failed:', error);

      // Import the helper from api.ts
      const isTimeout = !error.response && (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK');

      // Only log out if it's explicitly an Auth error (401/403)
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_profile');
        setUser(null);
        setProfile(null);
        setIsColdStart(false);
      } else if (isTimeout) {
        // For timeouts: Keep session active, show cold start message
        console.warn('Server timeout (likely cold start), keeping local session active.');
        // The retry is handled by api.ts interceptor
        // Just track attempt for UI
        setRetryAttempt((prev) => prev + 1);
      } else {
        // For 500s, Other Network Errors:
        // KEEP the local session. Do NOT log out.
        // User continues using cached data.
        console.warn('Server unreachable or error, keeping local session active.');
      }
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      const { data } = await api.post('/auth/register', {
        email,
        password,
        displayName
      });

      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      localStorage.setItem('auth_profile', JSON.stringify(data.user));

      setUser(data.user);
      setProfile(data.user as Profile);

      toast.success('Account created successfully!');
      // Welcome dialog logic
      setShowWelcome(true);
    } catch (err: any) {
      console.error('Signup error:', err);
      toast.error(err.response?.data?.message || 'Failed to sign up');
      throw err;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data } = await api.post('/auth/login', {
        email,
        password
      });

      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      localStorage.setItem('auth_profile', JSON.stringify(data.user));

      setUser(data.user);
      setProfile(data.user as Profile);

      toast.success('Welcome back!');
    } catch (err: any) {
      console.error('Sign in error:', err);
      // Show technical error in toast (bottom right) as requested
      toast.error(err.message || 'Failed to sign in');
      throw err;
    }
  };

  const signOut = async () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_profile');
    setUser(null);
    setProfile(null);
    toast.success('Signed out successfully');
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;
    try {
      const { data } = await api.put('/users/profile', updates);
      setProfile(data as Profile); // Update local state
      localStorage.setItem('auth_profile', JSON.stringify(data));
    } catch (err: any) {
      console.error('Update profile error:', err);
      toast.error('Failed to update profile');
      throw err;
    }
  };

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {/* Show cold start loader if we detect a cold start and we're loading */}
      {isColdStart && loading ? (
        <ColdStartLoader
          message="Waking up server..."
          retryAttempt={retryAttempt}
          maxRetries={3}
        />
      ) : (
        children
      )}
      <WelcomeDialog open={showWelcome} onClose={() => setShowWelcome(false)} />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}