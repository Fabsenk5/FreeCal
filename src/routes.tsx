import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import ErrorBoundaryLayout from '@/components/errors/ErrorBoundaryLayout';
import RootBoundary from '@/components/errors/RootBoundary';

// Pages are lazily loaded so heavy features (maps, wishlist, ...) stay out of
// the entry chunk. The Suspense boundary lives in ErrorBoundaryLayout.
const Index = lazy(() => import('@/pages/index'));
const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })));
const Signup = lazy(() => import('@/pages/Signup').then((m) => ({ default: m.Signup })));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const HealthCheck = lazy(() => import('@/pages/HealthCheck').then((m) => ({ default: m.HealthCheck })));
const PendingApproval = lazy(() => import('@/pages/PendingApproval').then((m) => ({ default: m.PendingApproval })));
const FreeTimeFinderV2 = lazy(() => import('@/pages/FreeTimeFinderV2').then((m) => ({ default: m.FreeTimeFinderV2 })));
const FeatureWishlist = lazy(() => import('@/pages/FeatureWishlist').then((m) => ({ default: m.FeatureWishlist })));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy').then((m) => ({ default: m.PrivacyPolicy })));
const NotFound = lazy(() => import('@/pages/NotFound'));

const routes = [
  {
    path: "/",
    element: <ErrorBoundaryLayout />,
    errorElement: <RootBoundary />,
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute>
            <Index />
          </ProtectedRoute>
        ),
      },
      {
        path: "login",
        element: <Login />,
      },
      {
        path: "signup",
        element: <Signup />,
      },
      {
        path: "forgot-password",
        element: <ForgotPassword />,
      },
      {
        path: "reset-password",
        element: <ResetPassword />,
      },
      {
        path: "pending-approval",
        element: <PendingApproval />,
      },
      {
        path: "free-time-v2",
        element: (
          <ProtectedRoute>
            <FreeTimeFinderV2 />
          </ProtectedRoute>
        ),
      },
      {
        path: "feature-wishlist",
        element: (
          <ProtectedRoute>
            <FeatureWishlist />
          </ProtectedRoute>
        ),
      },
      {
        path: "health",
        element: <HealthCheck />,
      },
      {
        path: "privacy-policy",
        element: <PrivacyPolicy />,
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
];

const basename = (window as Window & { __APP_BASENAME__?: string }).__APP_BASENAME__ || "/";
export const router = createBrowserRouter(routes, { basename });
