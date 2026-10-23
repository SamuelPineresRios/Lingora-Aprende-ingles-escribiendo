/**
 * Modal de corrección gramatical: el envío no se hace, se explica el error
 * con la versión correcta y una micro-lección de 60 s, y el alumno vuelve a
 * escribir la frase para continuar.
 */
import { ArrowRight, BookOpen, X } from 'lucide-react'
import { lessonFor } from '@/lib/grammar-lessons'

export interface GrammarCorrection {
  original: string
  corrected: string
  explanation: string
  errorType: string
}

export function GrammarCorrectionModal({
  correction,
  onClose,
}: {
  correction: GrammarCorrection
  onClose: () => void
}) {
  const lesson = lessonFor(correction.errorType)

  return (
    <div data-grammar-modal className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg space-y-5 rounded-2xl border border-amber/40 bg-slate-950/95 p-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber">No se envió</p>
            <h2 className="mt-1 font-body text-xl font-bold text-white">Revisa la gramática</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar la corrección"
            className="text-slate-400 transition-colors hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-2 rounded-xl border border-white/10 bg-black/40 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-coral">Tu frase</p>
          <p className="text-sm text-slate-400 line-through decoration-coral/50">{correction.original}</p>
          <p className="mt-3 flex items-start gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald">
            Correcto
          </p>
          <p className="flex items-start gap-2 text-sm leading-relaxed text-emerald-200">
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" />
            {correction.corrected}
          </p>
          <p className="pt-1 text-[12px] leading-relaxed text-slate-400">{correction.explanation}</p>
        </div>

        <div className="space-y-2 rounded-xl border border-cyan/25 bg-cyan/5 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan">
            <BookOpen className="h-3.5 w-3.5" /> Micro-lección de 60 s · {lesson.title}
          </p>
          <p className="text-[12px] leading-relaxed text-slate-300">{lesson.rule}</p>
          <ul className="space-y-1.5 pt-1">
            {lesson.examples.map(example => (
              <li key={example.en} className="text-[12px] leading-relaxed">
                <span className="text-white">{example.en}</span>{' '}
                <span className="text-slate-500">— {example.es}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] leading-relaxed text-slate-500">
          Al cerrar no se enviará tu mensaje: tendrás que escribir de nuevo la frase correcta para continuar.
        </p>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-amber py-3 text-[11px] font-bold uppercase tracking-widest text-black transition-colors hover:bg-amber-light"
        >
          Entendido, la reescribo
        </button>
      </div>
    </div>
  )
}
