import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { CreditCard, ChevronDown, ChevronUp, Search, X, CalendarDays, Plus, MoreVertical, Pencil, Trash2, DollarSign } from 'lucide-react'
import { InvoiceDetailModal } from '@/components/InvoiceDetailModal'
import { CalendarPicker } from '../components/CalendarPicker'

interface Payment {
    id: string
    amount: number
    date: string
    notes: string | null
    invoice_id: string | null
    client_id: string
    method_id: string | null
    clients: { first_name: string; last_name: string }
    payment_methods: { name: string } | null
    payment_allocations?: { invoice_id: string; amount_allocated: number }[]
}

interface Invoice {
    id: string
    invoice_number: string | null
    status: string
    total: number
    amount_paid: number
    balance_due: number
    issued_at: string
    client_id: string
    invoice_lines?: { description: string; sort_order: number }[]
}

interface Client {
    id: string
    first_name: string
    last_name: string
    credit_balance: number
}

type SortField = 'date' | 'client' | 'method' | 'amount'
type SortDir   = 'asc' | 'desc'

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)

const METHOD_COLORS: Record<string, string> = {
    'efectivo':     '#22c55e',
    'tarjeta':      '#6366f1',
    'transferencia':'#3b82f6',
    'default':      'var(--color-accent)',
}
const methodColor = (name: string) =>
    Object.entries(METHOD_COLORS).find(([k]) => name.toLowerCase().includes(k))?.[1] ?? METHOD_COLORS.default

