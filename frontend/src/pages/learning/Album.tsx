/**
 * Álbum: todas las escenas como colección. Cada misión completada desbloquea
 * su carta (personaje + escena); las colecciones van por nivel y su premio es
 * la medalla del nivel. Las cartas enlazan a su misión para jugarla.
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Album as AlbumIcon, Lock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { readJson } from '@/lib/api'
import { useAuth } from '@/lib/hooks/useAuth'
import { characterAvatarUrl, type AvatarGender } from '@/lib/avatar'
import { MedalBadge } from '@/components/progress/MedalBadge'
import { ModuleBackdrop } from '@/components/layout/ModuleBackdrop'

interface AlbumCharacter {
  mission_id: string
  title: string
  level: string
  character_name: string
  emoji: string | null
  gender: AvatarGender | null
  scene_title: string | null
  unlocked: boolean
}

interface AlbumCollection {
  level: string
  total: number
  unlocked: number
  medal: { id: string; name: string; icon: string; earned: boolean }
}

interface AlbumPagination {
  level: string
  page: number
  page_size: number
  total: number
  pages: number
}

interface AlbumView {
  total: number
  unlocked: number
  collections: AlbumCollection[]
  characters: AlbumCharacter[]
  pagination: AlbumPagination
}

export default function AlbumPage() {
  const { user } = useAuth()
  const [album, setAlbum] = useState<AlbumView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const cardsRef = useRef<HTMLElement | null>(null)
  const skipScroll = useRef(true)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    setLoading(true)
    setError('')

    const params = new URLSearchParams({ level: filter, page: String(page) })
    fetch(`/api/students/${user.id}/album?${params.toString()}`)
      .then(readJson<AlbumView>)
      .then(data => {
        if (!cancelled && data) setAlbum(data)
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudo cargar el álbum.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id, filter, page])

  useEffect(() => {
    if (skipScroll.current) {
      skipScroll.current = false
      return
    }
    cardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [filter, page])

  const characters = album?.characters ?? []
  const pct = album && album.total > 0 ? Math.round((album.unlocked / album.total) * 100) : 0

  return (
    <div className="relative min-h-[100vh] w-full bg-black/90">
      <ModuleBackdrop />

      <div className="relative z-10 min-h-screen p-4 font-mono max-w-6xl mx-auto sm:p-8 space-y-8 animate-fade-in pt-16 lg:pt-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-body text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
              ÁLBUM
            </h1>
            <p className="text-[11px] text-slate-500 uppercase tracking-widest mt-2">
              {album ? `${album.unlocked} de ${album.total} escenas desbloqueadas` : 'Tu colección de escenas'}
            </p>
          </div>
          {album && (
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">{pct} %</span>
          )}
        </header>

        {album && (
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-cyan transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        )}

        {loading && !album && (
          <div className="flex items-center justify-center py-20 text-slate-500 gap-2 text-xs uppercase tracking-widest">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        )}

        {error && <p className="text-coral text-sm">{error}</p>}

        {album && (
          <>
            {/* Colecciones por nivel, con la medalla como premio */}
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {album.collections.map(collection => (
                <div
                  key={collection.level}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border px-4 py-3',
                    collection.unlocked >= collection.total
                      ? 'border-amber/40 bg-amber/5'
                      : 'border-white/10 bg-black/20',
                  )}
                >
                  <MedalBadge medal={{ icon: collection.medal.icon, earned: collection.medal.earned }} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">
                      {collection.level}{' '}
                      <span className="font-mono text-[10px] text-slate-500">
                        {collection.unlocked}/{collection.total}
                      </span>
                    </p>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', collection.medal.earned ? 'bg-amber' : 'bg-cyan')}
                        style={{ width: `${Math.round((collection.unlocked / collection.total) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 truncate text-[10px] uppercase tracking-widest text-slate-500">
                      {collection.medal.earned ? collection.medal.name : `Premio: ${collection.medal.name}`}
                    </p>
                  </div>
                </div>
              ))}
            </section>

            {/* Filtros por nivel */}
            <div className="flex flex-wrap items-center gap-2">
              {['all', ...album.collections.map(collection => collection.level)].map(level => (
                <button
                  key={level}
                  onClick={() => { setFilter(level); setPage(1) }}
                  className={cn(
                    'rounded-lg border px-4 py-2 text-[11px] uppercase tracking-widest transition-colors',
                    filter === level
                      ? 'border-cyan/50 bg-cyan/10 text-cyan'
                      : 'border-white/10 text-slate-400 hover:border-white/30 hover:text-white',
                  )}
                >
                  {level === 'all' ? 'Todas' : level}
                </button>
              ))}
            </div>

            {/* Cartas: 10 por página */}
            <section
              ref={cardsRef}
              aria-busy={loading}
              className={cn(
                'grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 lg:grid-cols-5',
                loading && 'pointer-events-none opacity-40',
              )}
            >
              {characters.map(card => (
                <Link
                  key={card.mission_id}
                  to={`/mission/${card.mission_id}`}
                  title={card.unlocked ? `Jugar «${card.title}»` : 'Completa la misión para desbloquearla'}
                  className={cn(
                    'group relative flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-center transition-colors',
                    card.unlocked
                      ? 'border-white/10 bg-black/20 hover:border-cyan/40 hover:bg-cyan/5'
                      : 'border-white/5 bg-black/30',
                  )}
                >
                  {!card.unlocked && <Lock className="absolute right-3 top-3 h-3.5 w-3.5 text-slate-600" />}
                  <img
                    src={characterAvatarUrl(card.character_name, card.gender ?? undefined)}
                    alt=""
                    className={cn('h-16 w-16', card.unlocked ? '' : 'opacity-30 grayscale')}
                  />
                  <div className="min-w-0">
                    <p className={cn('truncate text-[11px] font-bold uppercase tracking-widest', card.unlocked ? 'text-cyan' : 'text-slate-600')}>
                      {card.level}
                    </p>
                    <p className={cn('mt-0.5 line-clamp-2 text-xs', card.unlocked ? 'text-white' : 'text-slate-500')}>
                      {card.unlocked ? card.scene_title ?? card.title : card.title}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-slate-600">
                      {card.unlocked ? card.character_name : 'Por descubrir'}
                    </p>
                  </div>
                </Link>
              ))}
            </section>

            {!loading && characters.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed border-white/5 rounded-2xl space-y-2">
                <AlbumIcon className="h-8 w-8 text-slate-600 mx-auto" />
                <p className="text-slate-400 text-xs uppercase tracking-widest">Sin cartas en este nivel</p>
              </div>
            )}

            {album.pagination.pages > 1 && (
              <nav
                aria-label="Paginación del álbum"
                className="flex flex-wrap items-center justify-center gap-3 pt-1"
              >
                <button
                  onClick={() => setPage(current => Math.max(1, current - 1))}
                  disabled={page <= 1 || loading}
                  className="rounded-lg border border-white/10 px-4 py-2 text-[11px] uppercase tracking-widest text-slate-300 transition-colors hover:border-cyan/40 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ← Anterior
                </button>
                <span className="text-[10px] uppercase tracking-widest text-slate-500">
                  Página {page} de {album.pagination.pages} · {album.pagination.page_size} por página
                </span>
                <button
                  onClick={() => setPage(current => Math.min(album.pagination.pages, current + 1))}
                  disabled={page >= album.pagination.pages || loading}
                  className="rounded-lg border border-white/10 px-4 py-2 text-[11px] uppercase tracking-widest text-slate-300 transition-colors hover:border-cyan/40 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Siguiente →
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  )
}
