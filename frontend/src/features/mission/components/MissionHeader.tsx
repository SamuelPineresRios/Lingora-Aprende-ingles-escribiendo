import { XpBar } from '@/components/XpBar'
import { HeartMeter } from '@/components/GrammarToast'
import { cn } from '@/lib/utils'
import type { StudentProgress } from '@/lib/hooks/useProgress'
import { TOTAL_HEARTS } from '../constants'
import type { Mission, MissionMode } from '../types'

interface MissionHeaderProps {
  mission: Mission
  progress: StudentProgress | null
  missionProgress: number
  mode: MissionMode
  hearts: number
  onBack: () => void
}

export function MissionHeader({
  mission,
  progress,
  missionProgress,
  mode,
  hearts,
  onBack,
}: MissionHeaderProps) {
  return (
    <header className="px-4 pt-5 shrink-0 space-y-2 sm:pt-4">
      <div className="flex items-center gap-3 py-1">
        <button onClick={onBack} className="text-slate-light hover:text-foreground transition-colors">
          ←
        </button>
        <div className="flex-1 text-center text-cyan text-xs uppercase tracking-widest">{mission.title}</div>
        <XpBar progress={progress} className="hidden sm:flex" />
      </div>

      <div className="bg-gradient-to-r from-cyan-950/60 to-slate-900/60 backdrop-blur-sm p-3 rounded-lg border border-cyan/30 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.7rem] md:text-[0.75rem] text-cyan-300 font-bold uppercase tracking-widest">
            🎯 Objetivo
          </span>
        </div>
        <p className="text-[0.8rem] md:text-sm text-cyan-50 leading-snug">{mission.objective}</p>
      </div>

      <div className="relative">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[0.7rem] md:text-[0.75rem] text-slate-400 uppercase tracking-widest">
            Progreso
          </span>
          <span
            className={cn(
              'text-[0.8rem] md:text-sm font-bold',
              missionProgress >= 100 ? 'text-emerald animate-pulse' : 'text-cyan',
            )}
          >
            {missionProgress}%
          </span>
        </div>
        <div className="overflow-hidden h-2 text-xs flex rounded bg-slate-800 border border-slate-700/50">
          <div
            style={{ width: `${missionProgress}%` }}
            className={cn(
              'flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-700 ease-out',
              missionProgress >= 100
                ? 'bg-emerald shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                : 'bg-cyan shadow-[0_0_5px_rgba(6,182,212,0.5)]',
            )}
          />
        </div>
        {mode === 'evaluation' && (
          <div className="flex items-center justify-between gap-3">
            <HeartMeter hearts={hearts} total={TOTAL_HEARTS} />
          </div>
        )}
      </div>
    </header>
  )
}
