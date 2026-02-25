import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Receipt, Plus, X } from 'lucide-react'

interface Expense {
    id: string
    date: string
    period: string
    description: string | null
    vendor: string | null
    subtotal: number
    tax: number
    total: number
    has_receipt: boolean
    payment_method: string | null
    expense_categories: { name: string }
}

interface Category { id: string; name: string }

export function ExpensesPage() {
    const { orgMember } = useAuth()
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState({ category_id: '', date: '', description: '', vendor: '', subtotal: '', payment_method: 'efectivo', has_receipt: false })
    const [saving, setSaving] = useState(false)

    const orgId = orgMember?.org_id

    const fetchExpenses = async () => {
        if (!orgId) return
        const [expRes, catRes] = await Promise.all([
            supabase.from('expenses').select('*, expense_categories(name)').eq('org_id', orgId).order('date', { ascending: false }).limit(50),
            supabase.from('expense_categories').select('id, name').eq('org_id', orgId).order('name'),
        ])
        setExpenses((expRes.data as unknown as Expense[]) || [])
        setCategories(catRes.data || [])
        setLoading(false)
    }

    useEffect(() => { fetchExpenses() }, [orgId])

    const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!orgId) return
        setSaving(true)
        const dateObj = new Date(form.date)
        const period = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-01`
        await supabase.from('expenses').insert({
            org_id: orgId,
            category_id: form.category_id,
            date: form.date,
            period,
            description: form.description || null,
            vendor: form.vendor || null,
            subtotal: parseFloat(form.subtotal),
            payment_method: form.payment_method,
            has_receipt: form.has_receipt,
        })
        setShowModal(false)
        setForm({ category_id: '', date: '', description: '', vendor: '', subtotal: '', payment_method: 'efectivo', has_receipt: false })
        setSaving(false)
        fetchExpenses()
    }

    return (
        <div className="animate-in">
            <div className="page-header page-header-actions">
                <div>
                    <h2>Gastos</h2>
                    <p>{expenses.length} gastos registrados</p>
                </div>
                <button id="btn-new-expense" className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={16} /> Nuevo gasto
                </button>
            </div>

            {loading ? (
                <div className="loading-screen" style={{ minHeight: 300 }}><div className="spinner" /></div>
            ) : expenses.length === 0 ? (
                <div className="card"><div className="empty-state"><Receipt /><h3>Sin gastos aún</h3><p>Registra los gastos operativos de tu negocio.</p></div></div>
            ) : (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Proveedor</th><th>Subtotal</th><th>IVA</th><th>Total</th><th>Factura</th></tr></thead>
                        <tbody>
                            {expenses.map((ex) => (
                                <tr key={ex.id}>
                                    <td style={{ color: 'var(--color-text-secondary)' }}>{new Date(ex.date).toLocaleDateString('es-MX')}</td>
                                    <td><span className="badge badge-draft">{ex.expense_categories?.name}</span></td>
                                    <td>{ex.description || '—'}</td>
                                    <td style={{ color: 'var(--color-text-secondary)' }}>{ex.vendor || '—'}</td>
                                    <td>{fmt(ex.subtotal)}</td>
                                    <td style={{ color: 'var(--color-text-tertiary)' }}>{fmt(ex.tax)}</td>
                                    <td style={{ fontWeight: 600 }}>{fmt(ex.total)}</td>
                                    <td>{ex.has_receipt ? <span className="badge badge-completed">Sí</span> : <span className="badge badge-draft">No</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Nuevo gasto</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                                <div className="form-group">
                                    <label className="form-label">Categoría</label>
                                    <select className="form-select" required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                                        <option value="">Seleccionar</option>
                                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fecha</label>
                                    <input className="form-input" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                <label className="form-label">Descripción</label>
                                <input className="form-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                                <div className="form-group">
                                    <label className="form-label">Proveedor</label>
                                    <input className="form-input" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Subtotal (antes de IVA)</label>
                                    <input className="form-input" type="number" step="0.01" required value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-md)', alignItems: 'end' }}>
                                <div className="form-group">
                                    <label className="form-label">Método de pago</label>
                                    <select className="form-select" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                                        <option value="efectivo">Efectivo</option>
                                        <option value="tarjeta">Tarjeta</option>
                                        <option value="transferencia">Transferencia</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                        <input type="checkbox" checked={form.has_receipt} onChange={(e) => setForm({ ...form, has_receipt: e.target.checked })} />
                                        Tiene factura
                                    </label>
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <span className="spinner" /> : 'Guardar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
