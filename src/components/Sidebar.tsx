import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
    LayoutDashboard,
    Users,
    Calendar,
    Scissors,
    FileText,
    CreditCard,
    Receipt,
    Settings,
    LogOut,
} from 'lucide-react'

const operationItems = [
    { label: 'Citas', to: '/bookings', icon: Calendar },
    { label: 'Comprobantes', to: '/invoices', icon: FileText },
    { label: 'Pagos', to: '/payments', icon: CreditCard },
]

const managementItems = [
    { label: 'Clientes', to: '/clients', icon: Users },
    { label: 'Servicios', to: '/services', icon: Scissors },
    { label: 'Gastos', to: '/expenses', icon: Receipt },
]

export function Sidebar() {
    const { user, orgMember, signOut } = useAuth()
    const navigate = useNavigate()

    const handleSignOut = async () => {
        await signOut()
        navigate('/login')
    }

    const initials = orgMember?.display_name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U'

    const logoUrl = orgMember?.organizations?.logo_url
    const orgName = orgMember?.organizations?.name || 'Mi Negocio'

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                {logoUrl ? (
                    <img
                        src={logoUrl}
                        alt={orgName}
                        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                ) : (
                    <div className="sidebar-logo">S</div>
                )}
                <div className="sidebar-brand">
                    <h1>{orgName}</h1>
                </div>
            </div>

            <nav className="sidebar-nav">
                <span className="sidebar-section-label">General</span>
                <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <LayoutDashboard />
                    <span>Dashboard</span>
                </NavLink>

                <span className="sidebar-section-label">Operaciones</span>
                {operationItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <item.icon />
                        <span>{item.label}</span>
                    </NavLink>
                ))}

                <span className="sidebar-section-label">Gestión</span>
                {managementItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <item.icon />
                        <span>{item.label}</span>
                    </NavLink>
                ))}

                <div style={{ marginTop: 'auto', paddingTop: 'var(--space-md)' }}>
                    <span className="sidebar-section-label">Sistema</span>
                    <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Settings />
                        <span>Configuración</span>
                    </NavLink>
                </div>
            </nav>

            <div className="sidebar-footer">
                <div className="user-info" onClick={handleSignOut} title="Cerrar sesión">
                    <div className="user-avatar">{initials}</div>
                    <div className="user-details">
                        <span className="name">{orgMember?.display_name || user?.email}</span>
                        <span className="role">{orgMember?.role || 'usuario'}</span>
                    </div>
                    <LogOut style={{ width: 16, height: 16, marginLeft: 'auto', opacity: 0.4 }} />
                </div>
            </div>
        </aside>
    )
}
