import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function PendingApproval() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const isRejected = profile?.approval_status === 'rejected';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-elegant">
              <Calendar className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-card rounded-2xl p-8 shadow-card text-center space-y-4">
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
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          {isRejected 
            ? 'Contact support for assistance'
            : 'We typically review new accounts within 24 hours'
          }
        </p>
      </div>
    </div>
  );
}
