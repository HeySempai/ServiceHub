import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Scissors, Plus, X, MoreVertical, Pencil, Archive, RotateCcw } from 'lucide-react'

interface Category {
    id: string
    name: string
    sort_order: number
}

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

const CATEGORY_COLORS: Record<string, string> = {
    'Cortes':   '#6366f1',
    'Limpieza': '#06b6d4',
    'Tintes':   '#f59e0b',
    'Diseño':   '#ec4899',
    'Extras':   '#10b981',
}

const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

const emptyForm = () => ({
    name: '', description: '', duration_min: '30', price: '', color: '#6366f1', category_id: '',
})

export function ServicesPage() {
    const { orgMember } = useAuth()
    const [services, setServices]         = useState<Service[]>([])
    const [categories, setCategories]     = useState<Category[]>([])
    const [loading, setLoading]           = useState(true)
    const [showModal, setShowModal]       = useState(false)
    const [editTarget, setEditTarget]     = useState<Service | null>(null)
    const [form, setForm]                 = useState(emptyForm())
    const [saving, setSaving]             = useState(false)
    const [showArchived, setShowArchived] = useState(false)
    const [menuOpenId, setMenuOpenId]     = useState<string | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    const orgId = orgMember?.org_id

    const fetchAll = async () => {
        if (!orgId) return
        const [svcRes, catRes] = await Promise.all([
            supabase.from('services')
                .select('*, service_categories(name)')
                .eq('org_id', orgId)
                .order('sort_order'),
            supabase.from('service_categories')
                .select('id, name, sort_order')
                .eq('org_id', orgId)
                .order('sort_order'),
        ])
        setServices((svcRes.data as unknown as Service[]) || [])
        setCategories((catRes.data as Category[]) || [])
        setLoading(false)
    }

    useEffect(() => { fetchAll() }, [orgId])

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpenId(null)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const openCreate = () => {
        setEditTarget(null)
        setForm(emptyForm())
        setShowModal(true)
    }

    const openEdit = (s: Service) => {
        setEditTarget(s)
        setForm({
            name: s.name,
            description: s.description || '',
            duration_min: String(s.duration_min),
            price: String(s.price),
            color: s.color || '#6366f1',
            category_id: s.category_id || '',
        })
        setMenuOpenId(null)
        setShowModal(true)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!orgId) return
        setSaving(true)
        const payload = {
            name: form.name,
            description: form.description || null,
            duration_min: categories.find(c => c.id === form.category_id)?.name === 'Productos' ? 0 : parseInt(form.duration_min),
            price: parseFloat(form.price),
            tax_rate: 0,
            color: form.color,
            category_id: form.category_id || null,
        }
        if (editTarget) {
            await supabase.from('services').update(payload).eq('id', editTarget.id)
        } else {
            await supabase.from('services').insert({ ...payload, org_id: orgId, active: true })
        }
        setShowModal(false)
        setSaving(false)
        fetchAll()
    }

    const handleArchive = async (s: Service) => {
        setMenuOpenId(null)
        await supabase.from('services').update({ active: !s.active }).eq('id', s.id)
        fetchAll()
    }

    const visible = services.filter(s => showArchived ? true : s.active)

    // Group by category
    const grouped: Record<string, Service[]> = {}
    const uncategorized: Service[] = []
    for (const s of visible) {
        const cat = s.service_categories?.name
        if (cat) {
            if (!grouped[cat]) grouped[cat] = []
            grouped[cat].push(s)
        } else {
            uncategorized.push(s)
        }
    }

    const activeCount = services.filter(s => s.active).length
    const archivedCount = services.filter(s => !s.active).length

    return (
        <div className="animate-in">
            <div className="page-header page-header-actions">
                <div>
                    <h2>Servicios</h2>
                    <p>{activeCount} servicios activos{archivedCount > 0 ? ` · ${archivedCount} archivados` : ''}</p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                    {archivedCount > 0 && (
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowArchived(v => !v)}
                            style={{ fontSize: '13px' }}
                        >
                            {showArchived ? 'Ocultar archivados' : 'Ver archivados'}
                        </button>
                    )}
                    <button className="btn btn-glass-primary" style={{ borderRadius: '16px', height: '36px', border: 'none', padding: '0 20px' }} onClick={openCreate}>
                        <Plus size={15} /> Nuevo servicio
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading-screen" style={{ minHeight: 300 }}><div className="spinner" /></div>
            ) : visible.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <Scissors />
                        <h3>Sin servicios aún</h3>
                        <p>Agrega los servicios que ofrece tu negocio.</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
                    {categories
                        .filter(cat => grouped[cat.name]?.length > 0)
                        .map(cat => (
                            <div key={cat.id}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-md)' }}>
                                    <div style={{ width: 3, height: 18, borderRadius: 2, background: CATEGORY_COLORS[cat.name] || 'var(--color-accent)' }} />
                                    <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--color-text-secondary)' }}>
                                        {cat.name}
                                    </h3>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-md)' }}>
                                    {grouped[cat.name].map(s => (
                                        <ServiceCard
                                            key={s.id}
                                            service={s}
                                            menuOpenId={menuOpenId}
                                            setMenuOpenId={setMenuOpenId}
                                            menuRef={menuRef}
                                            onEdit={openEdit}
                                            onArchive={handleArchive}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                    }
                    {uncategorized.length > 0 && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-md)' }}>
                                <div style={{ width: 3, height: 18, borderRadius: 2, background: 'var(--color-text-tertiary)' }} />
                                <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--color-text-secondary)' }}>
                                    Sin categoría
                                </h3>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-md)' }}>
                                {uncategorized.map(s => (
                                    <ServiceCard
                                        key={s.id}
                                        service={s}
                                        menuOpenId={menuOpenId}
                                        setMenuOpenId={setMenuOpenId}
                                        menuRef={menuRef}
                                        onEdit={openEdit}
                                        onArchive={handleArchive}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Create / Edit modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editTarget ? 'Editar servicio' : 'Nuevo servicio'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="form-group">
                                <label className="form-label">Nombre del servicio *</label>
                                <input
                                    className="form-input" required
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Ej: Corte de cabello"
                                />
                            </div>
                            <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                <label className="form-label">Descripción</label>
                                <textarea
                                    className="form-textarea"
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Descripción breve del servicio"
                                    rows={2}
                                />
                            </div>
                            <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                <label className="form-label">Categoría</label>
                                <select
                                    className="form-select"
                                    value={form.category_id}
                                    onChange={(e) => {
                                        const cat = categories.find(c => c.id === e.target.value)
                                        setForm({
                                            ...form,
                                            category_id: e.target.value,
                                            color: cat ? (CATEGORY_COLORS[cat.name] || form.color) : form.color,
                                        })
                                    }}
                                >
                                    <option value="">Sin categoría</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            {(() => {
                                const isProduct = categories.find(c => c.id === form.category_id)?.name === 'Productos'
                                return isProduct ? (
                                    <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                        <label className="form-label">Precio (MXN) *</label>
                                        <input
                                            className="form-input" type="number" step="1" min="0" required
                                            value={form.price}
                                            onChange={(e) => setForm({ ...form, price: e.target.value })}
                                            placeholder="0"
                                        />
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                                        <div className="form-group">
                                            <label className="form-label">Precio (MXN) *</label>
                                            <input
                                                className="form-input" type="number" step="1" min="0" required
                                                value={form.price}
                                                onChange={(e) => setForm({ ...form, price: e.target.value })}
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Duración (min) *</label>
                                            <input
                                                className="form-input" type="number" min="5" required
                                                value={form.duration_min}
                                                onChange={(e) => setForm({ ...form, duration_min: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                )
                            })()}
                            <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                <label className="form-label">Color</label>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                                    <input
                                        type="color" value={form.color}
                                        onChange={(e) => setForm({ ...form, color: e.target.value })}
                                        style={{ width: 40, height: 32, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                                    />
                                    <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>{form.color}</span>
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <span className="spinner" /> : (editTarget ? 'Guardar cambios' : 'Crear servicio')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Service Card ──────────────────────────────────────────────────────────────
interface CardProps {
    service: Service
    menuOpenId: string | null
    setMenuOpenId: (id: string | null) => void
    menuRef: React.RefObject<HTMLDivElement | null>
    onEdit: (s: Service) => void
    onArchive: (s: Service) => void
}

function ServiceCard({ service: s, menuOpenId, setMenuOpenId, menuRef, onEdit, onArchive }: CardProps) {
    const isMenuOpen = menuOpenId === s.id
    return (
        <div
            className="card"
            style={{
                position: 'relative', overflow: 'hidden',
                opacity: s.active ? 1 : 0.55,
                transition: 'opacity 0.2s',
            }}
        >
            {/* color bar */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.color || 'var(--color-accent)' }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, paddingRight: 8 }}>{s.name}</h3>
                {/* 3-dot menu */}
                <div style={{ position: 'relative', flexShrink: 0 }} ref={isMenuOpen ? menuRef : undefined}>
                    <button
                        className="btn-icon"
                        style={{ width: 28, height: 28 }}
                        onClick={(e) => { e.stopPropagation(); setMenuOpenId(isMenuOpen ? null : s.id) }}
                    >
                        <MoreVertical size={15} />
                    </button>
                    {isMenuOpen && (
                        <div className="dropdown" style={{
                            position: 'absolute', top: 32, right: 0, zIndex: 50,
                            minWidth: 150, background: 'var(--color-bg-secondary)',
                            border: '1px solid var(--color-glass-border)',
                            borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                            overflow: 'hidden',
                        }}>
                            <button
                                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-primary)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-glass)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                onClick={() => onEdit(s)}
                            >
                                <Pencil size={14} /> Editar
                            </button>
                            <button
                                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: s.active ? '#f87171' : 'var(--color-success)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-glass)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                onClick={() => onArchive(s)}
                            >
                                {s.active ? <><Archive size={14} /> Archivar</> : <><RotateCcw size={14} /> Restaurar</>}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {s.description && (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: 'var(--space-md)', lineHeight: 1.4 }}>{s.description}</p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>{fmt(s.price)}</span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', background: 'var(--color-glass)', padding: '2px 8px', borderRadius: 8 }}>{s.duration_min} min</span>
            </div>

            {!s.active && (
                <div style={{ marginTop: 8 }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>Archivado</span>
                </div>
            )}
        </div>
    )
}
