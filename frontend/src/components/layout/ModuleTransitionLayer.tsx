import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

type Phase = 'idle' | 'closing' | 'opening'

function normalizePath(path: string) {
  return path.replace(/\/+$/, '') || '/'
}

function moduleKey(path: string) {
  const clean = normalizePath(path)
  const [segment] = clean.split('/').filter(Boolean)
  if (!segment) return 'home'

  if (segment === 'mission' || segment === 'missions') return 'mission-module'

  return segment
}

function shouldTransition(currentPath: string, targetPath: string) {
  if (!targetPath.startsWith('/')) return false
  if (targetPath.startsWith('/api')) return false

  const from = normalizePath(currentPath)
  const to = normalizePath(targetPath)

  if (from === to) return false
  return moduleKey(from) !== moduleKey(to)
}

function getNavigationLabel(path: string) {
  const clean = normalizePath(path)
  const [segment] = clean.split('/').filter(Boolean)

  if (!segment) return 'Inicio'

  const labels: Record<string, string> = {
    missions: 'Missions',
    mission: 'Mission',
    feedback: 'Feedback',
    profile: 'Profile',
    'join-group': 'Join Group',
    'session-summary': 'Session Summary',
    dashboard: 'Dashboard',
    group: 'Group',
    login: 'Login',
    signup: 'Signup'
  }

  if (labels[segment]) return labels[segment]
  return segment.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

export function ModuleTransitionLayer() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const [visible, setVisible] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [label, setLabel] = useState('LG')
  const [destinationLabel, setDestinationLabel] = useState('')

  const pendingPathRef = useRef<string | null>(null)
  const fromPathRef = useRef<string>('')
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const failSafeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const beginOpening = () => {
    setPhase('opening')

    if (openTimerRef.current) clearTimeout(openTimerRef.current)
    if (failSafeTimerRef.current) clearTimeout(failSafeTimerRef.current)

    openTimerRef.current = setTimeout(() => {
      setVisible(false)
      setPhase('idle')
      pendingPathRef.current = null
      fromPathRef.current = ''
      setDestinationLabel('')
    }, 360)
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      if (openTimerRef.current) clearTimeout(openTimerRef.current)
      if (failSafeTimerRef.current) clearTimeout(failSafeTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const pendingPath = pendingPathRef.current
    if (!pendingPath) return

    const currentPath = normalizePath(pathname)
    if (currentPath !== fromPathRef.current || currentPath === normalizePath(pendingPath)) {
      beginOpening()
    }
  }, [pathname])

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target as HTMLElement | null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return

      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return

      const href = anchor.getAttribute('href')
      if (!href) return
      if (href.startsWith('#')) return
      if (/^https?:\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')) return

      const targetPath = href.split('#')[0].split('?')[0] || '/'
      if (!shouldTransition(pathname, targetPath)) return

      event.preventDefault()
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      if (openTimerRef.current) clearTimeout(openTimerRef.current)
      if (failSafeTimerRef.current) clearTimeout(failSafeTimerRef.current)

      pendingPathRef.current = targetPath
      fromPathRef.current = normalizePath(pathname)
      setLabel('LG')
      setDestinationLabel(getNavigationLabel(targetPath))
      setVisible(true)
      setPhase('closing')

      closeTimerRef.current = setTimeout(() => {
        navigate(href)
      }, 280)

      // Safety valve: if navigation stalls or redirects unexpectedly, never leave doors closed.
      failSafeTimerRef.current = setTimeout(() => {
        beginOpening()
      }, 1200)
    }

    document.addEventListener('click', onDocumentClick, true)
    return () => document.removeEventListener('click', onDocumentClick, true)
  }, [pathname, navigate])

  if (!visible) return null

  return (
    <div className={`module-transition-overlay ${phase === 'closing' ? 'is-closing' : ''} ${phase === 'opening' ? 'is-opening' : ''}`} aria-hidden="true">
      <div className="module-transition-wash" />
      <div className="module-transition-door module-transition-door-left" />
      <div className="module-transition-door module-transition-door-right" />
      <div className="module-transition-title">{label}</div>
      <div className="module-transition-subtitle">Navegando a {destinationLabel}</div>
    </div>
  )
}
