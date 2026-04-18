import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
    Calendar, Users, DollarSign, TrendingUp,
    ArrowUpRight, ArrowDownRight, Clock
} from 'lucide-react'

interface Stats {
    clientCount: number
    bookingsTodayCount: number
    monthRevenue: number
    pendingInvoices: number
}

interface PendingInvoice {
    id: string
    balance_due: number
    clients: { first_name: string; last_name: string }
}

interface RecentBooking {
    id: string
    start_at: string
    status: string
    clients: { first_name: string; last_name: string }
    services: { name: string }
    org_members: { display_name: string }
}

export function DashboardPage() {
    const { orgMember, memberLabel } = useAuth()
    const [stats, setStats] = useState<Stats>({ clientCount: 0, bookingsTodayCount: 0, monthRevenue: 0, pendingInvoices: 0 })
    const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([])
    const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!orgMember) return
        const orgId = orgMember.org_id

        const fetchData = async () => {
            const today = new Date().toISOString().split('T')[0]
            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

            const [clientsRes, bookingsTodayRes, revenueRes, pendingRes, recentRes] = await Promise.all([
                supabase.from('clients').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('active', true),
                supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('org_id', orgId).gte('start_at', today + 'T00:00:00').lte('start_at', today + 'T23:59:59'),
                supabase.from('payments').select('amount').eq('org_id', orgId).gte('date', monthStart.split('T')[0]),
                supabase.from('invoices').select('id, balance_due, clients(first_name, last_name)').eq('org_id', orgId).in('status', ['open', 'partial']).order('balance_due', { ascending: false }),
                supabase.from('bookings').select('id, start_at, status, clients(first_name, last_name), services(name), org_members(display_name)')
                    .eq('org_id', orgId).order('start_at', { ascending: false }).limit(8),
            ])

            const monthRevenue = revenueRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0

            const pendingData = (pendingRes.data as unknown as PendingInvoice[]) || []
            setStats({
                clientCount: clientsRes.count || 0,
                bookingsTodayCount: bookingsTodayRes.count || 0,
                monthRevenue,
                pendingInvoices: pendingData.length,
            })
            setPendingInvoices(pendingData)
            setRecentBookings((recentRes.data as unknown as RecentBooking[]) || [])
            setLoading(false)
        }

        fetchData()
    }, [orgMember])

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount)

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr)
        return d.toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    const statusLabel: Record<string, string> = {
        scheduled: 'Programada',
        confirmed: 'Confirmada',
        completed: 'Completada',
        cancelled: 'Cancelada',
        no_show: 'No Show',
    }

    if (loading) {
        return <div className="loading-screen"><div className="spinner" /><span style={{ color: 'var(--color-text-tertiary)' }}>Cargando...</span></div>
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <h2>Dashboard</h2>
                <p>Resumen de tu negocio — {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>

            <div className="stats-grid">
                <div className="card stat-card info">
                    <div className="card-header">
                        <span className="card-title">Citas hoy</span>
                        <div className="card-icon" style={{ background: 'var(--color-info-soft)', color: 'var(--color-info)' }}>
                            <Calendar />
                        </div>
                    </div>
                    <div className="card-value">{stats.bookingsTodayCount}</div>
                    <div className="card-footer">
                        <span className="card-trend up"><ArrowUpRight size={14} /> Día activo</span>
                    </div>
                </div>

                <div className="card stat-card accent">
                    <div className="card-header">
                        <span className="card-title">Clientes activos</span>
                        <div className="card-icon" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>
                            <Users />
                        </div>
                    </div>
                    <div className="card-value">{stats.clientCount}</div>
                    <div className="card-footer">Total registrados</div>
                </div>

                <div className="card stat-card success">
                    <div className="card-header">
                        <span className="card-title">Ingresos del mes</span>
                        <div className="card-icon" style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)' }}>
                            <DollarSign />
                        </div>
                    </div>
                    <div className="card-value">{formatCurrency(stats.monthRevenue)}</div>
                    <div className="card-footer">
                        <span className="card-trend up"><TrendingUp size={14} /> Este mes</span>
                    </div>
                </div>

                <div className="card stat-card warning"
                    title={pendingInvoices.length > 0
                        ? pendingInvoices.map(inv => `${inv.clients?.first_name} ${inv.clients?.last_name}: ${formatCurrency(Number(inv.balance_due))}`).join('\n')
                        : 'Sin comprobantes pendientes'}
                >
                    <div className="card-header">
                        <span className="card-title">Comprobantes pendientes</span>
                        <div className="card-icon" style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}>
                            <Clock />
                        </div>
                    </div>
                    <div className="card-value">{stats.pendingInvoices}</div>
                    <div className="card-footer">Por cobrar</div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="card-header">
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>Últimas reservas</h3>
                </div>
                {recentBookings.length === 0 ? (
                    <div className="empty-state">
                        <Calendar />
                        <h3>Sin reservas aún</h3>
                        <p>Las reservas creadas aparecerán aquí.</p>
                    </div>
                ) : (
                    <div className="data-table-wrapper" style={{ border: 'none' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Cliente</th>
                                    <th>Servicio</th>
                                    <th>{memberLabel}</th>
                                    <th>Fecha</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentBookings.map((b) => (
                                    <tr key={b.id}>
                                        <td style={{ fontWeight: 500 }}>{b.clients?.first_name} {b.clients?.last_name}</td>
                                        <td>{b.services?.name}</td>
                                        <td style={{ color: 'var(--color-text-secondary)' }}>{b.org_members?.display_name}</td>
                                        <td style={{ color: 'var(--color-text-secondary)' }}>{formatTime(b.start_at)}</td>
                                        <td><span className={`badge badge-${b.status.replace('_', '-')}`}>{statusLabel[b.status] || b.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
