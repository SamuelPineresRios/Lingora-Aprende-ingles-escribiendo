/**
 * Editor del personaje: el mismo bloque voxel-art con pelo, piel, ropa y cara
 * editables.
 *
 * La vista previa va fija (derecha en escritorio, arriba en móvil) para ver
 * cada cambio sin scrollear; las piezas se agrupan en pestañas para no perder
 * el contexto. El registro guarda un skin base y aquí solo se pisa lo que se
 * toca; al guardar, la sesión se refresca y el avatar cambia en toda la app.
 */
import { ModuleBackdrop } from '@/components/ModuleBackdrop'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Dices, Loader2, Palette, RotateCcw, Scissors, Shirt, Smile } from 'lucide-react'
import {
  AVATAR_BEARDS,
  AVATAR_CHEEKS,
  AVATAR_CLOTHES_COLORS,
  AVATAR_EYEBROWS,
  AVATAR_EYES,
  AVATAR_GLASSES,
  AVATAR_HAIR_COLORS,
  AVATAR_MOUTHS,
  AVATAR_NOSES,
  AVATAR_OUTFITS,
  AVATAR_SKIN_COLORS,
  AVATAR_TOPS,
  baseAvatar,
  randomAvatarSeed,
  resolveAvatar,
  type UserAvatar,
} from '@vox/shared'
import { cn } from '@/lib/utils'
import { studentAvatarUrl } from '@/lib/avatar'
import { FrameRing } from '@/components/FrameRing'
import { useAuth } from '@/lib/hooks/useAuth'
import { useStoreView } from '@/lib/hooks/useStoreView'
import { useSeasonProgress } from '@/lib/hooks/useSeasonProgress'
import { activeFrame } from '@/lib/season'
import { equippedItem } from '@/lib/store'
import {
  BEARD_LABELS,
  CHEEK_LABELS,
  EYEBROW_LABELS,
  EYE_LABELS,
  GLASSES_LABELS,
  MOUTH_LABELS,
  NOSE_LABELS,
  OUTFIT_LABELS,
  TOP_LABELS,
} from '@/lib/avatar-options'

type TabId = 'pelo' | 'piel' | 'ropa' | 'cara'

const TABS: Array<{ id: TabId; label: string; icon: typeof Scissors }> = [
  { id: 'pelo', label: 'Pelo', icon: Scissors },
  { id: 'piel', label: 'Piel', icon: Palette },
  { id: 'ropa', label: 'Ropa', icon: Shirt },
  { id: 'cara', label: 'Cara', icon: Smile },
]

type Frame = { id: string; colors: [string, string] } | null

