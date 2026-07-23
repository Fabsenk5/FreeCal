import { Component, memo, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last-resort fallback UI for render crashes caught below the router level.
 * Keeps the app theme (no white screen) and offers a reload.
 */
function CrashFallback({ error }: { error: Error }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full p-6 border border-border rounded-lg bg-card text-center space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground break-words">{error.message}</p>
        <button
          className="px-4 py-2 border border-border rounded hover:bg-muted"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    </div>
  );
}

/**
 * Class-based error boundary around the routed content.
 * (react-error-boundary is not a dependency of this project, so the boundary
 * is implemented directly.) Router-level errors are additionally handled by
 * the root route's `errorElement` (RootBoundary) in routes.tsx.
 */
class LayoutErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('Unhandled render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return <CrashFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

/**
 * Fallback shown while a lazily loaded route chunk is loading.
 * Mirrors the spinner used by AuthContext/ProtectedRoute.
 */
function RouteLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/**
 * Root layout route: catches render crashes anywhere in the app and
 * provides the Suspense boundary for lazily loaded pages.
 */
const ErrorBoundaryLayout = () => {
  return (
    <LayoutErrorBoundary>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Outlet />
      </Suspense>
    </LayoutErrorBoundary>
  );
};

export default memo(ErrorBoundaryLayout);
