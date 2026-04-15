import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const mockUseAuth = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it('renders outlet when authenticated and active', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1' },
      loading: false,
      profile: { active: true },
      signOut: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/" element={<ProtectedRoute />}>
            <Route path="dashboard" element={<div data-testid="inside">ok</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('inside')).toBeInTheDocument();
  });

  it('redirects inactive users toward login', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1' },
      loading: false,
      profile: { active: false },
      signOut: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/" element={<ProtectedRoute />}>
            <Route path="dashboard" element={<div>inside</div>} />
          </Route>
          <Route path="/login" element={<div data-testid="login">login</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('login')).toBeInTheDocument();
  });
});