/** Fila de opciones; `none` añade la de no llevar nada (gafas, barba…). */
function Chips<T extends string>({
  label,
  options,
  labels,
  value,
  none = false,
  onChange,
}: {
  label: string
  options: readonly T[]
  labels: Record<T, string>
  value: T | null
  none?: boolean
  onChange: (value: T | null) => void
}) {
  const base = 'rounded-xl border px-3 py-2 text-[10px] uppercase tracking-widest transition-colors'
  const inactivo = 'border-white/10 text-slate-400 hover:border-white/30 hover:text-slate-200'
  const activo = 'border-cyan/60 bg-cyan/10 text-cyan shadow-[0_0_12px_rgba(6,182,212,0.15)]'

  return (
    <div className="space-y-2.5">
      <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-2.5">
        {none && (
          <button type="button" onClick={() => onChange(null)} className={cn(base, value === null ? activo : inactivo)}>
            Nada
          </button>
        )}
        {options.map(option => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(base, value === option ? activo : inactivo)}
          >
            {labels[option]}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Paleta curada: muestras grandes para tocar con dedo cómodamente. */
function Swatches({
  label,
  colors,
  value,
  onChange,
}: {
  label: string
  colors: readonly string[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-3">
        {colors.map(color => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            title={`#${color}`}
            aria-label={`${label} #${color}`}
            className={cn(
              'h-10 w-10 rounded-full border-2 transition-all hover:scale-110 lg:h-11 lg:w-11',
              value === color
                ? 'scale-110 border-white shadow-[0_0_14px_rgba(255,255,255,0.35)] ring-2 ring-cyan/50 ring-offset-2 ring-offset-slate-950'
                : 'border-white/20',
            )}
            style={{ backgroundColor: `#${color}` }}
          />
        ))}
      </div>
    </div>
  )
}

function Panel({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="space-y-6 rounded-3xl border border-white/10 bg-black/25 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-200">{title}</h2>
        <p className="text-[10px] uppercase tracking-widest text-slate-600">{hint}</p>
      </div>
      {children}
    </section>
  )
}

/** Vista previa; en compacto se pinta en la franja fija del móvil. */
function Preview({
  avatar,
  frame,
  name,
  dirty,
  saving,
  error,
  compact = false,
  onRandom,
  onBase,
  onSave,
}: {
  avatar: UserAvatar
  frame: Frame
  name: string
  dirty: boolean
  saving: boolean
  error: string
  compact?: boolean
  onRandom: () => void
  onBase: () => void
  onSave: () => void
}) {
  const size = compact ? 104 : 360
  const image = <img src={studentAvatarUrl(avatar)} alt="Tu personaje" className="h-full w-full" />
  const marco = frame ? (
    <FrameRing frameId={frame.id} colors={frame.colors} size={size}>
      {image}
    </FrameRing>
  ) : (
    <div className="rounded-full border-2 border-dashed border-cyan/30 p-2" style={{ width: size, height: size }}>
      <div className="h-full w-full overflow-hidden rounded-full bg-slate-950">{image}</div>
    </div>
  )

  const botonBase = 'flex h-10 w-10 items-center justify-center rounded-xl border transition-colors'
  const acciones = (
    <>
      <button
        type="button"
        onClick={onRandom}
        title="Sorpréndeme"
        className={cn(botonBase, 'border-violet/50 bg-violet/10 text-violet hover:bg-violet/20')}
      >
        <Dices className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onBase}
        title="Volver a la base"
        className={cn(botonBase, 'border-white/15 text-slate-300 hover:border-white/30')}
      >
        <RotateCcw className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || saving}
        title="Guardar personaje"
        className={cn(
          botonBase,
          dirty ? 'border-cyan/50 bg-cyan/10 text-cyan hover:bg-cyan/20' : 'cursor-not-allowed border-white/10 text-slate-600',
        )}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </button>
    </>
  )

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/70 p-3 backdrop-blur-xl sm:gap-4">
        <div className="shrink-0">{marco}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-white">{name}</p>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">
            {frame ? 'Con tu marco' : 'Sin marco'}
            {dirty ? ' · sin guardar' : ''}
          </p>
          {error && <p className="truncate text-[10px] text-coral">{error}</p>}
        </div>
        <div className="flex shrink-0 gap-1.5">{acciones}</div>
      </div>
    )
  }

  return (
    <div className="space-y-5 rounded-3xl border border-white/10 bg-black/40 p-6 text-center backdrop-blur-md">
      <div className="flex justify-center">{marco}</div>

      <div>
        <p className="text-sm text-white">{name}</p>
        <p className="text-[10px] uppercase tracking-widest text-slate-500">
          {frame ? 'Con tu marco equipado' : 'Sin marco equipado'}
          {dirty ? ' · cambios sin guardar' : ''}
        </p>
      </div>

      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={onRandom}
          className="flex items-center gap-1.5 rounded-xl border border-violet/50 bg-violet/10 px-3 py-2 text-[10px] uppercase tracking-widest text-violet transition-colors hover:bg-violet/20"
        >
          <Dices className="h-3.5 w-3.5" /> Sorpréndeme
        </button>
        <button
          type="button"
          onClick={onBase}
          className="flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-[10px] uppercase tracking-widest text-slate-300 transition-colors hover:border-white/30"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Base
        </button>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || saving}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[11px] uppercase tracking-widest transition-colors',
          dirty ? 'border-cyan/50 bg-cyan/10 text-cyan hover:bg-cyan/20' : 'cursor-not-allowed border-white/10 text-slate-600',
        )}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {saving ? 'Guardando…' : 'Guardar personaje'}
      </button>

      {error && <p className="text-xs text-coral">{error}</p>}
      {!dirty && !error && (
        <p className="text-[10px] uppercase tracking-widest text-slate-600">Toca cualquier pieza para empezar</p>
      )}

      <Link
        to="/profile"
        className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver al perfil
      </Link>
    </div>
  )
}

