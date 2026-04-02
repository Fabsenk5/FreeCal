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
  const setFromSession = async (session: Session | null) => {
    setLoading(true); // Indicate processing
    
    if (!session?.user) {
      setUser(null);
      setProfile(null);
      setLoading(false);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Supabase v2: We can just rely on onAuthStateChange as it fires INITIAL_SESSION
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        // Execute detached to avoid deadlocks during Auth events (like USER_UPDATED)
        setTimeout(() => {
          if (mounted) {
            setFromSession(session).catch((err) => {
              console.error('Auth context setup error:', err);
              if (mounted) setLoading(false);
            });
          }
        }, 0);
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
  };

  const updatePassword = async (password: string) => {
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