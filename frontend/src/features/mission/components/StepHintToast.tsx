/**
 * Aviso suave de paso incompleto.
 *
 * Sustituye al corrección completa cuando el alumno aún está cerca: le dice
 * QUÉ le falta, no cómo decirlo. Se va solo, para no ensuciar la pantalla.
 */
import { useEffect } from 'react'
import { X } from 'lucide-react'

export interface StepHint {
  id: string
  /** Lo que falta para completar el paso, en español y muy corto. */
  missing: string
}

/** Milisegundos que permanece antes de desaparecer por su cuenta. */
const AUTO_DISMISS_MS = 10_000

function StepHintToast({ hint, onDismiss }: { hint: StepHint; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(hint.id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [hint.id, onDismiss])

  return (
    <div
      role="status"
      className="pointer-events-auto flex w-[min(18rem,calc(100vw-2rem))] items-start gap-2 rounded-xl border border-cyan/35 bg-slate-900/95 p-3 shadow-[0_0_25px_rgba(0,0,0,0.55)] backdrop-blur-sm animate-in slide-in-from-right-5 fade-in duration-300"
    >
      <span className="text-base leading-none">🧭</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan">Sigue la conversación</p>
        <p className="mt-0.5 text-[12px] text-slate-200">
          Aún te falta <span className="font-semibold text-cyan">{hint.missing}</span>.
        </p>
      </div>
      <button
        onClick={() => onDismiss(hint.id)}
        aria-label="Cerrar aviso"
        className="text-slate-500 transition-colors hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/** Pila de avisos, anclada bajo las notificaciones de corrección. */
export function StepHintStack({
  hints,
  onDismiss,
}: {
  hints: StepHint[]
  onDismiss: (id: string) => void
}) {
  if (hints.length === 0) return null

  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 top-4 z-[190] flex flex-col gap-2">
      {hints.map(hint => (
        <StepHintToast key={hint.id} hint={hint} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
