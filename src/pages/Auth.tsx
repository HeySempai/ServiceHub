import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { signIn } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        const { error } = await signIn(email, password)
        if (error) {
            setError(error.message)
        } else {
            navigate('/')
        }
        setLoading(false)
    }

    return (
        <div className="auth-container">
            <div className="auth-card animate-in">
                <div className="auth-logo">
                    <div className="auth-logo-icon">S</div>
                    <h1>ServiceHub</h1>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <div className="auth-error">{error}</div>}

                    <div className="form-group">
                        <label className="form-label">Correo electrónico</label>
                        <input
                            id="login-email"
                            type="email"
                            className="form-input"
                            placeholder="tu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Contraseña</label>
                        <input
                            id="login-password"
                            type="password"
                            className="form-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button id="login-submit" type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
                        {loading ? <span className="spinner" /> : 'Iniciar sesión'}
                    </button>
                </form>

                <div className="auth-footer">
                    ¿No tienes cuenta? <Link to="/register">Crear cuenta</Link>
                </div>
            </div>
        </div>
    )
}

export function RegisterPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)
    const { signUp } = useAuth()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        const { error } = await signUp(email, password, name)
        if (error) {
            setError(error.message)
        } else {
            setSuccess(true)
        }
        setLoading(false)
    }

    if (success) {
        return (
            <div className="auth-container">
                <div className="auth-card animate-in">
                    <div className="auth-logo">
                        <div className="auth-logo-icon">S</div>
                        <h1>ServiceHub</h1>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ marginBottom: 8 }}>¡Cuenta creada!</h3>
                        <p style={{ color: 'var(--color-text-secondary)' }}>
                            Revisa tu correo electrónico para confirmar tu cuenta.
                        </p>
                        <Link to="/login" className="btn btn-primary" style={{ marginTop: 24, display: 'inline-flex' }}>
                            Ir a iniciar sesión
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="auth-container">
            <div className="auth-card animate-in">
                <div className="auth-logo">
                    <div className="auth-logo-icon">S</div>
                    <h1>ServiceHub</h1>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <div className="auth-error">{error}</div>}

                    <div className="form-group">
                        <label className="form-label">Nombre completo</label>
                        <input
                            id="register-name"
                            type="text"
                            className="form-input"
                            placeholder="Juan Pérez"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Correo electrónico</label>
                        <input
                            id="register-email"
                            type="email"
                            className="form-input"
                            placeholder="tu@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Contraseña</label>
                        <input
                            id="register-password"
                            type="password"
                            className="form-input"
                            placeholder="Mínimo 6 caracteres"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>

                    <button id="register-submit" type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
                        {loading ? <span className="spinner" /> : 'Crear cuenta'}
                    </button>
                </form>

                <div className="auth-footer">
                    ¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link>
                </div>
            </div>
        </div>
    )
}
