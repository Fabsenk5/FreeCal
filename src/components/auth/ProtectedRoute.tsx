/**
 * Protected Route Component
 * 
 * This component wraps routes that require authentication and approval.
 * 
 * Access Control Flow:
 * 1. Check if user is authenticated
 *    - If not → Redirect to /login
 * 2. Check if user profile is loaded
 *    - If loading → Show loading spinner
 *    - If the profile fetch finally failed → Error state with Retry (fail closed)
 * 3. Check if user is approved (or is admin)
 *    - Admin (profiles.is_admin, fallback: fabiank5@hotmail.com) always has access
 *    - Non-approved users → Redirect to /pending-approval
 * 4. If all checks pass → Render children (protected content)
 * 
 * @example
 * ```typescript
 * <Route path="/calendar" element={
 *   <ProtectedRoute>
 *     <CalendarView />
 *   </ProtectedRoute>
 * } />
 * ```
 * 
 * @module components/auth/ProtectedRoute
 */

import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

/**
 * Protected Route wrapper component
 * Ensures user is authenticated and approved before rendering children
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - The protected content to render
 * @returns {JSX.Element} Protected content, loading state, error state, or redirect
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [retrying, setRetrying] = useState(false);

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

  // Admin check: prefer the profiles.is_admin flag, with a documented fallback
  // to the known admin email in case the flag is not yet maintained in the live DB.
  const isAdmin = profile?.is_admin === true || user.email === 'fabiank5@hotmail.com';

  // Fail closed: if the profile could not be loaded at all (Supabase outage /
  // timeout), deny access and offer a retry instead of letting the user in.
  if (!isAdmin && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-sm px-4">
          <p className="text-foreground font-medium">Could not load your profile</p>
          <p className="text-muted-foreground text-sm">
            Please check your connection and try again.
          </p>
          <Button
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              try {
                await refreshProfile();
              } finally {
                setRetrying(false);
              }
            }}
          >
            {retrying ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      </div>
    );
  }

  // Check approval status (non-admin users reaching this point have a profile)
  const isApproved = profile?.is_approved === true || profile?.approval_status === 'approved';
  
  if (!isAdmin && !isApproved) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
}
