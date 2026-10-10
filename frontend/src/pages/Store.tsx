/**
 * Tienda de monedas: marcos, títulos, temas y escudos de racha.
 *
 * El catálogo y el saldo los sirve el backend; comprar y equipar se reflejan
 * al momento con la vista que devuelve cada acción. El fondo son monedas
 * cayendo en cascada y al comprar cae una ráfaga.
 */
import { useEffect, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Loader2,
  Lock,
  Palette,
  Shield,
  ShoppingBag,
  Sparkles,
  Tag,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveAvatar } from '@vox/shared'
import { studentAvatarUrl } from '@/lib/avatar'
import { CoinRain } from '@/components/CoinRain'
import { ModuleBackdrop } from '@/components/ModuleBackdrop'
import { FrameRing } from '@/components/FrameRing'
import { readJson } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'
import { publishStoreView } from '@/lib/hooks/useStoreView'
import { STORE_SECTIONS, type StoreItem, type StoreItemKind, type StoreView } from '@/lib/store'

/** Marcos por página: dos columnas por cuatro filas. */
const FRAMES_PER_PAGE = 8

const KIND_ICON: Record<StoreItemKind, LucideIcon> = {
  frame: Sparkles,
  title: Tag,
  theme: Palette,
  shield: Shield,
}

/** Visual del artículo: marco (con tu avatar dentro), título, tema o escudo. */
function ItemVisual({ item, avatar }: { item: StoreItem; avatar: string }) {
  if (item.kind === 'frame' && item.colors) {
    return (
      <FrameRing frameId={item.id} colors={item.colors} size={56}>
        <img src={avatar} alt="" className="h-full w-full" />
      </FrameRing>
    )
  }
  if (item.kind === 'title') {
    return (
      <span className="flex h-12 min-w-12 shrink-0 items-center justify-center rounded-full border border-violet/40 bg-violet/10 px-2 text-[10px] font-bold uppercase tracking-widest text-violet">
        {item.text}
      </span>
    )
  }
  if (item.kind === 'theme' && item.accent) {
    return (
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2"
        style={{ borderColor: item.accent, background: `${item.accent}22` }}
      >
        <span className="h-4 w-4 rounded-full" style={{ background: item.accent }} />
      </span>
    )
  }
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-emerald/40 bg-emerald/10">
      <Shield className="h-6 w-6 text-emerald" />
    </span>
  )
}

