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
 * 3. Check if user is approved (or is admin)
 *    - Admin (fabiank5@hotmail.com) always has access
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

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Protected Route wrapper component
 * Ensures user is authenticated and approved before rendering children
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - The protected content to render
 * @returns {JSX.Element} Protected content, loading state, or redirect
 */
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