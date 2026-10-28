import { X } from 'lucide-react'
import type { MissionHint } from '../types'

interface MissionHintsModalProps {
  open: boolean
  hints: MissionHint[]
  onClose: () => void
}

export function MissionHintsModal({ open, hints, onClose }: MissionHintsModalProps) {
  if (!open) return null

  return (
    <div data-hints-modal className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-violet/40 bg-slate-950/95 p-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-violet">Dos pistas</p>
            <h3 className="mt-0.5 font-body text-lg font-bold text-white">Así podrías responder</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar las pistas"
            className="text-slate-400 transition-colors hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <ol className="space-y-2.5">
          {hints.map((hint, index) => (
            <li key={index} className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
              <p className="text-sm leading-relaxed text-white">{hint.en}</p>
              <p className="mt-0.5 text-[12px] text-slate-500">{hint.es}</p>
            </li>
          ))}
        </ol>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Son ideas, no la respuesta obligatoria: escríbelo tú con tus palabras.
        </p>
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-violet py-3 text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-violet/80"
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
