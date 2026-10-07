/**
 * Tienda de monedas: marcos, títulos, temas y escudos de racha.
 *
 * El catálogo y el saldo los sirve el backend; comprar y equipar se reflejan
 * al momento con la vista que devuelve cada acción.
 */
import { useEffect, useState } from 'react'
import { Check, Coins, Loader2, Lock, Shield, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Canvas3DBackground } from '@/components/Canvas3DBackground'
import { readJson } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'
import { STORE_SECTIONS, type StoreItem, type StoreView } from '@/lib/store'

/** Visual del artículo: marco, título, tema o escudo. */
function ItemVisual({ item }: { item: StoreItem }) {
  if (item.kind === 'frame' && item.colors) {
    return (
      <span
        className="h-12 w-12 rounded-full p-[4px]"
        style={{ backgroundImage: `linear-gradient(135deg, ${item.colors[0]}, ${item.colors[1]})` }}
      >
        <span className="block h-full w-full rounded-full bg-slate-950" />
      </span>
    )
  }
  if (item.kind === 'title') {
    return (
      <span className="flex h-12 min-w-12 items-center justify-center rounded-full border border-violet/40 bg-violet/10 px-2 text-[10px] font-bold uppercase tracking-widest text-violet">
        {item.text}
      </span>
    )
  }
  if (item.kind === 'theme' && item.accent) {
    return (
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full border-2"
        style={{ borderColor: item.accent, background: `${item.accent}22` }}
      >
        <span className="h-4 w-4 rounded-full" style={{ background: item.accent }} />
      </span>
    )
  }
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald/40 bg-emerald/10">
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
        if (!cancelled) setView(data)
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
      if (data) setView(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La acción no se pudo completar.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="relative min-h-[100vh] w-full bg-black/90">
      <Canvas3DBackground className="opacity-60" />

      <div className="relative z-10 min-h-screen p-8 font-mono max-w-5xl mx-auto space-y-8 animate-fade-in pt-16 lg:pt-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-body text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
              TIENDA
            </h1>
            <p className="text-[11px] text-slate-500 uppercase tracking-widest mt-2">
              Gana monedas en el pase y en los retos · gástalas aquí
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-xl border border-emerald/30 bg-emerald/5 px-4 py-2 text-emerald text-sm">
              <Shield className="h-4 w-4" /> {view?.shields ?? 0}
            </span>
            <span className="flex items-center gap-1.5 rounded-xl border border-amber/30 bg-amber/5 px-4 py-2 text-amber text-sm font-bold">
              <Coins className="h-4 w-4" /> {view?.balance ?? 0}
            </span>
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
            {STORE_SECTIONS.map(section => {
              const items = view.items.filter(item => item.kind === section.kind)
              if (items.length === 0) return null
              return (
                <section key={section.kind} className="space-y-3">
                  <div className="flex items-baseline gap-3">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">{section.title}</h2>
                    <span className="text-[10px] uppercase tracking-widest text-slate-600">{section.hint}</span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {items.map(item => {
                      const canAfford = view.balance >= item.price
                      return (
                        <article
                          key={item.id}
                          className={cn(
                            'flex items-center gap-4 rounded-2xl border px-4 py-3',
                            item.equipped ? 'border-cyan/50 bg-cyan/10' : 'border-white/10 bg-black/25',
                          )}
                        >
                          <ItemVisual item={item} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-white">{item.label}</p>
                            <p className="text-[11px] text-slate-500">{item.description}</p>
                            {!item.consumable && (
                              <p className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-widest text-amber">
                                <Coins className="h-3 w-3" /> {item.price}
                              </p>
                            )}
                          </div>

                          {item.consumable ? (
                            <button
                              onClick={() => act('purchase', item.id)}
                              disabled={!canAfford || busy === item.id}
                              className={cn(
                                'shrink-0 rounded-lg border px-3 py-2 text-[10px] uppercase tracking-widest transition-colors',
                                canAfford
                                  ? 'border-amber/50 bg-amber/10 text-amber hover:bg-amber/20'
                                  : 'border-white/10 text-slate-600 cursor-not-allowed',
                              )}
                            >
                              {canAfford ? `Comprar · ${item.price}` : <Lock className="mx-auto h-3 w-3" />}
                            </button>
                          ) : item.equipped ? (
                            <span className="flex shrink-0 items-center gap-1 rounded-lg border border-cyan/40 px-3 py-2 text-[10px] uppercase tracking-widest text-cyan">
                              <Check className="h-3 w-3" /> Puesto
                            </span>
                          ) : item.owned ? (
                            <button
                              onClick={() => act('equip', item.id)}
                              disabled={busy === item.id}
                              className="shrink-0 rounded-lg border border-cyan/40 px-3 py-2 text-[10px] uppercase tracking-widest text-cyan hover:bg-cyan/10 transition-colors"
                            >
                              Equipar
                            </button>
                          ) : (
                            <button
                              onClick={() => act('purchase', item.id)}
                              disabled={!canAfford || busy === item.id}
                              className={cn(
                                'shrink-0 rounded-lg border px-3 py-2 text-[10px] uppercase tracking-widest transition-colors',
                                canAfford
                                  ? 'border-amber/50 bg-amber/10 text-amber hover:bg-amber/20'
                                  : 'border-white/10 text-slate-600 cursor-not-allowed',
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
