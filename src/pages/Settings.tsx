import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Save, Check, Upload, UserPlus, X, Mail, Calendar, ExternalLink, Loader, Users, Trash2, UserCheck, UserX, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

const BUSINESS_TYPES = [
    { value: 'clinic', label: 'Clínica' },
    { value: 'barbershop', label: 'Barbería' },
    { value: 'salon', label: 'Salón de Belleza' },
    { value: 'spa', label: 'Spa' },
    { value: 'dental', label: 'Dental' },
    { value: 'gym', label: 'Gimnasio' },
    { value: 'veterinary', label: 'Veterinaria' },
    { value: 'consulting', label: 'Consultoría' },
    { value: 'general', label: 'Otro' },
]

const TIMEZONES = [
    { value: 'America/Mexico_City', label: 'Ciudad de México / Monterrey — Hora Central (UTC-6)' },
    { value: 'America/Cancun', label: 'Cancún / Chetumal — Hora del Sureste (UTC-5)' },
    { value: 'America/Mazatlan', label: 'Mazatlán / Sinaloa — Hora del Pacífico (UTC-7)' },
    { value: 'America/Tijuana', label: 'Tijuana / Baja California — Hora del Noroeste (UTC-8)' },
    { value: 'America/Chihuahua', label: 'Chihuahua / Ciudad Juárez — Hora de la Montaña (UTC-7)' },
    { value: 'America/Hermosillo', label: 'Hermosillo / Sonora — Hora de la Montaña sin DST (UTC-7)' },
]

