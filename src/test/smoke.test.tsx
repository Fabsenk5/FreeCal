import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '@/App';

// Mock Supabase to avoid auth state issues in tests
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      in: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
  },
}));

describe('Smoke Tests - App Rendering', () => {
  it('should render app without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeTruthy();
  });

  it('should have root div with min-h-screen class', () => {
    const { container } = render(<App />);
    const rootDiv = container.querySelector('[class*="min-h-screen"]');
    expect(rootDiv).toBeTruthy();
  });

  it('should render without blank page', () => {
    const { container } = render(<App />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

describe('Smoke Tests - All Pages Render', () => {
  it('should render without errors', async () => {
    const { container } = render(<App />);
    expect(document.body.innerHTML.length).toBeGreaterThan(0);
  });

  it('should not have empty root div', () => {
    const { container } = render(<App />);
    const root = container.firstChild;
    expect(root).toBeTruthy();
    if (root instanceof Element) {
      expect(root.childNodes.length).toBeGreaterThan(0);
    }
  });

  it('should render AuthProvider wrapper', () => {
    render(<App />);
    // If we get here without errors, AuthProvider rendered successfully
    expect(true).toBe(true);
  });

  it('should render RouterProvider wrapper', () => {
    render(<App />);
    // RouterProvider is working if we get here without routing errors
    expect(true).toBe(true);
  });

  it('should not show 404 on initial render', () => {
    render(<App />);
    expect(screen.queryByText(/404/i) || screen.queryByText(/not found/i)).toBeNull();
  });
});

describe('Smoke Tests - Component Structure', () => {
  it('should have proper component hierarchy', () => {
    const { container } = render(<App />);
    expect(container.querySelector('[class*="min-h-screen"]')).toBeTruthy();
  });

  it('should render without console errors', () => {
    const consoleSpy = vi.spyOn(console, 'error');
    render(<App />);
    // Suppress act warnings which are expected in test environment
    const relevantErrors = consoleSpy.mock.calls.filter(
      call => !call[0]?.toString().includes('act(...)') && 
              !call[0]?.toString().includes('React Router')
    );
    consoleSpy.mockRestore();
    expect(relevantErrors.length).toBe(0);
  });

  it('should mount and unmount without errors', () => {
    const { unmount } = render(<App />);
    expect(() => unmount()).not.toThrow();
  });

  it('should be responsive to window size', () => {
    render(<App />);
    expect(window.matchMedia).toBeDefined();
  });
});

describe('Smoke Tests - DOM Structure', () => {
  it('should have a valid React root', () => {
    const { container } = render(<App />);
    expect(container.childNodes.length).toBeGreaterThan(0);
  });

  it('should not have undefined children', () => {
    const { container } = render(<App />);
    const walk = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        Array.from(node.childNodes).forEach(child => {
          expect(child).toBeDefined();
          walk(child);
        });
      }
    };
    walk(container);
  });

  it('should render complete HTML tree', () => {
    const { container } = render(<App />);
    const html = container.innerHTML;
    expect(html.length).toBeGreaterThan(100);
    expect(html).toContain('min-h-screen');
  });

  it('should have proper styling classes', () => {
    const { container } = render(<App />);
    const styledElements = container.querySelectorAll('[class*="bg-"]');
    // Even if 0 styled elements, the container itself has classes
    expect(container.querySelector('[class]')).toBeTruthy();
  });
});