export function PaymentsPage() {
    const { orgMember } = useAuth()
    const [payments, setPayments]             = useState<Payment[]>([])
    const [paymentMethods, setPaymentMethods] = useState<{ id: string; name: string }[]>([])
    const [clients, setClients]               = useState<Client[]>([])
    const [invoices, setInvoices]             = useState<Invoice[]>([])
    const [loading, setLoading]               = useState(true)
    const [saving, setSaving]                 = useState(false)

    // Filters
    const [search, setSearch]               = useState('')
    const [filterMethod, setFilterMethod]   = useState('all')
    const [dateFrom, setDateFrom]           = useState('')
    const [dateTo, setDateTo]               = useState('')
    const [showDateDd, setShowDateDd]       = useState(false)
    const dateDdRef = useRef<HTMLDivElement>(null)

    // Sorting
    const [sortField, setSortField] = useState<SortField>('date')
    const [sortDir, setSortDir]     = useState<SortDir>('desc')

    // Row menu
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    // Pay modal
    const [showPayModal, setShowPayModal]       = useState(false)
    const [payClientId, setPayClientId]         = useState('')
    const [payForm, setPayForm]                 = useState({ amount: '', method_id: '', notes: '', date: new Date().toLocaleDateString('en-CA') })
    const [showPayDatePicker, setShowPayDatePicker] = useState(false)
    const payDateRef = useRef<HTMLDivElement>(null)

    // Edit modal
    const [editingPayment, setEditingPayment]   = useState<Payment | null>(null)
    const [editForm, setEditForm]               = useState({ amount: '', method_id: '', notes: '', date: '' })
    const [showEditDatePicker, setShowEditDatePicker] = useState(false)
    const editDateRef = useRef<HTMLDivElement>(null)

    const orgId = orgMember?.org_id

    const fetchAll = async () => {
        if (!orgId) return
        const [payRes, pmRes, clientRes, invRes] = await Promise.all([
            supabase.from('payments')
                .select('id, amount, date, notes, invoice_id, client_id, method_id, clients(first_name, last_name), payment_methods(name), payment_allocations(invoice_id, amount_allocated)')
                .eq('org_id', orgId)
                .order('date', { ascending: false }),
            supabase.from('payment_methods')
                .select('id, name').eq('org_id', orgId).eq('active', true).order('sort_order'),
            supabase.from('clients')
                .select('id, first_name, last_name, credit_balance')
                .eq('org_id', orgId).eq('active', true).order('last_name'),
            supabase.from('invoices')
                .select('id, invoice_number, status, total, amount_paid, balance_due, issued_at, client_id, invoice_lines(description, sort_order)')
                .eq('org_id', orgId)
                .order('issued_at', { ascending: true }),
        ])
        setPayments((payRes.data as unknown as Payment[]) || [])
        setPaymentMethods(pmRes.data || [])
        setClients(clientRes.data || [])
        setInvoices((invRes.data as unknown as Invoice[]) || [])
        setLoading(false)
    }

    useEffect(() => { fetchAll() }, [orgId])

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const t = e.target as HTMLElement
            if (dateDdRef.current && !dateDdRef.current.contains(t)) setShowDateDd(false)
            if (menuRef.current && !menuRef.current.contains(t)) setActiveMenuId(null)
            if (payDateRef.current && !payDateRef.current.contains(t)) setShowPayDatePicker(false)
            if (editDateRef.current && !editDateRef.current.contains(t)) setShowEditDatePicker(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // ─── Sort toggle ───────────────────────────────────────────────────────────
    const toggleSort = (field: SortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortField(field); setSortDir('desc') }
    }

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ChevronDown size={12} style={{ opacity: 0.3 }} />
        return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
    }

    // ─── Filtered + sorted ────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        let data = [...payments]
        if (search.trim()) {
            const q = search.toLowerCase()
            data = data.filter(p =>
                `${p.clients?.first_name} ${p.clients?.last_name}`.toLowerCase().includes(q) ||
                (p.notes || '').toLowerCase().includes(q) ||
                p.id.slice(0, 8).toLowerCase().includes(q) ||
                (p.payment_allocations?.some(a => {
                    const num = invoices.find(inv => inv.id === a.invoice_id)?.invoice_number || ''
                    return num.toLowerCase().includes(q)
                }) ?? false)
            )
        }
        if (filterMethod !== 'all') data = data.filter(p => p.method_id === filterMethod)
        if (dateFrom) data = data.filter(p => p.date >= dateFrom)
        if (dateTo)   data = data.filter(p => p.date <= dateTo)
        data.sort((a, b) => {
            let cmp = 0
            if (sortField === 'date')   cmp = a.date.localeCompare(b.date)
            if (sortField === 'client') cmp = `${a.clients?.first_name}${a.clients?.last_name}`.localeCompare(`${b.clients?.first_name}${b.clients?.last_name}`)
            if (sortField === 'method') cmp = (a.payment_methods?.name || '').localeCompare(b.payment_methods?.name || '')
            if (sortField === 'amount') cmp = a.amount - b.amount
            return sortDir === 'asc' ? cmp : -cmp
        })
        return data
    }, [payments, search, filterMethod, dateFrom, dateTo, sortField, sortDir])

    // ─── Payment logic ────────────────────────────────────────────────────────
    const openPayModal = (clientId = '') => {
        setPayClientId(clientId)
        const debt = invoices
            .filter(i => i.client_id === clientId && ['open', 'partial'].includes(i.status))
            .reduce((s, i) => s + i.balance_due, 0)
        setPayForm({
            amount: clientId ? String(Math.round(debt * 100) / 100 || '') : '',
            method_id: paymentMethods[0]?.id || '',
            notes: '',
            date: new Date().toLocaleDateString('en-CA'),
        })
        setShowPayModal(true)
    }

    const handlePay = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!orgId || !payClientId) return
        setSaving(true)

        const { error } = await supabase.rpc('register_payment_full', {
            p_client_id: payClientId,
            p_org_id:    orgId,
            p_amount:    parseFloat(payForm.amount) || 0,
            p_method_id: payForm.method_id || null,
            p_date:      payForm.date,
            p_notes:     payForm.notes || null,
        })

        if (error) console.error('register_payment_full error:', error)
        setShowPayModal(false)
        setSaving(false)
        fetchAll()
    }

    const handleDelete = async (payment: Payment) => {
        if (!confirm('¿Eliminar este pago? Se revertirán todos los abonos asignados.')) return

        const { error } = await supabase.rpc('delete_payment_with_reversals', {
            p_payment_id: payment.id,
        })

        if (error) console.error('delete_payment error:', error)
        fetchAll()
    }

    const openEdit = (p: Payment) => {
        setEditingPayment(p)
        setEditForm({ amount: String(p.amount), method_id: p.method_id || '', notes: p.notes || '', date: p.date })
        setActiveMenuId(null)
    }

    const handleEditPayment = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingPayment || !orgId) return
        setSaving(true)

        const { error } = await supabase.rpc('update_payment_with_reallocation', {
            p_payment_id: editingPayment.id,
            p_amount:     parseFloat(editForm.amount) || 0,
            p_method_id:  editForm.method_id || null,
            p_date:       editForm.date,
            p_notes:      editForm.notes || null,
        })

        if (error) console.error('update_payment error:', error)
        setEditingPayment(null)
        setSaving(false)
        fetchAll()
    }

    const totalFiltered = filtered.reduce((s, p) => s + p.amount, 0)
    const hasFilters = search || filterMethod !== 'all' || dateFrom || dateTo
    const payClient  = clients.find(c => c.id === payClientId)
    const payAmount  = parseFloat(payForm.amount) || 0
    const clientDebt = payClientId
        ? invoices.filter(i => i.client_id === payClientId && ['open', 'partial'].includes(i.status)).reduce((s, i) => s + i.balance_due, 0)
        : 0

    const thStyle = (field: SortField): React.CSSProperties => ({
        padding: '10px 10px', fontWeight: 500, textAlign: 'left', cursor: 'pointer',
        userSelect: 'none', whiteSpace: 'nowrap', fontSize: '12px',
        color: sortField === field ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
    })

    return (
        <div className="animate-in">
            {/* Header */}
            <div className="page-header" style={{ marginBottom: 'var(--space-lg)' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 500 }}>Pagos</h2>
                <p style={{ color: 'var(--color-text-tertiary)', fontSize: '14px' }}>
                    {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
                    {hasFilters ? ' (filtrado)' : ''}
                </p>
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '180px', maxWidth: '320px' }}>
                    <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', pointerEvents: 'none' }} />
                    <input className="form-input" style={{ paddingLeft: 34, height: '36px', borderRadius: '16px' }}
                        placeholder="Buscar cliente, comprobante, notas..."
                        value={search} onChange={e => setSearch(e.target.value)} />
                </div>

                {/* Method quick buttons */}
                {[
                    { key: 'all', label: 'Todos' },
                    ...paymentMethods.map(m => ({ key: m.id, label: m.name })),
                ].map(({ key, label }) => (
                    <button key={key} className="btn btn-secondary"
                        style={{ borderRadius: '16px', height: '36px', fontSize: '13px', border: 'none', background: filterMethod === key ? 'var(--color-accent)' : undefined, color: filterMethod === key ? 'white' : undefined }}
                        onClick={() => setFilterMethod(key)}>
                        {label}
                    </button>
                ))}

                {/* Date range picker */}
                <div style={{ position: 'relative' }} ref={dateDdRef}>
                    <button className="btn btn-secondary"
                        style={{ borderRadius: '16px', height: '36px', gap: '8px', minWidth: '200px', justifyContent: 'space-between', border: 'none', fontSize: '13px', background: (dateFrom || dateTo) ? 'var(--color-accent-soft)' : undefined }}
                        onClick={() => setShowDateDd(d => !d)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <CalendarDays size={14} />
                            <span>
                                {!dateFrom && !dateTo ? 'Rango de fechas' : (() => {
                                    const fmtD = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
                                    if (dateFrom && dateTo && dateFrom !== dateTo) return `${fmtD(dateFrom)} – ${fmtD(dateTo)}`
                                    if (dateFrom) return fmtD(dateFrom)
                                    return 'Rango de fechas'
                                })()}
                            </span>
                        </div>
                        <ChevronDown size={14} />
                    </button>
                    {showDateDd && (
                        <div className="dropdown" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '310px', zIndex: 100, paddingBottom: 8 }}>
                            <CalendarPicker startDate={dateFrom} endDate={dateTo}
                                onRangeSelect={(start, end) => { setDateFrom(start); setDateTo(end); if (start && end) setShowDateDd(false) }} />
                            {(dateFrom || dateTo) && (
                                <button className="dropdown-item" style={{ color: '#f87171', fontSize: '12px', marginTop: 4 }}
                                    onClick={() => { setDateFrom(''); setDateTo(''); setShowDateDd(false) }}>
                                    <X size={12} /> Limpiar fechas
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ flex: 1 }} />
                <button className="btn btn-glass-primary" style={{ borderRadius: '16px', height: '36px', border: 'none', padding: '0 20px' }}
                    onClick={() => openPayModal()}>
                    <Plus size={15} /> Registrar Pago
                </button>
            </div>

            {/* Table */}
            {loading ? (
                <div className="loading-screen" style={{ minHeight: 300 }}><div className="spinner" /></div>
            ) : filtered.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <CreditCard />
                        <h3>Sin pagos{hasFilters ? ' con estos filtros' : ' registrados'}</h3>
                        <p>Registra un pago con el botón de arriba.</p>
                    </div>
                </div>
            ) : (
                <div className="data-table-wrapper">
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ borderBottom: '1px solid var(--color-glass-border)', fontSize: 12 }}>
                            <tr>
                                <th style={{ padding: '10px 10px', fontWeight: 500, textAlign: 'left', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', fontSize: '12px' }}>Folio</th>
                                <th style={thStyle('date')} onClick={() => toggleSort('date')}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Fecha <SortIcon field="date" /></span>
                                </th>
                                <th style={thStyle('client')} onClick={() => toggleSort('client')}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Cliente <SortIcon field="client" /></span>
                                </th>
                                <th style={thStyle('method')} onClick={() => toggleSort('method')}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Método <SortIcon field="method" /></span>
                                </th>
                                <th style={{ padding: '10px 10px', fontWeight: 500, textAlign: 'left', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap', fontSize: '12px' }}>Comp.</th>
                                <th style={{ padding: '10px 10px', fontWeight: 500, textAlign: 'left', color: 'var(--color-text-tertiary)', fontSize: '12px' }}>Notas</th>
                                <th style={{ ...thStyle('amount'), textAlign: 'right' }} onClick={() => toggleSort('amount')}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>Monto <SortIcon field="amount" /></span>
                                </th>
                                <th style={{ padding: '10px 6px', width: 36 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(p => {
                                const mName  = p.payment_methods?.name || ''
                                const mColor = methodColor(mName)
                                const allocs = p.payment_allocations || []
                                const isSaldoFavor = !allocs.length
                                return (
                                    <tr key={p.id} style={{ borderBottom: '1px solid var(--color-glass-border)' }}>
                                        <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                                            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-text-tertiary)', background: 'var(--color-glass)', padding: '2px 6px', borderRadius: 4 }}>
                                                #{p.id.slice(0, 6).toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontSize: '12px' }}>
                                            {new Date(p.date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                        </td>
                                        <td style={{ padding: '10px', fontWeight: 500, fontSize: '13px', whiteSpace: 'nowrap' }}>
                                            {p.clients?.first_name} {p.clients?.last_name}
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            {mName ? (
                                                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: 11, fontWeight: 500, background: mColor + '22', color: mColor, whiteSpace: 'nowrap' }}>
                                                    {mName}
                                                </span>
                                            ) : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                                        </td>
                                        <td style={{ padding: '10px', fontSize: '11px' }}>
                                            {isSaldoFavor ? (
                                                <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Saldo a favor</span>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    {allocs.map((a, i) => {
                                                        const inv = invoices.find(inv => inv.id === a.invoice_id)
                                                        const invNum = (inv?.invoice_number || a.invoice_id.slice(0, 6)).replace(/^INV-/i, '')
                                                        const firstLine = inv?.invoice_lines?.sort((x, y) => x.sort_order - y.sort_order)[0]?.description || ''
                                                        const invDate = inv ? new Date(inv.issued_at + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : ''
                                                        const tooltipText = inv ? `${firstLine}\nTotal: ${fmt(inv.total)} · ${invDate}` : ''
                                                        return (
                                                            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', whiteSpace: 'nowrap' }} title={tooltipText}>
                                                                <span
                                                                    style={{ color: 'var(--color-accent)', fontFamily: 'monospace', cursor: 'pointer', fontSize: '11px' }}
                                                                    onClick={() => setSelectedInvoiceId(a.invoice_id)}
                                                                >{invNum}</span>
                                                                <span style={{ color: 'var(--color-text-secondary)', fontSize: '10px' }}>{fmt(a.amount_allocated)}</span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '10px', color: 'var(--color-text-tertiary)', fontSize: '12px', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {isSaldoFavor ? '—' : (p.notes || '—')}
                                        </td>
                                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, fontSize: '13px',
                                            color: isSaldoFavor ? 'var(--color-text-tertiary)'
                                                : (() => {
                                                    const totalAllocated = allocs.reduce((s, a) => s + a.amount_allocated, 0)
                                                    if (p.amount > totalAllocated && totalAllocated > 0) return '#3b82f6'
                                                    const allInvoicesPaid = allocs.every(a => {
                                                        const inv = invoices.find(inv => inv.id === a.invoice_id)
                                                        return inv?.status === 'paid'
                                                    })
                                                    if (allInvoicesPaid) return 'var(--color-success)'
                                                    return '#eab308'
                                                })()
                                        }}>
                                            {fmt(p.amount)}
                                        </td>
                                        <td style={{ padding: '10px 6px', textAlign: 'right' }}>
                                            <div style={{ position: 'relative', display: 'inline-block' }} ref={activeMenuId === p.id ? menuRef : undefined}>
                                                <button className="btn-icon"
                                                    style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    onClick={() => setActiveMenuId(activeMenuId === p.id ? null : p.id)}>
                                                    <MoreVertical size={15} />
                                                </button>
                                                {activeMenuId === p.id && (
                                                    <div className="dropdown" style={{ position: 'absolute', right: 0, top: '100%', width: '160px', zIndex: 200, marginTop: 4 }}>
                                                        <button className="dropdown-item" style={{ gap: 8 }} onClick={() => openEdit(p)}>
                                                            <Pencil size={13} /> Editar
                                                        </button>
                                                        <div style={{ height: '1px', background: 'var(--color-glass-border)', margin: '4px 0' }} />
                                                        <button className="dropdown-item" style={{ gap: 8, color: '#f87171' }} onClick={() => { setActiveMenuId(null); handleDelete(p) }}>
                                                            <Trash2 size={13} /> Eliminar
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        <tfoot style={{ borderTop: '2px solid var(--color-glass-border)' }}>
                            <tr>
                                <td colSpan={6} style={{ padding: '10px', color: 'var(--color-text-tertiary)', fontSize: '12px', fontWeight: 500 }}>
                                    Total {hasFilters ? 'filtrado' : 'general'}
                                </td>
                                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, fontSize: '13px', color: 'var(--color-success)' }}>
                                    {fmt(totalFiltered)}
                                </td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {/* ── Registrar Pago Modal ──────────────────────────────────────── */}
            {showPayModal && (
                <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
                    <div className="modal" style={{ maxWidth: '520px', width: '95vw' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Registrar Pago</h3>
                            <button className="modal-close" onClick={() => setShowPayModal(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handlePay}>
                            <div className="form-group">
                                <label className="form-label">Cliente *</label>
                                <select className="form-input" required value={payClientId} onChange={e => {
                                    const cid = e.target.value
                                    setPayClientId(cid)
                                    const debt = invoices.filter(i => i.client_id === cid && ['open', 'partial'].includes(i.status)).reduce((s, i) => s + i.balance_due, 0)
                                    setPayForm(f => ({ ...f, amount: String(Math.round(debt * 100) / 100 || '') }))
                                }}>
                                    <option value="">Seleccionar cliente...</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                                </select>
                            </div>

                            {payClientId && (
                                <div style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-md)', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--color-glass-border)' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Resumen del cliente</div>
                                    {invoices.filter(i => i.client_id === payClientId && ['open', 'partial'].includes(i.status)).length === 0 ? (
                                        <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', margin: 0 }}>Sin comprobantes pendientes</p>
                                    ) : (
                                        <>
                                            {invoices.filter(i => i.client_id === payClientId && ['open', 'partial'].includes(i.status))
                                                .sort((a, b) => a.issued_at.localeCompare(b.issued_at))
                                                .map(inv => {
                                                    const firstLine = inv.invoice_lines?.sort((a, b) => a.sort_order - b.sort_order)[0]?.description || '—'
                                                    return (
                                                        <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', marginBottom: 4 }}>
                                                            <div>
                                                                <span style={{ color: 'var(--color-accent)', fontFamily: 'monospace', marginRight: 8 }}>{inv.invoice_number}</span>
                                                                <span style={{ color: 'var(--color-text-secondary)' }}>{firstLine}</span>
                                                            </div>
                                                            <span style={{ fontWeight: 600, color: '#eab308' }}>{fmt(inv.balance_due)}</span>
                                                        </div>
                                                    )
                                                })}
                                            <div style={{ borderTop: '1px solid var(--color-glass-border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                                                <span>Deuda total</span>
                                                <span style={{ color: '#eab308' }}>{fmt(clientDebt)}</span>
                                            </div>
                                        </>
                                    )}
                                    {(payClient?.credit_balance || 0) > 0 && (
                                        <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(34,197,94,0.1)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                            <span style={{ color: 'var(--color-success)' }}>Saldo a favor disponible</span>
                                            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{fmt(payClient!.credit_balance)}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                                <div className="form-group">
                                    <label className="form-label">Monto a recibir *</label>
                                    <input className="form-input" type="number" step="0.01" min="0" required
                                        value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fecha *</label>
                                    <div style={{ position: 'relative' }} ref={payDateRef}>
                                        <button type="button" className="btn btn-secondary"
                                            style={{ width: '100%', justifyContent: 'flex-start', gap: 8, height: '40px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-glass-border)', fontSize: '14px' }}
                                            onClick={() => setShowPayDatePicker(d => !d)}>
                                            <CalendarDays size={14} />
                                            {payForm.date
                                                ? new Date(payForm.date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
                                                : 'Seleccionar fecha'}
                                        </button>
                                        {showPayDatePicker && (
                                            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 300, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-glass-border)', borderRadius: 'var(--radius-md)', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
                                                <CalendarPicker startDate={payForm.date} endDate={payForm.date}
                                                    onRangeSelect={(start) => { setPayForm(f => ({ ...f, date: start })); setShowPayDatePicker(false) }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: 'var(--space-sm)' }}>
                                <label className="form-label">Método de pago</label>
                                <select className="form-input" value={payForm.method_id} onChange={e => setPayForm(f => ({ ...f, method_id: e.target.value }))}>
                                    <option value="">Sin especificar</option>
                                    {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginTop: 'var(--space-sm)' }}>
                                <label className="form-label">Notas</label>
                                <input className="form-input" placeholder="Ej. Efectivo en caja..." value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving || !payClientId || payAmount <= 0}>
                                    {saving ? <span className="spinner" /> : 'Confirmar pago'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Editar Pago Modal ─────────────────────────────────────────── */}
            {editingPayment && (
                <div className="modal-overlay" onClick={() => setEditingPayment(null)}>
                    <div className="modal" style={{ maxWidth: '480px', width: '95vw' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Editar Pago</h3>
                            <button className="modal-close" onClick={() => setEditingPayment(null)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleEditPayment}>
                            <div className="form-group">
                                <label className="form-label">Cliente</label>
                                <input className="form-input" disabled
                                    value={`${editingPayment.clients?.first_name} ${editingPayment.clients?.last_name}`} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
                                <div className="form-group">
                                    <label className="form-label">Monto *</label>
                                    <input className="form-input" type="number" step="0.01" min="0" required
                                        value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fecha *</label>
                                    <div style={{ position: 'relative' }} ref={editDateRef}>
                                        <button type="button" className="btn btn-secondary"
                                            style={{ width: '100%', justifyContent: 'flex-start', gap: 8, height: '40px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-glass-border)', fontSize: '14px' }}
                                            onClick={() => setShowEditDatePicker(d => !d)}>
                                            <CalendarDays size={14} />
                                            {editForm.date
                                                ? new Date(editForm.date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
                                                : 'Seleccionar fecha'}
                                        </button>
                                        {showEditDatePicker && (
                                            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 300, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-glass-border)', borderRadius: 'var(--radius-md)', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
                                                <CalendarPicker startDate={editForm.date} endDate={editForm.date}
                                                    onRangeSelect={(start) => { setEditForm(f => ({ ...f, date: start })); setShowEditDatePicker(false) }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: 'var(--space-sm)' }}>
                                <label className="form-label">Método de pago</label>
                                <select className="form-input" value={editForm.method_id} onChange={e => setEditForm(f => ({ ...f, method_id: e.target.value }))}>
                                    <option value="">Sin especificar</option>
                                    {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginTop: 'var(--space-sm)' }}>
                                <label className="form-label">Notas</label>
                                <input className="form-input" placeholder="Observaciones..." value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setEditingPayment(null)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving || parseFloat(editForm.amount) <= 0}>
                                    {saving ? <span className="spinner" /> : 'Guardar cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Invoice Detail Modal */}
            <InvoiceDetailModal invoiceId={selectedInvoiceId} onClose={() => { setSelectedInvoiceId(null); fetchAll() }} />
        </div>
    )
}
