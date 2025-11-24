import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, LogOut, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export function PendingApproval() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);

  const isRejected = profile?.approval_status === 'rejected';
  const isApproved = profile?.approval_status === 'approved' && profile?.is_approved;

  // Auto-redirect to home after 3 seconds if approved
  useEffect(() => {
    if (isApproved) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            navigate('/');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isApproved, navigate]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Global App Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-xl font-bold text-primary hover:text-primary/80 transition-colors"
          >
            <Calendar className="h-6 w-6" />
            <span>FreeCal</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          {/* Status Card */}
          <div className="bg-card rounded-2xl p-8 shadow-card text-center space-y-4">
            {isApproved ? (
              <>
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                </div>

                <div>
                  <h1 className="text-2xl font-bold mb-2">
                    Account Approved!
                  </h1>
                  <p className="text-muted-foreground">
                    Your account has been approved. Redirecting to home in {countdown} second{countdown !== 1 ? 's' : ''}...
                  </p>
                </div>

                <Button
                  onClick={() => navigate('/')}
                  className="w-full mt-4"
                >
                  Go to Home Now
                </Button>
              </>
            ) : (
              <>
                <div className="flex justify-center mb-4">
                  <div className={`w-16 h-16 rounded-full ${isRejected ? 'bg-destructive/10' : 'bg-primary/10'} flex items-center justify-center`}>
                    <Clock className={`w-8 h-8 ${isRejected ? 'text-destructive' : 'text-primary'}`} />
                  </div>
                </div>

                <div>
                  <h1 className="text-2xl font-bold mb-2">
                    {isRejected ? 'Access Denied' : 'Account Pending Approval'}
                  </h1>
                  <p className="text-muted-foreground">
                    {isRejected 
                      ? 'Your account registration has been rejected. Please contact support if you believe this is an error.'
                      : 'Thank you for registering! Your account is in beta phase and needs to be approved. You\'ll receive access once approved by our team.'
                    }
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium">Account Details</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><strong>Name:</strong> {profile?.display_name}</p>
                    <p><strong>Email:</strong> {profile?.email}</p>
                    <p><strong>Status:</strong> <span className={isRejected ? 'text-destructive' : 'text-primary'}>{profile?.approval_status}</span></p>
                  </div>
                </div>

                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  className="w-full mt-4 flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              </>
            )}
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground">
            {isApproved 
              ? 'Welcome to FreeCal!'
              : isRejected 
              ? 'Contact support for assistance'
              : 'We typically review new accounts within 24 hours'
            }
          </p>
        </div>
      </div>
    </div>
  );
}