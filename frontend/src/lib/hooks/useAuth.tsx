import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import type { UserAvatar } from '@vox/shared'
import { readJson } from '@/lib/api'

export interface AuthUser {
  id: string
  email: string
  role: 'student' | 'teacher'
  full_name: string | null
  /** Skin voxel-art del alumno (los docentes van a null). */
  avatar: UserAvatar | null
  cefr_level: string | null
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  logout: () => Promise<void>
  refetch: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/**
 * La sesión vive en una cookie HttpOnly, así que la identidad siempre viene
 * del servidor — nunca de localStorage.
 */
async function fetchCurrentUser(): Promise<AuthUser | null> {
  const res = await fetch('/api/auth/me')
  if (!res.ok) return null
  const data = await readJson(res)
  return data?.user ?? null
}

/**
 * Proveedor único de sesión.
 *
 * Antes cada componente que llamaba a `useAuth` disparaba su propio
 * `/api/auth/me`; con el contexto se hace una sola petición por carga y todos
 * los consumidores comparten el resultado.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    fetchCurrentUser()
      .then(nextUser => {
        if (!cancelled) setUser(nextUser)
      })
      .catch(error => console.error('[Auth] Error:', error))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const logout = useCallback(async () => {
    localStorage.removeItem('speak:last-route')
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
    navigate('/login')
  }, [navigate])

  const refetch = useCallback(async () => {
    setUser(await fetchCurrentUser())
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, logout, refetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return context
}
