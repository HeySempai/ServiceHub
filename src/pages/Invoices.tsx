import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { FileText } from 'lucide-react'

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
    clients: { first_name: string; last_name: string }
}

export function InvoicesPage() {
    const { orgMember } = useAuth()
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!orgMember) return
        supabase.from('invoices')
            .select('id, invoice_number, status, subtotal, tax_total, total, amount_paid, balance_due, issued_at, clients(first_name, last_name)')
            .eq('org_id', orgMember.org_id)
            .order('issued_at', { ascending: false })
            .then(({ data }) => {
                setInvoices((data as unknown as Invoice[]) || [])
                setLoading(false)
            })
    }, [orgMember])

    const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

    const statusLabels: Record<string, string> = {
        draft: 'Borrador', open: 'Abierta', paid: 'Pagada', partial: 'Parcial', void: 'Anulada',
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <h2>Facturas</h2>
                <p>{invoices.length} facturas</p>
            </div>

            {loading ? (
                <div className="loading-screen" style={{ minHeight: 300 }}><div className="spinner" /></div>
            ) : invoices.length === 0 ? (
                <div className="card"><div className="empty-state"><FileText /><h3>Sin facturas aún</h3><p>Las facturas se generan automáticamente al completar una cita.</p></div></div>
            ) : (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>No. Factura</th>
                                <th>Cliente</th>
                                <th>Fecha</th>
                                <th>Total</th>
                                <th>Pagado</th>
                                <th>Saldo</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map((inv) => (
                                <tr key={inv.id}>
                                    <td style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-sm)' }}>{inv.invoice_number || '—'}</td>
                                    <td style={{ fontWeight: 500 }}>{inv.clients?.first_name} {inv.clients?.last_name}</td>
                                    <td style={{ color: 'var(--color-text-secondary)' }}>{new Date(inv.issued_at).toLocaleDateString('es-MX')}</td>
                                    <td style={{ fontWeight: 600 }}>{fmt(inv.total)}</td>
                                    <td style={{ color: 'var(--color-success)' }}>{fmt(inv.amount_paid)}</td>
                                    <td style={{ color: inv.balance_due > 0 ? 'var(--color-warning)' : 'var(--color-text-tertiary)' }}>{fmt(inv.balance_due)}</td>
                                    <td><span className={`badge badge-${inv.status}`}>{statusLabels[inv.status] || inv.status}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
