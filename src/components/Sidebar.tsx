import { useState, useEffect } from 'react'
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
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

    // Sync CSS variable on mount so main-content margin matches sidebar state
    useEffect(() => {
        document.documentElement.style.setProperty(
            '--sidebar-current',
            collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)'
        )
    }, [])

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
                        style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
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

            <nav className="sidebar-nav" style={collapsed ? { alignItems: 'center' } : undefined}>
                {collapsed ? <div style={{ height: 'var(--space-sm)' }} /> : <span className="sidebar-section-label">General</span>}
                <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Dashboard" style={collapsed ? { justifyContent: 'center' } : undefined}>
                    <LayoutDashboard />
                    {!collapsed && <span>Dashboard</span>}
                </NavLink>

                {collapsed ? <div style={{ height: 1, background: 'var(--color-glass-border)', width: '60%', margin: 'var(--space-xs) 0' }} /> : <span className="sidebar-section-label">Operaciones</span>}
                {operationItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        title={item.label}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        style={collapsed ? { justifyContent: 'center' } : undefined}
                    >
                        <item.icon />
                        {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                ))}

                {collapsed ? <div style={{ height: 1, background: 'var(--color-glass-border)', width: '60%', margin: 'var(--space-xs) 0' }} /> : <span className="sidebar-section-label">Gestión</span>}
                {managementItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        title={item.label}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        style={collapsed ? { justifyContent: 'center' } : undefined}
                    >
                        <item.icon />
                        {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                ))}

                <div style={{ marginTop: 'auto', paddingTop: 'var(--space-md)' }}>
                    {collapsed ? <div style={{ height: 1, background: 'var(--color-glass-border)', width: '60%', margin: '0 auto var(--space-xs)' }} /> : <span className="sidebar-section-label">Sistema</span>}
                    <NavLink to="/settings" title="Configuración" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={collapsed ? { justifyContent: 'center' } : undefined}>
                        <Settings />
                        {!collapsed && <span>Configuración</span>}
                    </NavLink>
                    <button
                        onClick={toggleCollapse}
                        className="nav-item"
                        title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
                        style={collapsed ? { justifyContent: 'center', border: 'none', width: '100%', cursor: 'pointer' } : { border: 'none', width: '100%', cursor: 'pointer' }}
                    >
                        {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                        {!collapsed && <span>Colapsar</span>}
                    </button>
                </div>
            </nav>

            <div className="sidebar-footer">
                <div className="user-info" onClick={() => setShowLogoutConfirm(true)} title="Cerrar sesión" style={collapsed ? { justifyContent: 'center', padding: '12px' } : undefined}>
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

            {showLogoutConfirm && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowLogoutConfirm(false)}>
                    <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '24px', maxWidth: 340, width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid var(--color-glass-border)' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 8px', fontSize: '16px', color: 'var(--color-text-primary)' }}>Cerrar sesión</h3>
                        <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                            ¿Estás seguro que deseas cerrar sesión?
                        </p>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" style={{ borderRadius: '12px', padding: '8px 16px', border: 'none' }} onClick={() => setShowLogoutConfirm(false)}>
                                Cancelar
                            </button>
                            <button className="btn" style={{ borderRadius: '12px', padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none' }} onClick={handleSignOut}>
                                Cerrar sesión
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    )
}
