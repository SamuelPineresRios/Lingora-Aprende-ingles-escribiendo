import { Link } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { resolveAvatar } from '@vox/shared'
import { cn } from '@/lib/utils'
import { FrameRing } from '@/components/FrameRing'
import { Radio, User, LogOut, Users, Menu, X, BookMarked, Trophy, Medal, Store, Brush } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useStoreView, useThemeAccent } from '@/lib/hooks/useStoreView'
import { useSeasonProgress } from '@/lib/hooks/useSeasonProgress'
import { activeFrame } from '@/lib/season'
import { equippedItem } from '@/lib/store'
import { studentAvatarUrl } from '@/lib/avatar'
import { useEffect, useRef, useState, type CSSProperties } from 'react'

export function StudentSidebar() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const accent = useThemeAccent(user?.id)
  const shop = useStoreView(user?.id)
  const season = useSeasonProgress(user?.id)
  const [isOpen, setIsOpen] = useState(false)
  /** Hueco que se recorta en el fondo del sidebar para el módulo activo. */
  const asideRef = useRef<HTMLElement | null>(null)
  const activeRef = useRef<HTMLAnchorElement | null>(null)
  const [hole, setHole] = useState<{ w: number; h: number; top: number; pill: number } | null>(null)

  /**
   * Mide la posición del ítem activo para recortar el fondo justo ahí: la
   * franja del módulo activo queda sin el tinte del sidebar y se ve el fondo
   * real de la página, como si el sidebar no estuviera pintado en esa zona.
   */
  useEffect(() => {
    const measure = () => {
      const aside = asideRef.current
      const link = activeRef.current
      if (!aside || !link) {
        setHole(null)
        return
      }
      const a = aside.getBoundingClientRect()
      const l = link.getBoundingClientRect()
      setHole({ w: Math.round(a.width), h: Math.round(a.height), top: Math.round(l.top - a.top), pill: Math.round(l.height) })
    }

    measure()
    window.addEventListener('resize', measure)
    document.fonts?.ready.then(measure).catch(() => {})
    return () => window.removeEventListener('resize', measure)
  }, [pathname, isOpen])

  // Máscara SVG con el hueco: rectángulo completo menos una píldora pegada al
  // borde derecho (mismo truco que las muescas, pero de verdad transparente).
  const maskUrl = (() => {
    if (!hole || hole.pill <= 0) return undefined

    // Píldora del activo con las esquinas redondeadas: la izquierda es media
    // circunferencia y, al llegar al borde derecho, dos muescas cóncavas (r)
    // funden la píldora con el borde, como en la referencia.
    const w = hole.w
    const t = hole.top
    const h = hole.pill
    const p = h / 2
    const r = 16
    // 4 px de más a la derecha: el agujero cruza el borde y se recorta solo.
    const e = 4
    const path =
      `M0 0H${w}V${hole.h}H0Z ` +
      `M${w + e} ${t - r}H${w}` +
      `A${r} ${r} 0 0 0 ${w - r} ${t}` +
      `H${p}` +
      `A${p} ${p} 0 0 0 ${p} ${t + h}` +
      `H${w - r}` +
      `A${r} ${r} 0 0 0 ${w} ${t + h + r}` +
      `H${w + e}Z`

    return `url("data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${hole.h}' preserveAspectRatio='none'><path fill='black' fill-rule='evenodd' d='${path}'/></svg>`,
    )}")`
  })()

  // Tu personaje completo con el marco equipado (tienda o pase), para el hueco del menú.
  const frame = equippedItem(shop, 'frame') ?? activeFrame(season)
  /** Color del ítem activo: el tema equipado o el cian de siempre. */
  const activeColor = accent ?? '#a5f3fc'
  const avatar = studentAvatarUrl(resolveAvatar({ id: user?.id ?? 'lingora', avatar: user?.avatar ?? null }))

  const links = [
    { href: '/missions', label: 'Misiones', icon: Radio },
    { href: '/words', label: 'Vocabulario', icon: BookMarked },
    { href: '/ranking', label: 'Ranking', icon: Trophy },
    { href: '/season', label: 'Pase', icon: Medal },
    { href: '/store', label: 'Tienda', icon: Store },
    { href: '/groups', label: 'Grupos', icon: Users },
    { href: '/avatar', label: 'Avatar', icon: Brush },
    { href: '/profile', label: 'Perfil', icon: User },
  ]

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b border-white/10 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <img src="/Lingora_logo.png" alt="" className="h-8 w-8 object-contain" />
          <div>
            <h1 className="font-display font-bold text-lg tracking-wider text-white">Lingora</h1>
          </div>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-slate-400 hover:text-white transition-colors"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={asideRef}
        className={cn(
          "fixed left-0 top-0 h-screen w-64 flex flex-col z-50 transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Fondo del sidebar con el hueco del activo: la máscara deja al
            descubierto la página justo en la franja del módulo activo. */}
        <div
          aria-hidden
          className="absolute inset-0 border-r border-white/10 bg-black/90 backdrop-blur-xl lg:bg-black/40"
          style={
            maskUrl
              ? ({
                  maskImage: maskUrl,
                  WebkitMaskImage: maskUrl,
                  maskSize: '100% 100%',
                  WebkitMaskSize: '100% 100%',
                  maskRepeat: 'no-repeat',
                  WebkitMaskRepeat: 'no-repeat',
                } as CSSProperties)
              : undefined
          }
        />
        {/* Brand - hidden on mobile since it's in top bar */}
        <div className="relative z-10 p-6 border-b border-white/10 hidden lg:block">
        <div className="flex items-center gap-3">
          <img src="/Lingora_logo.png" alt="" className="h-8 w-8 object-contain" />
          <div>
            <h1 className="font-display font-bold text-lg tracking-wider text-white">Lingora</h1>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 mt-16 flex flex-1 flex-col gap-2 p-4 min-h-0 lg:mt-0">
        {links.map((link) => {
          const isActive = pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              ref={isActive ? activeRef : null}
              to={link.href}
              onClick={() => setIsOpen(false)}
              className={cn(
                "group relative flex items-center gap-3 px-4 py-3.5 font-poppins text-[15px] font-medium tracking-normal transition-colors duration-300",
                // Muescas: dos cuartos de círculo del color del contenido, uno
                // encima y otro debajo del extremo derecho del activo. Están
                // siempre en el DOM (transparentes si el módulo no lo está) para
                // que al cambiar de módulo las curvas se fundan, no salten.
                "before:pointer-events-none before:absolute before:-top-5 before:right-0 before:h-5 before:w-5 before:rounded-bl-full before:content-[''] before:transition-colors before:duration-300",
                "after:pointer-events-none after:absolute after:-bottom-5 after:right-0 after:h-5 after:w-5 after:rounded-tl-full after:content-[''] after:transition-colors after:duration-300",
                isActive
                  ? // Como en la referencia: el activo no pinta fondo (queda
                    // transparente, se ve el sidebar tal cual) y se distingue
                    // por el color del acento del tema.
                    "z-10 rounded-xl bg-transparent font-semibold before:bg-transparent after:bg-transparent"
                  : "rounded-xl text-slate-400 hover:text-white hover:bg-white/5 before:bg-transparent after:bg-transparent",
              )}
              style={
                isActive
                  ? ({
                      color: activeColor,
                      backgroundColor: 'transparent',
                      textShadow: `0 0 6px ${activeColor}, 0 0 18px ${activeColor}99`,
                    } as CSSProperties)
                  : undefined
              }
            >
              <link.icon
                className={cn('h-4 w-4', isActive ? '' : 'opacity-70 group-hover:opacity-100')}
                style={isActive ? { filter: `drop-shadow(0 0 5px ${activeColor})` } : undefined}
              />
              <span>{link.label}</span>
            </Link>
          )
        })}

        {/* Tu personaje completo, con su marco, abajo del menú y pegado al
            divisor de la sesión. En móvil no se muestra: el cajón se queda con
            el menú y la sesión. */}
        <div className="mt-auto hidden justify-center pb-0.5 lg:flex">
          {frame ? (
            <FrameRing frameId={frame.id} colors={frame.colors as [string, string]} accent={accent} size={160}>
              <img src={avatar} alt="Tu avatar" className="h-full w-full" />
            </FrameRing>
          ) : (
            <img src={avatar} alt="Tu avatar" className="h-40 w-40" />
          )}
        </div>
      </nav>

      {/* User Status / Logout */}
      <div className="relative z-10 p-4 border-t border-white/10 bg-black/20">
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 font-poppins text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-xl transition-colors group"
        >
          <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Cerrar sesion</span>
        </button>
        
        <div className="mt-4 flex items-center justify-between px-2">
           <div className="flex gap-1">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
             <span className="text-[9px] text-emerald-400 font-mono uppercase tracking-widest">Online</span>
           </div>
           <span className="text-[9px] text-slate-600 font-mono">ID::8472-X</span>
        </div>
      </div>
    </aside>
    </>
  )
}
