import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface OrgMember {
    id: string
    org_id: string
    role: string
    display_name: string
    email: string
    can_be_booked: boolean
    organizations: { id: string; name: string; slug: string; type: string; settings: any; logo_url: string | null }
}

interface AuthContextType {
    user: User | null
    session: Session | null
    orgMember: OrgMember | null
    loading: boolean
    memberLabel: string
    memberLabelPlural: string
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>
    signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null }>
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [orgMember, setOrgMember] = useState<OrgMember | null>(null)
    const [loading, setLoading] = useState(true)
    const currentUserRef = useRef<string | null>(null)

    const fetchOrgMember = async (userId: string) => {
        console.log('Fetching org member for user_id:', userId)
        const { data, error } = await supabase
            .from('org_members')
            .select('id, org_id, role, display_name, email, can_be_booked, organizations(id, name, slug, type, settings, logo_url)')
            .eq('user_id', userId)
            .eq('active', true)
            .limit(1)
            .single()

        if (error) {
            console.error('Error fetching orgMember:', error)
        }

        if (data) {
            console.log('Org member found:', data)
            setOrgMember(data as unknown as OrgMember)
        } else {
            console.warn('No org member found for user_id:', userId)
            setOrgMember(null)
        }

        // Explicitly clear loading right after fetch finishes
        setLoading(false)
    }

    useEffect(() => {
        let mounted = true
        let authInitializing = true

        const checkSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession()
                if (error) throw error

                if (mounted) {
                    const isSameUser = session?.user?.id === currentUserRef.current

                    setSession(session)
                    setUser(session?.user ?? null)

                    if (session?.user) {
                        currentUserRef.current = session.user.id
                        if (!isSameUser || !orgMember) {
                            await fetchOrgMember(session.user.id)
                        } else {
                            // If we already have the orgMember for this user, just clear loading
                            setLoading(false)
                        }
                    } else {
                        currentUserRef.current = null
                        setLoading(false)
                    }
                }
            } catch (err) {
                console.error('Auth check error:', err)
                if (mounted) setLoading(false)
            } finally {
                authInitializing = false
            }
        }

        checkSession()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            if (!mounted) return

            // Only run if we aren't currently in the initial load
            if (!authInitializing) {
                const isSameUser = newSession?.user?.id === currentUserRef.current;

                setSession(newSession)
                setUser(newSession?.user ?? null)

                if (newSession?.user) {
                    currentUserRef.current = newSession.user.id
                    // If it's the exact same user (e.g., token refresh or tab focus), 
                    // DO NOT block the UI with loading=true. We already have their orgMember in memory.
                    // If we don't have an orgMember yet, or it's a completely new user logging in, fetch it.
                    if (!isSameUser) {
                        setLoading(true)
                        await fetchOrgMember(newSession.user.id)
                    } else if (!orgMember) {
                        // Edge case: same user but orgMember failed to load previously
                        await fetchOrgMember(newSession.user.id)
                    }
                } else {
                    // User logged out
                    currentUserRef.current = null
                    setOrgMember(null)
                    setLoading(false)
                }
            }
        })

        const failsafeTimeout = setTimeout(() => {
            if (mounted && loading) {
                console.warn('Auth initialization timed out. Forcing loading to false.')
                setLoading(false)
            }
        }, 5000) // Increased to 5s just in case network is slow

        return () => {
            mounted = false
            clearTimeout(failsafeTimeout)
            subscription.unsubscribe()
        }
    }, [orgMember])

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error as Error | null }
    }

    const signUp = async (email: string, password: string, displayName: string) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: displayName } }
        })
        return { error: error as Error | null }
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        setOrgMember(null)
    }

    const memberLabel = orgMember?.organizations?.settings?.member_label || 'Proveedor'
    const memberLabelPlural = orgMember?.organizations?.settings?.member_label_plural || 'Proveedores'

    return (
        <AuthContext.Provider value={{ user, session, orgMember, loading, memberLabel, memberLabelPlural, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
