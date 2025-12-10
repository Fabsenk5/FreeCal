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
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      // Fetch current user details
      const { data } = await api.get('/auth/me');
      setUser(data);

      // In our new schema, profile and user are effectively merged or 1:1. 
      // The API returns the profile data as 'user'.
      // We'll map it to 'profile' state for compatibility.
      setProfile(data as Profile);
    } catch (error) {
      console.error('Auth verification failed:', error);
      localStorage.removeItem('auth_token');
      setUser(null);
      setProfile(null);
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
    setUser(null);
    setProfile(null);
    toast.success('Signed out successfully');
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;
    try {
      const { data } = await api.put('/users/profile', updates);
      setProfile(data as Profile); // Update local state
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
      {children}
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