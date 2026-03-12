import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Users, Plus, Search, X, ChevronDown, Download, Filter, MoreVertical, Edit2 } from 'lucide-react'

interface Client {
    id: string
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
    gender: 'M' | 'F' | 'O' | null
    birth_date: string | null
    concession: string | null
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
    const [filterGender, setFilterGender] = useState('all')
    const [filterAge, setFilterAge] = useState('all')
    const [showModal, setShowModal] = useState(false)
    const [editingClient, setEditingClient] = useState<Client | null>(null)
    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        rfc: '',
        notes: '',
        gender: '' as any,
        birth_date: '',
        concession: '',
        preferred_contact: 'WhatsApp'
    })
    const [saving, setSaving] = useState(false)
    const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null)

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

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement
            // Check if click is outside ANY dropdown or action button
            if (!target.closest('.dropdown') && !target.closest('.btn-secondary') && !target.closest('.btn-icon')) {
                setActiveDropdownId(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const calculateAge = (birthDate: string | null) => {
        if (!birthDate) return null
        const birth = new Date(birthDate)
        const today = new Date()
        let age = today.getFullYear() - birth.getFullYear()
        const m = today.getMonth() - birth.getMonth()
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--
        }
        return age
    }

    const filteredClients = clients.filter((c) => {
        const q = search.toLowerCase()
        const matchesSearch = `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.phone?.includes(q)

        const matchesGender = filterGender === 'all' || c.gender === filterGender

        let matchesAge = true
        if (filterAge !== 'all') {
            const age = calculateAge(c.birth_date)
            if (age === null) matchesAge = false
            else if (filterAge === '0-18') matchesAge = age <= 18
            else if (filterAge === '19-30') matchesAge = age >= 19 && age <= 30
            else if (filterAge === '31-50') matchesAge = age >= 31 && age <= 50
            else if (filterAge === '51+') matchesAge = age >= 51
        }

        return matchesSearch && matchesGender && matchesAge
    })

    const handleEdit = (client: Client) => {
        setEditingClient(client)
        setForm({
            first_name: client.first_name,
            last_name: client.last_name,
            email: client.email || '',
            phone: client.phone || '',
            rfc: client.rfc || '',
            notes: client.notes || '',
            gender: client.gender || '',
            birth_date: client.birth_date || '',
            concession: client.concession || '',
            preferred_contact: client.preferred_contact || 'WhatsApp'
        })
        setShowModal(true)
    }

    const handleDuplicate = async (client: Client) => {
        if (!orgId) return
        setLoading(true)
        const { id, created_at, ...copyData } = client
        await supabase.from('clients').insert({
            ...copyData,
            first_name: `${copyData.first_name} (Copia)`,
            org_id: orgId
        })
        fetchClients()
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este paciente?')) return
        await supabase.from('clients').update({ active: false }).eq('id', id)
        fetchClients()
    }

    const exportToCSV = () => {
        const headers = ['Nombre', 'Apellido', 'Sexo', 'Fecha Nacimiento', 'Teléfono', 'Email', 'RFC', 'Concesión', 'Notas']
        const rows = filteredClients.map(c => [
            c.first_name,
            c.last_name,
            c.gender || '',
            c.birth_date || '',
            c.phone || '',
            c.email || '',
            c.rfc || '',
            c.concession || '',
            c.notes || ''
        ])

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n")
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute("download", `clientes_${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!orgId) return
        setSaving(true)

        const payload = {
            ...form,
            org_id: orgId,
            gender: form.gender || null,
            birth_date: form.birth_date || null
        }

        if (editingClient) {
            await supabase.from('clients').update(payload).eq('id', editingClient.id)
        } else {
            await supabase.from('clients').insert(payload)
        }

        setShowModal(false)
        setEditingClient(null)
        setForm({
            first_name: '', last_name: '', email: '', phone: '', rfc: '', notes: '',
            gender: '' as any, birth_date: '', concession: '', preferred_contact: 'WhatsApp'
        })
        setSaving(false)
        fetchClients()
    }

    return (
        <div className="animate-in">
            <div className="page-header page-header-actions" style={{ marginBottom: 'var(--space-lg)' }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: 500 }}>Clientes</h2>
                    <p style={{ color: 'var(--color-text-tertiary)', fontSize: '14px' }}>{clients.length} clientes registrados</p>
                </div>
                <button id="btn-new-client" className="btn btn-glass-primary" style={{ borderRadius: '16px', height: '36px', border: 'none', padding: '0 20px' }} onClick={() => setShowModal(true)}>
                    <Plus size={16} /> Nuevo cliente
                </button>
            </div>

            <div style={{ marginBottom: 'var(--space-md)', display: 'flex', gap: 'var(--space-md)', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 260, maxWidth: 360 }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                    <input
                        id="search-clients"
                        className="form-input"
                        placeholder="Buscar por nombre, correo o teléfono..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ paddingLeft: 36, borderRadius: '16px', height: '36px' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                    {/* Sexo Dropdown */}
                    <div style={{ position: 'relative' }}>
                        <button
                            className="btn btn-secondary"
                            style={{ borderRadius: '16px', height: '36px', gap: '8px', minWidth: '120px', justifyContent: 'space-between', border: 'none' }}
                            onClick={() => setActiveDropdownId(activeDropdownId === 'gender' ? null : 'gender')}
                        >
                            <span style={{ fontSize: '13px' }}>
                                {filterGender === 'all' ? 'Todo Sexo' : filterGender === 'M' ? 'Hombre' : filterGender === 'F' ? 'Mujer' : 'Otro'}
                            </span>
                            <ChevronDown size={14} />
                        </button>
                        {activeDropdownId === 'gender' && (
                            <div className="dropdown" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '160px', zIndex: 100 }}>
                                <button className="dropdown-item" onClick={() => { setFilterGender('all'); setActiveDropdownId(null); }}>Todo Sexo</button>
                                <button className="dropdown-item" onClick={() => { setFilterGender('M'); setActiveDropdownId(null); }}>Hombre</button>
                                <button className="dropdown-item" onClick={() => { setFilterGender('F'); setActiveDropdownId(null); }}>Mujer</button>
                                <button className="dropdown-item" onClick={() => { setFilterGender('O'); setActiveDropdownId(null); }}>Otro</button>
                            </div>
                        )}
                    </div>

                    {/* Edad Dropdown */}
                    <div style={{ position: 'relative' }}>
                        <button
                            className="btn btn-secondary"
                            style={{ borderRadius: '16px', height: '36px', gap: '8px', minWidth: '130px', justifyContent: 'space-between', border: 'none' }}
                            onClick={() => setActiveDropdownId(activeDropdownId === 'age' ? null : 'age')}
                        >
                            <span style={{ fontSize: '13px' }}>
                                {filterAge === 'all' ? 'Toda Edad' : filterAge}
                            </span>
                            <ChevronDown size={14} />
                        </button>
                        {activeDropdownId === 'age' && (
                            <div className="dropdown" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '180px', zIndex: 100 }}>
                                <button className="dropdown-item" onClick={() => { setFilterAge('all'); setActiveDropdownId(null); }}>Toda Edad</button>
                                <button className="dropdown-item" onClick={() => { setFilterAge('0-18'); setActiveDropdownId(null); }}>0-18 años</button>
                                <button className="dropdown-item" onClick={() => { setFilterAge('19-30'); setActiveDropdownId(null); }}>19-30 años</button>
                                <button className="dropdown-item" onClick={() => { setFilterAge('31-50'); setActiveDropdownId(null); }}>31-50 años</button>
                                <button className="dropdown-item" onClick={() => { setFilterAge('51+'); setActiveDropdownId(null); }}>51+ años</button>
                            </div>
                        )}
                    </div>

                    <button className="btn btn-secondary" onClick={exportToCSV} title="Exportar CSV" style={{ borderRadius: '16px', height: '36px', gap: '8px', border: 'none' }}>
                        <Download size={16} /> Exportar
                    </button>
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
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ borderBottom: '1px solid var(--color-glass-border)', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                            <tr>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Nombre</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Sexo</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Edad</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Teléfono</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Balance</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>RFC</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredClients.map((c) => {
                                const age = calculateAge(c.birth_date)
                                return (
                                    <tr key={c.id} style={{ borderBottom: '1px solid var(--color-glass-border)', transition: 'background 0.2s' }}>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{c.first_name} {c.last_name}</span>
                                                <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', fontWeight: 400 }}>{c.email || 'Sin correo'}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            {c.gender === 'M' ? (
                                                <span style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px' }}>
                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} /> M
                                                </span>
                                            ) : c.gender === 'F' ? (
                                                <span style={{ color: '#ec4899', display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px' }}>
                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ec4899' }} /> F
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--color-text-tertiary)', fontSize: '13px' }}>—</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px', color: 'var(--color-text-secondary)' }}>{age !== null ? `${age}a` : '—'}</td>
                                        <td style={{ padding: '16px', color: 'var(--color-text-secondary)' }}>{c.phone || '—'}</td>
                                        <td style={{ padding: '16px' }}>
                                            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>$0.00</span>
                                        </td>
                                        <td style={{ padding: '16px', color: 'var(--color-text-tertiary)', fontFamily: 'monospace', fontSize: 'var(--font-size-sm)' }}>{c.rfc || '—'}</td>
                                        <td style={{ padding: '16px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                <button className="btn-icon" onClick={() => handleEdit(c)} title="Editar" style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Edit2 size={16} />
                                                </button>
                                                <div style={{ position: 'relative' }}>
                                                    <button
                                                        className="btn-icon"
                                                        title="Más opciones"
                                                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveDropdownId(activeDropdownId === `actions-${c.id}` ? null : `actions-${c.id}`);
                                                        }}
                                                    >
                                                        <MoreVertical size={16} />
                                                    </button>
                                                    {activeDropdownId === `actions-${c.id}` && (
                                                        <div className="dropdown" style={{
                                                            position: 'absolute',
                                                            right: 0,
                                                            top: '100%',
                                                            width: '200px',
                                                            zIndex: 100,
                                                            marginTop: '8px'
                                                        }}>
                                                            <button className="dropdown-item" onClick={() => { handleDuplicate(c); setActiveDropdownId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <Filter size={14} /> Duplicar cliente
                                                            </button>
                                                            <button className="dropdown-item" onClick={() => { exportToCSV(); setActiveDropdownId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <Download size={14} /> Exportar datos
                                                            </button>
                                                            <div style={{ height: '1px', background: 'var(--color-glass-border)', margin: '4px 0' }} />
                                                            <button className="dropdown-item" style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => { handleDelete(c.id); setActiveDropdownId(null); }}>
                                                                <X size={14} /> Borrar paciente
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
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
                                    <label className="form-label">Nombre *</label>
                                    <input className="form-input" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Apellido</label>
                                    <input className="form-input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                                <div className="form-group">
                                    <label className="form-label">Sexo *</label>
                                    <select className="form-input" required value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as any })}>
                                        <option value="">Seleccionar...</option>
                                        <option value="M">Hombre</option>
                                        <option value="F">Mujer</option>
                                        <option value="O">Otro</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Fecha de Nacimiento</label>
                                    <input className="form-input" type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                                <div className="form-group">
                                    <label className="form-label">Teléfono *</label>
                                    <input className="form-input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Correo electrónico</label>
                                    <input className="form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                                <div className="form-group">
                                    <label className="form-label">RFC</label>
                                    <input className="form-input" value={form.rfc} onChange={(e) => setForm({ ...form, rfc: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Contacto preferido</label>
                                    <select className="form-input" value={form.preferred_contact} onChange={(e) => setForm({ ...form, preferred_contact: e.target.value })}>
                                        <option value="WhatsApp">WhatsApp</option>
                                        <option value="Llamada">Llamada</option>
                                        <option value="Email">Email</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                                <label className="form-label">Concesión / Convenio</label>
                                <input className="form-input" placeholder="Ej. INAPAM, Estudiante..." value={form.concession || ''} onChange={(e) => setForm({ ...form, concession: e.target.value })} />
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
