import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Receipt, CheckCircle2 } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
    draft:   { label: 'Borrador',       bg: 'rgba(255,255,255,0.06)',   color: 'var(--color-text-tertiary)' },
    open:    { label: 'Abierta',        bg: 'rgba(234,179,8,0.15)',     color: '#eab308' },
    paid:    { label: 'Pagada',         bg: 'rgba(34,197,94,0.15)',     color: 'var(--color-success)' },
    partial: { label: 'Parcial',        bg: 'rgba(249,115,22,0.15)',    color: '#f97316' },
    void:    { label: 'Anulada',        bg: 'rgba(239,68,68,0.10)',     color: '#f87171' },
}

interface InvoiceLine {
    description: string
    quantity: number
    unit_price: number
    tax_rate: number
    tax: number
    total: number
    sort_order: number
}

interface InvoiceDetail {
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
    clients: { first_name: string; last_name: string } | null
    invoice_lines: InvoiceLine[]
}

interface PaymentDetail {
    id: string
    amount: number
    date: string
    notes: string | null
    amount_allocated: number
    payment_methods: { name: string } | null
}

interface Props {
    invoiceId: string | null
    onClose: () => void
    onMarkAsPaid?: (inv: InvoiceDetail) => void
}

export function InvoiceDetailModal({ invoiceId, onClose, onMarkAsPaid }: Props) {
    const [inv, setInv] = useState<InvoiceDetail | null>(null)
    const [payments, setPayments] = useState<PaymentDetail[]>([])
    const [loading, setLoading] = useState(false)
    const [paymentsLoading, setPaymentsLoading] = useState(false)

    useEffect(() => {
        if (!invoiceId) return
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        document.addEventListener('keydown', handler)
        return () => document.removeEventListener('keydown', handler)
    }, [invoiceId, onClose])

    useEffect(() => {
        if (!invoiceId) { setInv(null); setPayments([]); return }
        setLoading(true)
        setPaymentsLoading(true)

        supabase
            .from('invoices')
            .select('id, invoice_number, status, subtotal, tax_total, total, amount_paid, balance_due, issued_at, notes, client_rfc, requires_cfdi, clients(first_name, last_name), invoice_lines(description, quantity, unit_price, tax_rate, tax, total, sort_order)')
            .eq('id', invoiceId)
            .single()
            .then(({ data }) => {
                setInv(data as unknown as InvoiceDetail)
                setLoading(false)
            })

        supabase
            .from('payment_allocations')
            .select('amount_allocated, payments(id, amount, date, notes, payment_methods(name))')
            .eq('invoice_id', invoiceId)
            .order('created_at', { ascending: true })
            .then(({ data }) => {
                const rows: PaymentDetail[] = (data || []).map((row: any) => ({
                    id: row.payments?.id,
                    amount: row.payments?.amount,
                    date: row.payments?.date,
                    notes: row.payments?.notes,
                    amount_allocated: row.amount_allocated,
                    payment_methods: row.payments?.payment_methods,
                }))
                setPayments(rows)
                setPaymentsLoading(false)
            })
    }, [invoiceId])

    if (!invoiceId) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                style={{ maxWidth: '640px', width: '95vw', maxHeight: '90vh', overflow: 'auto' }}
                onClick={e => e.stopPropagation()}
            >
                {loading || !inv ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                        <div className="spinner" />
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Receipt size={18} style={{ color: 'var(--color-accent)' }} />
                                <div>
                                    <h3 className="modal-title" style={{ margin: 0 }}>{inv.invoice_number || 'Sin número'}</h3>
                                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-tertiary)' }}>
                                        {inv.clients?.first_name} {inv.clients?.last_name}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: 12, fontWeight: 500, background: STATUS_CONFIG[inv.status]?.bg, color: STATUS_CONFIG[inv.status]?.color }}>
                                    {STATUS_CONFIG[inv.status]?.label}
                                </span>
                                {inv.requires_cfdi && (
                                    <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: 11, fontWeight: 500, background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                                        Factura Fiscal
                                    </span>
                                )}
                                <button className="modal-close" onClick={onClose}><X size={16} /></button>
                            </div>
                        </div>

                        {/* Meta */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                            {[
                                { label: 'Fecha de emisión', value: new Date(inv.issued_at + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) },
                                { label: 'RFC', value: inv.client_rfc || '—' },
                                { label: 'Notas', value: inv.notes || '—' },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ background: 'var(--color-glass)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                                    <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                                    <div style={{ fontSize: '13px' }}>{value}</div>
                                </div>
                            ))}
                        </div>

                        {/* Line items */}
                        <div style={{ marginBottom: 'var(--space-lg)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Conceptos</div>
                            <div style={{ border: '1px solid var(--color-glass-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 60px 100px 70px 90px', gap: 8, padding: '8px 14px', background: 'var(--color-glass)', fontSize: '11px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>
                                    <span>Descripción</span><span style={{ textAlign: 'center' }}>Cant.</span><span style={{ textAlign: 'right' }}>Precio U.</span><span style={{ textAlign: 'center' }}>IVA</span><span style={{ textAlign: 'right' }}>Total</span>
                                </div>
                                {(inv.invoice_lines || []).sort((a, b) => a.sort_order - b.sort_order).map((line, i) => (
                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 60px 100px 70px 90px', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--color-glass-border)', fontSize: '13px' }}>
                                        <span>{line.description}</span>
                                        <span style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>{line.quantity ?? 1}</span>
                                        <span style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{fmt(line.unit_price ?? 0)}</span>
                                        <span style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '12px' }}>{Math.round((line.tax_rate ?? 0) * 100)}%</span>
                                        <span style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(line.total ?? 0)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Totals */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-lg)' }}>
                            <div style={{ width: '240px', background: 'var(--color-glass)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-glass-border)', padding: 'var(--space-md)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '16px' }}>
                                    <span>Total</span><span>{fmt(inv.total)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: 8, color: 'var(--color-success)' }}>
                                    <span>Pagado</span><span style={{ fontWeight: 600 }}>{fmt(inv.amount_paid)}</span>
                                </div>
                                {inv.balance_due > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: 4, color: '#eab308' }}>
                                        <span>Saldo pendiente</span><span style={{ fontWeight: 600 }}>{fmt(inv.balance_due)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Payment conciliation */}
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Conciliación de pagos</div>
                            {paymentsLoading ? (
                                <div style={{ textAlign: 'center', padding: 24 }}><div className="spinner" /></div>
                            ) : payments.length === 0 ? (
                                <div style={{ padding: '16px 0', fontSize: '13px', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Sin pagos registrados para este comprobante.</div>
                            ) : (
                                <div style={{ border: '1px solid var(--color-glass-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '90px 100px 1fr 110px 90px', gap: 8, padding: '8px 14px', background: 'var(--color-glass)', fontSize: '11px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>
                                        <span>Folio</span><span>Fecha</span><span>Notas</span><span>Método</span><span style={{ textAlign: 'right' }}>Abonado</span>
                                    </div>
                                    {payments.map((pay, i) => (
                                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 100px 1fr 110px 90px', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--color-glass-border)', fontSize: '13px', alignItems: 'center' }}>
                                            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-text-tertiary)', background: 'var(--color-glass)', padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>
                                                #{pay.id ? pay.id.slice(0, 8).toUpperCase() : '—'}
                                            </span>
                                            <span style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontSize: '12px' }}>
                                                {new Date(pay.date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                            <span style={{ color: 'var(--color-text-tertiary)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {pay.notes || '—'}
                                            </span>
                                            <span>
                                                {pay.payment_methods?.name ? (
                                                    <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: 8, background: 'var(--color-glass)', color: 'var(--color-text-secondary)' }}>
                                                        {pay.payment_methods.name}
                                                    </span>
                                                ) : '—'}
                                            </span>
                                            <span style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>{fmt(pay.amount_allocated)}</span>
                                        </div>
                                    ))}
                                    <div style={{ display: 'grid', gridTemplateColumns: '90px 100px 1fr 110px 90px', gap: 8, padding: '10px 14px', borderTop: '2px solid var(--color-glass-border)', fontSize: '13px', fontWeight: 700 }}>
                                        <span style={{ gridColumn: '1/5', color: 'var(--color-text-secondary)' }}>Total conciliado</span>
                                        <span style={{ textAlign: 'right', color: 'var(--color-success)' }}>
                                            {fmt(payments.reduce((s, p) => s + p.amount_allocated, 0))}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="modal-actions" style={{ marginTop: 'var(--space-lg)' }}>
                            <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
                            {onMarkAsPaid && ['open', 'partial'].includes(inv.status) && inv.balance_due > 0 && (
                                <button className="btn btn-primary" style={{ gap: 6 }} onClick={() => { onClose(); onMarkAsPaid(inv) }}>
                                    <CheckCircle2 size={14} /> Marcar como pagado ({fmt(inv.balance_due)})
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
