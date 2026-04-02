/**
 * Authentication Context & Provider — Supabase Edition
 *
 * Manages global auth state using Supabase Auth.
 * Replaces the old JWT/localStorage-based auth.
 */
import { createContext, useContext, useEffect, useState } from 'react';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  // Fetch profile from profiles table
  const fetchProfile = async (userId: string, email: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data;
  };

  // Convert session to our User/Profile types
  const setFromSession = async (session: Session | null) => {
    if (!session?.user) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

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

    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    let initialSessionFetched = false;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        initialSessionFetched = true;
        setFromSession(session);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;
        // In Supabase v2, INITIAL_SESSION fires immediately on listener attachment.
        // We skip it if getSession has already run, or we let it run if it beats getSession.
        if (event === 'INITIAL_SESSION' && initialSessionFetched) return;
        initialSessionFetched = true; // Mark as fetched whichever finishes first
        
        await setFromSession(session);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, displayName: string) => {
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
  };

  const signIn = async (email: string, password: string) => {
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
  };

  const signOut = async () => {
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
    localStorage.removeItem('cached_events');
    toast.success('Signed out successfully');
  };

  const updateProfileFn = async (updates: Partial<Profile>) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .update({
        display_name: updates.display_name,
        calendar_color: updates.calendar_color,
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      toast.error('Failed to update profile');
      throw error;
    }

    setProfile(data);
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error('Failed to update password');
      throw error;
    }
    toast.success('Password updated successfully');
  };

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile: updateProfileFn,
    updatePassword,
  };

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