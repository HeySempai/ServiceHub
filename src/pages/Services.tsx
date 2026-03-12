import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Scissors, Plus, X } from 'lucide-react'

interface Service {
    id: string
    name: string
    description: string | null
    duration_min: number
    price: number
    tax_rate: number
    color: string | null
    active: boolean
    category_id: string | null
    service_categories: { name: string } | null
}

export function ServicesPage() {
    const { orgMember, memberLabel } = useAuth()
    const [services, setServices] = useState<Service[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState({ name: '', description: '', duration_min: '60', price: '', tax_rate: '0.16', color: '#6366f1' })
    const [saving, setSaving] = useState(false)

    const orgId = orgMember?.org_id

    const fetchServices = async () => {
        if (!orgId) return
        const { data } = await supabase
            .from('services')
            .select('*, service_categories(name)')
            .eq('org_id', orgId)
            .order('sort_order')
        setServices((data as unknown as Service[]) || [])
        setLoading(false)
    }

    useEffect(() => { fetchServices() }, [orgId])

    const formatCurrency = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!orgId) return
        setSaving(true)
        await supabase.from('services').insert({
            org_id: orgId,
            name: form.name,
            description: form.description || null,
            duration_min: parseInt(form.duration_min),
            price: parseFloat(form.price),
            tax_rate: parseFloat(form.tax_rate),
            color: form.color,
        })
        setShowModal(false)
        setForm({ name: '', description: '', duration_min: '60', price: '', tax_rate: '0.16', color: '#6366f1' })
        setSaving(false)
        fetchServices()
    }

    return (
        <div className="animate-in">
            <div className="page-header page-header-actions">
                <div>
                    <h2>Servicios</h2>
                    <p>{services.length} servicios configurados</p>
                </div>
                <button id="btn-new-service" className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={16} /> Nuevo servicio
                </button>
            </div>

            {loading ? (
                <div className="loading-screen" style={{ minHeight: 300 }}><div className="spinner" /></div>
            ) : services.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <Scissors />
                        <h3>Sin servicios aún</h3>
                        <p>Agrega los servicios que ofrece tu negocio.</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
                    {services.map((s) => (
                        <div key={s.id} className="card" style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.color || 'var(--color-accent)' }} />
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                                <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>{s.name}</h3>
                                <div style={{
                                    width: 10, height: 10, borderRadius: '50%', background: s.color || 'var(--color-accent)',
                                    boxShadow: `0 0 8px ${s.color || 'var(--color-accent)'}60`,
                                    flexShrink: 0, marginTop: 6,
                                }} />
                            </div>
                            {s.description && (
                                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-md)' }}>{s.description}</p>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                                <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{formatCurrency(s.price)}</span>
                                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>{s.duration_min} min</span>
                            </div>
                            {s.service_categories?.name && (
                                <div style={{ marginTop: 'var(--space-sm)' }}>
                                    <span className="badge badge-draft">{s.service_categories.name}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Nuevo servicio</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="form-group">
                                <label className="form-label">Nombre del servicio</label>
                                <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Corte de cabello" />
                            </div>
                            <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                <label className="form-label">Descripción</label>
                                <textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                                <div className="form-group">
                                    <label className="form-label">Duración (min)</label>
                                    <input className="form-input" type="number" required value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Precio</label>
                                    <input className="form-input" type="number" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">IVA</label>
                                    <select className="form-select" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}>
                                        <option value="0.16">16%</option>
                                        <option value="0.08">8%</option>
                                        <option value="0">Exento</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                <label className="form-label">Color</label>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                                    <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ width: 40, height: 32, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} />
                                    <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>{form.color}</span>
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <span className="spinner" /> : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
