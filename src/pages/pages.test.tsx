import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import NotFound from '@/pages/NotFound';
import HealthCheck from '@/pages/HealthCheck';

// Mock auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    loading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    acceptApproval: vi.fn(),
  }),
}));

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
  it('should render app without crashing', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
    expect(document.body).not.toBeEmptyDOMElement();
  });

  it('should render login page', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
  });

  it('should render signup page', () => {
    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>
    );
    expect(screen.getByText(/sign up/i)).toBeInTheDocument();
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
    expect(screen.getByText(/404|not found/i)).toBeInTheDocument();
  });
});

describe('Smoke Tests - Route Navigation', () => {
  it('should render at login route', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>
    );
    expect(document.body).not.toBeEmptyDOMElement();
  });

  it('should render at signup route', () => {
    render(
      <MemoryRouter initialEntries={['/signup']}>
        <App />
      </MemoryRouter>
    );
    expect(document.body).not.toBeEmptyDOMElement();
  });

  it('should render at health check route', () => {
    render(
      <MemoryRouter initialEntries={['/health']}>
        <App />
      </MemoryRouter>
    );
    expect(document.body).not.toBeEmptyDOMElement();
  });

  it('should handle root path', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(document.body).not.toBeEmptyDOMElement();
  });
});
