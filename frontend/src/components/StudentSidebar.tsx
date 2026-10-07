import { Link } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Radio, User, LogOut, Users, Menu, X, BookMarked, Trophy, Medal } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useState } from 'react'

export function StudentSidebar() {
  const { pathname } = useLocation()
  const { logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  const links = [
    { href: '/missions', label: 'MISIONES', icon: Radio },
    { href: '/words', label: 'VOCABULARIO', icon: BookMarked },
    { href: '/ranking', label: 'RANKING', icon: Trophy },
    { href: '/season', label: 'PASE', icon: Medal },
    { href: '/groups', label: 'GRUPOS', icon: Users },
    { href: '/profile', label: 'PERFIL', icon: User },
  ]

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b border-white/10 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <img src="/Letoura_logo.png" alt="" className="h-8 w-8 object-contain" />
          <div>
            <h1 className="font-display font-bold text-lg tracking-wider text-white">Letoura</h1>
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
      <aside className={cn(
        "fixed left-0 top-0 h-screen w-64 border-r border-white/10 bg-black/90 lg:bg-black/40 backdrop-blur-xl flex flex-col z-50 transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Brand - hidden on mobile since it's in top bar */}
        <div className="p-6 border-b border-white/10 hidden lg:block">
        <div className="flex items-center gap-3">
          <img src="/Letoura_logo.png" alt="" className="h-8 w-8 object-contain" />
          <div>
            <h1 className="font-display font-bold text-lg tracking-wider text-white">Letoura</h1>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest px-4 mb-2 lg:mt-0 mt-16">Menu principal</div>
        {links.map((link) => {
          const isActive = pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              to={link.href}
              onClick={() => setIsOpen(false)}
              className={cn(
                "group relative flex items-center gap-3 px-4 py-3 text-xs font-mono tracking-wide transition-colors duration-300",
                // Muescas: dos cuartos de círculo del color del contenido, uno
                // encima y otro debajo del extremo derecho del activo. Están
                // siempre en el DOM (transparentes si el módulo no lo está) para
                // que al cambiar de módulo las curvas se fundan, no salten.
                "before:pointer-events-none before:absolute before:-top-5 before:right-0 before:h-5 before:w-5 before:rounded-bl-full before:content-[''] before:transition-colors before:duration-300",
                "after:pointer-events-none after:absolute after:-bottom-5 after:right-0 after:h-5 after:w-5 after:rounded-tl-full after:content-[''] after:transition-colors after:duration-300",
                isActive
                  ? // El fondo del contenido se cuela en el sidebar: franja del
                    // color del área de contenido (slate-950, el que ya usan las
                    // páginas), sin borde visible, pegada al borde derecho y con
                    // las muescas curvas que dibujan las pseudoclases.
                    // 17 px = los 16 del padding del nav + el 1 del `border-r`
                    // del sidebar: la franja los cubre y su borde derecho queda
                    // limpio, sin la línea. El tinte cian es el del estado activo
                    // de siempre, y va también en las muescas para que la curva
                    // del borde derecho se lea contra el fondo del sidebar.
                    "z-10 [margin-right:-17px] rounded-l-full rounded-r-none border border-transparent bg-cyan/10 text-cyan before:bg-cyan/10 after:bg-cyan/10"
                  : "rounded-lg border border-transparent text-slate-400 hover:text-white hover:bg-white/5 before:bg-transparent after:bg-transparent",
              )}
            >
              <link.icon className={cn("w-4 h-4", isActive ? "animate-pulse" : "opacity-70 group-hover:opacity-100")} />
              <span>{link.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* User Status / Logout */}
      <div className="p-4 border-t border-white/10 bg-black/20">
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 text-xs font-mono text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-lg transition-colors group"
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
