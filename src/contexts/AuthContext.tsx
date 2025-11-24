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
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '@/lib/supabase';
import { toast } from 'sonner';
import { WelcomeDialog } from '@/components/WelcomeDialog';
import { notifyAdminNewUser } from '@/lib/notifications';

/**
 * Generate random color for user's calendar
 * Used during sign up to assign a unique color to each user
 *
 * @returns {string} Hex color code
 */
const getRandomColor = () => {
  const colors = [
    '#8B5CF6', // Purple
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Orange
    '#EF4444', // Red
    '#EC4899', // Pink
    '#14B8A6', // Teal
    '#F97316', // Orange
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

/**
 * Defines the shape of the authentication context.
 *
 * @property {User | null} user - The currently authenticated Supabase user.
 * @property {Profile | null} profile - The user's profile data from the database.
 * @property {Session | null} session - The current Supabase session.
 * @property {boolean} loading - Indicates if authentication data is still loading.
 * @property {(email: string, password: string, displayName: string) => Promise<void>} signUp - Registers a new user.
 * @property {(email: string, password: string) => Promise<void>} signIn - Logs in an existing user.
 * @property {() => Promise<void>} signOut - Logs out the current user.
 * @property {(updates: Partial<Profile>) => Promise<void>} updateProfile - Updates the user's profile.
 */
interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

/**
 * React context for authentication state and actions.
 *
 * @type {React.Context<AuthContextType | undefined>}
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provides authentication state and actions to the component tree.
 *
 * @param {React.ReactNode} children - Child components that can consume the auth context.
 * @returns {JSX.Element} The provider component wrapping children.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Show welcome dialog ONLY for approved users on their first login
    if (user && profile && !loading) {
      // Only show welcome if user is approved
      if (profile.is_approved) {
        const hasSeenWelcome = localStorage.getItem('welcomeShown');
        if (!hasSeenWelcome) {
          setShowWelcome(true);
        }
      }
    }
  }, [user, profile, loading]);

  /**
   * Fetches the user's profile from the database.
   *
   * @param {string} userId - The ID of the user whose profile to fetch.
   */
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Registers a new user and creates a profile entry.
   *
   * @param {string} email - User's email address.
   * @param {string} password - User's chosen password.
   * @param {string} displayName - User's display name.
   */
  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error('No user returned');

      const newProfile: any = {
        id: data.user.id,
        email,
        display_name: displayName,
        calendar_color: getRandomColor(),
        is_approved: false,
        approval_status: 'pending',
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .insert(newProfile);

      if (profileError) throw profileError;

      // Notify admin of new user
      await notifyAdminNewUser(email, displayName);

      // User stays logged in - app will show approval pending screen
      toast.success('Account created successfully!', {
        description: 'Your account is pending approval.',
      });
    } catch (err) {
      console.error('Signup error:', err);
      throw err;
    }
  };

  /**
   * Logs in an existing user.
   *
   * @param {string} email - User's email address.
   * @param {string} password - User's password.
   */
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        toast.success('Welcome back!', {
          description: 'You are now signed in.',
        });
      }
    } catch (err) {
      console.error('Sign in error:', err);
      throw err;
    }
  };

  /**
   * Logs out the current user.
   */
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      toast.success('Signed out successfully');
    } catch (err) {
      console.error('Sign out error:', err);
      throw err;
    }
  };

  /**
   * Updates the current user's profile.
   *
   * @param {Partial<Profile>} updates - Fields to update in the profile.
   */
  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      // Refresh profile
      await fetchProfile(user.id);
      toast.success('Profile updated successfully!');
    } catch (err) {
      console.error('Update profile error:', err);
      throw err;
    }
  };

  const value = {
    user,
    profile,
    session,
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

/**
 * Hook to access authentication context.
 *
 * @returns {AuthContextType} The authentication context value.
 * @throws Will throw an error if used outside of AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}