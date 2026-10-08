/**
 * Progreso del alumno: nivel, barra de XP y racha.
 *
 * - `compact`: para la cabecera del chat (nivel, barra fina y XP).
 * - `full`: panel del perfil, con racha, misiones y tiempo.
 */
import { Flame, Target, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/useAuth'
import { useThemeAccent } from '@/lib/hooks/useStoreView'
import type { StudentProgress } from '@/lib/hooks/useProgress'

interface XpBarProps {
  progress: StudentProgress | null
  variant?: 'compact' | 'full'
  className?: string
}

/** Segundos en algo legible. */
function readableTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

export function XpBar({ progress, variant = 'compact', className }: XpBarProps) {
  const { user } = useAuth()
  const accent = useThemeAccent(user?.id)

  if (!progress) return null

  const percent = progress.level_span > 0 ? Math.round((progress.level_xp / progress.level_span) * 100) : 0
  const fillStyle = accent ? { background: accent, boxShadow: `0 0 10px ${accent}99` } : undefined

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1',
          className,
        )}
        title={`Nivel ${progress.level} · ${progress.total_xp} XP · faltan ${progress.xp_to_next} XP`}
      >
        <span className="font-mono text-[10px] uppercase tracking-widest text-cyan" style={accent ? { color: accent } : undefined}>
          Nv {progress.level}
        </span>
        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10">
          <span
            className="block h-full rounded-full bg-cyan transition-all duration-700"
            style={{ width: `${percent}%`, ...fillStyle }}
          />
        </span>
        <span className="font-mono text-[10px] text-slate-400">{progress.total_xp} XP</span>
      </div>
    )
  }

  const stats = [
    { icon: Flame, label: progress.streak === 1 ? '1 día seguido' : `${progress.streak} días seguidos` },
    { icon: Target, label: progress.missions_completed === 1 ? '1 misión' : `${progress.missions_completed} misiones` },
    { icon: Timer, label: readableTime(progress.writing_seconds) },
  ]

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Nivel</p>
          <p className="text-3xl font-bold text-white">{progress.level}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm text-cyan" style={accent ? { color: accent } : undefined}>
            {progress.total_xp} XP
          </p>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">
            {progress.xp_to_next === 0
              ? 'nivel completo'
              : `faltan ${progress.xp_to_next} XP`}
          </p>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-cyan shadow-[0_0_10px_rgba(6,182,212,0.6)] transition-all duration-700"
          style={{ width: `${percent}%`, ...fillStyle }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-slate-400">
        {stats.map(stat => (
          <span key={stat.label} className="flex items-center gap-1.5">
            <stat.icon className="h-3.5 w-3.5 text-slate-500" />
            {stat.label}
          </span>
        ))}
        {progress.xp_today > 0 && (
          <span className="text-emerald">+{progress.xp_today} XP hoy</span>
        )}
      </div>
    </div>
  )
}