export function SettingsPage() {
    const { orgMember, user, session, memberLabel, memberLabelPlural } = useAuth()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [searchParams, setSearchParams] = useSearchParams()

    // Profile form
    const [displayName, setDisplayName] = useState('')
    const [email, setEmail] = useState('')
    const [canBeBooked, setCanBeBooked] = useState(true)
    const [profileSaving, setProfileSaving] = useState(false)
    const [profileSaved, setProfileSaved] = useState(false)

    // Org form
    const [orgName, setOrgName] = useState('')
    const [orgType, setOrgType] = useState('')
    const [orgTimezone, setOrgTimezone] = useState('')
    const [logoUrl, setLogoUrl] = useState<string | null>(null)
    const [orgSaving, setOrgSaving] = useState(false)
    const [orgSaved, setOrgSaved] = useState(false)
    const [uploading, setUploading] = useState(false)

    // Member Labelling
    const [customMemberLabel, setCustomMemberLabel] = useState('Proveedor')
    const [customMemberLabelPlural, setCustomMemberLabelPlural] = useState('Proveedores')

    // Team
    const [teamMembers, setTeamMembers] = useState<any[]>([])
    const [showInvite, setShowInvite] = useState(false)
    const [inviteMode, setInviteMode] = useState<'no_account' | 'with_account'>('no_account')
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState('provider')
    const [inviteName, setInviteName] = useState('')
    const [inviteColor, setInviteColor] = useState('#3B82F6')
    const [inviting, setInviting] = useState(false)
    const [inviteSuccess, setInviteSuccess] = useState(false)

    // Google integration
    const [googleConnected, setGoogleConnected] = useState(false)
    const [googleEmail, setGoogleEmail] = useState<string | null>(null)
    const [googleConnecting, setGoogleConnecting] = useState(false)
    const [googleSuccess, setGoogleSuccess] = useState(false)

    useEffect(() => {
        if (!orgMember) return
        setDisplayName(orgMember.display_name || '')
        setEmail(orgMember.email || user?.email || '')
        setCanBeBooked(orgMember.can_be_booked)

        // Fetch org details
        supabase.from('organizations')
            .select('name, type, timezone, logo_url, settings')
            .eq('id', orgMember.org_id)
            .single()
            .then(({ data }) => {
                if (data) {
                    setOrgName(data.name)
                    setOrgType(data.type || 'general')
                    setOrgTimezone(data.timezone || 'America/Mexico_City')
                    setLogoUrl(data.logo_url)
                    setCustomMemberLabel(data.settings?.member_label || 'Proveedor')
                    setCustomMemberLabelPlural(data.settings?.member_label_plural || 'Proveedores')
                }
            })

        // Fetch team members
        supabase.from('org_members')
            .select('id, display_name, email, role, can_be_booked, active, color, user_id')
            .eq('org_id', orgMember.org_id)
            .eq('active', true)
            .order('role')
            .then(({ data }) => setTeamMembers(data || []))

        // Check Google connection
        supabase.from('calendar_connections')
            .select('id, account_email')
            .eq('org_id', orgMember.org_id)
            .eq('provider', 'google')
            .limit(1)
            .then(({ data }) => {
                if (data && data.length > 0) {
                    setGoogleConnected(true)
                    setGoogleEmail(data[0].account_email)
                }
            })

        // Handle ?google=success redirect
        if (searchParams.get('google') === 'success') {
            setGoogleSuccess(true)
            setGoogleConnected(true)
            setSearchParams({}, { replace: true })
            setTimeout(() => setGoogleSuccess(false), 4000)
            // Re-fetch to get email
            supabase.from('calendar_connections')
                .select('account_email')
                .eq('org_id', orgMember.org_id)
                .eq('provider', 'google')
                .limit(1)
                .single()
                .then(({ data }) => {
                    if (data) setGoogleEmail(data.account_email)
                })
        }
    }, [orgMember, user])

    const handleSaveProfile = async () => {
        if (!orgMember) return
        setProfileSaving(true)
        await supabase.from('org_members')
            .update({ display_name: displayName, email, can_be_booked: canBeBooked })
            .eq('id', orgMember.id)
        setProfileSaving(false)
        setProfileSaved(true)
        setTimeout(() => setProfileSaved(false), 2000)
    }

    const handleSaveOrg = async () => {
        if (!orgMember) return
        setOrgSaving(true)

        // Fetch current settings to preserve other fields if any
        const { data: org } = await supabase.from('organizations').select('settings').eq('id', orgMember.org_id).single()
        const newSettings = { ...org?.settings, member_label: customMemberLabel, member_label_plural: customMemberLabelPlural }

        await supabase.from('organizations')
            .update({ name: orgName, type: orgType, timezone: orgTimezone, settings: newSettings })
            .eq('id', orgMember.org_id)
        setOrgSaving(false)
        setOrgSaved(true)
        setTimeout(() => setOrgSaved(false), 2000)
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !orgMember) return
        setUploading(true)

        const ext = file.name.split('.').pop()
        const filePath = `${orgMember.org_id}/logo_${Date.now()}.${ext}`

        const { error: uploadError } = await supabase.storage
            .from('logos')
            .upload(filePath, file, { upsert: true })

        if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(filePath)
            await supabase.from('organizations')
                .update({ logo_url: publicUrl })
                .eq('id', orgMember.org_id)
            setLogoUrl(publicUrl)
        }
        setUploading(false)
        // Reset input so same file can be re-selected
        e.target.value = ''
    }

    const refreshTeam = async () => {
        if (!orgMember) return
        const { data } = await supabase.from('org_members')
            .select('id, display_name, email, role, can_be_booked, active, color, user_id')
            .eq('org_id', orgMember.org_id)
            .eq('active', true)
            .order('role')
        setTeamMembers(data || [])
    }

    const handleInvite = async () => {
        if (!orgMember || !inviteName.trim()) return
        setInviting(true)

        if (inviteMode === 'with_account' && inviteEmail) {
            // Check for duplicate email
            const { data: existing } = await supabase
                .from('org_members')
                .select('id')
                .eq('org_id', orgMember.org_id)
                .eq('email', inviteEmail)
                .limit(1)
            if (existing && existing.length > 0) {
                setInviting(false)
                return
            }
        }

        const { error: insertError } = await supabase.from('org_members').insert({
            org_id: orgMember.org_id,
            user_id: null,
            role: inviteRole,
            display_name: inviteName.trim(),
            email: inviteMode === 'with_account' ? inviteEmail : null,
            color: inviteColor,
            can_be_booked: true,
            active: true,
        })

        setInviting(false)
        if (insertError) {
            console.error('Error al agregar miembro:', insertError)
            return
        }
        setInviteSuccess(true)
        setInviteEmail('')
        setInviteName('')
        setInviteColor('#3B82F6')
        setTimeout(() => setInviteSuccess(false), 3000)
        await refreshTeam()
    }

    const handleRemoveMember = async (id: string) => {
        if (!orgMember) return
        await supabase.from('org_members').update({ active: false }).eq('id', id)
        await refreshTeam()
    }

    const handleGoogleConnect = async () => {
        setGoogleConnecting(true)
        try {
            const { data, error } = await supabase.functions.invoke('google-auth-init', {
                method: 'POST',
            })

            if (error) throw error

            if (data?.url) {
                window.location.href = data.url
            } else {
                console.error('Google init response missing URL:', data)
            }
        } catch (err) {
            console.error('Google connect error:', err)
        }
        setGoogleConnecting(false)
    }

    const isOwner = orgMember?.role === 'owner'
    const { theme, setTheme } = useTheme()
    const isAdminOrOwner = orgMember?.role === 'owner' || orgMember?.role === 'admin'

    const roleLabels: Record<string, string> = {
        owner: 'Dueño', admin: 'Admin', provider: 'Proveedor', receptionist: 'Recepcionista',
    }

    return (
        <div className="animate-in">
            <div className="page-header">
                <h2>Configuración</h2>
                <p>Administra tu cuenta, equipo e integraciones</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                {/* Profile Card */}
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
                        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>Perfil</h3>
                        <button
                            className={`btn ${profileSaved ? 'btn-ghost' : 'btn-primary'} btn-sm`}
                            onClick={handleSaveProfile}
                            disabled={profileSaving}
                        >
                            {profileSaved ? <><Check size={14} /> Guardado</> : profileSaving ? <span className="spinner" /> : <><Save size={14} /> Guardar</>}
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <div className="form-group">
                            <label className="form-label">Nombre</label>
                            <input className="form-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Correo electrónico</label>
                            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                                <input type="checkbox" checked={canBeBooked} onChange={(e) => setCanBeBooked(e.target.checked)} style={{ accentColor: 'var(--color-accent)' }} />
                                Puede recibir citas (aparece en Agenda)
                            </label>
                        </div>
                        <div style={{ padding: 'var(--space-sm) var(--space-md)', background: 'var(--color-glass)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>Rol</span>
                            <span className="badge badge-confirmed">{roleLabels[orgMember?.role || ''] || orgMember?.role}</span>
                        </div>

                        {/* Theme selector */}
                        <div style={{ padding: 'var(--space-sm) var(--space-md)', background: 'var(--color-glass)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-sm)' }}>
                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>Tema</span>
                            <div style={{ display: 'flex', gap: 4, background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-full)', padding: 3 }}>
                                <button
                                    onClick={() => setTheme('light')}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
                                        borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
                                        fontSize: '12px', fontWeight: 500, transition: 'all 0.2s',
                                        background: theme === 'light' ? 'var(--color-accent)' : 'transparent',
                                        color: theme === 'light' ? 'white' : 'var(--color-text-tertiary)',
                                    }}>
                                    <Sun size={13} /> Claro
                                </button>
                                <button
                                    onClick={() => setTheme('dark')}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
                                        borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
                                        fontSize: '12px', fontWeight: 500, transition: 'all 0.2s',
                                        background: theme === 'dark' ? 'var(--color-accent)' : 'transparent',
                                        color: theme === 'dark' ? 'white' : 'var(--color-text-tertiary)',
                                    }}>
                                    <Moon size={13} /> Oscuro
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Organization Card */}
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
                        <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>Negocio</h3>
                        {isOwner && (
                            <button
                                className={`btn ${orgSaved ? 'btn-ghost' : 'btn-primary'} btn-sm`}
                                onClick={handleSaveOrg}
                                disabled={orgSaving}
                            >
                                {orgSaved ? <><Check size={14} /> Guardado</> : orgSaving ? <span className="spinner" /> : <><Save size={14} /> Guardar</>}
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        {/* Logo */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                            <div
                                onClick={() => isOwner && fileInputRef.current?.click()}
                                style={{
                                    width: 64, height: 64,
                                    borderRadius: '50%',
                                    background: logoUrl ? `url(${logoUrl}) center/cover` : 'var(--color-accent-soft)',
                                    border: '2px dashed var(--color-glass-border)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: isOwner ? 'pointer' : 'default',
                                    transition: 'all var(--transition-fast)',
                                    flexShrink: 0,
                                    overflow: 'hidden',
                                }}
                            >
                                {!logoUrl && (
                                    uploading
                                        ? <span className="spinner" />
                                        : <Upload size={20} style={{ color: 'var(--color-accent)' }} />
                                )}
                            </div>
                            <div>
                                <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                                    {logoUrl ? 'Logo del negocio' : 'Agregar logo'}
                                </p>
                                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                                    {isOwner ? 'Click para subir (PNG, JPG)' : 'Solo el dueño puede cambiar el logo'}
                                </p>
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleLogoUpload} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Nombre del negocio</label>
                            <input className="form-input" value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!isOwner} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Tipo de negocio</label>
                            <select className="form-select" value={orgType} onChange={(e) => setOrgType(e.target.value)} disabled={!isOwner}>
                                {BUSINESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Zona horaria</label>
                            <select className="form-select" value={orgTimezone} onChange={(e) => setOrgTimezone(e.target.value)} disabled={!isOwner}>
                                {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                            </select>
                        </div>

                        {/* Labelling */}
                        <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', background: 'var(--color-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-glass-border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-sm)' }}>
                                <Users size={16} style={{ color: 'var(--color-accent)' }} />
                                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Personalización de Nombres</span>
                            </div>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-md)' }}>
                                Define cómo se llamará a los miembros de tu equipo en el sistema (ej. "Barbero", "Doctor").
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '11px' }}>Singular (ej. Barbero)</label>
                                    <input className="form-input" value={customMemberLabel} onChange={(e) => setCustomMemberLabel(e.target.value)} disabled={!isOwner} placeholder="Proveedor" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '11px' }}>Plural (ej. Barberos)</label>
                                    <input className="form-input" value={customMemberLabelPlural} onChange={(e) => setCustomMemberLabelPlural(e.target.value)} disabled={!isOwner} placeholder="Proveedores" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Team Section */}
            <div className="card" style={{ marginTop: 'var(--space-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>Equipo</h3>
                    {isAdminOrOwner && (
                        <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(!showInvite)}>
                            {showInvite ? <><X size={14} /> Cerrar</> : <><UserPlus size={14} /> Agregar {memberLabel.toLowerCase()}</>}
                        </button>
                    )}
                </div>

                {/* Add Member Form */}
                {showInvite && (
                    <div style={{
                        padding: 'var(--space-md)',
                        background: 'var(--color-accent-soft)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-accent)',
                        marginBottom: 'var(--space-lg)',
                    }}>
                        {/* Mode toggle */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-md)' }}>
                            <button
                                className={`btn btn-sm ${inviteMode === 'no_account' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ borderRadius: '16px' }}
                                onClick={() => setInviteMode('no_account')}
                            >
                                <UserX size={13} /> Sin acceso al sistema
                            </button>
                            <button
                                className={`btn btn-sm ${inviteMode === 'with_account' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ borderRadius: '16px' }}
                                onClick={() => setInviteMode('with_account')}
                            >
                                <UserCheck size={13} /> Con cuenta (invitar)
                            </button>
                        </div>

                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-md)' }}>
                            {inviteMode === 'no_account'
                                ? 'Agrega al miembro solo para llevar su agenda. No tendrá acceso al sistema.'
                                : 'El miembro podrá iniciar sesión con su correo y tendrá acceso según su rol.'}
                        </p>

                        {inviteSuccess && (
                            <div style={{
                                padding: 'var(--space-sm) var(--space-md)',
                                background: 'var(--color-success-soft)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--color-success)',
                                fontSize: 'var(--font-size-sm)',
                                marginBottom: 'var(--space-md)',
                                display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                            }}>
                                <Check size={14} /> {memberLabel} agregado al equipo
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: inviteMode === 'with_account' ? '1fr 1fr 80px auto' : '1fr 80px auto', gap: 'var(--space-sm)', alignItems: 'end' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Nombre *</label>
                                <input className="form-input" placeholder={`Nombre del ${memberLabel.toLowerCase()}`} value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
                            </div>
                            {inviteMode === 'with_account' && (
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Correo electrónico</label>
                                    <input className="form-input" type="email" placeholder="correo@ejemplo.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                                </div>
                            )}
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Color</label>
                                <input
                                    type="color"
                                    value={inviteColor}
                                    onChange={(e) => setInviteColor(e.target.value)}
                                    style={{ width: '100%', height: '38px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-glass-border)', background: 'var(--color-bg-secondary)', cursor: 'pointer', padding: '2px 4px' }}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Rol</label>
                                <select className="form-select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                                    <option value="provider">Proveedor</option>
                                    <option value="receptionist">Recepcionista</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        </div>
                        <button
                            className="btn btn-primary btn-sm"
                            style={{ marginTop: 'var(--space-md)' }}
                            onClick={handleInvite}
                            disabled={inviting || !inviteName.trim()}
                        >
                            {inviting ? <span className="spinner" /> : inviteMode === 'with_account' ? <><Mail size={14} /> Agregar e invitar</> : <><UserPlus size={14} /> Agregar al equipo</>}
                        </button>
                    </div>
                )}

                {/* Team List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                    {teamMembers.map((m) => (
                        <div key={m.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: 'var(--space-sm) var(--space-md)',
                            borderRadius: 'var(--radius-md)',
                            background: m.id === orgMember?.id ? 'var(--color-accent-soft)' : 'var(--color-glass)',
                            border: m.id === orgMember?.id ? '1px solid var(--color-accent)' : '1px solid transparent',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                <div style={{
                                    width: 36, height: 36,
                                    borderRadius: 'var(--radius-full)',
                                    background: m.color || 'var(--color-accent)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'white',
                                    flexShrink: 0,
                                }}>
                                    {(m.display_name || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                    <p style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>
                                        {m.display_name} {m.id === orgMember?.id && <span style={{ color: 'var(--color-text-tertiary)' }}>(tú)</span>}
                                    </p>
                                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                                        {m.email || <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>Sin cuenta</span>}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                                {!m.user_id && (
                                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(148,163,184,0.15)', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <UserX size={10} /> Sin acceso
                                    </span>
                                )}
                                {m.can_be_booked && <span className="badge badge-scheduled" style={{ fontSize: '10px' }}>Agenda</span>}
                                <span className={`badge ${m.role === 'owner' ? 'badge-completed' : m.role === 'admin' ? 'badge-confirmed' : 'badge-draft'}`}>
                                    {roleLabels[m.role] || m.role}
                                </span>
                                {isAdminOrOwner && m.id !== orgMember?.id && (
                                    <button
                                        className="btn-icon-clear"
                                        style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-tertiary)' }}
                                        title="Desactivar miembro"
                                        onClick={() => handleRemoveMember(m.id)}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Google Integration */}
            <div className="card" style={{ marginTop: 'var(--space-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600 }}>Integraciones</h3>
                </div>

                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: 'var(--space-md)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-glass)',
                    border: `1px solid ${googleConnected ? 'var(--color-success)' : 'var(--color-glass-border)'}`,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <div style={{
                            width: 44, height: 44,
                            borderRadius: 'var(--radius-md)',
                            background: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.5rem',
                        }}>
                            <svg width="24" height="24" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                        </div>
                        <div>
                            <p style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Google Workspace</p>
                            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                                Google Calendar · Gmail · Sincronización bidireccional de citas
                            </p>
                        </div>
                    </div>
                    {googleConnected ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                            {googleEmail && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{googleEmail}</span>}
                            <span className="badge badge-completed"><Check size={12} /> Conectado</span>
                        </div>
                    ) : (
                        <button className="btn btn-primary btn-sm" onClick={handleGoogleConnect} disabled={googleConnecting}>
                            {googleConnecting ? <><Loader size={14} className="spin" /> Conectando...</> : <><ExternalLink size={14} /> Conectar</>}
                        </button>
                    )}
                </div>

                <div style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                    padding: 'var(--space-md)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-glass)',
                    border: '1px solid var(--color-glass-border)',
                    marginTop: 'var(--space-sm)',
                    opacity: 0.6,
                }}>
                    <div style={{
                        width: 44, height: 44,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-glass)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Calendar size={22} style={{ color: 'var(--color-text-tertiary)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Más integraciones</p>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                            WhatsApp Business, Stripe, MercadoPago — próximamente
                        </p>
                    </div>
                    <span className="badge badge-draft">Próximamente</span>
                </div>
            </div>
        </div>
    )
}