export default function StorePage() {
  const { user } = useAuth()
  const [view, setView] = useState<StoreView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [burst, setBurst] = useState(0)
  /** Página del catálogo de marcos (el resto de secciones entra entera). */
  const [framePage, setFramePage] = useState(0)
  const avatar = studentAvatarUrl(resolveAvatar({ id: user?.id ?? 'lingora', avatar: user?.avatar ?? null }))

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/students/${user.id}/store`)
        if (!res.ok) throw new Error('No se pudo cargar la tienda.')
        const data = await readJson<StoreView>(res)
        if (!cancelled) {
          setView(data)
          publishStoreView(data, user?.id)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar la tienda.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    if (!burst) return
    const timer = setTimeout(() => setBurst(0), 2000)
    return () => clearTimeout(timer)
  }, [burst])

  /** Compra o equipa y pinta la vista que devuelve el backend. */
  const act = async (action: 'purchase' | 'equip', itemId: string) => {
    if (!user?.id || busy) return
    setBusy(itemId)
    setError('')
    try {
      const res = await fetch(`/api/students/${user.id}/store/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      })
      const data = await readJson<StoreView & { error?: string }>(res)
      if (!res.ok) throw new Error(data?.error ?? 'La acción no se pudo completar.')
      if (data) {
        setView(data)
        publishStoreView(data, user.id)
        if (action === 'purchase') setBurst(Date.now())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La acción no se pudo completar.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="relative min-h-[100vh] w-full overflow-hidden">
      {/* El mismo fondo que el resto de módulos (el azul), con la cascada de
          monedas de la tienda por encima. */}
      <ModuleBackdrop />
      <CoinRain />
      {burst > 0 && <CoinRain key={burst} variant="burst" />}

      <div className="relative z-10 min-h-screen p-4 pt-16 font-mono max-w-5xl mx-auto space-y-8 animate-fade-in sm:p-8 sm:pt-16 lg:pt-8">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="font-body text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
              TIENDA
            </h1>
            <p className="text-[11px] text-slate-500 uppercase tracking-widest mt-2">
              Gana monedas en el pase y en los retos · gástalas aquí
            </p>
          </div>

          <div className="flex items-stretch gap-2 sm:gap-3">
            <div className="flex items-center gap-2.5 rounded-2xl border border-amber/30 bg-gradient-to-br from-amber/15 via-amber/5 to-transparent px-4 py-2.5 sm:gap-3 sm:px-5 sm:py-3">
              <Coins className="h-6 w-6 text-amber" />
              <div>
                <p className="text-[9px] uppercase tracking-[0.2em] text-amber/70">Monedas</p>
                <p className="text-2xl font-bold leading-none text-amber">{view ? view.balance : '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl border border-emerald/25 bg-emerald/5 px-4 py-2.5 sm:gap-3 sm:px-5 sm:py-3">
              <Shield className="h-5 w-5 text-emerald" />
              <div>
                <p className="text-[9px] uppercase tracking-[0.2em] text-emerald/70">Escudos</p>
                <p className="text-2xl font-bold leading-none text-emerald">{view ? view.shields : '—'}</p>
              </div>
            </div>
          </div>
        </header>

        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-500 gap-2 text-xs uppercase tracking-widest">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        )}

        {!loading && error && <p className="text-coral text-sm">{error}</p>}

        {!loading && view && (
          <div className="space-y-8">
            {STORE_SECTIONS.map((section, index) => {
              const allItems = view.items.filter(item => item.kind === section.kind)
              if (allItems.length === 0) return null
              const Icon = KIND_ICON[section.kind]

              // Los marcos se paginan; las demás secciones caben enteras.
              const paginada = section.kind === 'frame' && allItems.length > FRAMES_PER_PAGE
              const pageCount = Math.max(1, Math.ceil(allItems.length / FRAMES_PER_PAGE))
              const page = Math.min(framePage, pageCount - 1)
              const items = paginada
                ? allItems.slice(page * FRAMES_PER_PAGE, (page + 1) * FRAMES_PER_PAGE)
                : allItems

              return (
                <section
                  key={section.kind}
                  className="animate-fade-in-up space-y-4 rounded-3xl border border-white/10 bg-black/25 p-4 sm:p-5"
                  style={{ animationDelay: `${index * 90}ms`, animationFillMode: 'backwards' }}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                      <Icon className="h-4 w-4 text-cyan" />
                    </span>
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">{section.title}</h2>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-500">
                      {allItems.length}
                    </span>
                    <span className="hidden h-px flex-1 bg-white/10 sm:block" />
                    <span className="hidden text-[10px] uppercase tracking-widest text-slate-600 sm:block">{section.hint}</span>
                    {paginada && (
                      <span className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setFramePage(current => Math.max(0, current - 1))}
                          disabled={page === 0}
                          aria-label="Marcos anteriores"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition-colors hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="min-w-10 text-center font-mono text-[10px] uppercase tracking-widest text-slate-500">
                          {page + 1}/{pageCount}
                        </span>
                        <button
                          type="button"
                          onClick={() => setFramePage(current => Math.min(pageCount - 1, current + 1))}
                          disabled={page === pageCount - 1}
                          aria-label="Marcos siguientes"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition-colors hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </span>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {items.map((item, itemIndex) => {
                      const canAfford = view.balance >= item.price
                      return (
                        <article
                          key={item.id}
                          data-item={item.id}
                          className={cn(
                            'animate-fade-in-up flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-4 transition-[transform,border-color,background-color] duration-300 hover:-translate-y-0.5 sm:gap-4',
                            item.equipped
                              ? 'border-cyan/50 bg-cyan/[0.07] shadow-[0_0_25px_rgba(34,211,238,0.08)]'
                              : 'border-white/10 bg-black/30 hover:border-white/25 hover:bg-black/40',
                          )}
                          style={{ animationDelay: `${index * 90 + itemIndex * 55}ms`, animationFillMode: 'backwards' }}
                        >
                          <ItemVisual item={item} avatar={avatar} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] text-white sm:text-sm">{item.label}</p>
                            <p className="mt-0.5 text-xs text-slate-500 sm:text-[11px]">{item.description}</p>
                          </div>

                          {/* En móvil la acción baja a su propia fila, a todo lo ancho */}
                          <div className="flex w-full shrink-0 items-center justify-between gap-2 pt-1 sm:w-auto sm:flex-col sm:items-end sm:gap-2 sm:pt-0">
                            {!item.consumable && !item.owned && (
                              <span className="flex items-center gap-1 text-xs uppercase tracking-widest text-amber sm:text-[10px]">
                                <Coins className="h-3 w-3" /> {item.price}
                              </span>
                            )}

                            {item.consumable ? (
                              <button
                                onClick={() => act('purchase', item.id)}
                                disabled={!canAfford || busy === item.id}
                                className={cn(
                                  'whitespace-nowrap rounded-xl border px-4 py-2.5 text-xs uppercase tracking-widest transition-colors sm:px-3.5 sm:py-2 sm:text-[10px]',
                                  canAfford
                                    ? 'border-amber/50 bg-amber/10 text-amber hover:bg-amber/20'
                                    : 'cursor-not-allowed border-white/10 text-slate-600',
                                )}
                              >
                                {canAfford ? (
                                  <span className="flex items-center gap-1">
                                    <ShoppingBag className="h-3 w-3" /> Comprar · {item.price}
                                  </span>
                                ) : (
                                  <Lock className="mx-auto h-3 w-3" />
                                )}
                              </button>
                            ) : item.kind === 'title' && item.owned ? (
                              <button
                                onClick={() => act('equip', item.id)}
                                disabled={busy === item.id}
                                className={cn(
                                  'whitespace-nowrap rounded-xl border px-4 py-2.5 text-xs uppercase tracking-widest transition-colors sm:px-3.5 sm:py-2 sm:text-[10px]',
                                  item.equipped
                                    ? 'border-white/20 text-slate-300 hover:border-coral/50 hover:text-coral'
                                    : 'border-cyan/40 text-cyan hover:bg-cyan/10',
                                )}
                              >
                                {item.equipped ? 'Quitar' : 'Equipar'}
                              </button>
                            ) : item.equipped ? (
                              <span className="flex items-center gap-1 whitespace-nowrap rounded-xl border border-cyan/40 px-4 py-2.5 text-xs uppercase tracking-widest text-cyan sm:px-3.5 sm:py-2 sm:text-[10px]">
                                <Check className="h-3 w-3" /> Puesto
                              </span>
                            ) : item.owned ? (
                              <button
                                onClick={() => act('equip', item.id)}
                                disabled={busy === item.id}
                                className="whitespace-nowrap rounded-xl border border-cyan/40 px-4 py-2.5 text-xs uppercase tracking-widest text-cyan transition-colors hover:bg-cyan/10 sm:px-3.5 sm:py-2 sm:text-[10px]"
                              >
                                Equipar
                              </button>
                            ) : (
                              <button
                                onClick={() => act('purchase', item.id)}
                                disabled={!canAfford || busy === item.id}
                                className={cn(
                                  'whitespace-nowrap rounded-xl border px-4 py-2.5 text-xs uppercase tracking-widest transition-colors sm:px-3.5 sm:py-2 sm:text-[10px]',
                                  canAfford
                                    ? 'border-amber/50 bg-amber/10 text-amber hover:bg-amber/20'
                                    : 'cursor-not-allowed border-white/10 text-slate-600',
                                )}
                              >
                                {canAfford ? (
                                  <span className="flex items-center gap-1">
                                    <ShoppingBag className="h-3 w-3" /> Comprar · {item.price}
                                  </span>
                                ) : (
                                  <Lock className="mx-auto h-3 w-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
