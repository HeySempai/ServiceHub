import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Users, Plus, Search, X, ChevronDown, Download, Filter, MoreVertical, Edit2, Phone, Mail, CalendarDays, CreditCard, FileText, Clock } from 'lucide-react'
import { InvoiceDetailModal } from '@/components/InvoiceDetailModal'

interface ClientHistory {
    bookings: {
        id: string; start_at: string; status: string
        services: string[]
        total: number
        inv_status: string | null
    }[]
    invoices: {
        id: string; invoice_number: string | null; status: string; total: number; amount_paid: number; balance_due: number; issued_at: string
    }[]
    payments: {
        id: string; date: string; amount: number; method: string | null; notes: string | null
    }[]
}

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
    credit_balance: number
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

    // Client detail drawer
    const [detailClient, setDetailClient] = useState<Client | null>(null)
    const [detailHistory, setDetailHistory] = useState<ClientHistory | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailTab, setDetailTab] = useState<'bookings' | 'invoices' | 'payments'>('bookings')
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null)

    const orgId = orgMember?.org_id

    const [clientDebts, setClientDebts] = useState<Record<string, number>>({})

    const fetchClients = async () => {
        if (!orgId) return
        const [{ data }, { data: invData }] = await Promise.all([
            supabase.from('clients').select('*').eq('org_id', orgId).eq('active', true).order('last_name'),
            supabase.from('invoices').select('client_id, balance_due').eq('org_id', orgId).in('status', ['open', 'partial']),
        ])
        setClients(data || [])
        const debts: Record<string, number> = {}
        ;(invData || []).forEach((inv: any) => {
            debts[inv.client_id] = (debts[inv.client_id] || 0) + Number(inv.balance_due)
        })
        setClientDebts(debts)
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

    const openDetail = async (client: Client) => {
        setDetailClient(client)
        setDetailHistory(null)
        setDetailLoading(true)
        setDetailTab('bookings')

        const [bkRes, invRes, payRes] = await Promise.all([
            supabase.from('bookings')
                .select('id, start_at, status, booking_services(price_snapshot, sort_order, services(name)), services(name, price)')
                .eq('client_id', client.id)
                .order('start_at', { ascending: false })
                .limit(20),
            supabase.from('invoices')
                .select('id, invoice_number, status, total, amount_paid, balance_due, issued_at')
                .eq('client_id', client.id)
                .order('issued_at', { ascending: false }),
            supabase.from('payments')
                .select('id, date, amount, notes, payment_methods(name)')
                .eq('client_id', client.id)
                .order('date', { ascending: false }),
        ])

        // Fetch invoice lines for the actual booking IDs
        const bookingIds = (bkRes.data || []).map((b: any) => b.id)
        const invLinesData = bookingIds.length > 0
            ? (await supabase.from('invoice_lines').select('booking_id, invoices(status)').in('booking_id', bookingIds)).data || []
            : []
        const bookingInvMap = new Map<string, string>()
        for (const line of invLinesData as any[]) {
            if (line.booking_id && line.invoices?.status && !bookingInvMap.has(line.booking_id)) {
                bookingInvMap.set(line.booking_id, line.invoices.status)
            }
        }

        const bookings = (bkRes.data || []).map((b: any) => {
            const bsList = b.booking_services?.length > 0
                ? [...b.booking_services].sort((a: any, x: any) => a.sort_order - x.sort_order)
                : null
            return {
                id: b.id,
                start_at: b.start_at,
                status: b.status,
                services: bsList ? bsList.map((bs: any) => bs.services?.name || '') : [b.services?.name || ''],
                total: bsList ? bsList.reduce((s: number, x: any) => s + Number(x.price_snapshot), 0) : (b.services?.price || 0),
                inv_status: bookingInvMap.get(b.id) ?? null,
            }
        })

        setDetailHistory({
            bookings,
            invoices: (invRes.data || []).map((i: any) => ({
                id: i.id, invoice_number: i.invoice_number, status: i.status,
                total: Number(i.total), amount_paid: Number(i.amount_paid), balance_due: Number(i.balance_due),
                issued_at: i.issued_at,
            })),
            payments: (payRes.data || []).map((p: any) => ({
                id: p.id, date: p.date, amount: Number(p.amount),
                method: p.payment_methods?.name || null, notes: p.notes,
            })),
        })
        setDetailLoading(false)
    }

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
            <div className="page-header" style={{ marginBottom: 'var(--space-lg)' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 500 }}>Clientes</h2>
                <p style={{ color: 'var(--color-text-tertiary)', fontSize: '14px' }}>{clients.length} clientes registrados</p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '180px', maxWidth: '320px' }}>
                    <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                    <input
                        id="search-clients"
                        className="form-input"
                        placeholder="Buscar por nombre, correo o teléfono..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ paddingLeft: 34, borderRadius: '16px', height: '36px' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                    {/* Sexo Dropdown */}
                    <div style={{ position: 'relative' }}>
                        <button
                            className="btn btn-secondary"
                            style={{ borderRadius: '16px', height: '36px', gap: '8px', minWidth: '120px', justifyContent: 'space-between', border: 'none', fontSize: '13px' }}
                            onClick={() => setActiveDropdownId(activeDropdownId === 'gender' ? null : 'gender')}
                        >
                            <span>
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
                            style={{ borderRadius: '16px', height: '36px', gap: '8px', minWidth: '130px', justifyContent: 'space-between', border: 'none', fontSize: '13px' }}
                            onClick={() => setActiveDropdownId(activeDropdownId === 'age' ? null : 'age')}
                        >
                            <span>
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
                <div style={{ flex: 1 }} />
                <button id="btn-new-client" className="btn btn-glass-primary" style={{ borderRadius: '16px', height: '36px', border: 'none', padding: '0 20px' }} onClick={() => setShowModal(true)}>
                    <Plus size={15} /> Nuevo cliente
                </button>
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
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>Saldo</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'left' }}>RFC</th>
                                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'right' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredClients.map((c) => {
                                const age = calculateAge(c.birth_date)
                                return (
                                    <tr key={c.id} onClick={() => openDetail(c)} style={{ borderBottom: '1px solid var(--color-glass-border)', transition: 'background 0.2s', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-glass)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
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
                                            {(() => {
                                                const saldo = (c.credit_balance || 0) - (clientDebts[c.id] || 0)
                                                if (saldo === 0) return <span style={{ color: 'var(--color-text-tertiary)' }}>$0</span>
                                                const formatted = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Math.abs(saldo))
                                                return saldo > 0
                                                    ? <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>+{formatted}</span>
                                                    : <span style={{ color: '#f87171', fontWeight: 600 }}>-{formatted}</span>
                                            })()}
                                        </td>
                                        <td style={{ padding: '16px', color: 'var(--color-text-tertiary)', fontFamily: 'monospace', fontSize: 'var(--font-size-sm)' }}>{c.rfc || '—'}</td>
                                        <td style={{ padding: '16px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
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

            {/* ── Client Detail Drawer ── */}
            {detailClient && (() => {
                const initials = `${detailClient.first_name[0] || ''}${detailClient.last_name[0] || ''}`.toUpperCase()
                const fmtMXN = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
                const completedBookings = detailHistory?.bookings.filter(b => b.status === 'completed') || []
                const totalSpent = detailHistory?.invoices.reduce((s, i) => s + i.amount_paid, 0) || 0
                const lastVisit = detailHistory?.bookings.find(b => b.status === 'completed')
                const totalPending = detailHistory?.invoices.reduce((s, i) => s + i.balance_due, 0) || 0

                const INV_STATUS: Record<string, { label: string; color: string }> = {
                    paid:    { label: 'Pagada',   color: '#4ade80' },
                    open:    { label: 'Abierta',  color: '#eab308' },
                    partial: { label: 'Parcial',  color: '#f97316' },
                    draft:   { label: 'Borrador', color: '#94a3b8' },
                    void:    { label: 'Anulada',  color: '#f87171' },
                }
                const tabs: { key: typeof detailTab; label: string; count: number }[] = [
                    { key: 'bookings', label: 'Citas', count: detailHistory?.bookings.length || 0 },
                    { key: 'invoices', label: 'Comprobantes', count: detailHistory?.invoices.length || 0 },
                    { key: 'payments', label: 'Pagos', count: detailHistory?.payments.length || 0 },
                ]

                return <>
                    {/* Backdrop */}
                    <div onClick={() => setDetailClient(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 }} />

                    {/* Drawer panel */}
                    <div style={{
                        position: 'fixed', top: 0, right: 0, bottom: 0, width: '520px', maxWidth: '95vw',
                        background: 'var(--color-bg-secondary)', borderLeft: '1px solid var(--color-glass-border)',
                        zIndex: 201, display: 'flex', flexDirection: 'column',
                        boxShadow: '-12px 0 60px rgba(0,0,0,0.6)',
                    }}>

                        {/* ── Hero header ── */}
                        <div style={{ background: 'var(--color-bg-tertiary)', padding: '28px 28px 0', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    {/* Avatar */}
                                    <div style={{
                                        width: 56, height: 56, borderRadius: '50%',
                                        background: 'linear-gradient(135deg, var(--color-accent), #7c3aed)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', flexShrink: 0,
                                        boxShadow: '0 0 20px rgba(99,102,241,0.4)',
                                    }}>
                                        {initials}
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
                                            {detailClient.first_name} {detailClient.last_name}
                                        </h3>
                                        <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                                            {detailClient.phone && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                                    <Phone size={11} /> {detailClient.phone}
                                                </span>
                                            )}
                                            {detailClient.email && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                                                    <Mail size={11} /> {detailClient.email}
                                                </span>
                                            )}
                                            {detailClient.birth_date && (
                                                <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                                                    {calculateAge(detailClient.birth_date)} años
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '5px 12px', border: '1px solid var(--color-glass-border)', background: 'var(--color-glass-hover)' }}
                                        onClick={() => { handleEdit(detailClient); setDetailClient(null) }}>
                                        <Edit2 size={12} /> Editar
                                    </button>
                                    <button className="btn-icon" style={{ color: 'var(--color-text-tertiary)' }} onClick={() => setDetailClient(null)}>
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Stats row */}
                            {detailHistory && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--color-glass-hover)', borderRadius: '12px 12px 0 0', overflow: 'hidden', marginTop: 4 }}>
                                    {[
                                        { label: 'Visitas', value: completedBookings.length.toString(), color: '#38bdf8' },
                                        { label: 'Total gastado', value: fmtMXN(totalSpent), color: '#4ade80' },
                                        { label: 'Pendiente', value: totalPending > 0 ? fmtMXN(totalPending) : '—', color: totalPending > 0 ? '#f97316' : 'rgba(255,255,255,0.3)' },
                                        { label: 'Saldo a favor', value: (detailClient.credit_balance || 0) > 0 ? fmtMXN(detailClient.credit_balance) : '—', color: (detailClient.credit_balance || 0) > 0 ? '#4ade80' : 'rgba(255,255,255,0.3)' },
                                    ].map(stat => (
                                        <div key={stat.label} style={{ padding: '14px 12px', background: 'var(--color-bg-elevated)', textAlign: 'center' }}>
                                            <div style={{ fontSize: '15px', fontWeight: 700, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                                            <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{stat.label}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {detailLoading && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--color-glass-hover)', borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
                                    {[...Array(4)].map((_, i) => (
                                        <div key={i} style={{ padding: '14px 12px', background: 'var(--color-bg-elevated)', textAlign: 'center', height: 52 }} />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Tab bar ── */}
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-glass-border)', background: 'var(--color-bg-secondary)', flexShrink: 0 }}>
                            {tabs.map(t => (
                                <button key={t.key}
                                    onClick={() => setDetailTab(t.key)}
                                    style={{
                                        flex: 1, padding: '14px 8px', border: 'none', cursor: 'pointer', background: 'transparent',
                                        fontSize: '13px', fontWeight: detailTab === t.key ? 600 : 400,
                                        color: detailTab === t.key ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                        borderBottom: detailTab === t.key ? '2px solid var(--color-accent)' : '2px solid transparent',
                                        transition: 'all 0.15s',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                    }}>
                                    {t.label}
                                    {!detailLoading && t.count > 0 && (
                                        <span style={{
                                            fontSize: '10px', background: detailTab === t.key ? 'var(--color-accent)' : 'var(--color-glass-hover)',
                                            color: detailTab === t.key ? 'white' : 'var(--color-text-secondary)',
                                            padding: '1px 6px', borderRadius: 10, fontWeight: 600,
                                        }}>{t.count}</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* ── Tab content ── */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                            {detailLoading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                                    <div className="spinner" />
                                </div>
                            ) : !detailHistory ? null : detailTab === 'bookings' ? (
                                /* ── Citas tab ── */
                                detailHistory.bookings.length === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--color-text-tertiary)', gap: 8 }}>
                                        <CalendarDays size={32} style={{ opacity: 0.3 }} />
                                        <span style={{ fontSize: '13px' }}>Sin citas registradas</span>
                                    </div>
                                ) : detailHistory.bookings.map((b, i) => {
                                    const d = new Date(b.start_at)
                                    const isDimmed = b.status === 'cancelled' || b.status === 'no_show'
                                    const isPending = b.status === 'scheduled' || b.status === 'confirmed'

                                    // Payment status icon for completed bookings
                                    const PayIcon = () => {
                                        if (b.status !== 'completed') return null
                                        const inv = b.inv_status
                                        if (inv === 'paid') {
                                            return (
                                                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" style={{ flexShrink: 0 }}>
                                                    <circle cx="15" cy="15" r="13" fill="rgba(34,197,94,0.15)" />
                                                    <path d="M9.5 15.5 13 19 20.5 11.5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                                </svg>
                                            )
                                        }
                                        if (inv === 'partial') {
                                            return (
                                                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" style={{ flexShrink: 0 }}>
                                                    <circle cx="15" cy="15" r="13" fill="rgba(249,115,22,0.15)" />
                                                    <path d="M15 8.5v8M15 19.5v2" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" />
                                                </svg>
                                            )
                                        }
                                        // open or no invoice
                                        return (
                                            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" style={{ flexShrink: 0 }}>
                                                <circle cx="15" cy="15" r="13" fill="rgba(245,158,11,0.15)" />
                                                <path d="M15 8.5v8M15 19.5v2" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
                                            </svg>
                                        )
                                    }

                                    // Status icon for cancelled/no_show
                                    const StatusIcon = () => {
                                        if (b.status === 'cancelled' || b.status === 'no_show') {
                                            return (
                                                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" style={{ flexShrink: 0 }}>
                                                    <circle cx="15" cy="15" r="13" fill="rgba(239,68,68,0.15)" />
                                                    <path d="M10 10 20 20M20 10 10 20" stroke="#f87171" strokeWidth="2" strokeLinecap="round" />
                                                </svg>
                                            )
                                        }
                                        return null
                                    }

                                    return (
                                        <div key={b.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 16,
                                            padding: '16px 28px',
                                            borderBottom: i < detailHistory.bookings.length - 1 ? '1px solid var(--color-glass-border)' : 'none',
                                            transition: 'background 0.15s',
                                            opacity: isDimmed ? 0.35 : 1,
                                        }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-glass)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                                        >
                                            {/* Date block */}
                                            <div style={{ textAlign: 'center', minWidth: 42, flexShrink: 0 }}>
                                                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>{d.getDate()}</div>
                                                <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase' }}>
                                                    {d.toLocaleDateString('es-MX', { month: 'short' })}
                                                </div>
                                            </div>
                                            {/* Divider */}
                                            <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
                                            {/* Info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {b.services.filter(Boolean).join(' + ') || '—'}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                                    <Clock size={11} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                                                    <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
                                                        {d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} · {d.getFullYear()}
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Right side */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                                {/* Amount — left of icon, regular weight */}
                                                {b.total > 0 && (
                                                    <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                                                        ${b.total.toLocaleString()}
                                                    </span>
                                                )}
                                                {/* Pending indicator */}
                                                {isPending && (
                                                    <span style={{
                                                        width: 7, height: 7, borderRadius: '50%',
                                                        background: 'rgba(255,255,255,0.25)',
                                                        display: 'inline-block', flexShrink: 0,
                                                    }} title="Pendiente" />
                                                )}
                                                {/* Payment status icon (completed only) */}
                                                <PayIcon />
                                                {/* Cancelled / no-show X */}
                                                <StatusIcon />
                                            </div>
                                        </div>
                                    )
                                })
                            ) : detailTab === 'invoices' ? (
                                /* ── Comprobantes tab ── */
                                detailHistory.invoices.length === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--color-text-tertiary)', gap: 8 }}>
                                        <FileText size={32} style={{ opacity: 0.3 }} />
                                        <span style={{ fontSize: '13px' }}>Sin comprobantes</span>
                                    </div>
                                ) : detailHistory.invoices.map((inv, i) => {
                                    const st = INV_STATUS[inv.status] || { label: inv.status, color: '#94a3b8' }
                                    return (
                                        <div key={inv.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 16, padding: '16px 28px',
                                            borderBottom: i < detailHistory.invoices.length - 1 ? '1px solid var(--color-glass-border)' : 'none',
                                            transition: 'background 0.15s',
                                            cursor: 'pointer',
                                        }}
                                            onClick={() => setSelectedInvoiceId(inv.id)}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-glass)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                                        >
                                            {/* Icon */}
                                            <div style={{ width: 36, height: 36, borderRadius: 10, background: st.color + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <FileText size={16} style={{ color: st.color }} />
                                            </div>
                                            {/* Info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'var(--color-glass-hover)', color: 'var(--color-text-tertiary)', padding: '1px 7px', borderRadius: 4 }}>
                                                        {inv.invoice_number || inv.id.slice(0, 8)}
                                                    </span>
                                                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 6, background: st.color + '1a', color: st.color, fontWeight: 500 }}>
                                                        {st.label}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                                                    {new Date(inv.issued_at + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </div>
                                            </div>
                                            {/* Right */}
                                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{fmtMXN(inv.total)}</div>
                                                {inv.balance_due > 0 && (
                                                    <div style={{ fontSize: '11px', color: '#f97316', marginTop: 3 }}>
                                                        Pendiente {fmtMXN(inv.balance_due)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })
                            ) : (
                                /* ── Pagos tab ── */
                                detailHistory.payments.length === 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--color-text-tertiary)', gap: 8 }}>
                                        <CreditCard size={32} style={{ opacity: 0.3 }} />
                                        <span style={{ fontSize: '13px' }}>Sin pagos registrados</span>
                                    </div>
                                ) : detailHistory.payments.map((pay, i) => {
                                    const methodColors: Record<string, string> = { efectivo: '#22c55e', tarjeta: '#6366f1', transferencia: '#3b82f6' }
                                    const mColor = Object.entries(methodColors).find(([k]) => (pay.method || '').toLowerCase().includes(k))?.[1] || '#6366f1'
                                    return (
                                        <div key={pay.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 16, padding: '16px 28px',
                                            borderBottom: i < detailHistory.payments.length - 1 ? '1px solid var(--color-glass-border)' : 'none',
                                            transition: 'background 0.15s',
                                        }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-glass)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                                        >
                                            {/* Icon */}
                                            <div style={{ width: 36, height: 36, borderRadius: 10, background: mColor + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <CreditCard size={16} style={{ color: mColor }} />
                                            </div>
                                            {/* Info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'var(--color-glass-hover)', color: 'var(--color-text-tertiary)', padding: '1px 7px', borderRadius: 4 }}>
                                                        #{pay.id.slice(0, 8).toUpperCase()}
                                                    </span>
                                                    {pay.method && (
                                                        <span style={{ fontSize: '12px', padding: '1px 8px', borderRadius: 6, background: mColor + '1a', color: mColor, fontWeight: 500 }}>
                                                            {pay.method}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                                                    {new Date(pay.date + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    {pay.notes && <span style={{ marginLeft: 6, fontStyle: 'italic' }}>· {pay.notes}</span>}
                                                </div>
                                            </div>
                                            {/* Amount */}
                                            <span style={{ fontSize: '17px', fontWeight: 700, color: '#4ade80', flexShrink: 0 }}>
                                                {fmtMXN(pay.amount)}
                                            </span>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* Notes footer */}
                        {detailClient.notes && (
                            <div style={{ padding: '12px 28px', borderTop: '1px solid var(--color-glass-border)', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
                                <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nota: </span>
                                <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>{detailClient.notes}</span>
                            </div>
                        )}
                    </div>
                </>
            })()}

            {/* Invoice Detail Modal */}
            <InvoiceDetailModal invoiceId={selectedInvoiceId} onClose={() => setSelectedInvoiceId(null)} />
        </div>
    )
}

// ─── Helper sub-components ─────────────────────────────────────────────────────
function Section({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 'var(--space-xl)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ color: 'var(--color-accent)' }}>{icon}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-secondary)' }}>{title}</span>
                <span style={{ fontSize: '11px', background: 'var(--color-glass)', color: 'var(--color-text-tertiary)', padding: '1px 7px', borderRadius: 10 }}>{count}</span>
            </div>
            {children}
        </div>
    )
}

function EmptyRow({ text }: { text: string }) {
    return <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', fontStyle: 'italic', padding: '8px 0' }}>{text}</p>
}
