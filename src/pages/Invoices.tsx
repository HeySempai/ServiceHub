import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { FileText, X, MoreVertical, ChevronDown, ChevronUp, Receipt, Plus, Trash2, Search, CheckCircle2, CalendarDays } from 'lucide-react'
import { InvoiceDetailModal } from '@/components/InvoiceDetailModal'
import { CalendarPicker } from '@/components/CalendarPicker'

interface InvoiceLine {
    id?: string
    description: string
    quantity: number
    unit_price: number
    tax_rate: number
    tax: number
    total: number
    sort_order: number
}

interface Invoice {
    id: string
    invoice_number: string | null
    status: string
    subtotal: number
    tax_total: number
    total: number
    amount_paid: number
    balance_due: number
    issued_at: string
    notes: string | null
    client_rfc: string | null
    requires_cfdi: boolean
    client_id: string
    clients: { first_name: string; last_name: string; rfc: string | null }
    invoice_lines?: { description: string; sort_order: number }[]
}

interface Client {
    id: string
    first_name: string
    last_name: string
    rfc: string | null
    credit_balance: number
}

interface PaymentMethod {
    id: string
    name: string
}


const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
    draft:   { label: 'Borrador', bg: 'rgba(255,255,255,0.06)',  color: 'var(--color-text-tertiary)' },
    open:    { label: 'Abierta',  bg: 'rgba(234,179,8,0.15)',   color: '#eab308' },
    paid:    { label: 'Pagada',   bg: 'rgba(34,197,94,0.15)',   color: 'var(--color-success)' },
    partial: { label: 'Parcial',  bg: 'rgba(249,115,22,0.15)',  color: '#f97316' },
    void:    { label: 'Anulada',  bg: 'rgba(239,68,68,0.10)',   color: '#f87171' },
}

const emptyLine = (): InvoiceLine => ({
    description: '', quantity: 1, unit_price: 0, tax_rate: 0, tax: 0, total: 0, sort_order: 0
})

