import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Edit2, Phone, Mail, CalendarDays, CreditCard, FileText, Clock } from 'lucide-react'
import { InvoiceDetailModal } from './InvoiceDetailModal'

const fmtMXN = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
const fmt = fmtMXN

interface ClientHistory {
    bookings: { id: string; start_at: string; status: string; services: string[]; total: number; inv_status: string | null }[]
    invoices: { id: string; invoice_number: string | null; status: string; total: number; amount_paid: number; balance_due: number; issued_at: string }[]
    payments: { id: string; date: string; amount: number; method: string | null; notes: string | null }[]
}

interface ClientBase {
    id: string; first_name: string; last_name: string; email: string | null; phone: string | null
    gender: 'M' | 'F' | 'O' | null; birth_date: string | null; notes: string | null; credit_balance: number
}

interface Props {
    clientId: string | null
    orgId: string | undefined
    onClose: () => void
    onEdit?: (client: ClientBase) => void
}

const INV_STATUS: Record<string, { label: string; color: string }> = {
    paid: { label: 'Pagada', color: '#4ade80' },
    open: { label: 'Abierta', color: '#eab308' },
    partial: { label: 'Parcial', color: '#f97316' },
    draft: { label: 'Borrador', color: '#94a3b8' },
    void: { label: 'Anulada', color: '#f87171' },
}

const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null
    const birth = new Date(birthDate)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
}

