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

    const textStyle = {
        opacity: collapsed ? 0 : 1,
        transition: 'opacity 200ms ease',
        whiteSpace: 'nowrap' as const,
        overflow: 'hidden' as const,
        pointerEvents: (collapsed ? 'none' : 'auto') as const,
    }

    const sectionLabel = (label: string) => (
        <span className="sidebar-section-label" style={{ ...textStyle, height: collapsed ? 8 : undefined }}>
            {label}
        </span>
    )

    const divider = collapsed ? (
        <div style={{ height: 1, background: 'var(--color-glass-border)', width: '60%', margin: 'var(--space-xs) auto', transition: 'opacity 200ms ease' }} />
    ) : null

    return (
        <aside className="sidebar" style={{ width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)' }}>
            <div className="sidebar-header" style={{ overflow: 'hidden' }}>
                {logoUrl ? (
                    <img
                        src={logoUrl}
                        alt={orgName}
                        style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                ) : (
                    <div className="sidebar-logo">S</div>
                )}
                <div className="sidebar-brand" style={textStyle}>
                    <h1>{orgName}</h1>
                </div>
            </div>

            <nav className="sidebar-nav">
                {sectionLabel('General')}
                {divider}
                <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Dashboard">
                    <LayoutDashboard />
                    <span style={textStyle}>Dashboard</span>
                </NavLink>

                {sectionLabel('Operaciones')}
                {divider}
                {operationItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        title={item.label}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <item.icon />
                        <span style={textStyle}>{item.label}</span>
                    </NavLink>
                ))}

                {sectionLabel('Gestión')}
                {divider}
                {managementItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        title={item.label}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <item.icon />
                        <span style={textStyle}>{item.label}</span>
                    </NavLink>
                ))}

                <div style={{ marginTop: 'auto', paddingTop: 'var(--space-md)' }}>
                    {sectionLabel('Sistema')}
                    {divider}
                    <NavLink to="/settings" title="Configuración" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <Settings />
                        <span style={textStyle}>Configuración</span>
                    </NavLink>
                    <button
                        onClick={toggleCollapse}
                        className="nav-item"
                        title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
                        style={{ border: 'none', width: '100%', cursor: 'pointer' }}
                    >
                        {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                        <span style={textStyle}>{collapsed ? 'Expandir' : 'Colapsar'}</span>
                    </button>
                </div>
            </nav>

            <div className="sidebar-footer" style={{ overflow: 'hidden' }}>
                <div className="user-info" onClick={() => setShowLogoutConfirm(true)} title="Cerrar sesión">
                    <div className="user-avatar">{initials}</div>
                    <div className="user-details" style={textStyle}>
                        <span className="name">{orgMember?.display_name || user?.email}</span>
                        <span className="role">{orgMember?.role || 'usuario'}</span>
                    </div>
                    <LogOut style={{ ...textStyle, width: 16, height: 16, marginLeft: 'auto', opacity: collapsed ? 0 : 0.4 }} />
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
