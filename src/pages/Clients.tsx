import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Users, Plus, Search, X } from 'lucide-react'

interface Client {
    id: string
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
    preferred_contact: string
    notes: string | null
    rfc: string | null
    active: boolean
    created_at: string
}

export function ClientsPage() {
    const { orgMember } = useAuth()
    const [clients, setClients] = useState<Client[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', rfc: '', notes: '' })
    const [saving, setSaving] = useState(false)

    const orgId = orgMember?.org_id

    const fetchClients = async () => {
        if (!orgId) return
        const { data } = await supabase
            .from('clients')
            .select('*')
            .eq('org_id', orgId)
            .eq('active', true)
            .order('last_name')
        setClients(data || [])
        setLoading(false)
    }

    useEffect(() => { fetchClients() }, [orgId])

    const filteredClients = clients.filter((c) => {
        const q = search.toLowerCase()
        return `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.phone?.includes(q)
    })

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!orgId) return
        setSaving(true)
        await supabase.from('clients').insert({ ...form, org_id: orgId })
        setShowModal(false)
        setForm({ first_name: '', last_name: '', email: '', phone: '', rfc: '', notes: '' })
        setSaving(false)
        fetchClients()
    }

    return (
        <div className="animate-in">
            <div className="page-header page-header-actions">
                <div>
                    <h2>Clientes</h2>
                    <p>{clients.length} clientes registrados</p>
                </div>
                <button id="btn-new-client" className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={16} /> Nuevo cliente
                </button>
            </div>

            <div style={{ marginBottom: 'var(--space-md)' }}>
                <div style={{ position: 'relative', maxWidth: 360 }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                    <input
                        id="search-clients"
                        className="form-input"
                        placeholder="Buscar por nombre, correo o teléfono..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ paddingLeft: 36 }}
                    />
                </div>
            </div>

            {loading ? (
                <div className="loading-screen" style={{ minHeight: 300 }}><div className="spinner" /></div>
            ) : filteredClients.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <Users />
                        <h3>{search ? 'Sin resultados' : 'Sin clientes aún'}</h3>
                        <p>{search ? 'Intenta una búsqueda diferente.' : 'Agrega tu primer cliente para comenzar.'}</p>
                    </div>
                </div>
            ) : (
                <div className="data-table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Correo</th>
                                <th>Teléfono</th>
                                <th>RFC</th>
                                <th>Contacto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredClients.map((c) => (
                                <tr key={c.id}>
                                    <td style={{ fontWeight: 500 }}>{c.first_name} {c.last_name}</td>
                                    <td style={{ color: 'var(--color-text-secondary)' }}>{c.email || '—'}</td>
                                    <td style={{ color: 'var(--color-text-secondary)' }}>{c.phone || '—'}</td>
                                    <td style={{ color: 'var(--color-text-tertiary)', fontFamily: 'monospace', fontSize: 'var(--font-size-sm)' }}>{c.rfc || '—'}</td>
                                    <td><span className="badge badge-confirmed">{c.preferred_contact}</span></td>
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
                            <h3 className="modal-title">Nuevo cliente</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                                <div className="form-group">
                                    <label className="form-label">Nombre</label>
                                    <input className="form-input" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Apellido</label>
                                    <input className="form-input" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                <label className="form-label">Correo electrónico</label>
                                <input className="form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                                <div className="form-group">
                                    <label className="form-label">Teléfono</label>
                                    <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">RFC</label>
                                    <input className="form-input" value={form.rfc} onChange={(e) => setForm({ ...form, rfc: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                <label className="form-label">Notas</label>
                                <textarea className="form-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
