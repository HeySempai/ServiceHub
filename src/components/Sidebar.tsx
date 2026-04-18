import { useState } from 'react'
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
    PanelLeftClose,
    PanelLeftOpen,
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
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true')

    const toggleCollapse = () => {
        const next = !collapsed
        setCollapsed(next)
        localStorage.setItem('sidebar-collapsed', String(next))
        document.documentElement.style.setProperty('--sidebar-current', next ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)')
    }

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
        <aside className="sidebar" style={{ width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)' }}>
            <div className="sidebar-header" style={{ justifyContent: collapsed ? 'center' : undefined, padding: collapsed ? 'var(--space-lg) var(--space-sm)' : undefined }}>
                {logoUrl ? (
                    <img
                        src={logoUrl}
                        alt={orgName}
                        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                ) : (
                    <div className="sidebar-logo">S</div>
                )}
                {!collapsed && (
                    <div className="sidebar-brand">
                        <h1>{orgName}</h1>
                    </div>
                )}
            </div>

            <nav className="sidebar-nav" style={collapsed ? { alignItems: 'center', padding: '0 var(--space-xs)' } : undefined}>
                {!collapsed && <span className="sidebar-section-label">General</span>}
                <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Dashboard" style={collapsed ? { justifyContent: 'center', padding: '10px' } : undefined}>
                    <LayoutDashboard />
                    {!collapsed && <span>Dashboard</span>}
                </NavLink>

                {!collapsed && <span className="sidebar-section-label">Operaciones</span>}
                {operationItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        title={item.label}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        style={collapsed ? { justifyContent: 'center', padding: '10px' } : undefined}
                    >
                        <item.icon />
                        {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                ))}

                {!collapsed && <span className="sidebar-section-label">Gestión</span>}
                {managementItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        title={item.label}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        style={collapsed ? { justifyContent: 'center', padding: '10px' } : undefined}
                    >
                        <item.icon />
                        {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                ))}

                <div style={{ marginTop: 'auto', paddingTop: 'var(--space-md)' }}>
                    {!collapsed && <span className="sidebar-section-label">Sistema</span>}
                    <NavLink to="/settings" title="Configuración" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={collapsed ? { justifyContent: 'center', padding: '10px' } : undefined}>
                        <Settings />
                        {!collapsed && <span>Configuración</span>}
                    </NavLink>
                    <button
                        onClick={toggleCollapse}
                        className="nav-item"
                        title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
                        style={collapsed ? { justifyContent: 'center', padding: '10px', border: 'none', width: '100%', cursor: 'pointer' } : { border: 'none', width: '100%', cursor: 'pointer' }}
                    >
                        {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                        {!collapsed && <span>Colapsar</span>}
                    </button>
                </div>
            </nav>

            <div className="sidebar-footer">
                <div className="user-info" onClick={handleSignOut} title="Cerrar sesión" style={collapsed ? { justifyContent: 'center', padding: '12px' } : undefined}>
                    <div className="user-avatar">{initials}</div>
                    {!collapsed && (
                        <>
                            <div className="user-details">
                                <span className="name">{orgMember?.display_name || user?.email}</span>
                                <span className="role">{orgMember?.role || 'usuario'}</span>
                            </div>
                            <LogOut style={{ width: 16, height: 16, marginLeft: 'auto', opacity: 0.4 }} />
                        </>
                    )}
                </div>
            </div>
        </aside>
    )
}
