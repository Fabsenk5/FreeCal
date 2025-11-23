import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check approval status
  // Admin user (fabiank5@hotmail.com) always has access
  const isAdmin = profile?.email === 'fabiank5@hotmail.com';
  const isApproved = profile?.is_approved === true || profile?.approval_status === 'approved';
  
  if (!isAdmin && !isApproved && profile) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
}