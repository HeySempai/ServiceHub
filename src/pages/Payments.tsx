import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { CreditCard } from 'lucide-react'

interface Payment {
    id: string
    amount: number
    date: string
    notes: string | null
    invoices: { invoice_number: string | null }
    clients: { first_name: string; last_name: string }
    payment_methods: { name: string } | null
}

export function PaymentsPage() {
    const { orgMember } = useAuth()
    const [payments, setPayments] = useState<Payment[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!orgMember) return
        supabase.from('payments')
            .select('id, amount, date, notes, invoices(invoice_number), clients(first_name, last_name), payment_methods(name)')
            .eq('org_id', orgMember.org_id)
            .order('date', { ascending: false })
            .limit(50)
            .then(({ data }) => {
                setPayments((data as unknown as Payment[]) || [])
                setLoading(false)
            })
    }, [orgMember])

    const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

    return (
        <div className="animate-in">
            <div className="page-header">
                <h2>Pagos</h2>
                <p>{payments.length} pagos registrados</p>
            </div>

            {loading ? (
                <div className="loading-screen" style={{ minHeight: 300 }}><div className="spinner" /></div>
            ) : payments.length === 0 ? (
                <div className="card"><div className="empty-state"><CreditCard /><h3>Sin pagos aún</h3><p>Los pagos se registran contra facturas abiertas.</p></div></div>
            ) : (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead><tr><th>Fecha</th><th>Cliente</th><th>Factura</th><th>Método</th><th>Monto</th></tr></thead>
                        <tbody>
                            {payments.map((p) => (
                                <tr key={p.id}>
                                    <td style={{ color: 'var(--color-text-secondary)' }}>{new Date(p.date).toLocaleDateString('es-MX')}</td>
                                    <td style={{ fontWeight: 500 }}>{p.clients?.first_name} {p.clients?.last_name}</td>
                                    <td style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>{p.invoices?.invoice_number || '—'}</td>
                                    <td><span className="badge badge-confirmed">{p.payment_methods?.name || '—'}</span></td>
                                    <td style={{ fontWeight: 600, color: 'var(--color-success)' }}>{fmt(p.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
