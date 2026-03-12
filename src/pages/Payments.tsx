import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { CreditCard, Plus, X, TrendingUp, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'

interface Payment {
    id: string
    amount: number
    date: string
    notes: string | null
    invoice_id: string
    client_id: string
    method_id: string | null
    invoices: { invoice_number: string | null; total: number; balance_due: number } | null
    clients: { first_name: string; last_name: string }
    payment_methods: { name: string } | null
}

interface OpenInvoice {
    id: string
    invoice_number: string | null
    total: number
    balance_due: number
    client_id: string
    clients: { first_name: string; last_name: string }
}

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)

const METHOD_COLORS: Record<string, string> = {
    'Efectivo': '#22c55e',
    'Tarjeta': '#6366f1',
    'Transferencia': '#3b82f6',
    'default': 'var(--color-accent)',
}

export function PaymentsPage() {
    const { orgMember } = useAuth()
    const [payments, setPayments] = useState<Payment[]>([])
    const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([])
    const [paymentMethods, setPaymentMethods] = useState<{ id: string; name: string }[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null)

    const [viewMonth, setViewMonth] = useState(() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
    const [filterMethod, setFilterMethod] = useState('all')

    const [form, setForm] = useState({
        invoice_id: '',
        amount: '',
        method_id: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
    })

    const orgId = orgMember?.org_id

    const fetchAll = async () => {
        if (!orgId) return
        const [payRes, invRes, pmRes] = await Promise.all([
            supabase.from('payments')
                .select('id, amount, date, notes, invoice_id, client_id, method_id, invoices(invoice_number, total, balance_due), clients(first_name, last_name), payment_methods(name)')
                .eq('org_id', orgId)
                .order('date', { ascending: false })
                .limit(200),
            supabase.from('invoices')
                .select('id, invoice_number, total, balance_due, client_id, clients(first_name, last_name)')
                .eq('org_id', orgId)
                .in('status', ['open', 'partial']),
            supabase.from('payment_methods')
                .select('id, name')
                .eq('org_id', orgId)
                .eq('active', true)
                .order('sort_order'),
        ])
        setPayments((payRes.data as unknown as Payment[]) || [])
        setOpenInvoices((invRes.data as unknown as OpenInvoice[]) || [])
        setPaymentMethods(pmRes.data || [])
        setLoading(false)
    }

    useEffect(() => { fetchAll() }, [orgId])

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const t = e.target as HTMLElement
            if (!t.closest('.dropdown') && !t.closest('.btn-icon') && !t.closest('.btn-secondary')) {
                setActiveDropdownId(null)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Month navigation
    const changeMonth = (delta: number) => {
        const [y, m] = viewMonth.split('-').map(Number)
        const d = new Date(y, m - 1 + delta, 1)
        setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    const monthLabel = new Date(viewMonth + '-15').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

    // Filtered payments
    const filteredPayments = payments.filter(p => {
        const matchMonth = p.date.slice(0, 7) === viewMonth
        const matchMethod = filterMethod === 'all' || p.method_id === filterMethod
        return matchMonth && matchMethod
    })

    // KPIs
    const totalMonth = filteredPayments.reduce((s, p) => s + p.amount, 0)
    const allTimeTotal = payments.reduce((s, p) => s + p.amount, 0)
    const totalPending = openInvoices.reduce((s, i) => s + i.balance_due, 0)

    // By method
    const byMethod: Record<string, number> = {}
    filteredPayments.forEach(p => {
        const name = p.payment_methods?.name || 'Sin método'
        byMethod[name] = (byMethod[name] || 0) + p.amount
    })

    // Pre-fill amount when selecting invoice
    const onInvoiceChange = (invId: string) => {
        const inv = openInvoices.find(i => i.id === invId)
        setForm(f => ({ ...f, invoice_id: invId, amount: inv ? String(inv.balance_due) : f.amount }))
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!orgId) return
        setSaving(true)

        const inv = openInvoices.find(i => i.id === form.invoice_id)
        if (!inv) { setSaving(false); return }

        const amount = parseFloat(form.amount)
        const newPaid = (inv.total - inv.balance_due) + amount
        const newBalance = inv.total - newPaid
        const newStatus = newBalance <= 0.01 ? 'paid' : 'partial'

        await supabase.from('payments').insert({
            org_id: orgId,
            invoice_id: form.invoice_id,
            client_id: inv.client_id,
            method_id: form.method_id || null,
            amount,
            date: form.date,
            notes: form.notes || null,
        })
        await supabase.from('invoices').update({
            amount_paid: newPaid,
            status: newStatus,
        }).eq('id', form.invoice_id)

        setShowModal(false)
        setSaving(false)
        setForm({ invoice_id: '', amount: '', method_id: '', date: new Date().toISOString().split('T')[0], notes: '' })
        fetchAll()
    }

    return (
        <div className="animate-in">
            {/* Header */}
            <div className="page-header page-header-actions" style={{ marginBottom: 'var(--space-lg)' }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: 500 }}>Pagos</h2>
                    <p style={{ color: 'var(--color-text-tertiary)', fontSize: '14px' }}>{filteredPayments.length} pagos en {monthLabel}</p>
                </div>
                <button className="btn btn-glass-primary" style={{ borderRadius: '16px', height: '36px', border: 'none', padding: '0 20px' }}
                    onClick={() => { setForm({ invoice_id: '', amount: '', method_id: paymentMethods[0]?.id || '', date: new Date().toISOString().split('T')[0], notes: '' }); setShowModal(true) }}>
                    <Plus size={16} /> Registrar pago
                </button>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                <div className="card" style={{ padding: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <TrendingUp size={16} style={{ color: 'var(--color-success)' }} />
                        <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cobrado este mes</span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-success)' }}>{fmt(totalMonth)}</div>
                </div>
                <div className="card" style={{ padding: 'var(--space-lg)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Total histórico</div>
                    <div style={{ fontSize: '24px', fontWeight: 700 }}>{fmt(allTimeTotal)}</div>
                </div>
                <div className="card" style={{ padding: 'var(--space-lg)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Por cobrar</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#eab308' }}>{fmt(totalPending)}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: 4 }}>{openInvoices.length} facturas abiertas</div>
                </div>
                <div className="card" style={{ padding: 'var(--space-lg)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Por método</div>
                    {Object.entries(byMethod).length === 0 ? (
                        <span style={{ fontSize: '13px', color: 'var(--color-text-tertiary)' }}>Sin datos</span>
                    ) : Object.entries(byMethod).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, total]) => (
                        <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: 4 }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>{name}</span>
                            <span style={{ fontWeight: 600 }}>{fmt(total)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--color-bg-card)', border: '1px solid var(--color-glass-border)', borderRadius: '16px', padding: '0 8px', height: '36px' }}>
                    <button className="btn-icon" style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => changeMonth(-1)}>
                        <ChevronLeft size={14} />
                    </button>
                    <span style={{ fontSize: '13px', fontWeight: 500, minWidth: '130px', textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel}</span>
                    <button className="btn-icon" style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => changeMonth(1)}>
                        <ChevronRight size={14} />
                    </button>
                </div>

                {/* Method filter */}
                <div style={{ position: 'relative' }}>
                    <button className="btn btn-secondary" style={{ borderRadius: '16px', height: '36px', gap: '8px', minWidth: '150px', justifyContent: 'space-between', border: 'none' }}
                        onClick={() => setActiveDropdownId(activeDropdownId === 'method' ? null : 'method')}>
                        <span style={{ fontSize: '13px' }}>{filterMethod === 'all' ? 'Todo método' : paymentMethods.find(m => m.id === filterMethod)?.name || 'Método'}</span>
                        <ChevronDown size={14} />
                    </button>
                    {activeDropdownId === 'method' && (
                        <div className="dropdown" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '190px', zIndex: 100 }}>
                            <button className="dropdown-item" onClick={() => { setFilterMethod('all'); setActiveDropdownId(null) }}>Todo método</button>
                            {paymentMethods.map(m => (
                                <button key={m.id} className="dropdown-item" onClick={() => { setFilterMethod(m.id); setActiveDropdownId(null) }}>{m.name}</button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="loading-screen" style={{ minHeight: 300 }}><div className="spinner" /></div>
            ) : filteredPayments.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <CreditCard />
                        <h3>Sin pagos en {monthLabel}</h3>
                        <p>Los pagos se registran contra facturas abiertas.</p>
                    </div>
                </div>
            ) : (
                <div className="data-table-wrapper">
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ borderBottom: '1px solid var(--color-glass-border)', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                            <tr>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Fecha</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Cliente</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Factura</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Método</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Notas</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'right' }}>Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPayments.map(p => {
                                const methodName = p.payment_methods?.name || ''
                                const methodColor = Object.entries(METHOD_COLORS).find(([k]) => methodName.toLowerCase().includes(k.toLowerCase()))?.[1] || METHOD_COLORS.default
                                return (
                                    <tr key={p.id} style={{ borderBottom: '1px solid var(--color-glass-border)', transition: 'background 0.2s' }}>
                                        <td style={{ padding: '16px', color: 'var(--color-text-secondary)' }}>
                                            {new Date(p.date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td style={{ padding: '16px', fontWeight: 500 }}>{p.clients?.first_name} {p.clients?.last_name}</td>
                                        <td style={{ padding: '16px', fontFamily: 'monospace', fontSize: '13px', color: 'var(--color-accent)' }}>{p.invoices?.invoice_number || '—'}</td>
                                        <td style={{ padding: '16px' }}>
                                            {methodName ? (
                                                <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: 12, fontWeight: 500, background: methodColor + '22', color: methodColor }}>
                                                    {methodName}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td style={{ padding: '16px', color: 'var(--color-text-tertiary)', fontSize: '13px' }}>{p.notes || '—'}</td>
                                        <td style={{ padding: '16px', textAlign: 'right', fontWeight: 700, color: 'var(--color-success)', fontSize: '16px' }}>{fmt(p.amount)}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot style={{ borderTop: '2px solid var(--color-glass-border)' }}>
                            <tr>
                                <td colSpan={5} style={{ padding: '12px 16px', color: 'var(--color-text-tertiary)', fontSize: '13px', fontWeight: 500 }}>Total del mes</td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontSize: '18px', color: 'var(--color-success)' }}>{fmt(totalMonth)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {/* Register Payment Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Registrar pago</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
                        </div>
                        {openInvoices.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-tertiary)' }}>
                                <CreditCard size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                                <p>No hay facturas abiertas por cobrar.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSave}>
                                <div className="form-group">
                                    <label className="form-label">Factura *</label>
                                    <select className="form-input" required value={form.invoice_id} onChange={e => onInvoiceChange(e.target.value)}>
                                        <option value="">Seleccionar factura abierta...</option>
                                        {openInvoices.map(inv => (
                                            <option key={inv.id} value={inv.id}>
                                                {inv.invoice_number || 'Sin número'} — {inv.clients?.first_name} {inv.clients?.last_name} — Saldo: {fmt(inv.balance_due)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Monto *</label>
                                        <input className="form-input" type="number" step="0.01" min="0.01" required placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Fecha *</label>
                                        <input className="form-input" type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                    <label className="form-label">Método de pago</label>
                                    <select className="form-input" value={form.method_id} onChange={e => setForm(f => ({ ...f, method_id: e.target.value }))}>
                                        <option value="">Sin especificar</option>
                                        {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                    <label className="form-label">Notas</label>
                                    <input className="form-input" placeholder="Referencia de transferencia, etc." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                                </div>
                                <div className="modal-actions">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? <span className="spinner" /> : 'Confirmar pago'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
