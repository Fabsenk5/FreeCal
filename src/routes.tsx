import { createBrowserRouter } from "react-router-dom";
import Index from '@/pages/index';
import NotFound from '@/pages/NotFound';
import { Login } from '@/pages/Login';
import { Signup } from '@/pages/Signup';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import { HealthCheck } from '@/pages/HealthCheck';
import { PendingApproval } from '@/pages/PendingApproval';
import { FreeTimeFinderV2 } from '@/pages/FreeTimeFinderV2';
import { FeatureWishlist } from '@/pages/FeatureWishlist';
import { FreeTimeFinder } from '@/pages/FreeTimeFinder';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

const routes = [
  {
    path: "/",
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
        path: "free-time-v1",
        element: (
          <ProtectedRoute>
            <FreeTimeFinder />
          </ProtectedRoute>
        ),
      },
      {
        path: "health",
        element: <HealthCheck />,
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