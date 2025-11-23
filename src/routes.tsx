import { createBrowserRouter } from "react-router-dom";
import Index from '@/pages/index';
import NotFound from '@/pages/NotFound';
import { Login } from '@/pages/Login';
import { Signup } from '@/pages/Signup';
import { HealthCheck } from '@/pages/HealthCheck';
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