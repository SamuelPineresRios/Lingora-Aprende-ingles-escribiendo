import { lessonFor } from '@/lib/grammar-lessons'
import type { MissionMode, MissionRewrite } from '../types'

interface RewritePanelProps {
  mode: MissionMode
  rewrite: MissionRewrite
  hintLevel: number
  notice: string | null
  onHint: () => void
}

export function RewritePanel({ mode, rewrite, hintLevel, notice, onHint }: RewritePanelProps) {
  return (
    <div className="mb-2 space-y-2 rounded-xl border border-amber/40 bg-amber/10 px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber">
          Corrige el error y reescribe la frase
        </p>
        {mode !== 'evaluation' && (
          <button
            onClick={onHint}
            disabled={hintLevel >= 3}
            className="rounded-lg border border-amber/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber transition-colors hover:bg-amber/10 disabled:opacity-40"
          >
            {hintLevel === 0 ? 'Pista' : `Pista ${hintLevel}/3`}
          </button>
        )}
      </div>
      {hintLevel >= 1 && (
        <p className="text-[12px] leading-relaxed text-slate-300">
          Regla: {lessonFor(rewrite.errorType).rule}
        </p>
      )}
      {hintLevel >= 2 && (
        <p className="text-[12px] leading-relaxed text-slate-400">
          Empieza así:{' '}
          <span className="text-white">{rewrite.corrected.split(/\s+/).slice(0, 3).join(' ')}…</span>
        </p>
      )}
      {hintLevel >= 3 && (
        <p className="text-[13px] font-semibold leading-relaxed text-emerald-200">{rewrite.corrected}</p>
      )}
      {notice && <p className="text-[11px] text-coral">{notice}</p>}
    </div>
  )
}