export function InvoicesPage() {
    const { orgMember } = useAuth()
    const [invoices, setInvoices]           = useState<Invoice[]>([])
    const [clients, setClients]             = useState<Client[]>([])
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
    const [loading, setLoading]             = useState(true)
    const [showModal, setShowModal]         = useState(false)
    const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null)
    const [filterStatus, setFilterStatus]   = useState('all')
    const [search, setSearch]               = useState('')
    const [saving, setSaving]               = useState(false)
    const [dateFrom, setDateFrom]           = useState('')
    const [dateTo, setDateTo]               = useState('')
    const [showDateDd, setShowDateDd]       = useState(false)
    const dateDdRef = useRef<HTMLDivElement>(null)

    // Detail modal
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)

    // Mark as paid modal
    const [payInvoice, setPayInvoice] = useState<Invoice | null>(null)
    const [payMethodId, setPayMethodId] = useState('')
    const [payingInvoice, setPayingInvoice] = useState(false)

    // Invoice form
    const [form, setForm] = useState({
        client_id: '',
        issued_at: new Date().toISOString().split('T')[0],
        notes: '',
        requires_cfdi: false,
        client_rfc: '',
    })
    const [lines, setLines] = useState<InvoiceLine[]>([emptyLine()])

    // Sorting
    type SortField = 'date' | 'client' | 'total' | 'balance'
    const [sortField, setSortField] = useState<SortField>('date')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    const toggleSort = (field: SortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortField(field); setSortDir('desc') }
    }

    const orgId = orgMember?.org_id

    const fetchAll = async () => {
        if (!orgId) return
        const [invRes, clientRes, pmRes] = await Promise.all([
            supabase.from('invoices')
                .select('id, invoice_number, status, subtotal, tax_total, total, amount_paid, balance_due, issued_at, notes, client_rfc, requires_cfdi, client_id, clients(first_name, last_name, rfc), invoice_lines(description, quantity, unit_price, tax_rate, tax, total, sort_order)')
                .eq('org_id', orgId)
                .order('issued_at', { ascending: false }),
            supabase.from('clients')
                .select('id, first_name, last_name, rfc, credit_balance')
                .eq('org_id', orgId).eq('active', true).order('last_name'),
            supabase.from('payment_methods')
                .select('id, name').eq('org_id', orgId).eq('active', true).order('sort_order'),
        ])
        setInvoices((invRes.data as unknown as Invoice[]) || [])
        setClients(clientRes.data || [])
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
            if (dateDdRef.current && !dateDdRef.current.contains(t as Node)) {
                setShowDateDd(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const filteredInvoices = invoices.filter(inv => {
        if (filterStatus === 'cfdi') return inv.requires_cfdi === true
        if (filterStatus !== 'all') {
            if (filterStatus === 'open' && !['open', 'partial'].includes(inv.status)) return false
            if (filterStatus !== 'open' && inv.status !== filterStatus) return false
        }
        if (dateFrom && inv.issued_at < dateFrom) return false
        if (dateTo && inv.issued_at > dateTo) return false
        if (search.trim()) {
            const q = search.toLowerCase()
            const name = `${inv.clients?.first_name} ${inv.clients?.last_name}`.toLowerCase()
            const num  = (inv.invoice_number || '').toLowerCase()
            const svc  = (inv.invoice_lines?.[0]?.description || '').toLowerCase()
            return name.includes(q) || num.includes(q) || svc.includes(q)
        }
        return true
    }).sort((a, b) => {
        let cmp = 0
        if (sortField === 'date') cmp = a.issued_at.localeCompare(b.issued_at)
        if (sortField === 'client') cmp = `${a.clients?.first_name}${a.clients?.last_name}`.localeCompare(`${b.clients?.first_name}${b.clients?.last_name}`)
        if (sortField === 'total') cmp = a.total - b.total
        if (sortField === 'balance') cmp = a.balance_due - b.balance_due
        return sortDir === 'asc' ? cmp : -cmp
    })


    // ─── Invoice form helpers ──────────────────────────────────────────────────
    const updateLine = (i: number, field: keyof InvoiceLine, value: string | number) => {
        setLines(prev => {
            const next = [...prev]
            const line = { ...next[i], [field]: value }
            line.tax   = 0
            line.total = Math.round(line.quantity * line.unit_price * 100) / 100
            next[i] = line
            return next
        })
    }

    const invoiceTotal = lines.reduce((s, l) => s + l.total, 0)

    const openCreateModal = () => {
        setForm({ client_id: '', issued_at: new Date().toISOString().split('T')[0], notes: '', requires_cfdi: false, client_rfc: '' })
        setLines([emptyLine()])
        setShowModal(true)
    }

    const onClientChange = (clientId: string) => {
        const c = clients.find(c => c.id === clientId)
        setForm(f => ({ ...f, client_id: clientId, client_rfc: c?.rfc || '' }))
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!orgId || lines.length === 0) return
        setSaving(true)

        const { data, error } = await supabase.rpc('create_invoice_with_lines', {
            p_org_id:        orgId,
            p_client_id:     form.client_id,
            p_issued_at:     form.issued_at,
            p_notes:         form.notes || null,
            p_requires_cfdi: form.requires_cfdi,
            p_client_rfc:    form.client_rfc || null,
            p_lines:         lines.map(l => ({
                description: l.description,
                quantity:    l.quantity,
                unit_price:  l.unit_price,
                tax_rate:    l.tax_rate,
                tax:         l.tax,
                total:       l.total,
            })),
        })

        if (error) console.error('create_invoice error:', error)
        setShowModal(false)
        setSaving(false)
        fetchAll()
    }

    const handleVoid = async (id: string) => {
        if (!confirm('¿Anular este comprobante?')) return
        const { error } = await supabase.rpc('void_invoice', {
            p_invoice_id: id,
            p_org_id: orgId,
        })
        if (error) console.error('void_invoice error:', error)
        fetchAll()
    }

    const handleToggleFactura = async (invoiceId: string, value: boolean) => {
        await supabase.from('invoices').update({ requires_cfdi: value }).eq('id', invoiceId)
        setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, requires_cfdi: value } : i))
    }

    const handleMarkAsPaid = async () => {
        if (!orgId || !payInvoice) return
        setPayingInvoice(true)
        const { error } = await supabase.rpc('register_payment_full', {
            p_client_id: payInvoice.client_id,
            p_org_id:    orgId,
            p_amount:    payInvoice.balance_due,
            p_method_id: payMethodId || null,
            p_date:      new Date().toISOString().split('T')[0],
            p_notes:     `Pago completo - Comprobante ${payInvoice.invoice_number || ''}`,
        })
        if (error) console.error('mark_as_paid error:', error)
        setPayInvoice(null)
        setPayMethodId('')
        setPayingInvoice(false)
        fetchAll()
    }

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="animate-in">
            {/* Header */}
            <div className="page-header" style={{ marginBottom: 'var(--space-lg)' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 500 }}>Comprobantes</h2>
                <p style={{ color: 'var(--color-text-tertiary)', fontSize: '14px' }}>{invoices.length} comprobantes en total</p>
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '180px', maxWidth: '320px' }}>
                    <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', pointerEvents: 'none' }} />
                    <input
                        className="form-input"
                        style={{ paddingLeft: 34, height: '36px', borderRadius: '16px' }}
                        placeholder="Buscar cliente, folio, servicio..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', display: 'flex' }}>
                            <X size={12} />
                        </button>
                    )}
                </div>
                {([
                    { key: 'all',  label: 'Todos' },
                    { key: 'open', label: 'Abiertos' },
                    { key: 'paid', label: 'Pagados' },
                    { key: 'cfdi', label: 'Solicitó Factura' },
                ] as { key: string; label: string }[]).map(({ key, label }) => (
                    <button key={key} className="btn btn-secondary"
                        style={{ borderRadius: '16px', height: '36px', fontSize: '13px', border: 'none', background: filterStatus === key ? 'var(--color-accent)' : undefined, color: filterStatus === key ? 'white' : undefined }}
                        onClick={() => setFilterStatus(key)}>
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
            </div>

            {/* Table */}
            {loading ? (
                <div className="loading-screen" style={{ minHeight: 300 }}><div className="spinner" /></div>
            ) : filteredInvoices.length === 0 ? (
                <div className="card"><div className="empty-state"><FileText /><h3>Sin comprobantes aún</h3><p>Crea un nuevo comprobante para comenzar.</p></div></div>
            ) : (
                <div className="data-table-wrapper" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table className="data-table" style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse' }}>
                        <thead style={{ borderBottom: '1px solid var(--color-glass-border)', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                            <tr>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Folio</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('date')}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: sortField === 'date' ? 'var(--color-text-primary)' : undefined }}>Fecha {sortField === 'date' ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronDown size={12} style={{ opacity: 0.3 }} />}</span>
                                </th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('client')}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: sortField === 'client' ? 'var(--color-text-primary)' : undefined }}>Cliente {sortField === 'client' ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronDown size={12} style={{ opacity: 0.3 }} />}</span>
                                </th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Servicio</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('total')}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: sortField === 'total' ? 'var(--color-text-primary)' : undefined }}>Total {sortField === 'total' ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronDown size={12} style={{ opacity: 0.3 }} />}</span>
                                </th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Pagado</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('balance')}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: sortField === 'balance' ? 'var(--color-text-primary)' : undefined }}>Restante {sortField === 'balance' ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ChevronDown size={12} style={{ opacity: 0.3 }} />}</span>
                                </th>
                                <th style={{ padding: '12px 8px', fontWeight: 500, textAlign: 'center' }}>Factura</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Estado</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInvoices.map(inv => {
                                const firstLine = inv.invoice_lines
                                    ?.sort((a, b) => a.sort_order - b.sort_order)[0]?.description || '—'
                                const credit = clients.find(c => c.id === inv.client_id)?.credit_balance || 0
                                return (
                                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--color-glass-border)', cursor: 'pointer' }} onClick={() => setSelectedInvoiceId(inv.id)}>
                                        <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                                            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-text-tertiary)', background: 'var(--color-glass)', padding: '2px 7px', borderRadius: 5 }}>
                                                {inv.invoice_number || '—'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                                            {new Date(inv.issued_at + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ fontWeight: 500 }}>{inv.clients?.first_name} {inv.clients?.last_name}</div>
                                            {credit > 0 && (
                                                <div style={{ fontSize: '11px', color: 'var(--color-success)', marginTop: 2 }}>
                                                    Saldo a favor: {fmt(credit)}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: 180 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-accent)', flexShrink: 0 }} />
                                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{firstLine}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px', fontSize: '14px', fontWeight: 500 }}>{fmt(inv.total)}</td>
                                        <td style={{ padding: '16px', fontSize: '14px', fontWeight: 500, color: inv.status === 'paid' ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{fmt(inv.amount_paid)}</td>
                                        <td style={{ padding: '16px', fontSize: '14px', fontWeight: 500, color: inv.balance_due > 0 ? '#eab308' : 'var(--color-text-tertiary)', opacity: inv.balance_due === 0 ? 0.5 : 1 }}>
                                            {fmt(inv.balance_due)}
                                        </td>
                                        <td style={{ padding: '16px 8px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => handleToggleFactura(inv.id, !inv.requires_cfdi)}
                                                title={inv.requires_cfdi ? 'Requiere factura fiscal' : 'No requiere factura fiscal'}
                                                style={{
                                                    width: 20, height: 20, borderRadius: '50%', cursor: 'pointer',
                                                    border: inv.requires_cfdi ? 'none' : '2px solid var(--color-text-tertiary)',
                                                    background: inv.requires_cfdi ? 'var(--color-accent)' : 'transparent',
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                    transition: 'all 0.2s ease',
                                                    padding: 0,
                                                }}
                                            >
                                                {inv.requires_cfdi && <CheckCircle2 size={20} style={{ color: 'white' }} />}
                                            </button>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: 12, fontWeight: 500, background: STATUS_CONFIG[inv.status]?.bg, color: STATUS_CONFIG[inv.status]?.color }}>
                                                {STATUS_CONFIG[inv.status]?.label || inv.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                                <button className="btn-icon" style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    onClick={e => { e.stopPropagation(); setActiveDropdownId(activeDropdownId === inv.id ? null : inv.id) }}>
                                                    <MoreVertical size={16} />
                                                </button>
                                                {activeDropdownId === inv.id && (
                                                    <div className="dropdown" style={{ position: 'absolute', right: 0, top: '100%', width: '200px', zIndex: 100, marginTop: '8px' }}>
                                                        {['open', 'partial'].includes(inv.status) && (
                                                            <button className="dropdown-item" style={{ gap: 8, color: 'var(--color-success)' }} onClick={() => { setPayInvoice(inv); setActiveDropdownId(null) }}>
                                                                <CheckCircle2 size={14} /> Marcar como pagado
                                                            </button>
                                                        )}
                                                        {inv.status !== 'void' && (
                                                            <button className="dropdown-item" style={{ gap: 8, color: '#f87171' }} onClick={() => { handleVoid(inv.id); setActiveDropdownId(null) }}>
                                                                <X size={14} /> Anular comprobante
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Create Invoice Modal ─────────────────────────────────────── */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: '760px', width: '95vw' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Nuevo comprobante</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-md)' }}>
                                <div className="form-group">
                                    <label className="form-label">Cliente *</label>
                                    <select className="form-input" required value={form.client_id} onChange={e => onClientChange(e.target.value)}>
                                        <option value="">Seleccionar cliente...</option>
                                        {clients.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.first_name} {c.last_name}{c.credit_balance > 0 ? ` — Saldo: ${fmt(c.credit_balance)}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {form.client_id && (clients.find(c => c.id === form.client_id)?.credit_balance ?? 0) > 0 && (
                                        <p style={{ fontSize: '12px', color: 'var(--color-success)', marginTop: 4 }}>
                                            ✓ Este cliente tiene {fmt(clients.find(c => c.id === form.client_id)!.credit_balance)} de saldo a favor — se aplicará automáticamente.
                                        </p>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fecha de emisión *</label>
                                    <input className="form-input" type="date" required value={form.issued_at} onChange={e => setForm(f => ({ ...f, issued_at: e.target.value }))} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                                <div className="form-group">
                                    <label className="form-label">RFC del cliente</label>
                                    <input className="form-input" placeholder="RFC (para facturación)" value={form.client_rfc} onChange={e => setForm(f => ({ ...f, client_rfc: e.target.value }))} />
                                </div>
                                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-secondary)', userSelect: 'none' }}>
                                        <input type="checkbox" checked={form.requires_cfdi} onChange={e => setForm(f => ({ ...f, requires_cfdi: e.target.checked }))} style={{ width: 16, height: 16, accentColor: 'var(--color-accent)' }} />
                                        Requiere Factura Fiscal
                                    </label>
                                </div>
                            </div>

                            {/* Lines */}
                            <div style={{ marginTop: 'var(--space-lg)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                                    <label className="form-label" style={{ margin: 0 }}>Conceptos *</label>
                                    <button type="button" className="btn btn-secondary" style={{ borderRadius: '12px', height: '28px', fontSize: '12px', border: 'none', gap: 6 }}
                                        onClick={() => setLines(l => [...l, emptyLine()])}>
                                        <Plus size={12} /> Agregar línea
                                    </button>
                                </div>
                                <div style={{ border: '1px solid var(--color-glass-border)', borderRadius: '12px', overflow: 'visible' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 120px 90px 32px', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--color-glass-border)', fontSize: '11px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        <span>Descripción</span><span>Cant.</span><span>Precio</span><span style={{ textAlign: 'right' }}>Total</span><span></span>
                                    </div>
                                    {lines.map((line, i) => (
                                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 120px 90px 32px', gap: 8, padding: '8px 12px', borderBottom: i < lines.length - 1 ? '1px solid var(--color-glass-border)' : 'none', alignItems: 'center' }}>
                                            <input className="form-input" style={{ height: '32px', padding: '0 8px', fontSize: '13px' }} placeholder="Descripción" value={line.description} required onChange={e => updateLine(i, 'description', e.target.value)} />
                                            <input className="form-input" style={{ height: '32px', padding: '0 8px', fontSize: '13px' }} type="number" min="1" value={line.quantity} onChange={e => updateLine(i, 'quantity', parseFloat(e.target.value) || 1)} />
                                            <input className="form-input" style={{ height: '32px', padding: '0 8px', fontSize: '13px' }} type="number" min="0" step="0.01" placeholder="0.00" value={line.unit_price || ''} onChange={e => updateLine(i, 'unit_price', parseFloat(e.target.value) || 0)} />
                                            <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>{fmt(line.total)}</div>
                                            <button type="button" className="btn-icon" style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', opacity: lines.length === 1 ? 0.3 : 1 }}
                                                onClick={() => lines.length > 1 && setLines(l => l.filter((_, j) => j !== i))}>
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Total */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 32, background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--color-glass-border)', padding: '12px 20px' }}>
                                    <span style={{ color: 'var(--color-text-tertiary)', fontSize: '13px' }}>Total</span>
                                    <span style={{ fontWeight: 700, fontSize: '18px' }}>{fmt(invoiceTotal)}</span>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                <label className="form-label">Notas</label>
                                <textarea className="form-textarea" rows={2} placeholder="Observaciones..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving || invoiceTotal === 0}>
                                    {saving ? <span className="spinner" /> : 'Crear comprobante'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Mark as Paid Modal ────────────────────────────────────── */}
            {payInvoice && (
                <div className="modal-overlay" onClick={() => setPayInvoice(null)}>
                    <div className="modal" style={{ maxWidth: '420px', width: '95vw' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Marcar como pagado</h3>
                            <button className="modal-close" onClick={() => setPayInvoice(null)}><X size={16} /></button>
                        </div>
                        <div style={{ marginBottom: 'var(--space-md)' }}>
                            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
                                Se registrará un pago por el saldo pendiente de este comprobante.
                            </p>
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
                                {paymentMethods.map(pm => (
                                    <option key={pm.id} value={pm.id}>{pm.name}</option>
                                ))}
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

            {/* ── Invoice Detail Modal ──────────────────────────────────── */}
            <InvoiceDetailModal
                invoiceId={selectedInvoiceId}
                onClose={() => setSelectedInvoiceId(null)}
                onMarkAsPaid={(inv) => {
                    const matched = invoices.find(i => i.id === inv.id)
                    if (matched) setPayInvoice({ ...matched, balance_due: inv.balance_due })
                }}
            />
        </div>
    )
}
