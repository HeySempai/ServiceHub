import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Sidebar } from '../Sidebar'
import { AuthProvider } from '@/hooks/useAuth'

// Mock de useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <AuthProvider>{children}</AuthProvider>
    </BrowserRouter>
  )
}

describe('Sidebar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render sidebar container', () => {
    render(<Sidebar />, { wrapper: Wrapper })

    const sidebar = document.querySelector('.sidebar')
    expect(sidebar).toBeInTheDocument()
  })

  it('should display ServiceHub branding', () => {
    render(<Sidebar />, { wrapper: Wrapper })

    expect(screen.getByText('ServiceHub')).toBeInTheDocument()
  })

  it('should render navigation links', () => {
    render(<Sidebar />, { wrapper: Wrapper })

    // Check for operation items
    expect(screen.getByText('Citas')).toBeInTheDocument()
    expect(screen.getByText('Comprobantes')).toBeInTheDocument()
    expect(screen.getByText('Pagos')).toBeInTheDocument()

    // Check for management items
    expect(screen.getByText('Clientes')).toBeInTheDocument()
    expect(screen.getByText('Servicios')).toBeInTheDocument()
    expect(screen.getByText('Gastos')).toBeInTheDocument()
  })

  it('should render logout button', () => {
    render(<Sidebar />, { wrapper: Wrapper })

    const logoutButton = screen.getByRole('button', { name: /logout|cerrar sesión/i })
    expect(logoutButton).toBeInTheDocument()
  })

  it('should have proper navigation links', () => {
    render(<Sidebar />, { wrapper: Wrapper })

    const bookingsLink = screen.getByRole('link', { name: /citas/i })
    expect(bookingsLink).toHaveAttribute('href', '/bookings')

    const clientsLink = screen.getByRole('link', { name: /clientes/i })
    expect(clientsLink).toHaveAttribute('href', '/clients')
  })

  it('should display user avatar section', () => {
    render(<Sidebar />, { wrapper: Wrapper })

    const avatar = document.querySelector('.sidebar-avatar')
    expect(avatar).toBeInTheDocument()
  })
})
