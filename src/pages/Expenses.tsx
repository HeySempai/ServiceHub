import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Receipt, Plus, X, ChevronDown, TrendingDown, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

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
    category_id: string
    expense_categories: { name: string }
}

interface Category { id: string; name: string }

const PAYMENT_METHODS = ['Efectivo', 'Tarjeta débito', 'Tarjeta crédito', 'Transferencia', 'Cheque', 'Otro']

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0)

export function ExpensesPage() {
    const { orgMember } = useAuth()
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
    const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null)

    // Filters
    const [filterCategory, setFilterCategory] = useState('all')
    const [viewMonth, setViewMonth] = useState(() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })

    const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

    const [form, setForm] = useState({
        category_id: '',
        date: new Date().toLocaleDateString('en-CA'),
        period: currentMonth(),
        description: '',
        vendor: '',
        total: '',
        payment_method: 'Efectivo',
        has_receipt: false,
    })
    const [saving, setSaving] = useState(false)

    const orgId = orgMember?.org_id

    const fetchAll = async () => {
        if (!orgId) return
        const [expRes, catRes] = await Promise.all([
            supabase.from('expenses')
                .select('*, expense_categories(name)')
                .eq('org_id', orgId)
                .order('date', { ascending: false })
                .limit(200),
            supabase.from('expense_categories')
                .select('id, name')
                .eq('org_id', orgId)
                .order('sort_order'),
        ])
        setExpenses((expRes.data as unknown as Expense[]) || [])
        setCategories(catRes.data || [])
        setLoading(false)
    }

    useEffect(() => { fetchAll() }, [orgId])

    // Close dropdowns on outside click
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

    // Derived: filter by month and category
    const filteredExpenses = expenses.filter(ex => {
        const exMonth = ex.date.slice(0, 7)
        const matchMonth = exMonth === viewMonth
        const matchCategory = filterCategory === 'all' || ex.category_id === filterCategory
        return matchMonth && matchCategory
    })

    // KPI totals for current month
    const totalMonth = filteredExpenses.reduce((s, ex) => s + ex.total, 0)
    const totalSinIVA = filteredExpenses.reduce((s, ex) => s + ex.subtotal, 0)
    const totalIVA = filteredExpenses.reduce((s, ex) => s + (ex.tax || 0), 0)
    const withReceipt = filteredExpenses.filter(e => e.has_receipt).length

    // Top categories
    const byCategory: Record<string, number> = {}
    filteredExpenses.forEach(ex => {
        const name = ex.expense_categories?.name || 'Sin categoría'
        byCategory[name] = (byCategory[name] || 0) + ex.total
    })
    const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3)

    // Month navigation
    const changeMonth = (delta: number) => {
        const [y, m] = viewMonth.split('-').map(Number)
        const d = new Date(y, m - 1 + delta, 1)
        setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    const monthLabel = new Date(viewMonth + '-15').toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

    const openCreate = () => {
        setEditingExpense(null)
        setForm({ category_id: categories[0]?.id || '', date: new Date().toLocaleDateString('en-CA'), period: currentMonth(), description: '', vendor: '', total: '', payment_method: 'Efectivo', has_receipt: false })
        setShowModal(true)
    }

    const openEdit = (ex: Expense) => {
        setEditingExpense(ex)
        setForm({
            category_id: ex.category_id,
            date: ex.date,
            period: ex.period.slice(0, 7),
            description: ex.description || '',
            vendor: ex.vendor || '',
            total: String(ex.total),
            payment_method: ex.payment_method || 'Efectivo',
            has_receipt: ex.has_receipt,
        })
        setShowModal(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este gasto?')) return
        await supabase.from('expenses').delete().eq('id', id)
        fetchAll()
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!orgId) return
        setSaving(true)

        const totalVal = parseFloat(form.total) || 0
        const subtotalVal = Math.round((totalVal / 1.16) * 100) / 100

        const payload = {
            org_id: orgId,
            category_id: form.category_id,
            date: form.date,
            period: form.period + '-01',
            description: form.description || null,
            vendor: form.vendor || null,
            subtotal: subtotalVal,
            payment_method: form.payment_method,
            has_receipt: form.has_receipt,
        }

        if (editingExpense) {
            await supabase.from('expenses').update(payload).eq('id', editingExpense.id)
        } else {
            await supabase.from('expenses').insert(payload)
        }

        setShowModal(false)
        setSaving(false)
        fetchAll()
    }

    return (
        <div className="animate-in">
            {/* Header */}
            <div className="page-header" style={{ marginBottom: 'var(--space-lg)' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 500 }}>Gastos</h2>
                <p style={{ color: 'var(--color-text-tertiary)', fontSize: '14px' }}>{filteredExpenses.length} gastos en {monthLabel}</p>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                <div className="card" style={{ padding: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <TrendingDown size={16} style={{ color: '#f87171' }} />
                        <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total del mes</span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#f87171' }}>{fmt(totalMonth)}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                        {fmt(totalSinIVA)} + {fmt(totalIVA)} IVA
                    </div>
                </div>
                <div className="card" style={{ padding: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Receipt size={16} style={{ color: 'var(--color-accent)' }} />
                        <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Con factura</span>
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 700 }}>{withReceipt} <span style={{ fontSize: '14px', color: 'var(--color-text-tertiary)', fontWeight: 400 }}>/ {filteredExpenses.length}</span></div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: 4 }}>gastos con comprobante fiscal</div>
                </div>
                <div className="card" style={{ padding: 'var(--space-lg)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Top categorías</div>
                    {topCategories.length === 0 ? (
                        <span style={{ fontSize: '13px', color: 'var(--color-text-tertiary)' }}>Sin datos</span>
                    ) : topCategories.map(([name, total]) => (
                        <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: 4 }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>{name}</span>
                            <span style={{ fontWeight: 600 }}>{fmt(total)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
                {/* Month navigator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--color-bg-card)', border: '1px solid var(--color-glass-border)', borderRadius: '16px', padding: '0 8px', height: '36px' }}>
                    <button className="btn-icon" style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => changeMonth(-1)}>
                        <ChevronLeft size={14} />
                    </button>
                    <span style={{ fontSize: '13px', fontWeight: 500, minWidth: '130px', textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel}</span>
                    <button className="btn-icon" style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => changeMonth(1)}>
                        <ChevronRight size={14} />
                    </button>
                </div>

                {/* Category filter */}
                <div style={{ position: 'relative' }}>
                    <button
                        className="btn btn-secondary"
                        style={{ borderRadius: '16px', height: '36px', gap: '8px', minWidth: '140px', justifyContent: 'space-between', border: 'none' }}
                        onClick={() => setActiveDropdownId(activeDropdownId === 'cat' ? null : 'cat')}
                    >
                        <span style={{ fontSize: '13px' }}>
                            {filterCategory === 'all' ? 'Toda categoría' : categories.find(c => c.id === filterCategory)?.name || 'Categoría'}
                        </span>
                        <ChevronDown size={14} />
                    </button>
                    {activeDropdownId === 'cat' && (
                        <div className="dropdown" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '200px', zIndex: 100 }}>
                            <button className="dropdown-item" onClick={() => { setFilterCategory('all'); setActiveDropdownId(null) }}>Toda categoría</button>
                            {categories.map(c => (
                                <button key={c.id} className="dropdown-item" onClick={() => { setFilterCategory(c.id); setActiveDropdownId(null) }}>{c.name}</button>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ flex: 1 }} />
                <button className="btn btn-glass-primary" style={{ borderRadius: '16px', height: '36px', border: 'none', padding: '0 20px' }} onClick={openCreate}>
                    <Plus size={15} /> Nuevo gasto
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="loading-screen" style={{ minHeight: 300 }}><div className="spinner" /></div>
            ) : filteredExpenses.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <Receipt />
                        <h3>Sin gastos en {monthLabel}</h3>
                        <p>Registra los gastos operativos de tu negocio.</p>
                    </div>
                </div>
            ) : (
                <div className="data-table-wrapper">
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ borderBottom: '1px solid var(--color-glass-border)', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                            <tr>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Fecha</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Categoría</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Descripción</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Proveedor</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Subtotal</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>IVA</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Total</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Factura</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredExpenses.map((ex) => (
                                <tr key={ex.id} style={{ borderBottom: '1px solid var(--color-glass-border)', transition: 'background 0.2s' }}>
                                    <td style={{ padding: '16px', color: 'var(--color-text-secondary)' }}>
                                        {new Date(ex.date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: 12, fontWeight: 500, background: 'rgba(99,102,241,0.12)', color: 'var(--color-accent)' }}>
                                            {ex.expense_categories?.name}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px' }}>{ex.description || '—'}</td>
                                    <td style={{ padding: '16px', color: 'var(--color-text-secondary)' }}>{ex.vendor || '—'}</td>
                                    <td style={{ padding: '16px' }}>{fmt(ex.subtotal)}</td>
                                    <td style={{ padding: '16px', color: 'var(--color-text-tertiary)' }}>{fmt(ex.tax)}</td>
                                    <td style={{ padding: '16px', fontWeight: 600 }}>{fmt(ex.total)}</td>
                                    <td style={{ padding: '16px' }}>
                                        {ex.has_receipt
                                            ? <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: 12, fontWeight: 500, background: 'rgba(34,197,94,0.12)', color: 'var(--color-success)' }}>Sí</span>
                                            : <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: 12, background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-tertiary)' }}>No</span>}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                            <button className="btn-icon" onClick={() => openEdit(ex)} title="Editar" style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button className="btn-icon" onClick={() => handleDelete(ex.id)} title="Eliminar" style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editingExpense ? 'Editar gasto' : 'Nuevo gasto'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
                                <div className="form-group">
                                    <label className="form-label">Categoría *</label>
                                    <select className="form-input" required value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                                        <option value="">Seleccionar...</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fecha de pago *</label>
                                    <input className="form-input" type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Periodo *</label>
                                    <input className="form-input" type="month" required value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                <label className="form-label">Descripción</label>
                                <input className="form-input" placeholder="Ej. Compra de materiales..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                                <div className="form-group">
                                    <label className="form-label">Proveedor</label>
                                    <input className="form-input" placeholder="Ej. Office Depot" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Total (con IVA) *</label>
                                    <input className="form-input" type="number" step="0.01" min="0" required placeholder="0.00" value={form.total} onChange={e => setForm({ ...form, total: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-md)', alignItems: 'end' }}>
                                <div className="form-group">
                                    <label className="form-label">Método de pago</label>
                                    <select className="form-input" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
                                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-secondary)', userSelect: 'none' }}>
                                        <input type="checkbox" checked={form.has_receipt} onChange={e => setForm({ ...form, has_receipt: e.target.checked })} style={{ width: 16, height: 16 }} />
                                        Con Factura
                                    </label>
                                </div>
                            </div>
                            {form.total && (
                                (() => {
                                    const t = parseFloat(form.total) || 0
                                    const sub = Math.round((t / 1.16) * 100) / 100
                                    const iva = Math.round((t - sub) * 100) / 100
                                    return (
                                        <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--color-glass-border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: 6 }}>
                                                <span style={{ color: 'var(--color-text-tertiary)' }}>Subtotal</span>
                                                <span>{fmt(sub)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: 6 }}>
                                                <span style={{ color: 'var(--color-text-tertiary)' }}>IVA (16%)</span>
                                                <span>{fmt(iva)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--color-glass-border)', paddingTop: 6 }}>
                                                <span>Total</span>
                                                <span>{fmt(t)}</span>
                                            </div>
                                        </div>
                                    )
                                })()
                            )}
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <span className="spinner" /> : (editingExpense ? 'Guardar cambios' : 'Agregar gasto')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
