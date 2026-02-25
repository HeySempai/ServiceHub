import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
    Building2, Scissors, CreditCard, Check,
    ChevronRight, ChevronLeft, Plus, X, Sparkles
} from 'lucide-react'

const BUSINESS_TYPES = [
    { value: 'clinic', label: 'Clínica', icon: '🏥' },
    { value: 'barbershop', label: 'Barbería', icon: '💈' },
    { value: 'salon', label: 'Salón de Belleza', icon: '💇' },
    { value: 'spa', label: 'Spa', icon: '🧖' },
    { value: 'dental', label: 'Dental', icon: '🦷' },
    { value: 'gym', label: 'Gimnasio', icon: '🏋️' },
    { value: 'veterinary', label: 'Veterinaria', icon: '🐾' },
    { value: 'consulting', label: 'Consultoría', icon: '💼' },
    { value: 'general', label: 'Otro', icon: '🏢' },
]

interface ServiceDraft {
    name: string
    duration_min: string
    price: string
    color: string
}

const COLORS = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#14b8a6']

export function OnboardingPage() {
    const { user } = useAuth()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)

    // Step 1: Organization
    const [orgName, setOrgName] = useState('')
    const [orgType, setOrgType] = useState('')
    const [displayName, setDisplayName] = useState('')

    // Step 2: Services
    const [services, setServices] = useState<ServiceDraft[]>([
        { name: '', duration_min: '', price: '', color: COLORS[0] }
    ])

    // Step 3: Payment methods
    const [paymentMethods, setPaymentMethods] = useState([
        { name: 'Efectivo', enabled: true },
        { name: 'Tarjeta', enabled: true },
        { name: 'Transferencia', enabled: true },
    ])

    const [error, setError] = useState('')

    const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    // Steps 1-3: just navigate, no DB calls
    const goToStep = (n: number) => setStep(n)

    // Only persist everything on final confirmation
    const handleFinalize = async () => {
        setLoading(true)
        setError('')

        // 1. Create org + owner
        const { data: orgData, error: orgError } = await supabase.rpc('create_organization_with_owner', {
            p_name: orgName,
            p_slug: slugify(orgName),
            p_type: orgType,
            p_display_name: displayName || null,
        })
        if (orgError) {
            setError(orgError.message)
            setLoading(false)
            return
        }

        const newOrgId = orgData.org_id

        // 2. Insert services
        const validServices = services.filter(s => s.name.trim() && s.price)
        if (validServices.length > 0) {
            await supabase.from('services').insert(
                validServices.map((s, i) => ({
                    org_id: newOrgId,
                    name: s.name.trim(),
                    duration_min: parseInt(s.duration_min),
                    price: parseFloat(s.price),
                    tax_rate: 0.16,
                    color: s.color,
                    sort_order: i,
                }))
            )
        }

        // 3. Insert payment methods
        const enabled = paymentMethods.filter(pm => pm.enabled)
        if (enabled.length > 0) {
            await supabase.from('payment_methods').insert(
                enabled.map((pm, i) => ({
                    org_id: newOrgId,
                    name: pm.name,
                    sort_order: i,
                }))
            )
        }

        // 4. Insert default expense categories
        await supabase.from('expense_categories').insert([
            { org_id: newOrgId, name: 'Renta', sort_order: 1 },
            { org_id: newOrgId, name: 'Servicios', sort_order: 2 },
            { org_id: newOrgId, name: 'Nómina', sort_order: 3 },
            { org_id: newOrgId, name: 'Insumos', sort_order: 4 },
            { org_id: newOrgId, name: 'Marketing', sort_order: 5 },
        ])

        setStep(4)
        setLoading(false)
    }

    const handleFinish = () => {
        window.location.href = '/'
    }

    const addService = () => {
        const colorIdx = services.length % COLORS.length
        setServices([...services, { name: '', duration_min: '', price: '', color: COLORS[colorIdx] }])
    }

    const removeService = (i: number) => {
        if (services.length <= 1) return
        setServices(services.filter((_, idx) => idx !== i))
    }

    const updateService = (i: number, field: keyof ServiceDraft, value: string) => {
        const updated = [...services]
        updated[i] = { ...updated[i], [field]: value }
        setServices(updated)
    }

    const steps = [
        { num: 1, label: 'Tu negocio', icon: Building2 },
        { num: 2, label: 'Servicios', icon: Scissors },
        { num: 3, label: 'Pagos', icon: CreditCard },
        { num: 4, label: '¡Listo!', icon: Check },
    ]

    return (
        <div className="auth-container" style={{ alignItems: 'flex-start', paddingTop: 60 }}>
            <div style={{ width: '100%', maxWidth: 560, position: 'relative', zIndex: 1 }}>

                {/* Progress Steps */}
                <div style={{
                    display: 'flex', justifyContent: 'center', gap: 0,
                    marginBottom: 'var(--space-2xl)',
                }}>
                    {steps.map((s, i) => (
                        <div key={s.num} style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                            }}>
                                <div style={{
                                    width: 40, height: 40,
                                    borderRadius: 'var(--radius-full)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: step >= s.num ? 'var(--color-accent)' : 'var(--color-glass)',
                                    border: `2px solid ${step >= s.num ? 'var(--color-accent)' : 'var(--color-glass-border)'}`,
                                    color: step >= s.num ? 'white' : 'var(--color-text-tertiary)',
                                    transition: 'all var(--transition-base)',
                                    fontSize: 'var(--font-size-sm)',
                                    fontWeight: 600,
                                }}>
                                    {step > s.num ? <Check size={16} /> : <s.icon size={16} />}
                                </div>
                                <span style={{
                                    fontSize: 'var(--font-size-xs)',
                                    color: step >= s.num ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                                    fontWeight: step === s.num ? 600 : 400,
                                }}>{s.label}</span>
                            </div>
                            {i < steps.length - 1 && (
                                <div style={{
                                    width: 60, height: 2, margin: '0 var(--space-sm)',
                                    marginBottom: 22,
                                    background: step > s.num ? 'var(--color-accent)' : 'var(--color-glass-border)',
                                    borderRadius: 2,
                                    transition: 'background var(--transition-base)',
                                }} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step 1: Organization */}
                {step === 1 && (
                    <div className="auth-card animate-in" style={{ maxWidth: '100%' }}>
                        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 4 }}>Configura tu negocio</h2>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
                            Cuéntanos sobre tu negocio para personalizar tu experiencia.
                        </p>

                        <div className="form-group">
                            <label className="form-label">Tu nombre</label>
                            <input
                                className="form-input"
                                placeholder="¿Cómo te llamas?"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                            />
                        </div>

                        <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                            <label className="form-label">Nombre del negocio</label>
                            <input
                                className="form-input"
                                placeholder="Ej: Studio Barber, Clínica Norte..."
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group" style={{ marginTop: 'var(--space-md)' }}>
                            <label className="form-label">Tipo de negocio</label>
                            <div style={{
                                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-sm)',
                                marginTop: 'var(--space-xs)',
                            }}>
                                {BUSINESS_TYPES.map((t) => (
                                    <button
                                        key={t.value}
                                        type="button"
                                        onClick={() => setOrgType(t.value)}
                                        style={{
                                            padding: '10px 8px',
                                            borderRadius: 'var(--radius-md)',
                                            border: `1.5px solid ${orgType === t.value ? 'var(--color-accent)' : 'var(--color-glass-border)'}`,
                                            background: orgType === t.value ? 'var(--color-accent-soft)' : 'var(--color-glass)',
                                            color: orgType === t.value ? 'var(--color-accent-hover)' : 'var(--color-text-secondary)',
                                            cursor: 'pointer',
                                            transition: 'all var(--transition-fast)',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                                            fontSize: 'var(--font-size-sm)',
                                            fontWeight: orgType === t.value ? 600 : 400,
                                        }}
                                    >
                                        <span style={{ fontSize: '1.25rem' }}>{t.icon}</span>
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            className="btn btn-primary btn-lg"
                            style={{ width: '100%', marginTop: 'var(--space-lg)' }}
                            disabled={!orgName.trim() || !orgType || loading}
                            onClick={() => goToStep(2)}
                        >
                            {loading ? <span className="spinner" /> : <>Continuar <ChevronRight size={16} /></>}
                        </button>
                    </div>
                )}

                {/* Step 2: Services */}
                {step === 2 && (
                    <div className="auth-card animate-in" style={{ maxWidth: '100%' }}>
                        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 4 }}>¿Qué servicios ofreces?</h2>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
                            Agrega al menos un servicio. Puedes agregar más después.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                            {services.map((svc, i) => (
                                <div key={i} style={{
                                    padding: 'var(--space-md)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--color-glass-border)',
                                    background: 'var(--color-glass)',
                                    position: 'relative',
                                }}>
                                    {services.length > 1 && (
                                        <button
                                            onClick={() => removeService(i)}
                                            style={{
                                                position: 'absolute', top: 8, right: 8,
                                                background: 'none', border: 'none', color: 'var(--color-text-tertiary)',
                                                cursor: 'pointer', padding: 4,
                                            }}
                                        ><X size={14} /></button>
                                    )}
                                    <div className="form-group">
                                        <input
                                            className="form-input"
                                            placeholder="Nombre del servicio"
                                            value={svc.name}
                                            onChange={(e) => updateService(i, 'name', e.target.value)}
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                className="form-input"
                                                type="number"
                                                placeholder="Duración"
                                                value={svc.duration_min}
                                                onChange={(e) => updateService(i, 'duration_min', e.target.value)}
                                                style={{ paddingRight: 36 }}
                                            />
                                            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', pointerEvents: 'none' }}>min</span>
                                        </div>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                className="form-input"
                                                type="number"
                                                step="0.01"
                                                placeholder="Precio"
                                                value={svc.price}
                                                onChange={(e) => updateService(i, 'price', e.target.value)}
                                                style={{ paddingLeft: 24 }}
                                            />
                                            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', pointerEvents: 'none' }}>$</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', maxWidth: 80 }}>
                                            {COLORS.slice(0, 4).map((c) => (
                                                <div
                                                    key={c}
                                                    onClick={() => updateService(i, 'color', c)}
                                                    style={{
                                                        width: 18, height: 18, borderRadius: 'var(--radius-full)',
                                                        background: c, cursor: 'pointer',
                                                        border: svc.color === c ? '2px solid white' : '2px solid transparent',
                                                        transition: 'all var(--transition-fast)',
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            className="btn btn-ghost"
                            style={{ width: '100%', marginTop: 'var(--space-md)' }}
                            onClick={addService}
                        >
                            <Plus size={16} /> Agregar otro servicio
                        </button>

                        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
                            <button className="btn btn-secondary btn-lg" onClick={() => goToStep(1)} style={{ flex: 1 }}>
                                <ChevronLeft size={16} /> Atrás
                            </button>
                            <button
                                className="btn btn-primary btn-lg"
                                style={{ flex: 2 }}
                                disabled={!services.some(s => s.name.trim() && s.price) || loading}
                                onClick={() => goToStep(3)}
                            >
                                {loading ? <span className="spinner" /> : <>Continuar <ChevronRight size={16} /></>}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Payment Methods */}
                {step === 3 && (
                    <div className="auth-card animate-in" style={{ maxWidth: '100%' }}>
                        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 4 }}>Métodos de pago</h2>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
                            Selecciona los métodos de pago que aceptas.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                            {paymentMethods.map((pm, i) => (
                                <label
                                    key={pm.name}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                                        padding: 'var(--space-md)',
                                        borderRadius: 'var(--radius-md)',
                                        border: `1.5px solid ${pm.enabled ? 'var(--color-accent)' : 'var(--color-glass-border)'}`,
                                        background: pm.enabled ? 'var(--color-accent-soft)' : 'var(--color-glass)',
                                        cursor: 'pointer',
                                        transition: 'all var(--transition-fast)',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={pm.enabled}
                                        onChange={(e) => {
                                            const updated = [...paymentMethods]
                                            updated[i] = { ...updated[i], enabled: e.target.checked }
                                            setPaymentMethods(updated)
                                        }}
                                        style={{ width: 18, height: 18, accentColor: 'var(--color-accent)' }}
                                    />
                                    <span style={{
                                        fontWeight: pm.enabled ? 500 : 400,
                                        color: pm.enabled ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                                    }}>{pm.name}</span>
                                </label>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
                            <button className="btn btn-secondary btn-lg" onClick={() => goToStep(2)} style={{ flex: 1 }}>
                                <ChevronLeft size={16} /> Atrás
                            </button>
                            <button
                                className="btn btn-primary btn-lg"
                                style={{ flex: 2 }}
                                disabled={!paymentMethods.some(pm => pm.enabled) || loading}
                                onClick={handleFinalize}
                            >
                                {loading ? <span className="spinner" /> : <>Finalizar <ChevronRight size={16} /></>}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4: Done! */}
                {step === 4 && (
                    <div className="auth-card animate-in" style={{ maxWidth: '100%', textAlign: 'center' }}>
                        <div style={{
                            width: 72, height: 72,
                            borderRadius: 'var(--radius-full)',
                            background: 'var(--color-success-soft)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto var(--space-lg)',
                        }}>
                            <Sparkles size={32} style={{ color: 'var(--color-success)' }} />
                        </div>
                        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: 8 }}>
                            ¡Todo listo!
                        </h2>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xl)', maxWidth: 320, margin: '0 auto' }}>
                            Tu negocio <strong style={{ color: 'var(--color-text-primary)' }}>{orgName}</strong> está configurado.
                            Ya puedes empezar a agendar citas y manejar tu negocio.
                        </p>
                        <button
                            className="btn btn-primary btn-lg"
                            style={{ width: '100%', marginTop: 'var(--space-lg)' }}
                            onClick={handleFinish}
                        >
                            <Sparkles size={16} /> Ir a mi Dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
