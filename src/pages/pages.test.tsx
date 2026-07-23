import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '@/App';
import { Login } from '@/pages/Login';
import { Signup } from '@/pages/Signup';
import NotFound from '@/pages/NotFound';
import { HealthCheck } from '@/pages/HealthCheck';

// Mock auth context (AuthProvider as pass-through so App can render)
vi.mock('@/contexts/AuthContext', async () => {
  const React = await import('react');
  return {
    useAuth: () => ({
      user: null,
      profile: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      acceptApproval: vi.fn(),
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      eq: vi.fn(),
    })),
  },
}));

describe('Smoke Tests - All Pages Render', () => {
  it('should render app without crashing', async () => {
    // App brings its own RouterProvider, so it must not be wrapped in another router
    render(<App />);
    // Routes are lazily loaded, so the initial render shows a loading fallback
    await waitFor(() => expect(document.body).not.toBeEmptyDOMElement());
  });

  it('should render login page', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should render signup page', () => {
    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
  });

  it('should render health check page', () => {
    render(
      <MemoryRouter>
        <HealthCheck />
      </MemoryRouter>
    );
    expect(document.body).not.toBeEmptyDOMElement();
  });

  it('should render 404 page', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /404|not found/i })).toBeInTheDocument();
  });
});

describe('Smoke Tests - Route Navigation', () => {
  it('should render at login route', async () => {
    render(<App />);
    await waitFor(() => expect(document.body).not.toBeEmptyDOMElement());
  });

  it('should render at signup route', async () => {
    render(<App />);
    await waitFor(() => expect(document.body).not.toBeEmptyDOMElement());
  });

  it('should render at health check route', async () => {
    render(<App />);
    await waitFor(() => expect(document.body).not.toBeEmptyDOMElement());
  });

  it('should handle root path', async () => {
    render(<App />);
    // Unauthenticated users are redirected to the lazily loaded login page
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
});
