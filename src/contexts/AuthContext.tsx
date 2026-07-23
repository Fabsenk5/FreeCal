/**
 * Authentication Context & Provider — Supabase Edition
 *
 * Manages global auth state using Supabase Auth.
 * Replaces the old JWT/localStorage-based auth.
 *
 * Loading/refetch policy:
 * - The global `loading` spinner is only used for the INITIAL session load.
 *   Later auth events (e.g. the hourly TOKEN_REFRESHED) update state in the
 *   background without remounting the app.
 * - The profile is refetched only on INITIAL_SESSION, SIGNED_IN and
 *   USER_UPDATED — not on TOKEN_REFRESHED, where user data cannot change.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Profile, User } from '@/lib/api';
import { toast } from 'sonner';
import { WelcomeDialog } from '@/components/WelcomeDialog';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';

export type { Profile };

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  // Tracks whether the initial session load has finished; only that first load
  // may drive the global `loading` state.
  const initialLoadRef = useRef(true);

  const finishInitialLoad = useCallback(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      setLoading(false);
    }
  }, []);

  // Fetch profile from profiles table
  const fetchProfile = async (userId: string, email: string): Promise<Profile | null> => {
    try {
      // Add a 5 second timeout to prevent infinite hanging
      const fetchPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      const timeoutPromise = new Promise<any>((_, reject) => 
        setTimeout(() => reject(new Error('fetchProfile timed out')), 5000)
      );

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('Exception fetching profile:', err);
      return null;
    }
  };

  // Convert session to our User/Profile types
  const setFromSession = async (session: Session | null, event: AuthChangeEvent) => {
    if (!session?.user) {
      setUser(null);
      setProfile(null);
      finishInitialLoad();
      return;
    }

    // Refetch the profile only when user data may actually have changed.
    // TOKEN_REFRESHED and similar background events keep the existing state
    // and must not trigger the global loading spinner (which would remount
    // the whole app and destroy form/scroll/dialog state).
    const shouldRefetchProfile =
      event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED';

    if (!shouldRefetchProfile) {
      finishInitialLoad();
      return;
    }

    try {
      const supaUser = session.user;
      const profileData = await fetchProfile(supaUser.id, supaUser.email || '');

      if (profileData) {
        const userData: User = {
          id: profileData.id,
          email: profileData.email,
          display_name: profileData.display_name,
          avatar_url: profileData.avatar_url || undefined,
          calendar_color: profileData.calendar_color,
        };

        setUser(userData);
        setProfile(profileData);
      } else {
        // Profile not yet created (trigger might be delayed)
        setUser({
          id: supaUser.id,
          email: supaUser.email || '',
          display_name: supaUser.user_metadata?.display_name || supaUser.email?.split('@')[0] || '',
          calendar_color: 'hsl(217, 91%, 60%)',
        });
        setProfile(null);
      }
    } catch (error) {
      console.error('Error in setFromSession:', error);
      setUser(null);
      setProfile(null);
    } finally {
      finishInitialLoad();
    }
  };

  useEffect(() => {
    let mounted = true;

    // Supabase v2: We can just rely on onAuthStateChange as it fires INITIAL_SESSION
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        // Execute detached to avoid deadlocks during Auth events (like USER_UPDATED)
        setTimeout(() => {
          if (mounted) {
            setFromSession(session, event).catch((err) => {
              console.error('Auth context setup error:', err);
              if (mounted) finishInitialLoad();
            });
          }
        }, 0);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [finishInitialLoad]);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });

    if (error) {
      toast.error(error.message);
      throw error;
    }

    if (data.user) {
      toast.success('Account created successfully!');
      setShowWelcome(true);
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      throw error;
    }

    if (data.user) {
      toast.success('Welcome back!');
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Error signing out');
      throw error;
    }

    setUser(null);
    setProfile(null);
    // Clear any legacy localStorage items
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_profile');
    // Clear service worker caches so cached API responses stay unreadable
    // after logout on shared devices (fire-and-forget).
    try {
      if ('caches' in window) {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          .catch((err) => console.error('Failed to clear caches on sign out:', err));
      }
    } catch (err) {
      console.error('Failed to clear caches on sign out:', err);
    }
    toast.success('Signed out successfully');
  }, []);

  const updateProfileFn = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return;

    const updatePromise = supabase
      .from('profiles')
      .update({
        display_name: updates.display_name,
        calendar_color: updates.calendar_color,
      })
      .eq('id', user.id)
      .select()
      .single();

    const timeoutPromise = new Promise<any>((_, reject) => 
      setTimeout(() => reject(new Error('Profile update timed out. Please try again.')), 8000)
    );

    const { data, error } = await Promise.race([updatePromise, timeoutPromise]);

    if (error) {
      toast.error('Failed to update profile');
      throw error;
    }

    setProfile(data);
  }, [user]);

  const updatePassword = useCallback(async (password: string) => {
    const updatePromise = supabase.auth.updateUser({ password });
    
    const timeoutPromise = new Promise<any>((_, reject) => 
      setTimeout(() => reject(new Error('Password update timed out. Please try again.')), 8000)
    );

    const { error } = await Promise.race([updatePromise, timeoutPromise]);
    
    if (error) {
      toast.error('Failed to update password');
      throw error;
    }
    toast.success('Password updated successfully');
  }, []);

  // Re-fetch the current user's profile, e.g. for the approval gate's retry.
  const refreshProfile = useCallback(async () => {
    if (!user) return;

    const profileData = await fetchProfile(user.id, user.email);
    if (profileData) {
      setProfile(profileData);
      setUser({
        id: profileData.id,
        email: profileData.email,
        display_name: profileData.display_name,
        avatar_url: profileData.avatar_url || undefined,
        calendar_color: profileData.calendar_color,
      });
    }
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      signUp,
      signIn,
      signOut,
      updateProfile: updateProfileFn,
      updatePassword,
      refreshProfile,
    }),
    [user, profile, loading, signUp, signIn, signOut, updateProfileFn, updatePassword, refreshProfile]
  );

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="flex flex-col h-screen bg-background items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
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
