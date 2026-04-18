import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { X, FileText, CreditCard } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    draft:   { label: 'Borrador', color: '#94a3b8' },
    open:    { label: 'Abierta',  color: '#eab308' },
    paid:    { label: 'Pagada',   color: '#22c55e' },
    partial: { label: 'Parcial',  color: '#f97316' },
    void:    { label: 'Anulada',  color: '#f87171' },
}

interface InvoiceLine {
    id: string
    description: string
    quantity: number
    unit_price: number
    tax_rate: number
    tax: number
    total: number
    sort_order: number
}

interface Payment {
    id: string
    amount: number
    date: string
    notes: string | null
    payment_methods: { name: string } | null
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

interface Props {
    invoiceId: string | null
    onClose: () => void
}

export function InvoiceDetailDrawer({ invoiceId, onClose }: Props) {
    const [inv, setInv] = useState<InvoiceDetail | null>(null)
    const [payments, setPayments] = useState<Payment[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!invoiceId) { setInv(null); setPayments([]); return }
        setLoading(true)
        Promise.all([
            supabase
                .from('invoices')
                .select('id, invoice_number, status, subtotal, tax_total, total, amount_paid, balance_due, issued_at, notes, client_rfc, requires_cfdi, clients(first_name, last_name), invoice_lines(id, description, quantity, unit_price, tax_rate, tax, total, sort_order)')
                .eq('id', invoiceId)
                .single(),
            supabase
                .from('payments')
                .select('id, amount, date, notes, payment_methods(name)')
                .eq('invoice_id', invoiceId)
                .order('date', { ascending: false }),
        ]).then(([invRes, payRes]) => {
            setInv(invRes.data as unknown as InvoiceDetail)
            setPayments((payRes.data as unknown as Payment[]) || [])
            setLoading(false)
        })
    }, [invoiceId])

    if (!invoiceId) return null

    const st = inv ? (STATUS_CONFIG[inv.status] || { label: inv.status, color: '#94a3b8' }) : null
    const lines = inv?.invoice_lines?.slice().sort((a, b) => a.sort_order - b.sort_order) || []

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0, zIndex: 1100,
                    background: 'rgba(0,0,0,0.45)',
                    backdropFilter: 'blur(2px)',
                }}
            />

            {/* Drawer */}
            <div style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 1101,
                width: 480, maxWidth: '95vw',
                background: 'var(--color-bg-secondary)',
                borderLeft: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', flexDirection: 'column',
                boxShadow: '-16px 0 48px rgba(0,0,0,0.5)',
                overflowY: 'auto',
            }}>
                {loading || !inv ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="spinner" />
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div style={{
                            padding: '28px 28px 20px',
                            borderBottom: '1px solid rgba(255,255,255,0.07)',
                            display: 'flex', alignItems: 'flex-start', gap: 16,
                        }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                                background: (st!.color) + '1a',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <FileText size={20} style={{ color: st!.color }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '18px', fontWeight: 700, color: 'white', fontFamily: 'monospace' }}>
                                    {inv.invoice_number || inv.id.slice(0, 8)}
                                </div>
                                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>
                                    {inv.clients ? `${inv.clients.first_name} ${inv.clients.last_name}` : '—'}
                                    {' · '}
                                    {new Date(inv.issued_at + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{
                                    fontSize: '12px', padding: '4px 12px', borderRadius: 8,
                                    background: st!.color + '1a', color: st!.color, fontWeight: 600,
                                }}>
                                    {st!.label}
                                </span>
                                <button
                                    onClick={onClose}
                                    style={{
                                        background: 'rgba(255,255,255,0.06)', border: 'none',
                                        borderRadius: 8, width: 32, height: 32,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                                    }}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Lines */}
                        <div style={{ padding: '24px 28px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                                Conceptos
                            </div>
                            {lines.length === 0 ? (
                                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>Sin conceptos</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                                    {lines.map((line, i) => (
                                        <div key={line.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '12px 16px',
                                            background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                                        }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '13px', fontWeight: 500, color: 'white' }}>{line.description}</div>
                                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                                                    {line.quantity} × {fmt(line.unit_price)}
                                                    {line.tax_rate > 0 && ` · IVA ${Math.round(line.tax_rate * 100)}%`}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'white', flexShrink: 0 }}>
                                                {fmt(line.total)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Totals */}
                            <div style={{ marginTop: 16, padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                                    <span>Subtotal</span><span>{fmt(inv.subtotal)}</span>
                                </div>
                                {inv.tax_total > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                                        <span>IVA</span><span>{fmt(inv.tax_total)}</span>
                                    </div>
                                )}
                                <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 10 }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 700, color: 'white' }}>
                                    <span>Total</span><span>{fmt(inv.total)}</span>
                                </div>
                                {inv.amount_paid > 0 && (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#22c55e', marginTop: 8 }}>
                                            <span>Pagado</span><span>−{fmt(inv.amount_paid)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 600, color: inv.balance_due > 0 ? '#f97316' : '#22c55e', marginTop: 4 }}>
                                            <span>Saldo pendiente</span><span>{fmt(inv.balance_due)}</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Notes */}
                            {inv.notes && (
                                <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Notas</div>
                                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{inv.notes}</div>
                                </div>
                            )}

                            {/* RFC */}
                            {inv.client_rfc && (
                                <div style={{ marginTop: 10, padding: '10px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>RFC</span>
                                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'white', fontFamily: 'monospace' }}>{inv.client_rfc}</span>
                                </div>
                            )}
                        </div>

                        {/* Payments */}
                        {payments.length > 0 && (
                            <div style={{ padding: '0 28px 28px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                                    Pagos registrados
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                                    {payments.map((pay, i) => (
                                        <div key={pay.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '12px 16px',
                                            background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                                        }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <CreditCard size={14} style={{ color: '#22c55e' }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '13px', fontWeight: 500, color: 'white' }}>
                                                    {pay.payment_methods?.name || 'Pago'}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                                                    {new Date(pay.date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    {pay.notes && ` · ${pay.notes}`}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#22c55e', flexShrink: 0 }}>
                                                {fmt(pay.amount)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    )
}
