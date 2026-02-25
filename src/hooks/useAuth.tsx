import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface OrgMember {
    id: string
    org_id: string
    role: string
    display_name: string
    email: string
    can_be_booked: boolean
    organizations: { id: string; name: string; slug: string; type: string }
}

interface AuthContextType {
    user: User | null
    session: Session | null
    orgMember: OrgMember | null
    loading: boolean
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

    const fetchOrgMember = async (userId: string) => {
        const { data } = await supabase
            .from('org_members')
            .select('id, org_id, role, display_name, email, can_be_booked, organizations(id, name, slug, type)')
            .eq('user_id', userId)
            .eq('active', true)
            .limit(1)
            .single()

        if (data) {
            setOrgMember(data as unknown as OrgMember)
        }
    }

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) {
                await fetchOrgMember(session.user.id)
            }
            setLoading(false)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) {
                await fetchOrgMember(session.user.id)
            } else {
                setOrgMember(null)
            }
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

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

    return (
        <AuthContext.Provider value={{ user, session, orgMember, loading, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
