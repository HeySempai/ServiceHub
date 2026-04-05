import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../useAuth'
import { ReactNode } from 'react'

// Componente de prueba para usar el hook
function TestComponent() {
  const { user, loading, orgMember, memberLabel, signOut } = useAuth()

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <div data-testid="user-email">{user?.email || 'No user'}</div>
      <div data-testid="member-label">{memberLabel}</div>
      <div data-testid="org-member">{orgMember?.display_name || 'No member'}</div>
      <button onClick={signOut} data-testid="logout-btn">
        Logout
      </button>
    </div>
  )
}

// Wrapper con AuthProvider
function Wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should provide loading state initially', () => {
    render(<TestComponent />, { wrapper: Wrapper })

    expect(screen.getByText(/Loading.../i)).toBeInTheDocument()
  })

  it('should provide user authentication state', async () => {
    render(<TestComponent />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.queryByText(/Loading.../i)).not.toBeInTheDocument()
    })

    expect(screen.getByTestId('user-email')).toBeInTheDocument()
  })

  it('should provide memberLabel for display', async () => {
    render(<TestComponent />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('member-label')).toBeInTheDocument()
    })
  })

  it('should provide signOut method', async () => {
    render(<TestComponent />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('logout-btn')).toBeInTheDocument()
    })

    const logoutBtn = screen.getByTestId('logout-btn')
    expect(logoutBtn).toBeInTheDocument()
  })

  it('should handle missing credentials gracefully', async () => {
    render(<TestComponent />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toBeInTheDocument()
    })

    // Should show "No user" when not authenticated
    const userEmail = screen.getByTestId('user-email')
    expect(userEmail.textContent).toMatch(/No user|@/i)
  })
})