export function ClientDetailDrawer({ clientId, orgId, onClose, onEdit }: Props) {
    const [client, setClient] = useState<ClientBase | null>(null)
    const [history, setHistory] = useState<ClientHistory | null>(null)
    const [loading, setLoading] = useState(false)
    const [tab, setTab] = useState<'bookings' | 'invoices' | 'payments'>('bookings')
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)

    // Mark as paid
    const [paymentMethods, setPaymentMethods] = useState<{ id: string; name: string }[]>([])
    const [payInvoice, setPayInvoice] = useState<{ id: string; invoice_number: string | null; balance_due: number; client_id: string } | null>(null)
    const [payMethodId, setPayMethodId] = useState('')
    const [payingInvoice, setPayingInvoice] = useState(false)

    useEffect(() => {
        if (!clientId || !orgId) { setClient(null); setHistory(null); return }
        setLoading(true)
        setTab('bookings')

        const fetchDetail = async () => {
            const [clientRes, bkRes, invRes, payRes, pmRes] = await Promise.all([
                supabase.from('clients').select('id, first_name, last_name, email, phone, gender, birth_date, notes, credit_balance').eq('id', clientId).single(),
                supabase.from('bookings').select('id, start_at, status, booking_services(price_snapshot, sort_order, services(name)), services(name, price)').eq('client_id', clientId).order('start_at', { ascending: false }).limit(20),
                supabase.from('invoices').select('id, invoice_number, status, total, amount_paid, balance_due, issued_at').eq('client_id', clientId).order('issued_at', { ascending: false }),
                supabase.from('payments').select('id, date, amount, notes, payment_methods(name)').eq('client_id', clientId).order('date', { ascending: false }),
                supabase.from('payment_methods').select('id, name').eq('org_id', orgId).eq('active', true).order('sort_order'),
            ])

            setClient(clientRes.data as unknown as ClientBase)
            setPaymentMethods(pmRes.data || [])

            const bookingIds = (bkRes.data || []).map((b: any) => b.id)
            const invLinesData = bookingIds.length > 0
                ? (await supabase.from('invoice_lines').select('booking_id, invoices(status)').in('booking_id', bookingIds)).data || []
                : []
            const bookingInvMap = new Map<string, string>()
            for (const line of invLinesData as any[]) {
                if (line.booking_id && line.invoices?.status && !bookingInvMap.has(line.booking_id))
                    bookingInvMap.set(line.booking_id, line.invoices.status)
            }

            const bookings = (bkRes.data || []).map((b: any) => {
                const bsList = b.booking_services?.length > 0 ? [...b.booking_services].sort((a: any, x: any) => a.sort_order - x.sort_order) : null
                return {
                    id: b.id, start_at: b.start_at, status: b.status,
                    services: bsList ? bsList.map((bs: any) => bs.services?.name || '') : [b.services?.name || ''],
                    total: bsList ? bsList.reduce((s: number, x: any) => s + Number(x.price_snapshot), 0) : (b.services?.price || 0),
                    inv_status: bookingInvMap.get(b.id) ?? null,
                }
            })

            setHistory({
                bookings,
                invoices: (invRes.data || []).map((i: any) => ({ id: i.id, invoice_number: i.invoice_number, status: i.status, total: Number(i.total), amount_paid: Number(i.amount_paid), balance_due: Number(i.balance_due), issued_at: i.issued_at })),
                payments: (payRes.data || []).map((p: any) => ({ id: p.id, date: p.date, amount: Number(p.amount), method: p.payment_methods?.name || null, notes: p.notes })),
            })
            setLoading(false)
        }
        fetchDetail()
    }, [clientId, orgId])

    const handleMarkAsPaid = async () => {
        if (!orgId || !payInvoice) return
        setPayingInvoice(true)
        await supabase.rpc('register_payment_full', {
            p_client_id: payInvoice.client_id, p_org_id: orgId, p_amount: payInvoice.balance_due,
            p_method_id: payMethodId || null, p_date: new Date().toISOString().split('T')[0],
            p_notes: `Pago completo - Comprobante ${payInvoice.invoice_number || ''}`,
        })
        setPayInvoice(null); setPayMethodId(''); setPayingInvoice(false)
        // Re-fetch
        if (clientId) {
            const [invRes, payRes, clientRes] = await Promise.all([
                supabase.from('invoices').select('id, invoice_number, status, total, amount_paid, balance_due, issued_at').eq('client_id', clientId).order('issued_at', { ascending: false }),
                supabase.from('payments').select('id, date, amount, notes, payment_methods(name)').eq('client_id', clientId).order('date', { ascending: false }),
                supabase.from('clients').select('id, first_name, last_name, email, phone, gender, birth_date, notes, credit_balance').eq('id', clientId).single(),
            ])
            setClient(clientRes.data as unknown as ClientBase)
            setHistory(h => h ? {
                ...h,
                invoices: (invRes.data || []).map((i: any) => ({ id: i.id, invoice_number: i.invoice_number, status: i.status, total: Number(i.total), amount_paid: Number(i.amount_paid), balance_due: Number(i.balance_due), issued_at: i.issued_at })),
                payments: (payRes.data || []).map((p: any) => ({ id: p.id, date: p.date, amount: Number(p.amount), method: p.payment_methods?.name || null, notes: p.notes })),
            } : null)
        }
    }

    if (!clientId) return null
    if (!client) return loading ? (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 }} />
            <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '520px', maxWidth: '95vw', background: 'var(--color-bg-secondary)', zIndex: 201, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" />
            </div>
        </>
    ) : null

    const initials = `${client.first_name[0] || ''}${client.last_name[0] || ''}`.toUpperCase()
    const completedBookings = history?.bookings.filter(b => b.status === 'completed') || []
    const totalSpent = history?.invoices.reduce((s, i) => s + i.amount_paid, 0) || 0
    const totalPending = history?.invoices.reduce((s, i) => s + i.balance_due, 0) || 0

    const tabs: { key: typeof tab; label: string; count: number }[] = [
        { key: 'bookings', label: 'Citas', count: history?.bookings.length || 0 },
        { key: 'invoices', label: 'Comprobantes', count: history?.invoices.length || 0 },
        { key: 'payments', label: 'Pagos', count: history?.payments.length || 0 },
    ]

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 }} />
            <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '520px', maxWidth: '95vw', background: 'var(--color-bg-secondary)', borderLeft: '1px solid var(--color-glass-border)', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 60px rgba(0,0,0,0.6)' }}>

                {/* Hero header */}
                <div style={{ background: 'var(--color-bg-tertiary)', padding: '28px 28px 0', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-accent), #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, color: 'white', flexShrink: 0, boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}>
                                {initials}
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
                                    {client.first_name} {client.last_name}
                                </h3>
                                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                                    {client.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', color: 'var(--color-text-secondary)' }}><Phone size={11} /> {client.phone}</span>}
                                    {client.email && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', color: 'var(--color-text-secondary)' }}><Mail size={11} /> {client.email}</span>}
                                    {client.birth_date && <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>{calculateAge(client.birth_date)} a</span>}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {onEdit && (
                                <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid var(--color-glass-border)', background: 'var(--color-glass-hover)' }}
                                    onClick={() => { onEdit(client); onClose() }}>
                                    <Edit2 size={12} /> Editar
                                </button>
                            )}
                            <button className="btn-icon" style={{ color: 'var(--color-text-tertiary)' }} onClick={onClose}><X size={18} /></button>
                        </div>
                    </div>

                    {history && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--color-glass-hover)', borderRadius: '12px 12px 0 0', overflow: 'hidden', marginTop: 4 }}>
                            {[
                                { label: 'Visitas', value: completedBookings.length.toString(), color: '#38bdf8' },
                                { label: 'Total gastado', value: fmtMXN(totalSpent), color: '#4ade80' },
                                { label: 'Pendiente', value: totalPending > 0 ? fmtMXN(totalPending) : '—', color: totalPending > 0 ? '#f97316' : 'var(--color-text-tertiary)' },
                                { label: 'Saldo a favor', value: (client.credit_balance || 0) > 0 ? fmtMXN(client.credit_balance) : '—', color: (client.credit_balance || 0) > 0 ? '#4ade80' : 'var(--color-text-tertiary)' },
                            ].map(stat => (
                                <div key={stat.label} style={{ padding: '14px 12px', background: 'var(--color-bg-elevated)', textAlign: 'center' }}>
                                    <div style={{ fontSize: '15px', fontWeight: 700, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                                    <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    {loading && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--color-glass-hover)', borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
                            {[...Array(4)].map((_, i) => <div key={i} style={{ padding: '14px 12px', background: 'var(--color-bg-elevated)', height: 52 }} />)}
                        </div>
                    )}
                </div>

                {/* Tab bar */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--color-glass-border)', background: 'var(--color-bg-secondary)', flexShrink: 0 }}>
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)} style={{
                            flex: 1, padding: '14px 8px', border: 'none', cursor: 'pointer', background: 'transparent',
                            fontSize: '13px', fontWeight: tab === t.key ? 600 : 400,
                            color: tab === t.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                            borderBottom: tab === t.key ? '2px solid var(--color-accent)' : '2px solid transparent',
                            transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}>
                            {t.label}
                            {!loading && t.count > 0 && (
                                <span style={{ fontSize: '10px', background: tab === t.key ? 'var(--color-accent)' : 'var(--color-glass-hover)', color: tab === t.key ? 'white' : 'var(--color-text-secondary)', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>{t.count}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}><div className="spinner" /></div>
                    ) : !history ? null : tab === 'bookings' ? (
                        history.bookings.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--color-text-tertiary)', gap: 8 }}>
                                <CalendarDays size={32} style={{ opacity: 0.3 }} /><span style={{ fontSize: '13px' }}>Sin citas registradas</span>
                            </div>
                        ) : history.bookings.map((b, i) => {
                            const d = new Date(b.start_at)
                            const isDimmed = b.status === 'cancelled' || b.status === 'no_show'
                            const isPending = b.status === 'scheduled' || b.status === 'confirmed'
                            const PayIcon = () => {
                                if (b.status !== 'completed') return null
                                const inv = b.inv_status
                                if (inv === 'paid') return <svg width="30" height="30" viewBox="0 0 30 30" fill="none" style={{ flexShrink: 0 }}><circle cx="15" cy="15" r="13" fill="rgba(34,197,94,0.15)" /><path d="M9.5 15.5 13 19 20.5 11.5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                                if (inv === 'partial') return <svg width="30" height="30" viewBox="0 0 30 30" fill="none" style={{ flexShrink: 0 }}><circle cx="15" cy="15" r="13" fill="rgba(249,115,22,0.15)" /><path d="M15 8.5v8M15 19.5v2" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" /></svg>
                                return <svg width="30" height="30" viewBox="0 0 30 30" fill="none" style={{ flexShrink: 0 }}><circle cx="15" cy="15" r="13" fill="rgba(245,158,11,0.15)" /><path d="M15 8.5v8M15 19.5v2" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" /></svg>
                            }
                            const StatusIcon = () => (b.status === 'cancelled' || b.status === 'no_show') ? <svg width="30" height="30" viewBox="0 0 30 30" fill="none" style={{ flexShrink: 0 }}><circle cx="15" cy="15" r="13" fill="rgba(239,68,68,0.15)" /><path d="M10 10 20 20M20 10 10 20" stroke="#f87171" strokeWidth="2" strokeLinecap="round" /></svg> : null
                            return (
                                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 28px', borderBottom: i < history.bookings.length - 1 ? '1px solid var(--color-glass-border)' : 'none', opacity: isDimmed ? 0.35 : 1 }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-glass)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                    <div style={{ textAlign: 'center', minWidth: 42, flexShrink: 0 }}>
                                        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>{d.getDate()}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>{d.toLocaleDateString('es-MX', { month: 'short' })}</div>
                                    </div>
                                    <div style={{ width: 1, height: 36, background: 'var(--color-glass-border)', flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.services.filter(Boolean).join(' + ') || '—'}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                            <Clock size={11} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                                            <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>{d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} · {d.getFullYear()}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                        {b.total > 0 && <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>${b.total.toLocaleString()}</span>}
                                        {isPending && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--color-text-tertiary)', display: 'inline-block', flexShrink: 0 }} title="Pendiente" />}
                                        <PayIcon /><StatusIcon />
                                    </div>
                                </div>
                            )
                        })
                    ) : tab === 'invoices' ? (
                        history.invoices.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--color-text-tertiary)', gap: 8 }}>
                                <FileText size={32} style={{ opacity: 0.3 }} /><span style={{ fontSize: '13px' }}>Sin comprobantes</span>
                            </div>
                        ) : history.invoices.map((inv, i) => {
                            const st = INV_STATUS[inv.status] || { label: inv.status, color: '#94a3b8' }
                            return (
                                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 28px', borderBottom: i < history.invoices.length - 1 ? '1px solid var(--color-glass-border)' : 'none', cursor: 'pointer' }}
                                    onClick={() => setSelectedInvoiceId(inv.id)}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-glass)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: st.color + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={16} style={{ color: st.color }} /></div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'var(--color-glass-hover)', color: 'var(--color-text-tertiary)', padding: '1px 7px', borderRadius: 4 }}>{inv.invoice_number || inv.id.slice(0, 8)}</span>
                                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 6, background: st.color + '1a', color: st.color, fontWeight: 500 }}>{st.label}</span>
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: 4 }}>{new Date(inv.issued_at + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{fmtMXN(inv.total)}</div>
                                        {inv.balance_due > 0 && <div style={{ fontSize: '11px', color: '#f97316', marginTop: 3 }}>Pendiente {fmtMXN(inv.balance_due)}</div>}
                                    </div>
                                </div>
                            )
                        })
                    ) : (
                        history.payments.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--color-text-tertiary)', gap: 8 }}>
                                <CreditCard size={32} style={{ opacity: 0.3 }} /><span style={{ fontSize: '13px' }}>Sin pagos registrados</span>
                            </div>
                        ) : history.payments.map((pay, i) => {
                            const methodColors: Record<string, string> = { efectivo: '#22c55e', tarjeta: '#6366f1', transferencia: '#3b82f6' }
                            const mColor = Object.entries(methodColors).find(([k]) => (pay.method || '').toLowerCase().includes(k))?.[1] || '#6366f1'
                            return (
                                <div key={pay.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 28px', borderBottom: i < history.payments.length - 1 ? '1px solid var(--color-glass-border)' : 'none' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-glass)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: mColor + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CreditCard size={16} style={{ color: mColor }} /></div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'var(--color-glass-hover)', color: 'var(--color-text-tertiary)', padding: '1px 7px', borderRadius: 4 }}>#{pay.id.slice(0, 8).toUpperCase()}</span>
                                            {pay.method && <span style={{ fontSize: '12px', padding: '1px 8px', borderRadius: 6, background: mColor + '1a', color: mColor, fontWeight: 500 }}>{pay.method}</span>}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                                            {new Date(pay.date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            {pay.notes && <span style={{ marginLeft: 6, fontStyle: 'italic' }}>· {pay.notes}</span>}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '17px', fontWeight: 700, color: '#4ade80', flexShrink: 0 }}>{fmtMXN(pay.amount)}</span>
                                </div>
                            )
                        })
                    )}
                </div>

                {client.notes && (
                    <div style={{ padding: '12px 28px', borderTop: '1px solid var(--color-glass-border)', background: 'var(--color-glass)', flexShrink: 0 }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nota: </span>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>{client.notes}</span>
                    </div>
                )}
            </div>

            <InvoiceDetailModal
                invoiceId={selectedInvoiceId}
                onClose={() => setSelectedInvoiceId(null)}
                onMarkAsPaid={(inv) => {
                    setSelectedInvoiceId(null)
                    setPayInvoice({ id: inv.id, invoice_number: inv.invoice_number, balance_due: inv.balance_due, client_id: client.id })
                }}
            />

            {payInvoice && (
                <div className="modal-overlay" style={{ zIndex: 300 }} onClick={() => setPayInvoice(null)}>
                    <div className="modal" style={{ maxWidth: '420px', width: '95vw' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Marcar como pagado</h3>
                            <button className="modal-close" onClick={() => setPayInvoice(null)}><X size={16} /></button>
                        </div>
                        <div style={{ marginBottom: 'var(--space-md)' }}>
                            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>Se registrará un pago por el saldo pendiente de este comprobante.</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                            <div style={{ background: 'var(--color-glass)', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
                                <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Comprobante</div>
                                <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'monospace' }}>{payInvoice.invoice_number || '—'}</div>
                            </div>
                            <div style={{ background: 'var(--color-glass)', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
                                <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Monto a pagar</div>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-success)' }}>{fmt(payInvoice.balance_due)}</div>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Método de pago</label>
                            <select className="form-input" value={payMethodId} onChange={e => setPayMethodId(e.target.value)}>
                                <option value="">Seleccionar método...</option>
                                {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                            </select>
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => setPayInvoice(null)}>Cancelar</button>
                            <button type="button" className="btn btn-primary" disabled={payingInvoice} onClick={handleMarkAsPaid}>
                                {payingInvoice ? <span className="spinner" /> : 'Confirmar pago'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
