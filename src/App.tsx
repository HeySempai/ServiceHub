import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { AppLayout } from '@/components/AppLayout'
import { LoginPage, RegisterPage } from '@/pages/Auth'
import { OnboardingPage } from '@/pages/Onboarding'
import { DashboardPage } from '@/pages/Dashboard'
import { ClientsPage } from '@/pages/Clients'
import { BookingsPage } from '@/pages/Bookings'
import { ServicesPage } from '@/pages/Services'
import { InvoicesPage } from '@/pages/Invoices'
import { PaymentsPage } from '@/pages/Payments'
import { ExpensesPage } from '@/pages/Expenses'
import { SettingsPage } from '@/pages/Settings'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, orgMember, loading } = useAuth()

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner" />
                <span style={{ color: 'var(--color-text-tertiary)' }}>Cargando...</span>
            </div>
        )
    }

    if (!user) return <Navigate to="/login" replace />

    // User is authenticated but has no org → send to onboarding
    if (!orgMember) return <Navigate to="/onboarding" replace />

    return <>{children}</>
}

function OnboardingRoute({ children }: { children: React.ReactNode }) {
    const { user, orgMember, loading } = useAuth()

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner" />
            </div>
        )
    }

    if (!user) return <Navigate to="/login" replace />

    // Already has an org → go to dashboard
    if (orgMember) return <Navigate to="/" replace />

    return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth()
    if (loading) {
        return (
            <div className="loading-screen">
                <div className="spinner" />
            </div>
        )
    }
    if (user) return <Navigate to="/" replace />
    return <>{children}</>
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                    <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
                    <Route path="/onboarding" element={<OnboardingRoute><OnboardingPage /></OnboardingRoute>} />

                    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                        <Route index element={<DashboardPage />} />
                        <Route path="clients" element={<ClientsPage />} />
                        <Route path="bookings" element={<BookingsPage />} />
                        <Route path="services" element={<ServicesPage />} />
                        <Route path="invoices" element={<InvoicesPage />} />
                        <Route path="payments" element={<PaymentsPage />} />
                        <Route path="expenses" element={<ExpensesPage />} />
                        <Route path="settings" element={<SettingsPage />} />
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    )
}
