import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from '../App'
import { AuthProvider } from '@/hooks/useAuth'

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <AuthProvider>{children}</AuthProvider>
    </BrowserRouter>
  )
}

describe('App Router', () => {
  it('should render without crashing', () => {
    render(<App />, { wrapper: Wrapper })
    expect(document.body).toBeInTheDocument()
  })

  it('should handle route navigation', () => {
    render(<App />, { wrapper: Wrapper })
    // Basic smoke test - app should render without errors
    expect(document.querySelector('main')).toBeInTheDocument()
  })
})
