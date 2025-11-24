import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, AlertCircle, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { notifyAdminNewUser } from '@/lib/notifications';

// Debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Generate random color for calendar
const getRandomColor = () => {
  const colors = [
    '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B',
    '#EF4444', '#EC4899', '#14B8A6', '#F97316'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

export function Signup() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Email validation states
  const [emailStatus, setEmailStatus] = useState<'checking' | 'available' | 'taken' | null>(null);

  // Check email availability
  const checkEmailAvailability = useCallback(async (emailToCheck: string) => {
    if (!emailToCheck || !emailToCheck.includes('@')) {
      setEmailStatus(null);
      return;
    }

    setEmailStatus('checking');
    
    try {
      const { data, error } = await supabase.rpc('check_email_exists', { 
        email_to_check: emailToCheck 
      });

      console.log('Email check result:', { emailToCheck, data, error });

      if (error) {
        console.error('Email check error:', error);
        setEmailStatus(null);
        return;
      }

      // data is BOOLEAN: true = taken, false = available
      const status = data === true ? 'taken' : 'available';
      console.log('Setting email status to:', status);
      setEmailStatus(status);
    } catch (error) {
      console.error('Email check error:', error);
      setEmailStatus(null);
    }
  }, []);

  // Debounced email checking (500ms delay)
  const debouncedEmailCheck = useMemo(
    () => debounce(checkEmailAvailability, 500),
    [checkEmailAvailability]
  );

  // Handle email input change
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    setError('');
    debouncedEmailCheck(newEmail);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!displayName.trim()) {
      setError('Please enter your name.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please try again.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (emailStatus === 'taken') {
      setError('This email is already registered. Please sign in instead.');
      return;
    }

    if (emailStatus === 'checking') {
      setError('Please wait while we verify your email.');
      return;
    }

    setLoading(true);
    
    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('User creation failed');

      // 2. Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: email,
          display_name: displayName,
          calendar_color: getRandomColor(),
          is_approved: false,
          approval_status: 'pending',
          created_at: new Date().toISOString(),
        });

      if (profileError) throw profileError;

      // 3. Notify admin of new user
      try {
        await notifyAdminNewUser(email, displayName);
      } catch (notifyError) {
        console.error('Failed to notify admin:', notifyError);
        // Don't fail signup if notification fails
      }

      // 4. That's it! User stays logged in
      // The ProtectedRoute will redirect to /pending-approval automatically
      toast.success('Account created successfully!', {
        description: 'Your account is pending approval. You\'ll receive access once approved.',
      });

      // No sign-out, no redirect - just let the auth state update naturally
      // The user will be automatically redirected to /pending-approval by ProtectedRoute
      
    } catch (err: any) {
      console.error('Signup error:', err);
      
      if (err.message?.includes('already registered') || err.message?.includes('User already registered')) {
        setError('An account with this email already exists. Please sign in instead.');
      } else if (err.code === '23505') {
        setError('An account with this email already exists. Please sign in instead.');
      } else if (err.message?.includes('Invalid email')) {
        setError('Please enter a valid email address.');
      } else if (err.message?.includes('Password should be at least 6 characters')) {
        setError('Password must be at least 6 characters long.');
      } else if (err.message?.includes('Unable to validate email')) {
        setError('Invalid email format. Please check your email address.');
      } else {
        setError(err.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo & Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-elegant">
              <Calendar className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Create Account</h1>
          <p className="text-muted-foreground">Start managing your calendar today</p>
        </div>

        {/* Signup Form */}
        <div className="bg-card rounded-2xl p-8 shadow-card">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="displayName">Full Name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Alex Morgan"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setError('');
                }}
                className="bg-background"
                required
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  className={cn(
                    "bg-background pr-10",
                    emailStatus === 'taken' && "border-destructive focus-visible:ring-destructive",
                    emailStatus === 'available' && "border-green-500 focus-visible:ring-green-500"
                  )}
                  required
                  autoComplete="email"
                />
                {/* Email status indicators */}
                {emailStatus === 'checking' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {emailStatus === 'available' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Check className="h-4 w-4 text-green-500" />
                  </div>
                )}
                {emailStatus === 'taken' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="h-4 w-4 text-destructive" />
                  </div>
                )}
              </div>
              {emailStatus === 'taken' && (
                <p className="text-sm text-destructive">
                  This email is already registered.{' '}
                  <Link to="/login" className="underline hover:no-underline">
                    Sign in instead
                  </Link>
                </p>
              )}
              {emailStatus === 'available' && (
                <p className="text-sm text-green-600 dark:text-green-500">
                  Email available
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="bg-background"
                required
                minLength={6}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 6 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                className="bg-background"
                required
                minLength={6}
                autoComplete="new-password"
              />
              {password !== confirmPassword && confirmPassword && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || emailStatus === 'taken' || emailStatus === 'checking'}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          By signing up, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}