export default function AvatarPage() {
  const { user, refetch } = useAuth()
  const navigate = useNavigate()
  const shop = useStoreView(user?.id)
  const season = useSeasonProgress(user?.id)
  const [tab, setTab] = useState<TabId>('pelo')
  const [draft, setDraft] = useState<UserAvatar | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const avatar = draft ?? resolveAvatar({ id: user?.id ?? 'letoura', avatar: user?.avatar ?? null })
  const equipped = equippedItem(shop, 'frame') ?? activeFrame(season)
  const frame: Frame = equipped ? { id: equipped.id, colors: equipped.colors as [string, string] } : null
  const name = user?.full_name ?? 'Tu personaje'
  const set = (patch: Partial<UserAvatar>) => setDraft({ ...avatar, ...patch })

  const save = async () => {
    if (!user?.id || !draft || saving) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/students/${user.id}/avatar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo guardar el personaje.')
      await refetch()
      navigate('/profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el personaje.')
    } finally {
      setSaving(false)
    }
  }

  const previewProps = {
    avatar,
    frame,
    name,
    dirty: draft !== null,
    saving,
    error,
    onRandom: () => setDraft(baseAvatar(randomAvatarSeed())),
    onBase: () => setDraft(baseAvatar(user?.id ?? 'letoura')),
    onSave: save,
  }

  return (
    <div className="relative h-[calc(100dvh-4rem)] w-full overflow-hidden bg-black/90 lg:h-dvh">
      <ModuleBackdrop />
      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col gap-5 p-5 pt-6 font-mono animate-fade-in lg:p-8">
        <header className="flex shrink-0 flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="bg-clip-text font-body text-4xl font-bold text-transparent bg-gradient-to-r from-white to-slate-400 drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
              TU PERSONAJE
            </h1>
            <p className="mt-2 text-[11px] uppercase tracking-widest text-slate-500">
              Pelo, piel, ropa y cara · el mismo bloque de siempre
            </p>
          </div>
          <Link
            to="/profile"
            className="hidden items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500 transition-colors hover:text-white lg:flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al perfil
          </Link>
        </header>

        <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_460px]">
          {/* Piezas */}
          <div className="flex min-h-0 min-w-0 flex-col">
            {/* Móvil: el skin vive arriba, en el flujo, y no se va al scrollear */}
            <div className="shrink-0 lg:hidden">
              <Preview {...previewProps} compact />
            </div>
            <div role="tablist" className="mt-4 flex shrink-0 flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/30 p-2 lg:mt-0">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[11px] uppercase tracking-widest transition-colors',
                    tab === id
                      ? 'border-cyan/40 bg-cyan/10 text-cyan'
                      : 'border-transparent text-slate-400 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            {tab === 'pelo' && (
              <Panel title="Pelo" hint="peinado y color">
                <Chips label="Peinado" options={AVATAR_TOPS} labels={TOP_LABELS} value={avatar.top} onChange={value => value && set({ top: value })} />
                <Swatches label="Color del pelo" colors={AVATAR_HAIR_COLORS} value={avatar.topColor} onChange={topColor => set({ topColor })} />
              </Panel>
            )}

            {tab === 'piel' && (
              <Panel title="Piel" hint="tono del bloque">
                <Swatches label="Tono" colors={AVATAR_SKIN_COLORS} value={avatar.skinColor} onChange={skinColor => set({ skinColor })} />
              </Panel>
            )}

            {tab === 'ropa' && (
              <Panel title="Ropa" hint="conjunto y colores">
                <Chips label="Conjunto" options={AVATAR_OUTFITS} labels={OUTFIT_LABELS} value={avatar.outfit} onChange={value => value && set({ outfit: value })} />
                <div className="grid gap-6 sm:grid-cols-2">
                  <Swatches label="Camiseta" colors={AVATAR_CLOTHES_COLORS} value={avatar.shirtColor} onChange={shirtColor => set({ shirtColor })} />
                  <Swatches label="Chaqueta" colors={AVATAR_CLOTHES_COLORS} value={avatar.jacketColor} onChange={jacketColor => set({ jacketColor })} />
                  <Swatches label="Pantalón" colors={AVATAR_CLOTHES_COLORS} value={avatar.pantsColor} onChange={pantsColor => set({ pantsColor })} />
                  <Swatches label="Zapatos" colors={AVATAR_CLOTHES_COLORS} value={avatar.shoesColor} onChange={shoesColor => set({ shoesColor })} />
                  <Swatches label="Gorro" colors={AVATAR_CLOTHES_COLORS} value={avatar.hatColor} onChange={hatColor => set({ hatColor })} />
                </div>
              </Panel>
            )}

            {tab === 'cara' && (
              <Panel title="Cara" hint="gestos y complementos">
                <div className="grid gap-6 sm:grid-cols-2">
                  <Chips label="Ojos" options={AVATAR_EYES} labels={EYE_LABELS} value={avatar.eyes} onChange={value => value && set({ eyes: value })} />
                  <Chips label="Cejas" options={AVATAR_EYEBROWS} labels={EYEBROW_LABELS} value={avatar.eyebrows} onChange={value => value && set({ eyebrows: value })} />
                  <Chips label="Boca" options={AVATAR_MOUTHS} labels={MOUTH_LABELS} value={avatar.mouth} onChange={value => value && set({ mouth: value })} />
                  <Chips label="Nariz" options={AVATAR_NOSES} labels={NOSE_LABELS} value={avatar.nose} onChange={value => value && set({ nose: value })} />
                  <Chips label="Mejillas" options={AVATAR_CHEEKS} labels={CHEEK_LABELS} value={avatar.cheeks} none onChange={value => set({ cheeks: value })} />
                  <Chips label="Gafas" options={AVATAR_GLASSES} labels={GLASSES_LABELS} value={avatar.glasses} none onChange={value => set({ glasses: value })} />
                  <Chips label="Barba" options={AVATAR_BEARDS} labels={BEARD_LABELS} value={avatar.beard} none onChange={value => set({ beard: value })} />
                </div>
              </Panel>
            )}
            </div>
          </div>

          {/* Skin siempre a la vista: columna derecha sin scroll */}
          <aside className="hidden min-h-0 lg:block lg:overflow-y-auto">
            <Preview {...previewProps} />
          </aside>
        </div>
      </div>
    </div>
  )
}
